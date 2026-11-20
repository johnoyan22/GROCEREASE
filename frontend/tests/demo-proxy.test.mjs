import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import configure from '../vite.config.js';

test('demo proxy allows one exact host, overwrites spoofed HTTPS headers, and preserves optional TLS ports', () => {
  const saved={...process.env};
  try{
    process.env.GROCEREASE_DEMO_HOST='demo.example';process.env.GROCEREASE_TLS_CERT='';process.env.GROCEREASE_TLS_KEY='';
    const config=configure({mode:'test'});assert.deepEqual(config.server.allowedHosts,['demo.example']);assert.ok(config.server.proxy['/sanctum']);
    let proxyRequest;config.server.proxy['/api'].configure({on(event,callback){assert.equal(event,'proxyReq');proxyRequest=callback;}});
    function headers(remote,host,encrypted=false){const values={};proxyRequest({setHeader(k,v){values[k]=v;},removeHeader(k){values[k]=null;}},{socket:{remoteAddress:remote,encrypted},headers:{host,'x-forwarded-proto':'https','x-forwarded-host':'attacker.example'}});return values;}
    assert.equal(headers('127.0.0.1','demo.example')['X-Forwarded-Proto'],'https');
    assert.equal(headers('192.168.1.40','demo.example')['X-Forwarded-Proto'],'http');
    assert.equal(headers('127.0.0.1','localhost:5173')['X-Forwarded-Proto'],'http');
    assert.equal(headers('127.0.0.1','localhost:5173',true)['X-Forwarded-Port'],'5173');
    assert.equal(headers('127.0.0.1','demo.example').Forwarded,null);
    for(const value of ['*','.example.com','https://demo.example','demo.example/path','demo.example:443']){process.env.GROCEREASE_DEMO_HOST=value;assert.throws(()=>configure({mode:'test'}),/exact hostname/);}
  } finally {for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});

test('verification links reach Laravel with the signed URL and session cookie intact', async () => {
  const backend = createHttpServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ url: request.url, headers: request.headers }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  let vite;
  try {
    const config = configure({ mode: 'test' });
    const target = `http://127.0.0.1:${backend.address().port}`;
    vite = await createViteServer({
      configFile: false,
      logLevel: 'silent',
      server: {
        host: '127.0.0.1', port: 0, hmr: false,
        proxy: Object.fromEntries(Object.entries(config.server.proxy).map(([path, options]) => [path, { ...options, target }])),
      },
    });
    await vite.listen();
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    const path = '/email/verify/4/test-email-hash?expires=2000000000&signature=test-signature';
    const response = await fetch(origin + path, {
      headers: { Accept: 'application/json', Cookie: 'laravel_session=test-session' },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/json/);
    const forwarded = await response.json();
    assert.equal(forwarded.url, path);
    assert.equal(forwarded.headers.cookie, 'laravel_session=test-session');
    assert.equal(forwarded.headers.host, new URL(origin).host);
    assert.equal(forwarded.headers['x-forwarded-host'], new URL(origin).host);
    assert.equal(forwarded.headers['x-forwarded-proto'], 'http');
  } finally {
    await vite?.close();
    await new Promise(resolve => backend.close(resolve));
  }
});
