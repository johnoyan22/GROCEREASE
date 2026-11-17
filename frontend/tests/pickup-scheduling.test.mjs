import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickupWindowBounds, pickupWindowFits, checkoutPickupWindows, checkoutWindowFits, pickupWindowLabel, pickupServiceTimeOptions, pickupServicePeriodFits, suggestedPickupPeriod } from '../src/services/pickup-scheduling.js';

const hours = { opens_at: '10:00', closes_at: '18:00', store_opens_at: '09:00', store_closes_at: '21:00', earliest_start_at: '10:00' };

test('pickup selection is bounded by service hours while the store may close later', function () {
  assert.deepEqual(pickupWindowBounds(hours, '15:00'), { startMin: '10:00', startMax: '17:59', endMin: '15:01', endMax: '18:00' });
  assert.equal(pickupWindowFits(hours, '15:00', '16:00'), true);
  assert.equal(pickupWindowFits(hours, '09:00', '10:00'), false);
  assert.equal(pickupWindowFits(hours, '17:00', '18:01'), false);
});

test('today uses the server supplied future start instead of offering elapsed times', function () {
  const today = { ...hours, earliest_start_at: '16:31' };
  assert.equal(pickupWindowFits(today, '16:30', '17:00'), false);
  assert.equal(pickupWindowFits(today, '16:31', '17:00'), true);
  assert.equal(pickupWindowBounds(today).startMin, '16:31');
});

test('closed or suspended dates with no availability cannot enable a review', function () {
  assert.equal(pickupWindowBounds(null), null);
  assert.equal(pickupWindowFits(null, '10:00', '11:00'), false);
  assert.equal(pickupWindowBounds({ ...hours, earliest_start_at: '18:00' }), null);
});

test('store operating boundaries still constrain an inconsistent or outdated service response', function () {
  const constrained = { ...hours, store_opens_at: '11:00', store_closes_at: '17:00' };
  assert.equal(pickupWindowFits(constrained, '10:00', '12:00'), false);
  assert.equal(pickupWindowFits(constrained, '16:00', '18:00'), false);
  assert.equal(pickupWindowFits(constrained, '11:00', '17:00'), true);
});

test('empty malformed and nonincreasing selected windows cannot enable Checkout or rescheduling', function () {
  for (const [start, end] of [['', '11:00'], ['10:00', ''], ['25:00', '26:00'], ['10:00', '10:00'], ['11:00', '10:00']]) {
    assert.equal(pickupWindowFits(hours, start, end), false);
  }
});

test('the last selectable service minute permits a window ending exactly at closing', function () {
  assert.equal(pickupWindowFits(hours, '17:59', '18:00'), true);
  assert.equal(pickupWindowFits(hours, '18:00', '18:01'), false);
});

test('checkout requires an actual server option while Supervisor bounds keep accepting legacy ranges', () => {
  const offered = { ...hours, windows: [{ pickup_start: '12:00', pickup_end: '13:00' }, { pickup_start: '14:00', pickup_end: '16:00' }] };
  assert.equal(checkoutWindowFits(offered, '12:00', '13:00'), true);
  assert.equal(checkoutWindowFits(offered, '12:00', '16:00'), false);
  assert.equal(checkoutWindowFits(offered, '12:15', '13:15'), false);
  assert.equal(pickupWindowFits(offered, '12:15', '13:45'), true);
  assert.deepEqual(checkoutPickupWindows({ ...offered, windows: [] }), []);
  assert.deepEqual(checkoutPickupWindows(hours), []);
  assert.equal(pickupWindowLabel({ pickup_start: '08:30', pickup_end: '10:30' }), '8:30 AM – 10:30 AM');
  assert.equal(pickupWindowLabel({ pickup_start: '12:00', pickup_end: '13:00' }), '12:00 PM – 1:00 PM');
});

test('suggested pickup hours use an adjustable hour at both ends of the store day', () => {
  const store = { opens_at: '09:00', closes_at: '20:30' };
  const suggested = suggestedPickupPeriod(store);
  assert.deepEqual(suggested, { opens_at: '10:00', closes_at: '19:30' });
  const starts = pickupServiceTimeOptions(store, suggested, 'opens_at');
  const ends = pickupServiceTimeOptions(store, suggested, 'closes_at');
  assert.ok(starts.includes('09:30')); assert.ok(ends.includes('20:00'));
  assert.ok(starts.includes('09:00')); assert.ok(ends.includes('20:30'));
  assert.ok(starts.every((time) => time >= '09:00' && time < '19:30'));
  assert.ok(ends.every((time) => time > '10:00' && time <= '20:30'));
  assert.equal(pickupServicePeriodFits(store, { opens_at: '09:30', closes_at: '20:00' }), true);
  assert.equal(pickupServicePeriodFits(store, { opens_at: '08:30', closes_at: '19:30' }), false);
  assert.equal(pickupServicePeriodFits(store, { opens_at: '10:00', closes_at: '21:00' }), false);
});

test('dropdowns preserve exact saved minutes and suggestions for non-hour store boundaries', () => {
  const store = { opens_at: '09:15', closes_at: '20:40' }, saved = { opens_at: '10:17', closes_at: '18:43' };
  assert.deepEqual(suggestedPickupPeriod(store), { opens_at: '10:15', closes_at: '19:40' });
  assert.ok(pickupServiceTimeOptions(store, saved, 'opens_at').includes('10:17'));
  assert.ok(pickupServiceTimeOptions(store, saved, 'closes_at').includes('18:43'));
  assert.ok(pickupServiceTimeOptions(store, null, 'closes_at').includes('19:40'));
});

test('closed or invalid store hours offer no times and short days never get inverted defaults', () => {
  for (const store of [null, { opens_at: '', closes_at: '' }, { opens_at: '20:00', closes_at: '09:00' }]) {
    assert.equal(suggestedPickupPeriod(store), null); assert.deepEqual(pickupServiceTimeOptions(store, null, 'opens_at'), []);
  }
  const short = { opens_at: '09:00', closes_at: '10:30' };
  assert.deepEqual(suggestedPickupPeriod(short), short);
  assert.equal(pickupServicePeriodFits(short, suggestedPickupPeriod(short)), true);
});
