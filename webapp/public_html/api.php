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
    Auth::startSession();
    $action = (string)($_GET['action'] ?? '');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    $in = [];
    if ($method === 'POST') {
        Auth::checkCsrf();
        $raw = file_get_contents('php://input');
        $in = $raw ? json_decode($raw, true) : [];
        if (!is_array($in)) throw new ApiError('Richiesta non valida.');
    }
    $str = fn(string $k): string => (string)($in[$k] ?? '');

    switch ($action) {
        // ---- sessione
        case 'csrf':
            out(['csrf' => Auth::csrfToken()]);
        case 'me':
            $u = Auth::user();
            out(['csrf' => Auth::csrfToken(), 'user' => $u ? public_user($u) : null]);

        // ---- account
        case 'register':
            out(['message' => Auth::register($in)]);
        case 'verify':
            Auth::verifyEmail($str('token'));
            out(['message' => 'Email confermata. Ora puoi accedere.']);
        case 'resend_verification':
            Auth::resendVerification($str('email'));
            out(['message' => 'Se esiste un account non ancora confermato con questa email, ti abbiamo inviato un nuovo link.']);
        case 'login':
            $u = Auth::login($str('login'), $str('password'));
            out(['csrf' => Auth::csrfToken(), 'user' => public_user($u)]);
        case 'logout':
            Auth::logout();
            out(['message' => 'Uscito.']);
        case 'forgot':
            Auth::forgotPassword($str('email'));
            out(['message' => 'Se l\'indirizzo è registrato, riceverai a breve un\'email con le istruzioni.']);
        case 'reset':
            Auth::resetPassword($str('token'), $str('password'));
            out(['message' => 'Password aggiornata. Ora puoi accedere.']);
        case 'change_password':
            Auth::changePassword(Auth::requireUser(), $str('current'), $str('password'));
            out(['message' => 'Password aggiornata.']);
        case 'delete_account':
            Auth::deleteAccount(Auth::requireUser(), $str('password'));
            out(['message' => 'Account eliminato definitivamente.']);

        // ---- trading
        case 'portfolio':
            out(['portfolio' => Trading::portfolio(Auth::requireUser())]);
        case 'orders':
            out(['orders' => Trading::orders(Auth::requireUser())]);
        case 'equity':
            out(['equity' => Trading::equityHistory(Auth::requireUser())]);
        case 'place_order':
            $u = Auth::requireUser();
            $r = Trading::placeOrder($u, $str('ticker'), $str('side'), (int)($in['qty'] ?? 0), $str('mode') ?: 'now');
            out(['order' => $r, 'message' => $r['status'] === 'executed'
                ? 'Ordine eseguito.' : 'Ordine messo in coda: verrà eseguito al prossimo aggiornamento dei prezzi.']);
        case 'cancel_order':
            Trading::cancelOrder(Auth::requireUser(), (int)($in['id'] ?? 0));
            out(['message' => 'Ordine annullato.']);
        case 'update_settings':
            Trading::updateCommissions(Auth::requireUser(), (float)($in['commission_it'] ?? 0), (float)($in['commission_us'] ?? 0));
            out(['message' => 'Impostazioni salvate.']);
        case 'reset_account':
            $u = Auth::requireUser();
            if (!password_verify($str('password'), $u['password_hash'])) throw new ApiError('Password non corretta.', 403);
            Trading::resetAccount($u, strtoupper($str('currency')), (int)($in['budget'] ?? 0));
            out(['message' => 'Conto azzerato.']);

        default:
            throw new ApiError('Azione non trovata.', 404);
    }
} catch (ApiError $e) {
    out(['error' => $e->getMessage()], $e->status);
} catch (Throwable $e) {
    error_log('API error: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    out(['error' => 'Errore interno. Riprova più tardi.'], 500);
}
