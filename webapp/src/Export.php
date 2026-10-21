<?php
declare(strict_types=1);

/** Esportazione dello storico ordini di un utente in CSV, Excel (.xlsx) e XML. Nessuna estensione PHP richiesta. */
final class Export {
    private const COLUMNS = [
        'id', 'created_utc', 'executed_utc', 'valid_until_utc', 'ticker', 'market', 'side', 'quantity', 'order_type', 'limit_price',
        'status', 'price_source', 'price', 'price_currency', 'fx_rate', 'order_value', 'commission', 'realized_pl', 'account_currency', 'note',
    ];
    private const NUMERIC = ['id', 'quantity', 'limit_price', 'price', 'fx_rate', 'order_value', 'commission', 'realized_pl'];

    /** @return array{0:string,1:string,2:string} nome file, mime, contenuto */
    public static function orders(array $user, string $format): array {
        $format = strtolower($format);
        if (!in_array($format, ['csv', 'xlsx', 'xml'], true)) throw new ApiError(tr('Invalid export format.'));
        $rows = self::rows(Trading::orders($user, 5000), (string)$user['currency']);
        $name = 'orders-' . gmdate('Y-m-d') . '.' . $format;
        switch ($format) {
            case 'csv':  return [$name, 'text/csv; charset=utf-8', self::csv($rows, I18n::$lang === 'it' ? ';' : ',')];
            case 'xml':  return [$name, 'application/xml; charset=utf-8', self::xml($rows, (string)$user['currency'])];
            default:     return [$name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', self::xlsx($rows)];
        }
    }

    /** Righe pronte per l'export (chiavi = COLUMNS). */
    public static function rows(array $orders, string $ccy): array {
        $type = ['now' => 'market', 'next' => 'next_update', 'limit' => 'limit'];
        $src = ['mid' => 'intraday', 'close' => 'close'];
        $out = [];
        foreach (array_reverse($orders) as $o) {   // dal più vecchio al più recente
            $out[] = [
                'id' => (int)$o['id'], 'created_utc' => $o['created_at'], 'executed_utc' => $o['executed_at'],
                'valid_until_utc' => $o['valid_until'], 'ticker' => $o['ticker'], 'market' => $o['market'], 'side' => $o['side'],
                'quantity' => (int)$o['qty'], 'order_type' => $type[$o['mode']] ?? $o['mode'],
                'limit_price' => $o['limit_price'] === null ? null : (float)$o['limit_price'],
                'status' => $o['status'] === 'expired' ? 'not_executed' : $o['status'],
                'price_source' => $o['snapshot'] === null ? null : ($src[$o['snapshot']] ?? $o['snapshot']),
                'price' => $o['price'] === null ? null : (float)$o['price'], 'price_currency' => $o['price_ccy'],
                'fx_rate' => $o['fx_rate'] === null ? null : (float)$o['fx_rate'],
                'order_value' => $o['gross'] === null ? null : (float)$o['gross'],
                'commission' => $o['commission'] === null ? null : (float)$o['commission'],
                'realized_pl' => $o['realized_pl'] === null ? null : (float)$o['realized_pl'],
                'account_currency' => $ccy, 'note' => $o['note'],
            ];
        }
        return $out;
    }

    // ------------------------------------------------------------ CSV
    public static function csv(array $rows, string $delim = ','): string {
        $f = fopen('php://temp', 'w+');
        fputcsv($f, self::COLUMNS, $delim);
        foreach ($rows as $r) {
            $line = [];
            foreach (self::COLUMNS as $c) $line[] = self::csvCell($r[$c] ?? '');
            fputcsv($f, $line, $delim);
        }
        rewind($f);
        $s = stream_get_contents($f);
        fclose($f);
        return "\xEF\xBB\xBF" . $s;   // BOM UTF-8: Excel apre gli accenti correttamente
    }

    /** Neutralizza le formule (=, +, -, @) nei campi testo, per evitare CSV injection in Excel. */
    private static function csvCell($v) {
        if (is_string($v) && $v !== '' && strpos("=+-@\t\r", $v[0]) !== false) return "'" . $v;
        return $v;
    }

    // ------------------------------------------------------------ XML
    private static function x(string $s): string {
        $s = preg_replace('/[^\x{9}\x{A}\x{D}\x{20}-\x{D7FF}\x{E000}-\x{FFFD}]/u', '', $s) ?? '';
        return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    public static function xml(array $rows, string $ccy): string {
        $x = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $x .= '<orders currency="' . self::x($ccy) . '" exported="' . gmdate('Y-m-d\TH:i:s\Z') . '" count="' . count($rows) . "\">\n";
        foreach ($rows as $r) {
            $x .= '  <order id="' . (int)$r['id'] . "\">\n";
            foreach (self::COLUMNS as $c) {
                if ($c === 'id') continue;
                $v = $r[$c] ?? null;
                $x .= '    <' . $c . '>' . ($v === null ? '' : self::x((string)$v)) . '</' . $c . ">\n";
            }
            $x .= "  </order>\n";
        }
        return $x . "</orders>\n";
    }

    // ------------------------------------------------------------ XLSX
    private static function col(int $i): string {   // 0 -> A, 25 -> Z, 26 -> AA
        $s = '';
        for ($i++; $i > 0; $i = intdiv($i - 1, 26)) $s = chr(65 + ($i - 1) % 26) . $s;
        return $s;
    }

    public static function xlsx(array $rows): string {
        $n = count(self::COLUMNS);
        $sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            . '<cols><col min="1" max="' . $n . '" width="16" customWidth="1"/></cols><sheetData>';
        $sheet .= '<row r="1">';
        foreach (self::COLUMNS as $i => $c) $sheet .= '<c r="' . self::col($i) . '1" t="inlineStr" s="1"><is><t>' . self::x($c) . '</t></is></c>';
        $sheet .= '</row>';
        foreach ($rows as $ri => $r) {
            $rn = $ri + 2;
            $sheet .= '<row r="' . $rn . '">';
            foreach (self::COLUMNS as $i => $c) {
                $v = $r[$c] ?? null;
                if ($v === null || $v === '') continue;
                $ref = self::col($i) . $rn;
                if (in_array($c, self::NUMERIC, true)) $sheet .= '<c r="' . $ref . '"><v>' . (0 + $v) . '</v></c>';
                else $sheet .= '<c r="' . $ref . '" t="inlineStr"><is><t xml:space="preserve">' . self::x((string)$v) . '</t></is></c>';
            }
            $sheet .= '</row>';
        }
        $sheet .= '</sheetData><autoFilter ref="A1:' . self::col($n - 1) . (count($rows) + 1) . '"/></worksheet>';

        $ns = 'http://schemas.openxmlformats.org/';
        $files = [
            '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
                . '<Types xmlns="' . $ns . 'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                . '<Default Extension="xml" ContentType="application/xml"/>'
                . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
            '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
                . '<Relationships xmlns="' . $ns . 'package/2006/relationships"><Relationship Id="rId1" Type="' . $ns . 'officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
            'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
                . '<workbook xmlns="' . $ns . 'spreadsheetml/2006/main" xmlns:r="' . $ns . 'officeDocument/2006/relationships"><sheets><sheet name="Orders" sheetId="1" r:id="rId1"/></sheets></workbook>',
            'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
                . '<Relationships xmlns="' . $ns . 'package/2006/relationships"><Relationship Id="rId1" Type="' . $ns . 'officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
                . '<Relationship Id="rId2" Type="' . $ns . 'officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
            'xl/styles.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
                . '<styleSheet xmlns="' . $ns . 'spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
                . '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
                . '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
                . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
                . '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>',
            'xl/worksheets/sheet1.xml' => $sheet,
        ];
        return self::zip($files);
    }

    /** Archivio ZIP minimale senza compressione (metodo «stored»). */
    private static function zip(array $files): string {
        $date = ((2026 - 1980) << 9) | (1 << 5) | 1;   // 2026-01-01
        $out = ''; $central = ''; $count = 0;
        foreach ($files as $name => $data) {
            $crc = crc32($data);
            $len = strlen($data);
            $offset = strlen($out);
            $out .= pack('VvvvvvVVVvv', 0x04034b50, 20, 0, 0, 0, $date, $crc, $len, $len, strlen($name), 0) . $name . $data;
            $central .= pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0, 0, 0, $date, $crc, $len, $len, strlen($name), 0, 0, 0, 0, 0, $offset) . $name;
            $count++;
        }
        return $out . $central . pack('VvvvvVVv', 0x06054b50, 0, 0, $count, $count, strlen($central), strlen($out), 0);
    }
}
