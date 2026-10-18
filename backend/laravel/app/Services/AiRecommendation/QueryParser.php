<?php

namespace App\Services\AiRecommendation;

/**
 * Turns free text like "pasta for 4 under 500" into structured parameters.
 * This keyword version works without an API key. A Gemini-backed parser can
 * later return the same array shape without changing anything else.
 */
class QueryParser
{
    private const STOPWORDS = [
        'what', 'are', 'you', 'looking', 'for', 'today', 'want', 'need', 'some', 'the',
        'and', 'with', 'under', 'below', 'within', 'budget', 'than', 'less', 'max',
        'maximum', 'people', 'person', 'persons', 'pax', 'guests', 'guest', 'kids',
        'adults', 'good', 'serve', 'serves', 'feed', 'feeds', 'pesos', 'peso', 'php',
        'idea', 'ideas', 'ingredient', 'ingredients', 'please', 'can', 'get', 'buy',
        'have', 'has', 'any', 'help', 'find', 'make', 'cook', 'meal', 'dinner', 'lunch',
    ];

    /**
     * @return array{budget: ?float, headcount: ?int, keywords: list<string>}
     */
    public function parse(string $text): array
    {
        $clean = mb_strtolower(trim($text));

        return [
            'budget' => $this->budget($clean),
            'headcount' => $this->headcount($clean),
            'keywords' => $this->keywords($clean),
        ];
    }

    private function budget(string $text): ?float
    {
        $patterns = [
            '/(?:under|below|within|budget(?:\s+of)?|less\s+than|max(?:imum)?|up\s+to)\s*(?:₱|php|p)?\s*(\d[\d,]*(?:\.\d+)?)/u',
            '/(?:₱|php)\s*(\d[\d,]*(?:\.\d+)?)/u',
            '/(\d[\d,]*(?:\.\d+)?)\s*(?:pesos?|php)\b/u',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $m)) {
                $value = (float) str_replace(',', '', $m[1]);

                return $value > 0 ? $value : null;
            }
        }

        return null;
    }

    private function headcount(string $text): ?int
    {
        $patterns = [
            '/\b(?:for|serves?|feeds?)\s+(\d{1,2})\b/u',
            '/\b(\d{1,2})\s*(?:people|persons?|pax|guests?|adults|kids|heads|servings?)\b/u',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $m)) {
                $count = (int) $m[1];

                return $count > 0 ? $count : null;
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    private function keywords(string $text): array
    {
        $words = preg_split('/[^\p{L}]+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $keywords = [];

        foreach ($words as $word) {
            if (mb_strlen($word) < 3 || in_array($word, self::STOPWORDS, true)) {
                continue;
            }

            // Crude singular form so "eggs" matches "Egg".
            if (mb_strlen($word) > 3 && str_ends_with($word, 's') && ! str_ends_with($word, 'ss')) {
                $word = mb_substr($word, 0, -1);
            }

            $keywords[$word] = true;
        }

        return array_keys($keywords);
    }
}