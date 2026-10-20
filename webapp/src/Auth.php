<?php
declare(strict_types=1);

require_once __DIR__ . '/Mailer.php';

/** Registrazione, login, verifica email, recupero password, cancellazione account. */
final class Auth {
    public const BUDGET_MIN = 10000;
    public const BUDGET_MAX = 100000;
    public const VERIFY_TTL_MIN = 24 * 60;

    // ------------------------------------------------------------ sessione
    public static function startSession(): void {
        if (session_status() === PHP_SESSION_ACTIVE) return;
        session_name('aifs_sid');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => (bool)(app_config()['cookie_secure'] ?? true),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
        if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }

    public static function csrfToken(): string { return (string)$_SESSION['csrf']; }

    public static function checkCsrf(): void {
        $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        if ($sent === '' || !hash_equals(self::csrfToken(), $sent)) {
            throw new ApiError(tr('Session expired: reload the page and try again.'), 403);
        }
    }

    /** Utente loggato (riga completa) oppure null. */
    public static function user(): ?array {
        $id = $_SESSION['uid'] ?? null;
        if (!$id) return null;
        $st = db()->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$id]);
        $u = $st->fetch();
        if (!$u || $u['status'] !== 'active') {
            unset($_SESSION['uid']);
            return null;
        }
        return $u;
    }

    public static function requireUser(): array {
        $u = self::user();
        if (!$u) throw new ApiError(tr('You need to log in.'), 401);
        return $u;
    }

    public static function logout(): void {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'],
                'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Lax']);
        }
        session_destroy();
    }

    // ------------------------------------------------------------ rate limit
    private static function tooMany(string $kind, string $ident, int $max, int $windowSec): bool {
        $st = db()->prepare('SELECT COUNT(*) FROM rate_events WHERE kind = ? AND ident = ? AND created_at > ?');
        $st->execute([$kind, $ident, gmdate('Y-m-d H:i:s', time() - $windowSec)]);
        return (int)$st->fetchColumn() >= $max;
    }

    private static function hit(string $kind, string $ident): void {
        db()->prepare('INSERT INTO rate_events (kind, ident, created_at) VALUES (?, ?, ?)')
            ->execute([$kind, substr($ident, 0, 190), now_utc()]);
        if (random_int(1, 50) === 1) {
            db()->prepare('DELETE FROM rate_events WHERE created_at < ?')->execute([gmdate('Y-m-d H:i:s', time() - 86400)]);
        }
    }

    /** Limita le richieste: errore 429 oltre $max in $windowSec secondi, altrimenti registra l'evento. */
    public static function throttle(string $kind, string $ident, int $max, int $windowSec): void {
        self::limit($kind, $ident, $max, $windowSec);
        self::hit($kind, $ident);
    }

    private static function limit(string $kind, string $ident, int $max, int $windowSec): void {
        if (self::tooMany($kind, $ident, $max, $windowSec)) {
            throw new ApiError(tr('Too many attempts. Please try again in a few minutes.'), 429);
        }
    }

    // ------------------------------------------------------------ validazione
    public static function validUsername(string $u): bool { return (bool)preg_match('/^[A-Za-z0-9_]{3,30}$/', $u); }

    public static function checkPassword(string $p): void {
        $len = strlen($p);
        if ($len < 8) throw new ApiError(tr('The password must be at least 8 characters long.'));
        if ($len > 72) throw new ApiError(tr('The password can be at most 72 characters long.'));
        if (!preg_match('/[A-Za-z]/', $p) || !preg_match('/\d/', $p)) {
            throw new ApiError(tr('The password must contain at least one letter and one number.'));
        }
    }

    // ------------------------------------------------------------ token
    private static function createToken(int $userId, string $type, int $ttlMinutes): string {
        $raw = bin2hex(random_bytes(32));
        db()->prepare('DELETE FROM auth_tokens WHERE user_id = ? AND type = ?')->execute([$userId, $type]);
        db()->prepare('INSERT INTO auth_tokens (user_id, type, token_hash, expires_at, created_at) VALUES (?,?,?,?,?)')
            ->execute([$userId, $type, hash('sha256', $raw), gmdate('Y-m-d H:i:s', time() + $ttlMinutes * 60), now_utc()]);
        return $raw;
    }

    /** Ritorna la riga del token valido (non usato, non scaduto) o null. */
    private static function findToken(string $raw, string $type): ?array {
        if (!preg_match('/^[a-f0-9]{64}$/', $raw)) return null;
        $st = db()->prepare('SELECT * FROM auth_tokens WHERE token_hash = ? AND type = ? AND used_at IS NULL AND expires_at > ?');
        $st->execute([hash('sha256', $raw), $type, now_utc()]);
        return $st->fetch() ?: null;
    }

    private static function sendVerification(array $user): bool {
        $tok = self::createToken((int)$user['id'], 'verify', self::VERIFY_TTL_MIN);
        $link = Mailer::siteUrl() . '/account/' . (I18n::$lang === 'it' ? '?lang=it' : '') . '#/verify?token=' . $tok;
        return Mailer::send($user['email'], tr('Confirm your email address'), 'verify_email', [
            'username' => $user['username'], 'verify_link' => $link,
            'expires_hours' => (string)(self::VERIFY_TTL_MIN / 60),
        ]);
    }

    // ------------------------------------------------------------ azioni
    public static function register(array $in): string {
        if (!empty($in['website'])) throw new ApiError(tr('Invalid request.'));   // honeypot anti-bot
        $ip = client_ip();
        self::limit('register', $ip, 5, 3600);

        $username = trim((string)($in['username'] ?? ''));
        $email = strtolower(trim((string)($in['email'] ?? '')));
        $password = (string)($in['password'] ?? '');
        $currency = strtoupper((string)($in['currency'] ?? 'EUR'));
        $budget = (int)($in['budget'] ?? 10000);

        if (!self::validUsername($username)) throw new ApiError(tr('Invalid username: 3-30 characters, letters, numbers and underscore only.'));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) throw new ApiError(tr('Invalid email address.'));
        self::checkPassword($password);
        if (!in_array($currency, ['EUR', 'USD'], true)) throw new ApiError(tr('Invalid currency.'));
        if ($budget < self::BUDGET_MIN || $budget > self::BUDGET_MAX) {
            throw new ApiError(tr('The budget must be between {min} and {max}.', ['min' => self::BUDGET_MIN, 'max' => self::BUDGET_MAX]));
        }
        if (empty($in['accept_terms']) || empty($in['accept_age'])) {
            throw new ApiError(tr('You must accept the terms and privacy policy and confirm you are at least 18 years old.'));
        }

        self::hit('register', $ip);

        $st = db()->prepare('SELECT username, email FROM users WHERE username = ? OR email = ?');
        $st->execute([$username, $email]);
        foreach ($st->fetchAll() as $r) {
            if (strcasecmp($r['email'], $email) === 0) throw new ApiError(tr('An account with this email already exists.'));
            throw new ApiError(tr('Username already taken.'));
        }

        $now = now_utc();
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $pdo->prepare('INSERT INTO users (username, email, password_hash, currency, initial_budget, cash,
                    terms_version, terms_accepted_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
                ->execute([$username, $email, password_hash($password, PASSWORD_DEFAULT), $currency, $budget, $budget,
                    app_config()['terms_version'], $now, $now]);
            $id = (int)$pdo->lastInsertId();
            $pdo->prepare('INSERT INTO equity_history (user_id, ts, equity, cash) VALUES (?,?,?,?)')
                ->execute([$id, $now, $budget, $budget]);
            $pdo->commit();
        } catch (PDOException $e) {
            $pdo->rollBack();
            if ($e->getCode() === '23000') throw new ApiError(tr('Username or email already registered.'));
            throw $e;
        }

        $user = ['id' => $id, 'username' => $username, 'email' => $email];
        return self::sendVerification($user)
            ? tr('Account created. We sent you an email: click the link to activate it.')
            : tr('Account created, but we could not send the confirmation email. Use "Didn\'t get the confirmation email?" on the log in page.');
    }

    public static function verifyEmail(string $token): void {
        $t = self::findToken($token, 'verify');
        if (!$t) throw new ApiError(tr('Invalid or expired link. Request a new confirmation email.'));
        $pdo = db();
        $pdo->beginTransaction();
        $pdo->prepare('UPDATE users SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL')->execute([now_utc(), $t['user_id']]);
        $pdo->prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?')->execute([now_utc(), $t['id']]);
        $pdo->commit();
    }

    public static function resendVerification(string $email): void {
        $email = strtolower(trim($email));
        self::limit('resend', client_ip(), 5, 3600);
        self::hit('resend', client_ip());
        $st = db()->prepare('SELECT * FROM users WHERE email = ? AND email_verified_at IS NULL AND status = \'active\'');
        $st->execute([$email]);
        if ($u = $st->fetch()) {
            self::limit('resend_e', $email, 3, 3600);
            self::hit('resend_e', $email);
            self::sendVerification($u);
        }
        // risposta identica sia se l'account esiste sia se no
    }

    public static function login(string $login, string $password): array {
        $ip = client_ip();
        $login = trim($login);
        $key = strtolower($login);
        self::limit('login_ip', $ip, 20, 900);
        self::limit('login_user', $key, 6, 900);

        $st = db()->prepare('SELECT * FROM users WHERE username = ? OR email = ?');
        $st->execute([$login, strtolower($login)]);
        $u = $st->fetch();

        // verifica sempre un hash per non rivelare se l'utente esiste (timing)
        $hash = $u ? $u['password_hash'] : '$2y$10$ImHi0GBcu/4P0BT6klWtaeGqzPKI4pfXnge9ER4iOZL.PbCduojwW';
        $ok = password_verify($password, $hash) && $u;
        if (!$ok) {
            self::hit('login_ip', $ip);
            self::hit('login_user', $key);
            throw new ApiError(tr('Incorrect credentials.'), 401);
        }
        if ($u['status'] !== 'active') throw new ApiError(tr('Account suspended. Contact us for information.'), 403);
        if ($u['email_verified_at'] === null) {
            throw new ApiError(tr('Please confirm your email first: check your inbox (and spam) or request a new link.'), 403);
        }
        if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
            db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
        }
        session_regenerate_id(true);
        $_SESSION['uid'] = (int)$u['id'];
        db()->prepare('UPDATE users SET last_login_at = ? WHERE id = ?')->execute([now_utc(), $u['id']]);
        return $u;
    }

    public static function forgotPassword(string $email): void {
        $email = strtolower(trim($email));
        self::limit('forgot', client_ip(), 5, 3600);
        self::hit('forgot', client_ip());
        $st = db()->prepare('SELECT * FROM users WHERE email = ? AND status = \'active\'');
        $st->execute([$email]);
        if ($u = $st->fetch()) {
            self::limit('forgot_e', $email, 3, 3600);
            self::hit('forgot_e', $email);
            $ttl = Mailer::resetTtlMinutes();
            $tok = self::createToken((int)$u['id'], 'reset', $ttl);
            Mailer::send($u['email'], tr('Reset your password'), 'password_reset', [
                'username' => $u['username'],
                'reset_link' => Mailer::siteUrl() . '/account/' . (I18n::$lang === 'it' ? '?lang=it' : '') . '#/reset?token=' . $tok,
                'expires_minutes' => (string)$ttl,
            ]);
        }
        // risposta identica sia se l'email esiste sia se no
    }

    public static function resetPassword(string $token, string $password): void {
        self::limit('reset', client_ip(), 10, 3600);
        self::hit('reset', client_ip());
        self::checkPassword($password);
        $t = self::findToken($token, 'reset');
        if (!$t) throw new ApiError(tr('Invalid or expired link. Request a new password reset.'));
        $pdo = db();
        $pdo->beginTransaction();
        // il reset dimostra anche il possesso dell'email
        $pdo->prepare('UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), now_utc(), $t['user_id']]);
        $pdo->prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?')->execute([now_utc(), $t['id']]);
        $pdo->prepare('DELETE FROM auth_tokens WHERE user_id = ? AND type = \'reset\' AND used_at IS NULL')->execute([$t['user_id']]);
        $pdo->commit();
    }

    public static function changePassword(array $user, string $current, string $new): void {
        if (!password_verify($current, $user['password_hash'])) throw new ApiError(tr('The current password is not correct.'), 403);
        self::checkPassword($new);
        db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $user['id']]);
    }

    /** Cancellazione definitiva: elimina utente e, a cascata, ordini, posizioni, storico e token. */
    public static function deleteAccount(array $user, string $password): void {
        if (!password_verify($password, $user['password_hash'])) throw new ApiError(tr('Incorrect password.'), 403);
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$user['id']]);
        self::logout();
    }
}
