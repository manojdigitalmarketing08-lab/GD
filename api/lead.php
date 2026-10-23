<?php
/**
 * POST /api/lead.php  (JSON body)
 *
 * 1. validates the lead
 * 2. saves it to MySQL (with source + page)  <- the lead is safe from here on
 * 3. responds to the browser
 * 4. then sends the team email, the visitor auto-reply and the WhatsApp alert,
 *    recording each result in the leads row.
 */
declare(strict_types=1);

require __DIR__ . '/lib/Smtp.php';
require __DIR__ . '/lib/WhatsApp.php';

// Hostinger ships mbstring; this keeps the endpoint working where it is missing.
if (!function_exists('mb_substr')) {
    function mb_substr(string $s, int $start, ?int $len = null): string
    {
        return iconv_substr($s, $start, $len ?? iconv_strlen($s), 'UTF-8') ?: '';
    }
}

date_default_timezone_set('Asia/Kolkata');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
ob_start();

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
}

function clip(mixed $v, int $max): string
{
    $v = is_scalar($v) ? (string) $v : '';
    return mb_substr(trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $v)), 0, $max);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    error_log('lead.php: api/config.php is missing');
    respond(500, ['ok' => false, 'error' => 'Server is not configured']);
    exit;
}
$cfg = require $configFile;

// Same-site submissions only.
$origin = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
if ($originHost === '' || !in_array($originHost, $cfg['allowed_hosts'], true)) {
    respond(403, ['ok' => false, 'error' => 'Forbidden']);
    exit;
}

$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in)) {
    $in = $_POST;
}

// Honeypot: real visitors never fill this. Pretend success, store nothing.
if (clip($in['company_fax'] ?? '', 50) !== '') {
    respond(200, ['ok' => true]);
    exit;
}

$name        = clip($in['name'] ?? '', 80);
$email       = clip($in['email'] ?? '', 190);
$countryCode = clip($in['country_code'] ?? '+91', 8);
$phone       = preg_replace('/\D/', '', (string) ($in['phone'] ?? ''));
$phone       = ltrim($phone, '0');
$site        = clip($in['website'] ?? '', 255);
$service     = clip($in['service'] ?? '', 80);
$message     = clip($in['message'] ?? '', 1000);

// Same rules as the browser form (js/script.js), enforced again here.
$phoneRules = ['+91' => [10, 10, '/^[6-9]/'], '+1' => [10, 10, '/^[2-9]/'], '+44' => [10, 10, '/^7/'], '+971' => [9, 9, null], '+65' => [8, 8, null]];
[$minLen, $maxLen, $firstDigit] = $phoneRules[$countryCode] ?? [6, 14, null];

$errors = [];
if (!preg_match('/^[\p{L}\p{M}][\p{L}\p{M} .\'\x{2019}-]{1,79}$/u', $name)) {
    $errors['name'] = 'Please enter your name (letters only).';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^[^\s@<>()]+@[^\s@<>()]+\.[A-Za-z]{2,}$/', $email)) {
    $errors['email'] = 'Please enter a valid email address.';
}
if (!preg_match('/^\+\d{1,4}$/', $countryCode)) {
    $errors['phone'] = 'Please choose a valid country code.';
} elseif ($phone === '' || strlen($phone) < $minLen || strlen($phone) > $maxLen || ($firstDigit && !preg_match($firstDigit, $phone))) {
    $errors['phone'] = 'Please enter a valid phone number.';
}
if ($site !== '') {
    if (!preg_match('/^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i', $site)) {
        $errors['website'] = 'Please enter a valid website.';
    } elseif (!preg_match('/^https?:\/\//i', $site)) {
        $site = 'https://' . $site;
    }
}
if ($errors) {
    respond(422, ['ok' => false, 'error' => reset($errors), 'fields' => $errors]);
    exit;
}
$phoneFull = $countryCode . ' ' . $phone;

$details = [];
if (isset($in['details']) && is_array($in['details'])) {
    foreach (array_slice($in['details'], 0, 30, true) as $k => $v) {
        $details[clip($k, 40)] = is_array($v)
            ? implode(', ', array_map(fn($x) => clip($x, 80), array_slice($v, 0, 20)))
            : clip($v, 300);
    }
}

$utmSource   = clip($in['utm_source'] ?? '', 120);
$utmMedium   = clip($in['utm_medium'] ?? '', 120);
$utmCampaign = clip($in['utm_campaign'] ?? '', 160);
$referrer    = clip($in['referrer'] ?? '', 500);
$refHost     = strtolower((string) parse_url($referrer, PHP_URL_HOST));
$refHost     = preg_replace('/^www\./', '', $refHost);
$ownHost     = preg_replace('/^www\./', '', $originHost);
$source      = $utmSource !== '' ? $utmSource
    : (($refHost !== '' && $refHost !== $ownHost) ? $refHost : 'direct');

$pagePath = clip($in['page_path'] ?? '/', 255);
$pagePath = $pagePath !== '' && $pagePath[0] === '/' ? $pagePath : '/';
$formType = clip($in['form_type'] ?? 'form', 60);
$ip       = clip($_SERVER['REMOTE_ADDR'] ?? '', 45);
$ua       = clip($_SERVER['HTTP_USER_AGENT'] ?? '', 255);

// ---- 1. Save to the database ---------------------------------------------
try {
    $pdo = new PDO($cfg['db']['dsn'], $cfg['db']['user'], $cfg['db']['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $pdo->exec(file_get_contents(__DIR__ . '/schema.sql'));
    // Older installs: add columns introduced later.
    $have = array_column($pdo->query('SHOW COLUMNS FROM leads')->fetchAll(PDO::FETCH_ASSOC), 'Field');
    foreach (['country_code' => 'VARCHAR(8) NULL AFTER phone', 'service' => 'VARCHAR(80) NULL AFTER website', 'message' => 'TEXT NULL AFTER service'] as $col => $def) {
        if (!in_array($col, $have, true)) {
            $pdo->exec("ALTER TABLE leads ADD COLUMN $col $def");
        }
    }

    $recent = $pdo->prepare('SELECT COUNT(*) FROM leads WHERE ip = ? AND created_at > ?');
    $recent->execute([$ip, date('Y-m-d H:i:s', time() - 600)]);
    if ((int) $recent->fetchColumn() >= (int) ($cfg['rate_limit'] ?? 5)) {
        respond(429, ['ok' => false, 'error' => 'Too many requests. Please try again in a few minutes.']);
        exit;
    }

    $ins = $pdo->prepare(
        'INSERT INTO leads (created_at, name, email, country_code, phone, website, service, message, form_type, page_path, page_url, source,
            utm_source, utm_medium, utm_campaign, referrer, details, ip, user_agent)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    $ins->execute([
        date('Y-m-d H:i:s'), $name, $email, $countryCode, $phone, $site ?: null, $service ?: null, $message ?: null, $formType, $pagePath,
        'https://www.gddigitalmarketing.com' . $pagePath, $source,
        $utmSource ?: null, $utmMedium ?: null, $utmCampaign ?: null, $referrer ?: null,
        $details ? json_encode($details, JSON_UNESCAPED_UNICODE) : null, $ip, $ua,
    ]);
    $id = (int) $pdo->lastInsertId();
} catch (Throwable $e) {
    error_log('lead.php DB error: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'We could not save your request. Please try again or email us.']);
    exit;
}

// ---- 2. Answer the visitor now, notify in the background ------------------
respond(200, ['ok' => true, 'id' => $id]);
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} else {
    header('Connection: close');
    header('Content-Length: ' . ob_get_length());
    @ob_end_flush();
    @flush();
}
ignore_user_abort(true);

$lines = [
    "New lead #$id",
    "Name: $name",
    "Email: $email",
    "Phone: $phoneFull",
    'Website: ' . ($site ?: '-'),
    'Service: ' . ($service ?: '-'),
    'Message: ' . ($message ?: '-'),
    "Form: $formType",
    "Page: $pagePath",
    "Source: $source" . ($utmMedium !== '' ? " / $utmMedium" : '') . ($utmCampaign !== '' ? " / $utmCampaign" : ''),
];
foreach ($details as $k => $v) {
    $lines[] = "$k: $v";
}
$lines[] = 'Received: ' . date('d M Y, h:i A') . ' IST';

// ---- 3. Email via Hostinger SMTP ------------------------------------------
$emailStatus = 'skipped';
$mail = $cfg['mail'] ?? [];
if (!empty($mail['enabled'])) {
    try {
        $smtp = new Smtp($mail);
        $smtp->send($mail['notify_to'], "New lead: $name ($pagePath)", implode("\n", $lines), $email);
        $emailStatus = 'sent';
        // The auto-reply goes to an unverified address, so: never echo free text
        // (only a plain-looking first name) and cap auto-replies per hour site-wide.
        $hourly = $pdo->prepare('SELECT COUNT(*) FROM leads WHERE created_at > ? AND email_status LIKE ?');
        $hourly->execute([date('Y-m-d H:i:s', time() - 3600), '%autoreply%']);
        $underCap = (int) $hourly->fetchColumn() < (int) ($mail['autoreply_hourly_cap'] ?? 30);
        if (!empty($mail['autoreply']) && $underCap) {
            $firstWord = strtok($name, ' ') ?: '';
            $first = preg_match('/^[\p{L}][\p{L}.\'-]{0,29}$/u', $firstWord) ? $firstWord : 'there';
            $smtp->send(
                $email,
                'We received your request | GD Digital Marketing',
                "Hi $first,\n\nThanks for contacting GD Digital Marketing. A senior strategist will review your details "
                . "and reply within one business day.\n\nGD Digital Marketing\nhttps://www.gddigitalmarketing.com\n"
            );
            $emailStatus = 'sent+autoreply';
        }
    } catch (Throwable $e) {
        $emailStatus = 'failed: ' . mb_substr($e->getMessage(), 0, 200);
        error_log('lead.php mail: ' . $e->getMessage());
    }
}

// ---- 4. WhatsApp alert ------------------------------------------------------
$waStatus = 'skipped';
$wa = $cfg['whatsapp'] ?? [];
if (!empty($wa['enabled'])) {
    try {
        // Template body: "New lead: {{1}} | {{2}} | {{3}} | page {{4}} | source {{5}}"
        (new WhatsApp($wa))->sendTemplate([$name, $phoneFull, $email, $pagePath, $source]);
        $waStatus = 'sent';
    } catch (Throwable $e) {
        $waStatus = 'failed: ' . mb_substr($e->getMessage(), 0, 200);
        error_log('lead.php whatsapp: ' . $e->getMessage());
    }
}

try {
    $pdo->prepare('UPDATE leads SET email_status = ?, whatsapp_status = ? WHERE id = ?')
        ->execute([$emailStatus, $waStatus, $id]);
} catch (Throwable $e) {
    error_log('lead.php status update: ' . $e->getMessage());
}
