<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Reports\ReportAccess;
use App\Services\Reports\ReportPdf;
use App\Services\Reports\ReportSnapshots;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    public function options(Request $request, ReportAccess $access)
    {
        return DB::transaction(fn () => $this->json($access->options($access->context($request))));
    }

    public function generate(Request $request, ReportAccess $access, ReportSnapshots $snapshots)
    {
        return DB::transaction(function () use ($request, $access, $snapshots) {
            $context = $access->context($request);
            $snapshot = $snapshots->create($request, $context, $access->filters($request, $context));
            return $this->json(['report' => $snapshots->preview($snapshot, $request)], 201);
        }, 3);
    }

    public function show(Request $request, string $snapshot, ReportAccess $access, ReportSnapshots $snapshots)
    {
        return DB::transaction(function () use ($request, $snapshot, $access, $snapshots) {
            $record = $snapshots->get($snapshot, $access->context($request));
            return $this->json(['report' => $snapshots->preview($record, $request)]);
        }, 3);
    }

    public function pdf(Request $request, string $snapshot, ReportAccess $access, ReportSnapshots $snapshots, ReportPdf $pdf)
    {
        abort_if($request->query(), 422, 'Export uses the saved report only; generate again to change filters.');
        return DB::transaction(function () use ($request, $snapshot, $access, $snapshots, $pdf) {
            // Hold current placement locks throughout rendering so reassignment cannot race export authorization.
            $record = $snapshots->get($snapshot, $access->context($request));
            $filename = 'GrocerEase-'.$record['type'].'-'.substr($record['generated_at'], 0, 10).'.pdf';
            return response($pdf->render($record), 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="'.$filename.'"',
                'Cache-Control' => 'no-store, private', 'Pragma' => 'no-cache', 'X-Content-Type-Options' => 'nosniff']);
        }, 3);
    }

    private function json(array $data, int $status = 200)
    {
        return response()->json($data, $status)->header('Cache-Control', 'no-store, private')->header('Pragma', 'no-cache');
    }
}
