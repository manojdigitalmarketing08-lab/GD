<?php
/** WhatsApp Business Cloud API: template message to the team number. */
final class WhatsApp
{
    public function __construct(private array $c) {}

    /** @param string[] $params values for template placeholders {{1}}..{{n}} */
    public function sendTemplate(array $params): void
    {
        $url = 'https://graph.facebook.com/' . $this->c['api_version'] . '/' . $this->c['phone_number_id'] . '/messages';
        $payload = [
            'messaging_product' => 'whatsapp',
            'to'       => preg_replace('/\D/', '', $this->c['to']),
            'type'     => 'template',
            'template' => [
                'name'       => $this->c['template'],
                'language'   => ['code' => $this->c['language']],
                'components' => [[
                    'type'       => 'body',
                    'parameters' => array_map(
                        fn($p) => ['type' => 'text', 'text' => $this->clean($p)],
                        $params
                    ),
                ]],
            ],
        ];
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $this->c['token'], 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode($payload),
        ]);
        $out  = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err  = curl_error($ch);
        curl_close($ch);
        if ($out === false) {
            throw new RuntimeException('WhatsApp request failed: ' . $err);
        }
        if ($code < 200 || $code >= 300) {
            $msg = json_decode($out, true)['error']['message'] ?? substr($out, 0, 150);
            throw new RuntimeException("WhatsApp API $code: $msg");
        }
    }

    /** Template params cannot contain newlines/tabs or be empty. */
    private function clean(string $s): string
    {
        $s = trim(preg_replace('/\s+/', ' ', $s));
        return mb_substr($s === '' ? '-' : $s, 0, 200);
    }
}
