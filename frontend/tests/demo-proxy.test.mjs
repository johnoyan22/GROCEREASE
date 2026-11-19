import assert from 'node:assert/strict';
import { test } from 'node:test';
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
