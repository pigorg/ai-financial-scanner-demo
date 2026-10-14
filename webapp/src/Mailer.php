<?php
declare(strict_types=1);

require_once __DIR__ . '/vendor/PHPMailer/Exception.php';
require_once __DIR__ . '/vendor/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/vendor/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;

/** Invio email SMTP con template HTML + testo in webapp/templates/email. */
final class Mailer {
    private static ?array $cfg = null;

    private static function cfg(): array {
        if (self::$cfg === null) {
            $file = APP_ROOT . '/config/mail.config.php';
            if (!is_file($file)) throw new RuntimeException('Manca webapp/config/mail.config.php');
            self::$cfg = require $file;
        }
        return self::$cfg;
    }

    /** Sostituisce {{chiave}}; nell'HTML i valori sono escapati. */
    private static function render(string $tpl, array $vars, bool $html): string {
        foreach ($vars as $k => $v) {
            $tpl = str_replace('{{' . $k . '}}', $html ? htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8') : (string)$v, $tpl);
        }
        return $tpl;
    }

    /** $template = nome file senza estensione (es. password_reset). Ritorna true se inviata. */
    public static function send(string $to, string $subject, string $template, array $vars): bool {
        $c = self::cfg();
        $vars += [
            'site_name' => $c['site_name'], 'site_url' => $c['site_url'], 'reply_to' => $c['reply_to'],
        ];
        $dir = $c['templates_dir'];
        $html = @file_get_contents("$dir/$template.html");
        $txt  = @file_get_contents("$dir/$template.txt");
        if ($html === false || $txt === false) throw new RuntimeException("Template email mancante: $template");

        $m = new PHPMailer(true);
        try {
            $m->isSMTP();
            $m->Host = $c['host'];
            $m->Port = (int)$c['port'];
            $m->SMTPAuth = true;
            $m->Username = $c['username'];
            $m->Password = $c['password'];
            $m->SMTPSecure = $c['encryption'] === 'tls' ? PHPMailer::ENCRYPTION_STARTTLS : PHPMailer::ENCRYPTION_SMTPS;
            $m->CharSet = 'UTF-8';
            $m->Timeout = 15;
            $m->SMTPDebug = !empty($c['debug']) ? 2 : 0;
            $m->setFrom($c['from_email'], $c['from_name']);
            $m->addReplyTo($c['reply_to']);
            $m->addAddress($to);
            $m->isHTML(true);
            $m->Subject = $subject;
            $m->Body = self::render($html, $vars, true);
            $m->AltBody = self::render($txt, $vars, false);
            return $m->send();
        } catch (\Throwable $e) {
            error_log('Mailer: ' . $e->getMessage());
            return false;
        }
    }

    public static function siteUrl(): string { return rtrim(self::cfg()['site_url'], '/'); }
    public static function resetTtlMinutes(): int { return (int)(self::cfg()['reset_token_ttl_minutes'] ?? 60); }
}
