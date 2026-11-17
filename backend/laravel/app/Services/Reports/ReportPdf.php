<?php

namespace App\Services\Reports;

use Barryvdh\DomPDF\Facade\Pdf;

class ReportPdf
{
    public function render(array $snapshot): string
    {
        $snapshot = app(ReportPresentation::class)->compact($snapshot);
        $wide = collect($snapshot['sections'])->contains(fn ($section) => ($section['visible'] ?? true)
            && count($section['rows']) > 0 && count($section['columns']) > 7);
        $pdf = Pdf::loadView('reports.summary', ['report' => $snapshot, 'wide' => $wide])->setPaper('a4', $wide ? 'landscape' : 'portrait')->setOptions([
            'isRemoteEnabled' => false, 'isPhpEnabled' => false, 'isJavascriptEnabled' => false,
            'defaultFont' => 'DejaVu Sans', 'isFontSubsettingEnabled' => true, 'chroot' => base_path(),
            'logOutputFile' => null,
        ]);
        $pdf->render();
        $canvas = $pdf->getDomPDF()->getCanvas();
        $font = $pdf->getDomPDF()->getFontMetrics()->getFont('DejaVu Sans', 'normal');
        $canvas->page_text($canvas->get_width() - 125, $canvas->get_height() - 27, 'Page {PAGE_NUM} of {PAGE_COUNT}', $font, 8, [0, 0, 0]);
        return $pdf->output();
    }
}
