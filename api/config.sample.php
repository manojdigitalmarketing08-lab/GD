<?php
/**
 * Copy to api/config.php on the server (Hostinger File Manager) and fill in.
 * api/config.php is git-ignored and blocked from the web by api/.htaccess.
 */
return [
    // Hostinger hPanel > Databases > MySQL. Host is normally "localhost".
    'db' => [
        'dsn'  => 'mysql:host=localhost;dbname=u000000000_gd;charset=utf8mb4',
        'user' => 'u000000000_gd',
        'pass' => 'CHANGE_ME',
    ],

    // Hostinger hPanel > Emails > create a mailbox (e.g. hello@gddigitalmarketing.com).
    'mail' => [
        'enabled'   => true,
        'host'      => 'smtp.hostinger.com',
        'port'      => 465,            // 465 = SSL, 587 = STARTTLS
        'secure'    => 'ssl',          // 'ssl' or 'tls'
        'user'      => 'hello@gddigitalmarketing.com',
        'pass'      => 'CHANGE_ME',
        'from'      => 'hello@gddigitalmarketing.com',
        'from_name' => 'GD Digital Marketing',
        'notify_to' => 'hello@gddigitalmarketing.com', // receives new-lead alerts
        'autoreply' => true,           // confirmation email to the visitor
    ],

    // WhatsApp Business Cloud API (Meta). Sends an alert to the team number.
    // Business-initiated messages need an approved template; see api/README-leads.md.
    'whatsapp' => [
        'enabled'         => true,
        'token'           => 'CHANGE_ME',     // permanent system-user token
        'phone_number_id' => '000000000000000',
        'to'              => '919999999999',  // team number, digits only, with country code
        'template'        => 'new_lead',      // approved template name
        'language'        => 'en',
        'api_version'     => 'v21.0',
    ],

    // Only accept submissions from these hosts.
    'allowed_hosts' => ['gddigitalmarketing.com', 'www.gddigitalmarketing.com', 'localhost'],

    // Max submissions per IP in a 10 minute window.
    'rate_limit' => 5,
];
