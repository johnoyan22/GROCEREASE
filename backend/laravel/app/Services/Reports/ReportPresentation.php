<?php

namespace App\Services\Reports;

class ReportPresentation
{
    // Presentation only: saved rows, counts, filters and money remain unchanged.
    public function compact(array $report): array
    {
        $labels = [
            'Out-of-stock products (available = 0)' => 'Out of stock (available)',
            'Recorded nondepleted expired batches' => 'Expired batches with stock',
            'Recorded availability changes' => 'Availability changes',
            'Gross actual payments collected' => 'Gross actual collections',
            'Actual verified collections' => 'Actual collection count',
            'Test / sandbox collections (excluded from actual)' => 'Test / sandbox collections',
            'Legacy / unclassified collections (excluded from actual)' => 'Legacy / unclassified collections',
            'Records excluded: invalid payment evidence (all modes)' => 'Invalid payments excluded (all modes)',
            'No-show strikes issued in period' => 'No-show strikes issued',
        ];
        foreach ($report['metrics'] as &$metric) {
            $metric['label_short'] = $labels[$metric['label']] ?? $metric['label'];
            $optional = in_array($metric['label'], [
                'Test / sandbox collections (excluded from actual)', 'Legacy / unclassified collections (excluded from actual)',
                'Records excluded: invalid payment evidence (all modes)',
            ], true);
            $metric['visible'] = !$optional || $metric['value'] !== 0;
        }
        unset($metric);
        $headings = [
            'stock' => ['Stock summary', ''], 'batches' => ['Batches and expiry', ''],
            'impacts' => ['Approved stock changes', 'Approval date'],
            'requests' => ['Stock requests', 'Approved: decision date. Pending/rejected: request date.'],
            'availability' => ['Availability changes', 'Recorded date'],
            'payments' => ['Collections', 'Payment date. Pickup counts are current.'],
            'refunds' => ['Refund status', 'Current status. No refund amounts deducted.'],
            'handovers' => ['Completed pickups', 'Handover date'],
            'placed' => ['Orders placed', 'Order date. Current status.'],
            'events' => ['Order events', 'Completion / cancellation / no-show / handover date'],
            'inventory' => ['Current stock counts', 'As of generation time'],
            'strikes' => ['No-show strikes', 'Issue date. Current valid/voided status.'],
            'restriction_sources' => ['Restriction sources', 'Current distinct customers; each counted once.'],
            'cop_decisions' => ['Access decisions and expiry', 'Recorded decision / saved expiry date. Global actions for the selected customer cohort.'],
            'restrictions' => ['Current COP restrictions', $report['filters']['store_id']
                ? 'Global access for customers with orders or strikes at this store.' : 'Current customer counts across stores.'],
        ];
        $hasRows = array_sum(array_column($report['sections'], 'row_count')) > 0;
        foreach ($report['sections'] as $index => &$section) {
            [$section['title_short'], $section['date_basis']] = $headings[$section['key']] ?? [$section['title'], ''];
            $section['visible'] = $hasRows ? $section['row_count'] > 0 : $index === 0;
            if ($section['key'] === 'refunds' && collect($section['rows'])->every(fn ($row) => $row['status'] === 'not_required')) $section['visible'] = false;
            if ($section['key'] === 'batches' && ($report['filters']['status'] ?? '') === 'expiring_30') {
                $from = \Carbon\CarbonImmutable::parse($report['generated_at'])->setTimezone('Asia/Manila');
                $section['date_basis'] = 'Expiry: '.$from->format('Y-m-d').' to '.$from->addDays(30)->format('Y-m-d').'. Remaining stock only.';
            }
        }
        unset($section);
        $report['display_notes'] = array_map(fn ($note) => $note === 'An approved historical correction has no recorded delta; its quantity impact is unavailable and excluded.'
            ? 'Some approved historical correction deltas are unavailable and excluded.' : $note, $report['notes']);
        return $report;
    }
}
