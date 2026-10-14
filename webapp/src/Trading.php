<?php
declare(strict_types=1);

/**
 * Motore del paper trading: denaro virtuale, prezzi dagli snapshot di metà giornata e chiusura.
 * Tutti gli importi sono espressi nella valuta del conto dell'utente (EUR o USD).
 */
final class Trading {
    public const MAX_PENDING = 20;
    public const MAX_QTY = 1000000;
    public const MAX_AGE_SEC = 5 * 86400;   // oltre questa età i prezzi sono considerati non aggiornati

    private static ?array $prices = null;

    // ------------------------------------------------------------ prezzi
    public static function priceFile(): string { return APP_ROOT . '/public_html/prices.json'; }

    public static function prices(): array {
        if (self::$prices === null) {
            $raw = @file_get_contents(self::priceFile());
            $j = $raw ? json_decode($raw, true) : null;
            if (!is_array($j) || empty($j['prices'])) throw new ApiError('Prezzi non disponibili al momento.', 503);
            self::$prices = $j;
        }
        return self::$prices;
    }

    public static function setPricesForTest(array $p): void { self::$prices = $p; }

    private static function assertFresh(array $p): void {
        $ts = strtotime((string)($p['updated'] ?? '')) ?: 0;
        if (time() - $ts > self::MAX_AGE_SEC) {
            throw new ApiError('I prezzi non sono aggiornati: operatività sospesa fino al prossimo aggiornamento.', 503);
        }
    }

    /** Cambio per convertire un importo da $from a $to (EUR/USD). */
    public static function fxRate(string $from, string $to, array $p): float {
        if ($from === $to) return 1.0;
        $eurusd = (float)($p['fx']['EURUSD'] ?? 0);
        if ($eurusd <= 0) throw new ApiError('Cambio EUR/USD non disponibile.', 503);
        return $from === 'EUR' ? $eurusd : 1.0 / $eurusd;
    }

    public static function quote(string $ticker, array $p): array {
        $q = $p['prices'][$ticker] ?? null;
        if (!$q || !isset($q['p']) || $q['p'] <= 0) throw new ApiError('Titolo non disponibile: ' . $ticker);
        return $q;
    }

    // ------------------------------------------------------------ ordini
    /** Inserisce l'ordine: immediato ('now') o in coda per il prossimo aggiornamento ('next'). */
    public static function placeOrder(array $user, string $ticker, string $side, int $qty, string $mode): array {
        $ticker = strtoupper(trim($ticker));
        if (!in_array($side, ['buy', 'sell'], true)) throw new ApiError('Operazione non valida.');
        if (!in_array($mode, ['now', 'next'], true)) throw new ApiError('Modalità di esecuzione non valida.');
        if ($qty < 1 || $qty > self::MAX_QTY) throw new ApiError('Quantità non valida.');
        $p = self::prices();
        self::assertFresh($p);
        $q = self::quote($ticker, $p);

        if ($mode === 'next') {
            $st = db()->prepare('SELECT COUNT(*) FROM orders WHERE user_id = ? AND status = \'pending\'');
            $st->execute([$user['id']]);
            if ((int)$st->fetchColumn() >= self::MAX_PENDING) throw new ApiError('Hai troppi ordini in coda (massimo ' . self::MAX_PENDING . ').');
            db()->prepare('INSERT INTO orders (user_id, ticker, market, side, qty, mode, status, created_at)
                    VALUES (?,?,?,?,?,\'next\',\'pending\',?)')
                ->execute([$user['id'], $ticker, $q['m'], $side, $qty, now_utc()]);
            return ['id' => (int)db()->lastInsertId(), 'status' => 'pending'];
        }
        $id = self::fill((int)$user['id'], $ticker, $side, $qty, null, 'now');
        return ['id' => $id, 'status' => 'executed'];
    }

    /**
     * Esegue un ordine al prezzo dello snapshot corrente, in transazione.
     * $orderId = ordine pending già esistente da completare (null: ne crea uno nuovo).
     */
    public static function fill(int $userId, string $ticker, string $side, int $qty, ?int $orderId, string $mode): int {
        $p = self::prices();
        self::assertFresh($p);
        $q = self::quote($ticker, $p);
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('SELECT * FROM users WHERE id = ? FOR UPDATE');
            $st->execute([$userId]);
            $u = $st->fetch();
            if (!$u || $u['status'] !== 'active') throw new ApiError('Account non attivo.', 403);

            $acc = $u['currency'];
            $fx = self::fxRate($q['c'], $acc, $p);
            $price = (float)$q['p'];
            $gross = round_money($qty * $price * $fx);
            $comm = (float)($q['m'] === 'IT' ? $u['commission_it'] : $u['commission_us']);
            $cash = (float)$u['cash'];
            $realized = null;

            $ps = $pdo->prepare('SELECT * FROM positions WHERE user_id = ? AND ticker = ? FOR UPDATE');
            $ps->execute([$userId, $ticker]);
            $pos = $ps->fetch() ?: null;

            if ($side === 'buy') {
                $total = $gross + $comm;
                if ($total > $cash + 1e-9) {
                    throw new ApiError('Liquidità insufficiente: servono ' . number_format($total, 2, ',', '.') . ' ' . $acc
                        . ', disponibili ' . number_format($cash, 2, ',', '.') . '.');
                }
                $cash = round_money($cash - $total);
                if ($pos) {
                    $newQty = (int)$pos['qty'] + $qty;
                    $avg = round_money(((int)$pos['qty'] * (float)$pos['avg_cost'] + $gross) / $newQty);
                    $pdo->prepare('UPDATE positions SET qty = ?, avg_cost = ? WHERE user_id = ? AND ticker = ?')
                        ->execute([$newQty, $avg, $userId, $ticker]);
                } else {
                    $pdo->prepare('INSERT INTO positions (user_id, ticker, qty, avg_cost) VALUES (?,?,?,?)')
                        ->execute([$userId, $ticker, $qty, round_money($gross / $qty)]);
                }
            } else {
                if (!$pos || (int)$pos['qty'] < $qty) {
                    throw new ApiError('Non possiedi abbastanza azioni di ' . $ticker . ' (vendita allo scoperto non consentita).');
                }
                $realized = round_money($gross - $qty * (float)$pos['avg_cost'] - $comm);
                $cash = round_money($cash + $gross - $comm);
                if ((int)$pos['qty'] === $qty) {
                    $pdo->prepare('DELETE FROM positions WHERE user_id = ? AND ticker = ?')->execute([$userId, $ticker]);
                } else {
                    $pdo->prepare('UPDATE positions SET qty = qty - ? WHERE user_id = ? AND ticker = ?')->execute([$qty, $userId, $ticker]);
                }
            }
            $pdo->prepare('UPDATE users SET cash = ? WHERE id = ?')->execute([$cash, $userId]);

            $now = now_utc();
            $vals = [$p['snapshot'] ?? null, $price, $q['c'], $fx, $gross, $comm, $realized, $now];
            if ($orderId) {
                $pdo->prepare('UPDATE orders SET status = \'executed\', snapshot = ?, price = ?, price_ccy = ?, fx_rate = ?,
                        gross = ?, commission = ?, realized_pl = ?, executed_at = ?, note = NULL WHERE id = ? AND status = \'pending\'')
                    ->execute([...$vals, $orderId]);
            } else {
                $pdo->prepare('INSERT INTO orders (user_id, ticker, market, side, qty, mode, status, snapshot, price, price_ccy,
                        fx_rate, gross, commission, realized_pl, created_at, executed_at)
                        VALUES (?,?,?,?,?,?,\'executed\',?,?,?,?,?,?,?,?,?)')
                    ->execute([$userId, $ticker, $q['m'], $side, $qty, $mode, $vals[0], $vals[1], $vals[2], $vals[3],
                        $vals[4], $vals[5], $vals[6], $now, $now]);
                $orderId = (int)$pdo->lastInsertId();
            }
            $pdo->commit();
            return $orderId;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public static function cancelOrder(array $user, int $orderId): void {
        $st = db()->prepare('UPDATE orders SET status = \'cancelled\' WHERE id = ? AND user_id = ? AND status = \'pending\'');
        $st->execute([$orderId, $user['id']]);
        if ($st->rowCount() === 0) throw new ApiError('Ordine non trovato o già eseguito.', 404);
    }

    /** Esegue gli ordini in coda al nuovo snapshot (chiamato dal cron dopo l'aggiornamento prezzi). */
    public static function processPending(): array {
        $done = 0; $rejected = 0;
        $rows = db()->query('SELECT id, user_id, ticker, side, qty FROM orders WHERE status = \'pending\' AND mode = \'next\' ORDER BY id')->fetchAll();
        foreach ($rows as $o) {
            try {
                self::fill((int)$o['user_id'], $o['ticker'], $o['side'], (int)$o['qty'], (int)$o['id'], 'next');
                $done++;
            } catch (ApiError $e) {
                db()->prepare('UPDATE orders SET status = \'rejected\', note = ?, executed_at = ? WHERE id = ?')
                    ->execute([mb_substr($e->getMessage(), 0, 190), now_utc(), $o['id']]);
                $rejected++;
            }
        }
        return [$done, $rejected];
    }

    // ------------------------------------------------------------ portafoglio
    /** Posizioni valorizzate ai prezzi correnti + liquidità + P/L complessivo. */
    public static function portfolio(array $user): array {
        $p = self::prices();
        $acc = $user['currency'];
        $st = db()->prepare('SELECT ticker, qty, avg_cost FROM positions WHERE user_id = ? ORDER BY ticker');
        $st->execute([$user['id']]);
        $positions = []; $invested = 0.0;
        foreach ($st->fetchAll() as $r) {
            $qty = (int)$r['qty']; $avg = (float)$r['avg_cost'];
            $q = $p['prices'][$r['ticker']] ?? null;
            $stale = !$q || empty($q['p']);
            $price = $stale ? null : (float)$q['p'];
            $fx = $stale ? 1.0 : self::fxRate($q['c'], $acc, $p);
            $cost = round_money($qty * $avg);
            $value = $stale ? $cost : round_money($qty * $price * $fx);
            $positions[] = [
                'ticker' => $r['ticker'], 'name' => $q['n'] ?? '', 'market' => $q['m'] ?? (substr($r['ticker'], -3) === '.MI' ? 'IT' : 'US'),
                'qty' => $qty, 'avg_cost' => $avg, 'price' => $price, 'price_ccy' => $q['c'] ?? null,
                'value' => $value, 'cost' => $cost, 'pl' => round_money($value - $cost),
                'pl_pct' => $cost > 0 ? round(($value / $cost - 1) * 100, 2) : 0.0, 'stale' => $stale,
            ];
            $invested += $value;
        }
        $cash = (float)$user['cash'];
        $equity = round_money($cash + $invested);
        foreach ($positions as &$x) $x['weight'] = $equity > 0 ? round($x['value'] / $equity * 100, 2) : 0.0;
        unset($x);
        $initial = (float)$user['initial_budget'];
        return [
            'currency' => $acc, 'cash' => round_money($cash), 'invested' => round_money($invested), 'equity' => $equity,
            'initial_budget' => $initial, 'total_pl' => round_money($equity - $initial),
            'total_pl_pct' => $initial > 0 ? round(($equity / $initial - 1) * 100, 2) : 0.0,
            'positions' => $positions,
            'prices_snapshot' => $p['snapshot'] ?? null, 'prices_updated' => $p['updated'] ?? null,
        ];
    }

    public static function recordEquity(array $user): void {
        $pf = self::portfolio($user);
        db()->prepare('INSERT INTO equity_history (user_id, ts, equity, cash) VALUES (?,?,?,?)')
            ->execute([$user['id'], now_utc(), $pf['equity'], $pf['cash']]);
    }

    public static function recordEquityAll(): int {
        $n = 0;
        foreach (db()->query('SELECT * FROM users WHERE status = \'active\'')->fetchAll() as $u) {
            try { self::recordEquity($u); $n++; } catch (\Throwable $e) { error_log('equity ' . $u['id'] . ': ' . $e->getMessage()); }
        }
        return $n;
    }

    // ------------------------------------------------------------ impostazioni
    public static function updateCommissions(array $user, float $it, float $us): void {
        foreach ([$it, $us] as $c) if ($c < 0 || $c > 100) throw new ApiError('La commissione deve essere tra 0 e 100.');
        db()->prepare('UPDATE users SET commission_it = ?, commission_us = ? WHERE id = ?')->execute([round($it, 2), round($us, 2), $user['id']]);
    }

    /** Azzera il conto: cancella ordini, posizioni e storico e riparte con un nuovo budget/valuta. */
    public static function resetAccount(array $user, string $currency, int $budget): void {
        if (!in_array($currency, ['EUR', 'USD'], true)) throw new ApiError('Valuta non valida.');
        if ($budget < Auth::BUDGET_MIN || $budget > Auth::BUDGET_MAX) {
            throw new ApiError('Il budget deve essere tra ' . Auth::BUDGET_MIN . ' e ' . Auth::BUDGET_MAX . '.');
        }
        $pdo = db();
        $pdo->beginTransaction();
        $id = $user['id'];
        $pdo->prepare('DELETE FROM positions WHERE user_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM orders WHERE user_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM equity_history WHERE user_id = ?')->execute([$id]);
        $pdo->prepare('UPDATE users SET currency = ?, initial_budget = ?, cash = ? WHERE id = ?')->execute([$currency, $budget, $budget, $id]);
        $pdo->prepare('INSERT INTO equity_history (user_id, ts, equity, cash) VALUES (?,?,?,?)')->execute([$id, now_utc(), $budget, $budget]);
        $pdo->commit();
    }

    public static function orders(array $user, int $limit = 200): array {
        $st = db()->prepare('SELECT id, ticker, market, side, qty, mode, status, snapshot, price, price_ccy, fx_rate, gross,
                commission, realized_pl, note, created_at, executed_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ' . (int)$limit);
        $st->execute([$user['id']]);
        return $st->fetchAll();
    }

    public static function equityHistory(array $user): array {
        $st = db()->prepare('SELECT ts, equity, cash FROM equity_history WHERE user_id = ? ORDER BY ts LIMIT 2000');
        $st->execute([$user['id']]);
        return $st->fetchAll();
    }
}
