<?php
/**
 * API JSON del paper trading. Logica in webapp/src (fuori da public_html).
 *   GET  api.php?action=csrf|me|portfolio|orders|equity
 *   POST api.php?action=register|login|logout|verify|resend_verification|forgot|reset|change_password|
 *                       delete_account|place_order|cancel_order|update_settings|reset_account
 * I POST accettano JSON e richiedono l'header X-CSRF-Token (ottenuto con action=csrf o action=me).
 */
declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/Trading.php';
require_once __DIR__ . '/../src/Export.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function out(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode(['ok' => $status < 400] + $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function public_user(array $u): array {
    return [
        'username' => $u['username'], 'email' => $u['email'], 'currency' => $u['currency'],
        'initial_budget' => (float)$u['initial_budget'],
        'commission_it' => (float)$u['commission_it'], 'commission_us' => (float)$u['commission_us'],
        'created_at' => $u['created_at'],
    ];
}

try {
    I18n::init();
    Auth::startSession();
    $action = (string)($_GET['action'] ?? '');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    $in = [];
    if ($method === 'POST') {
        Auth::checkCsrf();
        $raw = file_get_contents('php://input');
        $in = $raw ? json_decode($raw, true) : [];
        if (!is_array($in)) throw new ApiError(tr('Invalid request.'));
    }
    $str = fn(string $k): string => (string)($in[$k] ?? '');
    $lv = fn(string $k): ?float => (isset($in[$k]) && $in[$k] !== '') ? (float)$in[$k] : null;

    switch ($action) {
        // ---- sessione
        case 'csrf':
            out(['csrf' => Auth::csrfToken()]);
        case 'me':
            $u = Auth::user();
            out(['csrf' => Auth::csrfToken(), 'user' => $u ? public_user($u) : null]);

        // ---- contatti
        case 'contact':
            if (!empty($in['website'])) throw new ApiError(tr('Invalid request.'));   // honeypot anti-bot
            $name = trim(preg_replace('/\s+/u', ' ', $str('name')));
            $email = strtolower(trim($str('email')));
            $text = trim(str_replace("\r\n", "\n", $str('message')));
            if (mb_strlen($name) < 2 || mb_strlen($name) > 80) throw new ApiError(tr('Please enter your name or nickname (2-80 characters).'));
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) throw new ApiError(tr('Invalid email address.'));
            if (mb_strlen($text) < 10 || mb_strlen($text) > 3000) throw new ApiError(tr('Please write a message (10-3000 characters).'));
            if (empty($in['accept_privacy'])) throw new ApiError(tr('Please accept the privacy policy to send your message.'));
            Auth::throttle('contact_ip', client_ip(), 5, 3600);
            Auth::throttle('contact_e', $email, 3, 3600);
            $ok = Mailer::send(Mailer::contactTo(), '[Paper Trading] ' . mb_substr($name, 0, 60), 'contact', [
                'name' => $name, 'email' => $email, 'message' => $text, 'lang' => I18n::$lang === 'it' ? 'Italiano' : 'English',
                'date' => gmdate('Y-m-d H:i') . ' UTC',
            ], $email);
            if (!$ok) throw new ApiError(tr('We could not send your message right now. Please try again later or write to {email}.', ['email' => Mailer::contactTo()]), 503);
            out(['message' => tr('Thanks! Your message has been sent. I will reply as soon as I can.')]);

        // ---- account
        case 'register':
            out(['message' => Auth::register($in)]);
        case 'verify':
            Auth::verifyEmail($str('token'));
            out(['message' => tr('Email confirmed. You can now log in.')]);
        case 'resend_verification':
            Auth::resendVerification($str('email'));
            out(['message' => tr('If an unconfirmed account exists for this email, we have sent you a new link.')]);
        case 'login':
            $u = Auth::login($str('login'), $str('password'));
            out(['csrf' => Auth::csrfToken(), 'user' => public_user($u)]);
        case 'logout':
            Auth::logout();
            out(['message' => tr('Logged out.')]);
        case 'forgot':
            Auth::forgotPassword($str('email'));
            out(['message' => tr('If the address is registered, you will receive an email with instructions shortly.')]);
        case 'reset':
            Auth::resetPassword($str('token'), $str('password'));
            out(['message' => tr('Password updated. You can now log in.')]);
        case 'change_password':
            Auth::changePassword(Auth::requireUser(), $str('current'), $str('password'));
            out(['message' => tr('Password updated.')]);
        case 'delete_account':
            Auth::deleteAccount(Auth::requireUser(), $str('password'));
            out(['message' => tr('Account permanently deleted.')]);

        // ---- trading
        case 'portfolio':
            out(['portfolio' => Trading::portfolio(Auth::requireUser())]);
        case 'orders':
            out(['orders' => Trading::orders(Auth::requireUser())]);
        case 'equity':
            out(['equity' => Trading::equityHistory(Auth::requireUser())]);
        case 'place_order':
            $u = Auth::requireUser();
            $r = Trading::placeOrder($u, $str('ticker'), $str('side'), (int)($in['qty'] ?? 0), $str('mode') ?: 'now', $lv('stop_loss'), $lv('take_profit'), $lv('limit_price'));
            out(['order' => $r, 'message' => $r['status'] === 'executed' ? tr('Order executed.')
                : (($r['mode'] ?? '') === 'limit' ? tr('Limit order placed: it stays active until the end of the trading day.')
                    : tr('Order queued: it will be executed at the next price update.'))]);
        case 'export_orders':
            $u = Auth::requireUser();
            [$fname, $mime, $body] = Export::orders($u, (string)($_GET['format'] ?? 'csv'));
            header('Content-Type: ' . $mime);
            header('Content-Disposition: attachment; filename="' . $fname . '"');
            header('Content-Length: ' . strlen($body));
            echo $body;
            exit;
        case 'set_levels':
            Trading::setLevels(Auth::requireUser(), $str('ticker'), $lv('stop_loss'), $lv('take_profit'));
            out(['message' => tr('Levels saved.')]);
        case 'cancel_order':
            Trading::cancelOrder(Auth::requireUser(), (int)($in['id'] ?? 0));
            out(['message' => tr('Order cancelled.')]);
        case 'update_settings':
            Trading::updateCommissions(Auth::requireUser(), (float)($in['commission_it'] ?? 0), (float)($in['commission_us'] ?? 0));
            out(['message' => tr('Settings saved.')]);
        case 'reset_account':
            $u = Auth::requireUser();
            if (!password_verify($str('password'), $u['password_hash'])) throw new ApiError(tr('Incorrect password.'), 403);
            Trading::resetAccount($u, strtoupper($str('currency')), (int)($in['budget'] ?? 0));
            out(['message' => tr('Account reset.')]);

        default:
            throw new ApiError(tr('Action not found.'), 404);
    }
} catch (ApiError $e) {
    out(['error' => $e->getMessage()], $e->status);
} catch (Throwable $e) {
    error_log('API error: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    out(['error' => tr('Internal error. Please try again later.')], 500);
}
