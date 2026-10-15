<?php
/**
 * Front controller for clean URLs.
 *
 *   /                        -> index.html
 *   /services/local-seo-agency -> services/local-seo-agency.html
 *   /some-page                 -> some-page.html
 *
 * Legacy *.html, trailing-slash URLs and renamed slugs are 301-redirected
 * to the canonical slash-less form (the homepage stays "/"). Works under Apache (via .htaccess) and the PHP
 * built-in server:  php -S localhost:8000 router.php
 */

function redirect_to(string $location, string $query): void
{
    header('Location: ' . $location . ($query !== '' ? '?' . $query : ''), true, 301);
    exit;
}

function serve_html(string $file, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: text/html; charset=UTF-8');
    readfile($file);
    exit;
}

function not_found(string $root): void
{
    if (is_file($root . '/404.html')) {
        serve_html($root . '/404.html', 404);
    }
    http_response_code(404);
    echo '<!DOCTYPE html><title>Page not found</title><h1>Page not found</h1><p><a href="/">Back to home</a></p>';
    exit;
}

$root  = __DIR__;
$path  = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$query = $_SERVER['QUERY_STRING'] ?? '';

// PHP built-in server: let real static assets through (same list as .htaccess).
if (PHP_SAPI === 'cli-server' && strpos($path, '/.') === false && is_file($root . $path)
    && preg_match('#\.(css|js|webp|png|jpe?g|svg|gif|ico|woff2?|txt|xml)$#i', $path)) {
    return false;
}

// API endpoints (PHP built-in server): execute the real file.
if (PHP_SAPI === 'cli-server' && preg_match('#^/api/lead\.php$#', $path) && is_file($root . $path)) {
    return false;
}

// Header/footer fragments fetched by js/script.js are served as-is.
if ($path === '/header.html' || $path === '/footer.html' || $path === '/404.html') {
    serve_html($root . $path);
}

// Legacy URLs: /index.html -> /, /services/foo.html -> /services/foo
if (substr($path, -5) === '.html') {
    $clean = substr($path, -11) === '/index.html'
        ? substr($path, 0, -10)
        : substr($path, 0, -5);
    // Only redirect to a validated, site-relative slug (no open redirect via //host).
    $cleanSlug = trim($clean, '/');
    if ($cleanSlug !== '' && !preg_match('#^[a-z0-9-]+(/[a-z0-9-]+)?$#', $cleanSlug)) {
        not_found($root);
    }
    redirect_to('/' . $cleanSlug, $query);
}

// Old service slugs -> canonical slugs from the on-page SEO doc.
$renamed = [
    'services/local-seo'              => '/services/local-seo-agency',
    'services/gmb-optimization'       => '/services/gmb-optimization-services',
    'services/google-ads'             => '/services/google-ads-marketing-agency',
    'services/meta-ads'               => '/services/meta-ads-agency',
    'services/content-marketing'      => '/services/content-marketing-agency',
    'services/social-media-marketing' => '/services/social-media-marketing-agency',
    'services/email-marketing'        => '/services/email-marketing-agency',
    'services/influencer-marketing'   => '/services/influencer-marketing-service',
];
if (isset($renamed[trim($path, '/')])) {
    redirect_to($renamed[trim($path, '/')], $query);
}

// Only lowercase slug segments are routable; blocks traversal and odd input.
$slug = trim($path, '/');
if ($slug !== '' && !preg_match('#^[a-z0-9-]+(/[a-z0-9-]+)?$#', $slug)) {
    not_found($root);
}

$file = $slug === '' ? $root . '/index.html' : $root . '/' . $slug . '.html';
if (!is_file($file)) {
    not_found($root);
}

// Enforce the slash-less canonical form for every page except the homepage.
if ($slug !== '' && substr($path, -1) === '/') {
    redirect_to('/' . $slug, $query);
}

serve_html($file);
