<?php
// Random disposable schema only. HTTP fakes test SQL races, not external Xendit connectivity.
use App\Models\Order;
use App\Models\PaymentCheckoutAttempt;
use App\Models\Role;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use App\Services\PaymentCheckout;
use App\Services\XenditCheckout;
use App\Services\XenditMoney;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

require __DIR__.'/../vendor/autoload.php';
$app=require __DIR__.'/../bootstrap/app.php';$app->make(Kernel::class)->bootstrap();
[$action,$suffix]=[$argv[1]??'',$argv[2]??''];
if(!preg_match('/^[a-f0-9]{12}$/D',$suffix))throw new RuntimeException('Invalid isolated Xendit test suffix.');
$database='grocerease_xendit_test_'.$suffix;$runtime=realpath(__DIR__.'/../../..').'/tmp/xendit-'.$suffix;
$c=config('database.connections.mysql');$server=new PDO('mysql:host='.$c['host'].';port='.$c['port'].';charset=utf8mb4',$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
if($action==='cleanup'){
    $server->exec('DROP DATABASE IF EXISTS `'.$database.'`');foreach(['.json','.posts'] as $extension)if(is_file($runtime.$extension))unlink($runtime.$extension);
    echo json_encode(['cleaned'=>true]);exit;
}
if($action==='setup')$server->exec('CREATE DATABASE `'.$database.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
config(['database.default'=>'mysql','database.connections.mysql.database'=>$database,'cache.default'=>'array','session.driver'=>'array','mail.default'=>'array']);DB::purge('mysql');
if(DB::connection()->getDatabaseName()!==$database || !preg_match('/^grocerease_xendit_test_[a-f0-9]{12}$/D',$database))throw new RuntimeException('Unsafe Xendit schema.');
DB::statement('SET SESSION innodb_lock_wait_timeout = 10');
\Illuminate\Support\Carbon::setTestNow('2032-05-11 01:00:00 UTC');\Carbon\CarbonImmutable::setTestNow('2032-05-11 01:00:00 UTC');

function checkoutCall(string $method,array $payload,int $shopper):array{
    $r=Request::create('/isolated-checkout','POST',$payload);$r->setUserResolver(fn()=>User::findOrFail($shopper));
    return app()->call([app(\App\Http\Controllers\Api\CheckoutController::class),$method],['request'=>$r])->getData(true);
}
function configureXendit(int $store):void{
    config(['payments.provider'=>'xendit','payments.mode'=>'test','app.frontend_url'=>'https://isolated.example',
        'payments.xendit'=>['store_id'=>$store,'merchant_id'=>str_repeat('a',24),'secret_key'=>'xnd_development_isolated_fixture',
            'webhook_secret'=>'isolated-callback-fixture-token','channel_codes'=>['GCASH']]]);
}
try{
    if($action==='setup'){
        if(Artisan::call('migrate',['--database'=>'mysql','--force'=>true])!==0)throw new RuntimeException(Artisan::output());
        (new Database\Seeders\RoleSeeder)->run();$shopper=User::factory()->create(['role_id'=>Role::where('slug','shopper')->value('role_id')])->id;
        $store=Store::create(['store_name'=>'Disposable Xendit TEST','address'=>'Isolated only'])->store_id;
        Store::findOrFail($store)->forceFill(['operating_hours'=>array_fill(1,7,['opens_at'=>'00:00','closes_at'=>'23:59']),'paid_order_holding_hours'=>24])->save();
        $product=\Tests\Support\CategoryFixture::product(['store_id'=>$store,'product_name'=>'Xendit race fixture','sku'=>'XENDIT-QA','category'=>'Test']);
        $inventory=StoreInventory::create(['store_id'=>$store,'product_id'=>$product->product_id,'selling_price'=>'100.00','hard_stock_qty'=>100,'soft_stock_qty'=>0,'status'=>'active'])->store_inventory_id;
        $cart=['store_id'=>$store,'items'=>[['store_inventory_id'=>$inventory,'quantity'=>2]],'pickup_date'=>'2032-05-12','pickup_start'=>'10:00','pickup_end'=>'11:00'];
        $q=checkoutCall('quote',$cart,$shopper)['quote_token'];$legacy=checkoutCall('store',$cart+['quote_token'=>$q,'idempotency_key'=>(string)Str::uuid()],$shopper)['order']['order_id'];
        // Exercise actual MariaDB ALTER/backfill on a legacy-shaped row, not only a fresh schema.
        $migration=require __DIR__.'/../database/migrations/2026_11_20_000001_pin_checkout_providers.php';$migration->down();
        $legacyId=(string)Str::uuid();DB::table('payment_checkout_attempts')->insert(['id'=>$legacyId,'order_id'=>$legacy,'store_id'=>$store,'merchant_id'=>'org_old_fixture',
            'credential_fingerprint'=>str_repeat('d',64),'mode'=>'test','amount_centavos'=>20000,'currency'=>'PHP','channels'=>'["gcash"]','status'=>'pending','expires_at'=>'2099-01-01 00:00:00','created_at'=>now(),'updated_at'=>now()]);
        $columns=Schema::getColumnListing('payment_checkout_attempts');$before=json_encode(DB::table('payment_checkout_attempts')->where('id',$legacyId)->first());$migration->up();
        if(json_encode(DB::table('payment_checkout_attempts')->select($columns)->where('id',$legacyId)->first())!==$before || DB::table('payment_checkout_attempts')->where('id',$legacyId)->value('provider')!=='paymongo')throw new RuntimeException('Legacy attempt backfill changed original fields.');
        configureXendit($store);$cart+=['payment_method'=>'digital','payment_channel'=>'wallet'];
        $q=checkoutCall('quote',$cart,$shopper)['quote_token'];$order=checkoutCall('store',$cart+['quote_token'=>$q,'idempotency_key'=>(string)Str::uuid()],$shopper)['order']['order_id'];
        $attempt=PaymentCheckoutAttempt::where('order_id',$order)->value('id');
        file_put_contents($runtime.'.json',json_encode(compact('shopper','store','order','attempt','inventory')));file_put_contents($runtime.'.posts','0');
        echo json_encode(['status'=>200,'backfill_preserved'=>true]);exit;
    }
    $state=json_decode(file_get_contents($runtime.'.json'),true,flags:JSON_THROW_ON_ERROR);configureXendit($state['store']);
    $a=PaymentCheckoutAttempt::findOrFail($state['attempt']);$completed=!in_array($action,['start','inspect'],true);
    $pr='pr-'.$a->id;$py='py-'.$a->id;
    $session=['payment_session_id'=>'ps-'.substr(hash('sha256',$a->id),0,24),'business_id'=>$a->merchant_id,'reference_id'=>$a->provider_reference,
        'session_type'=>'PAY','mode'=>'PAYMENT_LINK','country'=>'PH','currency'=>'PHP','amount'=>XenditMoney::decimal($a->amount_centavos),'allowed_payment_channels'=>['GCASH'],
        'capture_method'=>'AUTOMATIC','allow_save_payment_method'=>'DISABLED','status'=>$completed?'COMPLETED':'ACTIVE','expires_at'=>$a->expires_at->toIso8601String(),
        'payment_request_id'=>$completed?$pr:null,'latest_payment_request_id'=>$completed?$pr:null,'payment_id'=>$completed?$py:null];
    $session['payment_link_url']='https://checkout-staging.xendit.co/sessions/'.$session['payment_session_id'];
    $payment=['payment_id'=>$py,'payment_request_id'=>$pr,'business_id'=>$a->merchant_id,'reference_id'=>$a->provider_reference,'type'=>'PAY','country'=>'PH','currency'=>'PHP',
        'request_amount'=>XenditMoney::decimal($a->amount_centavos),'capture_method'=>'AUTOMATIC','channel_code'=>'GCASH','status'=>'SUCCEEDED',
        'captures'=>[['capture_id'=>'cap-'.$a->id,'capture_amount'=>XenditMoney::decimal($a->amount_centavos),'capture_timestamp'=>now()->toIso8601String()]]];
    $request=['payment_request_id'=>$pr,'latest_payment_id'=>$py,'business_id'=>$a->merchant_id,'reference_id'=>$a->provider_reference,'type'=>'PAY','country'=>'PH','currency'=>'PHP',
        'request_amount'=>XenditMoney::decimal($a->amount_centavos),'capture_method'=>'AUTOMATIC','channel_code'=>'GCASH','status'=>'SUCCEEDED'];
    Http::preventStrayRequests();Http::fake(function($r)use($runtime,$session,$request,$payment){
        $path=parse_url($r->url(),PHP_URL_PATH);
        if($r->method()==='POST'&&$path==='/sessions'){
            $f=fopen($runtime.'.posts','c+');flock($f,LOCK_EX);$count=(int)stream_get_contents($f);rewind($f);ftruncate($f,0);fwrite($f,(string)($count+1));fflush($f);flock($f,LOCK_UN);fclose($f);usleep(300000);
        }
        $data=str_starts_with($path,'/v3/payments/')?$payment:(str_starts_with($path,'/v3/payment_requests/')?$request:$session);
        return Http::response(XenditMoney::encode($data),200,['Content-Type'=>'application/json']);
    });
    if($action==='inspect'){
        $o=Order::findOrFail($state['order']);echo json_encode(['status'=>200,'posts'=>(int)file_get_contents($runtime.'.posts'),'orders'=>Order::count(),
            'payments'=>DB::table('order_payments')->count(),'events'=>DB::table('xendit_session_events')->count(),'processed'=>DB::table('xendit_session_events')->where('status','processed')->count(),
            'paid'=>$o->payment_status,'order_status'=>$o->status,'reservation'=>$o->reservation_status,'stock'=>StoreInventory::findOrFail($state['inventory'])->soft_stock_qty,
            'notices'=>DB::table('order_notifications')->where('type','digital_paid')->count()]);exit;
    }
    if($action==='start')$result=app(PaymentCheckout::class)->start($state['order'],$state['shopper']);
    elseif(in_array($action,['notify','expired-notify'],true)){
        $topic=$action==='notify'?'payment_session.completed':'payment_session.expired';$body=$session;if($action==='expired-notify')$body['status']='EXPIRED';
        $r=Request::create('/api/payments/xendit/test/'.$state['store'].'/webhook','POST',[],[],[],['CONTENT_TYPE'=>'application/json','HTTP_X_CALLBACK_TOKEN'=>'isolated-callback-fixture-token'],
            XenditMoney::encode(['event'=>$topic,'business_id'=>$a->merchant_id,'created'=>now()->addSeconds(random_int(1,30))->toIso8601String(),'data'=>$body]));
        $result=app()->call([app(\App\Http\Controllers\Api\XenditWebhookController::class),'__invoke'],['request'=>$r,'store'=>$state['store']])->getData(true);
    }elseif($action==='worker')$result=app(XenditCheckout::class)->retryEvents();
    elseif($action==='cancel')$result=app(PaymentCheckout::class)->locked($state['order'],$state['shopper'],fn($o)=>app(PaymentCheckout::class)->cancelLocked($o,$state['shopper'],'Isolated cancel race'));
    elseif($action==='expire'){
        \Illuminate\Support\Carbon::setTestNow('2032-05-11 01:16:00 UTC');\Carbon\CarbonImmutable::setTestNow('2032-05-11 01:16:00 UTC');
        $result=app(PaymentCheckout::class)->expireUnpaid();
    }else throw new RuntimeException('Unknown isolated action.');
    echo json_encode(['status'=>200]);
}catch(HttpExceptionInterface $e){echo json_encode(['status'=>$e->getStatusCode(),'message'=>$e->getMessage()]);}
catch(Throwable $e){fwrite(STDERR,get_class($e).': '.$e->getMessage());exit(1);}
