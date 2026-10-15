<?php
/** Minimal SMTP client (AUTH LOGIN over SSL 465 or STARTTLS 587). No dependencies. */
final class Smtp
{
    private $fp;

    public function __construct(private array $c) {}

    public function send(string $to, string $subject, string $body, ?string $replyTo = null): void
    {
        $host = ($this->c['secure'] === 'ssl' ? 'ssl://' : '') . $this->c['host'];
        $this->fp = @stream_socket_client($host . ':' . (int) $this->c['port'], $errno, $errstr, 15);
        if (!$this->fp) {
            throw new RuntimeException("SMTP connect failed: $errstr");
        }
        stream_set_timeout($this->fp, 15);
        $this->expect(220);
        $this->cmd('EHLO gddigitalmarketing.com', 250);
        if ($this->c['secure'] === 'tls') {
            $this->cmd('STARTTLS', 220);
            if (!stream_socket_enable_crypto($this->fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('SMTP STARTTLS failed');
            }
            $this->cmd('EHLO gddigitalmarketing.com', 250);
        }
        $this->cmd('AUTH LOGIN', 334);
        $this->cmd(base64_encode($this->c['user']), 334);
        $this->cmd(base64_encode($this->c['pass']), 235);
        $this->cmd('MAIL FROM:<' . $this->addr($this->c['from']) . '>', 250);
        $this->cmd('RCPT TO:<' . $this->addr($to) . '>', [250, 251]);
        $this->cmd('DATA', 354);

        $h = [
            'Date: ' . date('r'),
            'From: ' . $this->mimeWord($this->c['from_name']) . ' <' . $this->addr($this->c['from']) . '>',
            'To: <' . $this->addr($to) . '>',
            'Subject: ' . $this->mimeWord($subject),
            'Message-ID: <' . bin2hex(random_bytes(8)) . '@gddigitalmarketing.com>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
        ];
        if ($replyTo) {
            $h[] = 'Reply-To: <' . $this->addr($replyTo) . '>';
        }
        // base64 body contains no lone dots, so no dot-stuffing is needed.
        fwrite($this->fp, implode("\r\n", $h) . "\r\n\r\n" . chunk_split(base64_encode($body)) . "\r\n.\r\n");
        $this->expect(250);
        $this->cmd('QUIT', 221);
        fclose($this->fp);
    }

    /** Strip anything that could inject headers or extra commands. */
    private function addr(string $a): string
    {
        return preg_replace('/[\r\n<>]/', '', $a);
    }

    private function mimeWord(string $s): string
    {
        return '=?UTF-8?B?' . base64_encode(preg_replace('/[\r\n]+/', ' ', $s)) . '?=';
    }

    private function cmd(string $line, int|array $ok): void
    {
        fwrite($this->fp, $line . "\r\n");
        $this->expect($ok);
    }

    private function expect(int|array $ok): void
    {
        $ok = (array) $ok;
        $resp = '';
        while (($l = fgets($this->fp, 515)) !== false) {
            $resp .= $l;
            if (strlen($l) < 4 || $l[3] === ' ') {
                break;
            }
        }
        if (!in_array((int) substr($resp, 0, 3), $ok, true)) {
            throw new RuntimeException('SMTP error: ' . trim(substr($resp, 0, 200)));
        }
    }
}
