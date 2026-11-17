<?php

namespace App\Services\Reports;

use App\Models\Store;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ReportSnapshots
{
    public function create(Request $request, array $context, array $filters): array
    {
        $now = CarbonImmutable::now('Asia/Manila');
        $dataset = app(ReportBuilder::class)->build($filters, $now);
        $name = trim(($context['user']->profile?->first_name ?? '').' '.($context['user']->profile?->last_name ?? '')) ?: 'Staff member';
        $snapshot = [...$dataset, 'id' => bin2hex(random_bytes(32)), 'type' => $filters['type'], 'title' => ReportAccess::TYPES[$filters['type']][0],
            'generated_at' => $now->toIso8601String(), 'expires_at' => $now->addMinutes(config('reports.ttl_minutes'))->toIso8601String(),
            'generated_by' => $name, 'role' => $context['role'], 'filters' => $filters,
            'store_label' => $filters['store_id'] ? Store::findOrFail($filters['store_id'])->store_name : 'All authorized stores',
            '_owner' => $context['user']->id, '_assigned_store' => $context['store_id'], '_session' => $context['session']];
        $snapshot['notes'] = array_values(array_unique($snapshot['notes']));
        abort_if(strlen(json_encode($snapshot, JSON_THROW_ON_ERROR)) > config('reports.max_bytes'), 422, 'This report is too large. Narrow the filters and generate again.');
        abort_unless(Cache::store(config('reports.cache_store'))->put('report:'.$snapshot['id'], $snapshot, $now->addMinutes(config('reports.ttl_minutes'))), 503, 'Report snapshot storage is unavailable. Try again.');
        return $snapshot;
    }

    public function get(string $id, array $context): array
    {
        $snapshot = Cache::store(config('reports.cache_store'))->get('report:'.$id);
        abort_unless($snapshot, 410, 'This report expired or is unavailable. Generate the report again.');
        abort_unless($snapshot['_owner'] === $context['user']->id && $snapshot['role'] === $context['role']
            && $snapshot['_assigned_store'] === $context['store_id'] && hash_equals($snapshot['_session'], $context['session']), 403, 'This report is unavailable to your current session or store assignment. Generate again.');
        abort_unless(CarbonImmutable::parse($snapshot['expires_at'])->isFuture(), 410, 'This report expired. Generate again.');
        if ($snapshot['filters']['store_id']) abort_unless(Store::whereKey($snapshot['filters']['store_id'])->exists(), 403);
        return $snapshot;
    }

    public function preview(array $snapshot, Request $request): array
    {
        $request->validate(['pages' => ['sometimes', 'array', 'max:5'], 'pages.*' => ['integer', 'min:1']]);
        $pages = $request->input('pages', []);
        abort_if(array_diff(array_keys($request->query()), ['pages']), 422, 'Unexpected report pagination filters.');
        abort_if(array_diff(array_keys($pages), array_column($snapshot['sections'], 'key')), 422, 'Unknown report section.');
        unset($snapshot['_owner'], $snapshot['_assigned_store'], $snapshot['_session']);
        foreach ($snapshot['sections'] as &$section) {
            $last = max(1, (int) ceil($section['row_count'] / config('reports.page_size')));
            $page = (int) ($pages[$section['key']] ?? 1);
            abort_if($page > $last, 422, 'That report page does not exist.');
            $section['rows'] = array_slice($section['rows'], ($page - 1) * config('reports.page_size'), config('reports.page_size'));
            $section += ['page' => $page, 'last_page' => $last];
        }
        return app(ReportPresentation::class)->compact($snapshot);
    }
}
