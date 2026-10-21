<?php
declare(strict_types=1);

/**
 * Motore del paper trading: denaro virtuale, prezzi dagli snapshot di metà giornata e chiusura.
 * Tutti gli importi sono espressi nella valuta del conto dell'utente (EUR o USD).
 */
final class Trading {
    public const MAX_PENDING = 20;
    public const MAX_QTY = 1000000;
    public const MAX_AGE_SEC = 5 * 86400;
    public const LAST_UPDATE_HOUR = 21;   // ora di Roma dell'ultimo aggiornamento prezzi del giorno (cron)
    public const SESSION_END_HOUR = 22;   // ora di Roma in cui finisce la giornata di borsa (chiusura USA)   // oltre questa età i prezzi sono considerati non aggiornati

    private static ?array $prices = null;

    // ------------------------------------------------------------ prezzi
    public static function priceFile(): string { return APP_ROOT . '/public_html/prices.json'; }

    public static function prices(): array {
        if (self::$prices === null) {
            $raw = @file_get_contents(self::priceFile());
            $j = $raw ? json_decode($raw, true) : null;
            if (!is_array($j) || empty($j['prices'])) throw new ApiError(tr('Prices are not available at the moment.'), 503);
            self::$prices = $j;
        }
        return self::$prices;
    }

    public static function setPricesForTest(array $p): void { self::$prices = $p; }

    private static function assertFresh(array $p): void {
        $ts = strtotime((string)($p['updated'] ?? '')) ?: 0;
        if (time() - $ts > self::MAX_AGE_SEC) {
            throw new ApiError(tr('Prices are out of date: trading is paused until the next update.'), 503);
        }
    }

    /** Cambio per convertire un importo da $from a $to (EUR/USD). */
    public static function fxRate(string $from, string $to, array $p): float {
        if ($from === $to) return 1.0;
        $eurusd = (float)($p['fx']['EURUSD'] ?? 0);
        if ($eurusd <= 0) throw new ApiError(tr('EUR/USD exchange rate not available.'), 503);
        return $from === 'EUR' ? $eurusd : 1.0 / $eurusd;
    }

    public static function quote(string $ticker, array $p): array {
        $q = $p['prices'][$ticker] ?? null;
        if (!$q || !isset($q['p']) || $q['p'] <= 0) throw new ApiError(tr('Stock not available: {t}', ['t' => $ticker]));
        return $q;
    }

    // ------------------------------------------------------------ ordini
    /** Inserisce l'ordine: immediato ('now') o in coda per il prossimo aggiornamento ('next'). */
    public static function placeOrder(array $user, string $ticker, string $side, int $qty, string $mode, ?float $stopLoss = null, ?float $takeProfit = null, ?float $limitPrice = null): array {
        $ticker = strtoupper(trim($ticker));
        if (!in_array($side, ['buy', 'sell'], true)) throw new ApiError(tr('Invalid operation.'));
        if (!in_array($mode, ['now', 'next', 'limit'], true)) throw new ApiError(tr('Invalid execution mode.'));
        if ($mode === 'limit' && ($limitPrice === null || $limitPrice <= 0)) throw new ApiError(tr('Please enter a limit price greater than 0.'));
        if ($qty < 1 || $qty > self::MAX_QTY) throw new ApiError(tr('Invalid quantity.'));
        $p = self::prices();
        self::assertFresh($p);
        $q = self::quote($ticker, $p);
        $hasLevels = $stopLoss !== null || $takeProfit !== null;
        if ($hasLevels) {
            if ($side !== 'buy' || $mode !== 'now') {
                throw new ApiError(tr('Stop loss and take profit can be set on an immediate buy (or from the portfolio, after execution).'));
            }
            self::validateLevels((float)$q['p'], $stopLoss, $takeProfit);
        }

        if ($mode === 'limit' && self::limitHit($side, (float)$q['p'], $limitPrice)) {
            // il limite è già soddisfatto dal prezzo attuale: esecuzione immediata
            $id = self::fill((int)$user['id'], $ticker, $side, $qty, null, 'limit');
            db()->prepare('UPDATE orders SET limit_price = ? WHERE id = ?')->execute([round($limitPrice, 4), $id]);
            return ['id' => $id, 'status' => 'executed', 'mode' => 'limit'];
        }
        if ($mode === 'next' || $mode === 'limit') {
            self::expireStale();
            $st = db()->prepare('SELECT COUNT(*) FROM orders WHERE user_id = ? AND status = \'pending\'');
            $st->execute([$user['id']]);
            if ((int)$st->fetchColumn() >= self::MAX_PENDING) throw new ApiError(tr('You have too many queued orders (maximum {n}).', ['n' => self::MAX_PENDING]));
            db()->prepare('INSERT INTO orders (user_id, ticker, market, side, qty, mode, status, limit_price, valid_until, created_at)
                    VALUES (?,?,?,?,?,?,\'pending\',?,?,?)')
                ->execute([$user['id'], $ticker, $q['m'], $side, $qty, $mode, $mode === 'limit' ? round($limitPrice, 4) : null, self::validUntil(), now_utc()]);
            return ['id' => (int)db()->lastInsertId(), 'status' => 'pending', 'mode' => $mode];
        }
        $id = self::fill((int)$user['id'], $ticker, $side, $qty, null, 'now');
        if ($hasLevels) self::applyLevels((int)$user['id'], $ticker, $stopLoss, $takeProfit);
        return ['id' => $id, 'status' => 'executed'];
    }

    /**
     * Esegue un ordine al prezzo dello snapshot corrente, in transazione.
     * $orderId = ordine pending già esistente da completare (null: ne crea uno nuovo).
     */
    public static function fill(int $userId, string $ticker, string $side, int $qty, ?int $orderId, string $mode, ?string $note = null): int {
        $p = self::prices();
        self::assertFresh($p);
        $q = self::quote($ticker, $p);
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('SELECT * FROM users WHERE id = ? FOR UPDATE');
            $st->execute([$userId]);
            $u = $st->fetch();
            if (!$u || $u['status'] !== 'active') throw new ApiError(tr('Account not active.'), 403);

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
                    throw new ApiError(tr('Insufficient cash: you need {need} {ccy}, available {have}.', ['need' => number_format($total, 2, '.', ','), 'ccy' => $acc, 'have' => number_format($cash, 2, '.', ',')]));
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
                    throw new ApiError(tr('You do not own enough shares of {t} (short selling is not allowed).', ['t' => $ticker]));
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
                $upd = $pdo->prepare('UPDATE orders SET status = \'executed\', snapshot = ?, price = ?, price_ccy = ?, fx_rate = ?,
                        gross = ?, commission = ?, realized_pl = ?, executed_at = ?, note = NULL WHERE id = ? AND status = \'pending\'');
                $upd->execute([...$vals, $orderId]);
                if ($upd->rowCount() === 0) throw new ApiError(tr('Order not found or already executed.'), 404);   // scaduto o annullato nel frattempo
            } else {
                $pdo->prepare('INSERT INTO orders (user_id, ticker, market, side, qty, mode, status, snapshot, price, price_ccy,
                        fx_rate, gross, commission, realized_pl, note, created_at, executed_at)
                        VALUES (?,?,?,?,?,?,\'executed\',?,?,?,?,?,?,?,?,?,?)')
                    ->execute([$userId, $ticker, $q['m'], $side, $qty, $mode, $vals[0], $vals[1], $vals[2], $vals[3],
                        $vals[4], $vals[5], $vals[6], $note, $now, $now]);
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
        if ($st->rowCount() === 0) throw new ApiError(tr('Order not found or already executed.'), 404);
    }

    /** Il limite è raggiunto? Acquisto: prezzo <= limite. Vendita: prezzo >= limite. */
    public static function limitHit(string $side, float $price, float $limit): bool {
        return $side === 'buy' ? $price <= $limit + 1e-9 : $price >= $limit - 1e-9;
    }

    /**
     * Scadenza (UTC) di un ordine in attesa: fine della giornata di borsa in cui può essere valutato.
     * Se l'ordine è inserito prima dell'ultimo aggiornamento di un giorno feriale vale fino alle 22:00 (Roma) di quel giorno,
     * altrimenti fino alle 22:00 del primo giorno feriale successivo.
     */
    public static function validUntil(?\DateTimeImmutable $now = null): string {
        $utc = new \DateTimeZone('UTC');
        $n = ($now ?? new \DateTimeImmutable('now', $utc))->setTimezone(new \DateTimeZone('Europe/Rome'));
        $before = (int)$n->format('N') <= 5 && (int)$n->format('G') < self::LAST_UPDATE_HOUR;
        $d = $n->setTime(self::SESSION_END_HOUR, 0, 0);
        if (!$before) {
            $d = $d->modify('+1 day');
            while ((int)$d->format('N') > 5) $d = $d->modify('+1 day');
        }
        return $d->setTimezone($utc)->format('Y-m-d H:i:s');
    }

    /** Gli ordini in attesa oltre la scadenza diventano «non eseguiti» (stato expired). Ritorna quanti. */
    public static function expireStale(): int {
        $st = db()->prepare('UPDATE orders SET status = \'expired\', executed_at = ? WHERE status = \'pending\' AND valid_until IS NOT NULL AND valid_until < ?');
        $st->execute([now_utc(), now_utc()]);
        return $st->rowCount();
    }

    /** Esegue gli ordini in coda al nuovo snapshot (chiamato dal cron dopo l'aggiornamento prezzi). */
    public static function processPending(): array {
        $done = 0; $rejected = 0;
        $p = self::prices();
        $rows = db()->query('SELECT id, user_id, ticker, side, qty, mode, limit_price FROM orders WHERE status = \'pending\' AND mode IN (\'next\', \'limit\') ORDER BY id')->fetchAll();
        foreach ($rows as $o) {
            if ($o['mode'] === 'limit') {
                $px = $p['prices'][$o['ticker']]['p'] ?? null;
                if ($px === null || !self::limitHit($o['side'], (float)$px, (float)$o['limit_price'])) continue;   // resta in attesa
            }
            try {
                self::fill((int)$o['user_id'], $o['ticker'], $o['side'], (int)$o['qty'], (int)$o['id'], $o['mode']);
                $done++;
            } catch (ApiError $e) {
                db()->prepare('UPDATE orders SET status = \'rejected\', note = ?, executed_at = ? WHERE id = ? AND status = \'pending\'')
                    ->execute([mb_substr($e->getMessage(), 0, 190), now_utc(), $o['id']]);
                $rejected++;
            }
        }
        $expired = self::expireStale();
        return [$done, $rejected, $expired];
    }

    // ------------------------------------------------------------ stop loss / take profit
    /** I livelli sono prezzi nella valuta del titolo. Lo stop deve stare sotto il prezzo, il take profit sopra. */
    private static function validateLevels(float $price, ?float $sl, ?float $tp): void {
        if ($sl !== null && ($sl <= 0 || $sl >= $price)) {
            throw new ApiError(tr('The stop loss must be greater than 0 and below the current price ({p}).', ['p' => number_format($price, 2, '.', ',')]));
        }
        if ($tp !== null && $tp <= $price) {
            throw new ApiError(tr('The take profit must be above the current price ({p}).', ['p' => number_format($price, 2, '.', ',')]));
        }
    }

    private static function applyLevels(int $userId, string $ticker, ?float $sl, ?float $tp): void {
        db()->prepare('UPDATE positions SET stop_loss = ?, take_profit = ? WHERE user_id = ? AND ticker = ?')
            ->execute([$sl === null ? null : round($sl, 4), $tp === null ? null : round($tp, 4), $userId, $ticker]);
    }

    /** Imposta (o rimuove, con null) stop loss e take profit di una posizione aperta. */
    public static function setLevels(array $user, string $ticker, ?float $sl, ?float $tp): void {
        $ticker = strtoupper(trim($ticker));
        $st = db()->prepare('SELECT qty FROM positions WHERE user_id = ? AND ticker = ?');
        $st->execute([$user['id'], $ticker]);
        if (!$st->fetch()) throw new ApiError(tr('You have no open position on {t}.', ['t' => $ticker]), 404);
        $p = self::prices();
        self::assertFresh($p);
        self::validateLevels((float)self::quote($ticker, $p)['p'], $sl, $tp);
        self::applyLevels((int)$user['id'], $ticker, $sl, $tp);
    }

    /**
     * Dopo ogni aggiornamento prezzi: vende l'intera posizione se il prezzo ha raggiunto lo stop loss o il take profit.
     * L'esecuzione avviene al prezzo dello snapshot, che può differire dal livello (gap).
     */
    public static function checkTriggers(): array {
        $p = self::prices();
        $stop = 0; $take = 0;
        $rows = db()->query('SELECT p.user_id, p.ticker, p.qty, p.stop_loss, p.take_profit FROM positions p
                JOIN users u ON u.id = p.user_id AND u.status = \'active\'
                WHERE p.stop_loss IS NOT NULL OR p.take_profit IS NOT NULL')->fetchAll();
        foreach ($rows as $r) {
            $q = $p['prices'][$r['ticker']] ?? null;
            if (!$q || empty($q['p'])) continue;
            $price = (float)$q['p'];
            $label = number_format($price, 2, '.', ',') . ' ' . $q['c'];
            $note = null;
            $isStop = false;
            if ($r['stop_loss'] !== null && $price <= (float)$r['stop_loss']) {
                $note = 'Stop loss triggered at ' . number_format((float)$r['stop_loss'], 2, '.', ',') . ' (price ' . $label . ')';
                $isStop = true;
            } elseif ($r['take_profit'] !== null && $price >= (float)$r['take_profit']) {
                $note = 'Take profit reached at ' . number_format((float)$r['take_profit'], 2, '.', ',') . ' (price ' . $label . ')';
            }
            if ($note === null) continue;
            try {
                self::fill((int)$r['user_id'], $r['ticker'], 'sell', (int)$r['qty'], null, 'now', $note);
                if ($isStop) $stop++; else $take++;
            } catch (\Throwable $e) {
                error_log('trigger ' . $r['user_id'] . ' ' . $r['ticker'] . ': ' . $e->getMessage());
            }
        }
        return [$stop, $take];
    }

    // ------------------------------------------------------------ portafoglio
    /** Posizioni valorizzate ai prezzi correnti + liquidità + P/L complessivo. */
    public static function portfolio(array $user): array {
        $p = self::prices();
        $acc = $user['currency'];
        $st = db()->prepare('SELECT ticker, qty, avg_cost, stop_loss, take_profit FROM positions WHERE user_id = ? ORDER BY ticker');
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
                'stop_loss' => $r['stop_loss'] === null ? null : (float)$r['stop_loss'],
                'take_profit' => $r['take_profit'] === null ? null : (float)$r['take_profit'],
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
        foreach ([$it, $us] as $c) if ($c < 0 || $c > 100) throw new ApiError(tr('The commission must be between 0 and 100.'));
        db()->prepare('UPDATE users SET commission_it = ?, commission_us = ? WHERE id = ?')->execute([round($it, 2), round($us, 2), $user['id']]);
    }

    /** Azzera il conto: cancella ordini, posizioni e storico e riparte con un nuovo budget/valuta. */
    public static function resetAccount(array $user, string $currency, int $budget): void {
        if (!in_array($currency, ['EUR', 'USD'], true)) throw new ApiError(tr('Invalid currency.'));
        if ($budget < Auth::BUDGET_MIN || $budget > Auth::BUDGET_MAX) {
            throw new ApiError(tr('The budget must be between {min} and {max}.', ['min' => Auth::BUDGET_MIN, 'max' => Auth::BUDGET_MAX]));
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
        self::expireStale();
        $st = db()->prepare('SELECT id, ticker, market, side, qty, mode, status, limit_price, valid_until, snapshot, price, price_ccy, fx_rate, gross,
                commission, realized_pl, note, created_at, executed_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ' . (int)$limit);
        $st->execute([$user['id']]);
        return $st->fetchAll();
    }

    public static function equityHistory(array $user): array {
        $st = db()->prepare('SELECT ts, equity, cash FROM (SELECT ts, equity, cash FROM equity_history WHERE user_id = ? ORDER BY ts DESC LIMIT 2000) t ORDER BY ts');
        $st->execute([$user['id']]);
        return $st->fetchAll();
    }
}
