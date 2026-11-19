<?php
// Disposable, random-name schema only. Never migrate/reset/drop the working database.
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Services\FinancialLedger;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php'; $app->make(Kernel::class)->bootstrap();
[$action, $suffix, $arg] = [$argv[1] ?? '', $argv[2] ?? '', $argv[3] ?? '0'];
if (!preg_match('/^[a-f0-9]{12}$/D', $suffix)) throw new RuntimeException('Invalid isolated finance identifier.');
$database = 'grocerease_finance_test_'.$suffix;
$runtime = realpath(__DIR__.'/../../..').'/tmp/finance-'.$suffix.'.json';
$c = config('database.connections.mysql');
$server = new PDO('mysql:host='.$c['host'].';port='.$c['port'].';charset=utf8mb4', $c['username'], $c['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
if ($action === 'cleanup') {
    $server->exec('DROP DATABASE IF EXISTS `'.$database.'`');
    if (is_file($runtime)) unlink($runtime);
    echo json_encode(['cleaned'=>true]); exit;
}
if ($action === 'setup') $server->exec('CREATE DATABASE `'.$database.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
config(['database.default'=>'mysql','database.connections.mysql.database'=>$database,'cache.default'=>'array','session.driver'=>'array','mail.default'=>'array']); DB::purge('mysql');
if (DB::connection()->getDatabaseName() !== $database || !preg_match('/^grocerease_finance_test_[a-f0-9]{12}$/D',$database)) throw new RuntimeException('Unsafe test schema.');
DB::statement('SET SESSION innodb_lock_wait_timeout = 10');
try {
    $ledger = app(FinancialLedger::class);
    if ($action === 'setup') {
        if (Artisan::call('migrate',['--database'=>'mysql','--force'=>true]) !== 0) throw new RuntimeException(Artisan::output());
        (new Database\Seeders\RoleSeeder)->run();
        $admins = [];
        for ($i=0;$i<2;$i++) $admins[] = User::factory()->create(['role_id'=>Role::where('slug','admin')->value('role_id')])->id;
        $store = Store::create(['store_name'=>'Disposable financial TEST','address'=>'Isolated only'])->store_id;
        $base = ['reason'=>'Isolated financial test'];
        $ledger->execute($admins[0],$store,'test','agreement',(string)Str::uuid(),$base+['amount'=>'500.00','period'=>'monthly','starts_on'=>'2026-01-01','status'=>'active','expected_version'=>0]);
        $bill = $ledger->execute($admins[0],$store,'test','bill',(string)Str::uuid(),$base+['coverage_from'=>'2026-01-01','due_on'=>'2026-01-31','expected_version'=>1])['id'];
        $payment = $ledger->execute($admins[0],$store,'test','payment',(string)Str::uuid(),$base+['id'=>$bill,'amount'=>'500.00','paid_on'=>'2026-01-10','method'=>'cash','evidence'=>'Disposable receipt'])['id'];
        $ledger->execute($admins[0],$store,'test','verify',(string)Str::uuid(),$base+['id'=>$payment,'expected_version'=>1]);
        file_put_contents($runtime,json_encode(compact('admins','store','payment')));
        echo json_encode(['status'=>200]); exit;
    }
    $state = json_decode(file_get_contents($runtime),true,flags:JSON_THROW_ON_ERROR);
    if ($action === 'inspect') {
        $budget = DB::table('incentive_budgets')->where(['store_id'=>$state['store'],'mode'=>'test'])->first();
        echo json_encode(['status'=>200,'available'=>(int)($budget?->available_centavos??0),'reserved'=>(int)($budget?->reserved_centavos??0),
            'movements'=>DB::table('incentive_movements')->count(),'reversed'=>DB::table('subscription_payment_reversals')->count(),
            'reservation'=>DB::table('incentive_movements')->where('kind','reservation')->orderByDesc('id')->value('id'),
            'actual'=>DB::table('incentive_budgets')->where('mode','actual')->count()]); exit;
    }
    $args = json_decode($arg,true,flags:JSON_THROW_ON_ERROR);
    // Start a REPEATABLE READ snapshot before the other writer commits. Current locking reads
    // must still prevent allocation against the stale snapshot after waiting for the Store.
    $result = DB::transaction(function () use ($ledger,$state,$action,$args) {
        DB::table('incentive_movements')->count(); usleep(500000);
        $actor = $state['admins'][$args['actor']??0];
        $in = ['reason'=>'Isolated concurrent financial test'];
        if ($action === 'contribute') $in += ['id'=>$state['payment'],'amount'=>$args['amount']];
        elseif ($action === 'reserve') $in += ['amount'=>$args['amount']];
        elseif ($action === 'release') $in += ['id'=>$args['id']];
        elseif ($action === 'reverse_payment') $in += ['id'=>$state['payment'],'expected_version'=>2];
        elseif ($action === 'policy') $in += ['expected_version'=>0,'fee_enabled'=>true,'rate_bps'=>300,'approval_note'=>'Test store approval','digital_enabled'=>true];
        elseif ($action === 'bill') $in += ['coverage_from'=>$args['from'],'due_on'=>'2026-02-28','expected_version'=>1];
        return $ledger->execute($actor,$state['store'],'test',$action,$args['key'],$in);
    });
    echo json_encode(['status'=>200,'result'=>$result]);
} catch (HttpExceptionInterface $e) { echo json_encode(['status'=>$e->getStatusCode(),'message'=>$e->getMessage()]); }
catch (Throwable $e) { fwrite(STDERR,get_class($e).': '.$e->getMessage()); exit(1); }
