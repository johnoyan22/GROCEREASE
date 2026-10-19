<?php

namespace App\Services\AiRecommendation;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Thin wrapper around the Gemini generateContent REST endpoint.
 * It never throws during a shopper request: on any problem (no key, timeout,
 * quota, bad output) generateJson() returns null and callers fall back.
 * Nothing sensitive is logged: no key, no prompt, no shopper text.
 */
class GeminiClient
{
    private const COOLDOWN_KEY = 'habel_ai:gemini_cooldown';

    public function isConfigured(): bool
    {
        return filled(config('habel_ai.gemini.key')) && filled(config('habel_ai.gemini.model'));
    }

    /**
     * Ask Gemini for JSON that matches $schema. Returns the decoded array or null.
     *
     * @param  list<array<string, mixed>>  $parts  Gemini "parts" (text and/or inline_data)
     */
    public function generateJson(array $parts, array $schema, string $systemInstruction): ?array
    {
        $cache = Cache::store('file');

        if (! $this->isConfigured() || $cache->has(self::COOLDOWN_KEY)) {
            return null;
        }

        try {
            $response = $this->http()->post(
                $this->url('models/' . config('habel_ai.gemini.model') . ':generateContent'),
                [
                    'systemInstruction' => ['parts' => [['text' => $systemInstruction]]],
                    'contents' => [['role' => 'user', 'parts' => $parts]],
                    'generationConfig' => [
                        'temperature' => 0.2,
                        'responseMimeType' => 'application/json',
                        'responseSchema' => $schema,
                    ],
                ],
            );
        } catch (Throwable $exception) {
            Log::warning('Gemini request failed.', ['exception_class' => $exception::class]);

            return null;
        }

        if ($response->status() === 429) {
            // Over quota: stop calling Gemini for a minute so the page stays fast.
            $cache->put(self::COOLDOWN_KEY, true, 60);
            Log::warning('Gemini rate limit reached; using fallback for 60 seconds.');

            return null;
        }

        if ($response->failed()) {
            Log::warning('Gemini returned an error.', [
                'status' => $response->status(),
                'detail' => mb_substr((string) $response->json('error.message'), 0, 200),
            ]);

            return null;
        }

        $text = $response->json('candidates.0.content.parts.0.text');
        $decoded = is_string($text) ? json_decode($text, true) : null;

        if (! is_array($decoded)) {
            Log::warning('Gemini returned output that was not valid JSON.');

            return null;
        }

        return $decoded;
    }

    /**
     * Model names this key can use with generateContent. For setup checks in tinker.
     *
     * @return list<string>
     */
    public function models(): array
    {
        if (blank(config('habel_ai.gemini.key'))) {
            throw new RuntimeException('GEMINI_API_KEY is not set.');
        }

        $response = $this->http()->get($this->url('models'), ['pageSize' => 1000]);

        if ($response->failed()) {
            throw new RuntimeException('Gemini models request failed with status ' . $response->status() . '.');
        }

        return collect($response->json('models', []))
            ->filter(fn ($model) => in_array('generateContent', $model['supportedGenerationMethods'] ?? [], true))
            ->map(fn ($model) => str_replace('models/', '', $model['name']))
            ->values()
            ->all();
    }

    private function http()
    {
        return Http::withHeaders(['x-goog-api-key' => (string) config('habel_ai.gemini.key')])
            ->acceptJson()
            ->timeout((int) config('habel_ai.gemini.timeout'));
    }

    private function url(string $path): string
    {
        return rtrim((string) config('habel_ai.gemini.base_url'), '/') . '/' . $path;
    }
}