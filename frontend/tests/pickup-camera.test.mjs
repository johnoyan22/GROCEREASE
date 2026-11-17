import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cameraError, createPickupCamera, isPickupQr } from '../src/services/pickup-camera.js';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture(extra = {}) {
  const events = [], candidates = [], errors = [], states = [];
  let callback;
  const stream = { getTracks: () => [{ stop: () => events.push('track-stop') }] };
  const controls = { stop: () => events.push('decoder-stop') };
  class Reader { scan(video, cb) { callback = cb; return controls; } }
  const video = { srcObject: null, play: async () => {}, pause: () => events.push('pause') };
  const mediaDevices = { getUserMedia: async constraints => { events.push(constraints); return stream; }, enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'rear' }] };
  const camera = createPickupCamera({ video, mediaDevices, secure: true, loadReader: async () => ({ BrowserQRCodeReader: Reader }), onCandidate: code => candidates.push(code), onError: error => errors.push(error), onState: state => states.push(state), ...extra });
  return { camera, video, events, candidates, errors, states, stream, controls, frame: value => callback({ getText: () => value }, null, controls) };
}

test('only the existing raw lowercase 64-hex QR credential is accepted', () => {
  assert.equal(isPickupQr('a'.repeat(64)), true);
  for (const bad of ['GE-ORD-00000001', 'https://example.com', 'A'.repeat(64), '0'.repeat(64)+'\n', null]) assert.equal(isPickupQr(bad), false);
});
test('camera starts only explicitly, requests video only and prefers rear camera; stops on first frame', async () => {
  const f = fixture(); assert.equal(f.events.length, 0);
  await f.camera.start();
  assert.deepEqual(f.events.find(event => typeof event === 'object'), { audio: false, video: { facingMode: { ideal: 'environment' } } });
  f.frame('a'.repeat(64)); f.frame('a'.repeat(64));
  assert.equal(f.candidates.length, 1); assert.ok(f.events.includes('track-stop')); assert.ok(f.events.includes('decoder-stop')); assert.equal(f.video.srcObject, null);
});
test('switch and explicit stop release both streams and decoding', async () => {
  const f = fixture(); await f.camera.start(); await f.camera.start('front');
  assert.ok(f.events.includes('track-stop')); assert.ok(f.events.includes('decoder-stop'));
  assert.deepEqual(f.events.filter(event => typeof event === 'object').at(-1), { audio: false, video: { deviceId: { exact: 'front' } } });
  f.camera.stop(); assert.equal(f.video.srcObject, null);
});
test('close while awaiting camera permission immediately stops a late stream without decoding', async () => {
  const late = deferred(); const events = [];
  const f = fixture({ mediaDevices: { getUserMedia: () => late.promise } });
  const starting = f.camera.start(); await Promise.resolve(); f.camera.stop();
  late.resolve({ getTracks: () => [{ stop: () => events.push('released') }] }); await starting;
  assert.deepEqual(events, ['released']); assert.deepEqual(f.candidates, []); assert.equal(f.video.srcObject, null);
});
test('close during lazy initialization does not request permission', async () => {
  const late = deferred(); const f = fixture({ loadReader: () => late.promise });
  const starting = f.camera.start(); f.camera.stop(); late.resolve({}); await starting;
  assert.equal(f.events.some(event => typeof event === 'object'), false);
});
test('close during playback does not start a late decoder', async () => {
  const late = deferred(); let scans = 0;
  class Reader { scan() { scans++; return { stop() {} }; } }
  const video = { srcObject: null, play: () => late.promise, pause() {} };
  const f = fixture({ video, loadReader: async () => ({ BrowserQRCodeReader: Reader }) });
  const starting = f.camera.start(); await Promise.resolve(); await Promise.resolve(); f.camera.stop();
  late.resolve(); await starting;
  assert.equal(scans, 0); assert.ok(f.events.includes('track-stop'));
});
test('insecure connection, denied, busy, missing camera and failed decoder offer PIN fallback', async () => {
  const insecure = fixture({ secure: false }); await insecure.camera.start(); assert.match(insecure.errors[0], /HTTPS/);
  for (const name of ['NotAllowedError', 'NotReadableError', 'NotFoundError', 'SecurityError', 'Error']) {
    const f = fixture({ loadReader: async () => { throw Object.assign(new Error(), { name }); } });
    await f.camera.start(); assert.match(f.errors[0], /PIN/); assert.equal(f.video.srcObject, null);
    assert.match(cameraError({ name }), /PIN/);
  }
});
