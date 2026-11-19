<?php

namespace Tests\Feature;

use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class DemoProxyTest extends TestCase
{
    public function test_only_the_exact_trusted_proxy_can_assert_forwarded_https_and_host(): void
    {
        app(\Illuminate\Contracts\Http\Kernel::class);
        Route::get('/api/test-demo-transport',fn(Request $request)=>response()->json(['https'=>$request->isSecure(),'host'=>$request->getHost(),'port'=>$request->getPort()]));
        TrustProxies::at(['127.0.0.1']);
        TrustProxies::withHeaders(Request::HEADER_X_FORWARDED_FOR|Request::HEADER_X_FORWARDED_HOST|Request::HEADER_X_FORWARDED_PORT|Request::HEADER_X_FORWARDED_PROTO);
        $this->withServerVariables(['REMOTE_ADDR'=>'127.0.0.1'])->withHeaders(['X-Forwarded-Proto'=>'https','X-Forwarded-Host'=>'demo.example','X-Forwarded-Port'=>'443'])
            ->getJson('http://localhost/api/test-demo-transport')->assertOk()->assertJsonPath('https',true)->assertJsonPath('host','demo.example')->assertJsonPath('port',443);
        $this->withServerVariables(['REMOTE_ADDR'=>'192.168.1.40'])->getJson('http://localhost/api/test-demo-transport')->assertOk()->assertJsonPath('https',false)->assertJsonPath('host','localhost');
        TrustProxies::at([]);Request::setTrustedProxies([],Request::HEADER_X_FORWARDED_PROTO);
    }
}
