<?php

// Read-only database queries. Snapshot writes only an ignored local hash manifest.
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$mode = $argv[1] ?? '';
$label = $argv[2] ?? '';
if ($label !== '' && ! preg_match('/^[a-z0-9-]{1,64}$/D', $label)) throw new RuntimeException('Use a short lowercase alphanumeric/hyphen snapshot label.');
if (! in_array($mode, ['snapshot', 'verify'], true)) throw new RuntimeException('Use snapshot or verify. Neither mode changes database records.');
if (DB::connection()->getDriverName() !== 'mysql') throw new RuntimeException('This read-only helper targets the configured MySQL/MariaDB application database.');
$directory = realpath(base_path('../..')).DIRECTORY_SEPARATOR.'tmp';
if (! is_dir($directory)) mkdir($directory, 0755, true);
$path = $directory.DIRECTORY_SEPARATOR.'adviser-preservation'.($label !== '' ? '-'.$label : '').'.json';

function fingerprint(string $table, array $columns): array
{
    $hashes = [];
    foreach (DB::table($table)->select($columns)->cursor() as $row) {
        $data = (array) $row; ksort($data);
        $hashes[] = hash('sha256', json_encode($data, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION));
    }
    sort($hashes, SORT_STRING);
    return ['count' => count($hashes), 'sha256' => hash('sha256', implode("\n", $hashes))];
}

function volatileTable(string $table): bool
{
    // MySQL may return schema-qualified names, unlike SQLite.
    $parts = explode('.', $table);
    return in_array(end($parts), ['migrations', 'sessions', 'cache', 'cache_locks', 'jobs', 'failed_jobs', 'job_batches', 'sqlite_sequence'], true);
}

function applicationTable(string $table, string $database): bool
{
    return ! str_contains($table, '.') || str_starts_with($table, $database.'.');
}

if ($mode === 'snapshot') {
    if (is_file($path)) throw new RuntimeException('A preservation snapshot already exists. Keep it for review; this script never overwrites it.');
    $manifest = ['database' => DB::connection()->getDatabaseName(), 'captured_at' => gmdate('c'), 'tables' => []];
    // Laravel's default schema=null lists every non-system user schema on MySQL.
    foreach (Schema::getTableListing(DB::connection()->getDatabaseName()) as $table) {
        if (! applicationTable($table, $manifest['database']) || volatileTable($table)) continue;
        $columns = Schema::getColumnListing($table);
        $manifest['tables'][$table] = ['columns' => $columns, ...fingerprint($table, $columns)];
    }
    file_put_contents($path, json_encode($manifest, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
    echo json_encode(['status' => 'read_only_snapshot_saved', 'business_tables' => count($manifest['tables']), 'raw_records_exported' => false]).PHP_EOL;
} else {
    if (! is_file($path)) throw new RuntimeException('Create the read-only snapshot first.');
    $manifest = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    if ($manifest['database'] !== DB::connection()->getDatabaseName()) throw new RuntimeException('Database target changed; refusing comparison.');
    $changed = []; $checked = 0;
    foreach ($manifest['tables'] as $table => $original) {
        if (! applicationTable($table, $manifest['database']) || volatileTable($table)) continue;
        $checked++;
        $current = fingerprint($table, $original['columns']);
        if ($original['count'] !== $current['count'] || $original['sha256'] !== $current['sha256']) $changed[] = $table;
    }
    echo json_encode(['status' => $changed ? 'review_required' : 'all_original_business_values_preserved', 'business_tables' => $checked, 'changed_tables' => $changed]).PHP_EOL;
    exit($changed ? 1 : 0);
}
