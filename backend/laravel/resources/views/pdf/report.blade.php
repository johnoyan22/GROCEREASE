<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@page { margin: 36px 30px 46px; } body { font-family: 'DejaVu Sans', sans-serif; font-size: 9px; color: #1e293b; }
h1 { color: #14532d; font-size: 20px; margin-bottom: 6px; } p { line-height: 1.5; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; } thead { display: table-header-group; }
th { text-align: left; background: #f0fdf4; color: #14532d; } td, th { border-bottom: 1px solid #e2e8f0; padding: 6px 5px; vertical-align: top; word-wrap: break-word; }
tr { page-break-inside: avoid; } .totals { margin-top: 16px; padding: 10px; background: #f8faf9; } .note { color: #475569; font-size: 8px; }
footer { position: fixed; bottom: -26px; font-size: 8px; color: #475569; }
</style></head><body><footer>GrocerEase • {{ $report['scope'] }} • Generated {{ $report['generated_at'] }}</footer>
<h1>{{ $report['report_title'] }}</h1><p>Scope: {{ $report['scope'] }}<br>Period: {{ $report['from'] ?? 'All recorded dates' }} to {{ $report['until'] ?? 'Latest recorded date' }}<br>Generated: {{ $report['generated_at'] }}<br>Records: {{ count($report['rows']) }}</p>
@if ($report['filters'])<p class="note">Filters: @foreach ($report['filters'] as $key => $value) {{ $key }} = {{ $value }}; @endforeach</p>@endif
<table><thead><tr>@foreach ($report['headings'] as $heading)<th>{{ $heading }}</th>@endforeach</tr></thead><tbody>
@forelse ($report['rows'] as $row)<tr>@foreach ($row as $cell)<td>{{ $cell }}</td>@endforeach</tr>
@empty<tr><td colspan="{{ count($report['headings']) }}">No records match these filters.</td></tr>@endforelse
</tbody></table><div class="totals">@foreach ($report['totals'] as $label => $value)<p><strong>{{ $label }}:</strong> {{ $value }}</p>@endforeach</div>
<p class="note">{{ $report['note'] }}</p></body></html>
