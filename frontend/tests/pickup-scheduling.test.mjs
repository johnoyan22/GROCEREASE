import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickupWindowBounds, pickupWindowFits } from '../src/services/pickup-scheduling.js';

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
