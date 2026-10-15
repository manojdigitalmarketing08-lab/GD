# Lead capture setup (Hostinger)

Every form on the site (header popup, home plan form, service-page forms, Local SEO forms) posts JSON to `/api/lead.php`.
Order of work: validate -> **save to MySQL** -> reply to the visitor -> send team email, visitor auto-reply and WhatsApp alert.
If email or WhatsApp fail the lead is still saved; the result is stored in `email_status` / `whatsapp_status`.

## 1. Database
hPanel > Databases > MySQL Databases: create a database + user. The `leads` table is created automatically on the first submission (or run `api/schema.sql` in phpMyAdmin).
Stored per lead: name, email, phone, website, **form_type**, **page_path / page_url**, **source** (utm_source, else referrer host, else `direct`), utm_medium, utm_campaign, referrer, details (JSON of the other answers), IP, user agent, and the two delivery statuses.

## 2. Config
Copy `api/config.sample.php` to `api/config.php` on the server and fill in the database, mailbox and WhatsApp values. `config.php` is git-ignored and blocked from the web.

## 3. Email (Hostinger SMTP)
hPanel > Emails: create the mailbox (e.g. `hello@gddigitalmarketing.com`). Use `smtp.hostinger.com`, port 465 (`ssl`) or 587 (`tls`), the mailbox address and password. `notify_to` receives the lead alert; the visitor gets an auto-reply.

## 4. WhatsApp Cloud API (Meta)
1. Meta Business > WhatsApp > API setup: add/verify the sending number, note the **Phone number ID**.
2. Create a **System User** token with `whatsapp_business_messaging` (permanent token).
3. Create and get approved a **Utility** template named `new_lead` (language `en`) with exactly 5 body variables:
   `New lead: {{1}} | phone {{2}} | {{3}} | page {{4}} | source {{5}}`
4. Put the token, phone number ID and the team's receiving number (digits, country code) in `config.php`.

Template messages are required because the alert is business-initiated; plain text only works inside a 24h customer window.

## Reading leads
phpMyAdmin > `leads`, newest first. Useful: `SELECT source, COUNT(*) FROM leads GROUP BY source;`
