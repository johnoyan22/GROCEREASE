<?php

namespace App\Services;

use Dompdf\Dompdf;
use Dompdf\Options;

class DocumentPdf
{
    public function render(string $view, array $data, bool $landscape = false): string
    {
        $cache = storage_path('app/pdf-font-cache');
        if (! is_dir($cache)) mkdir($cache, 0755, true);
        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $options->set('isPhpEnabled', false);
        $options->set('isJavascriptEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('fontCache', $cache);
        $options->set('tempDir', storage_path('framework/cache'));
        $options->set('chroot', public_path());
        $pdf = new Dompdf($options);
        $pdf->loadHtml(view($view, $data)->render(), 'UTF-8');
        $pdf->setPaper('A4', $landscape ? 'landscape' : 'portrait');
        $pdf->render();
        $canvas = $pdf->getCanvas();
        $font = $pdf->getFontMetrics()->getFont('DejaVu Sans');
        $canvas->page_text($canvas->get_width() - 112, $canvas->get_height() - 27, 'Page {PAGE_NUM} of {PAGE_COUNT}', $font, 8, [0.3, 0.35, 0.3]);
        return $pdf->output();
    }

    public function download(string $bytes, string $filename)
    {
        return response($bytes, 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}
