import assert from 'node:assert/strict';
import { test } from 'node:test';
import { directionsUrl, distanceKm, nearbyStores, validPoint } from '../src/services/storeLocator.js';

test('geographic distance is symmetric, handles identical/antipodal points and rejects missing or invalid coordinates', () => {
  assert.equal(distanceKm({lat:0,lng:0},{lat:0,lng:0}),0);
  assert.ok(Math.abs(distanceKm({lat:0,lng:0},{lat:0,lng:1})-111.195)<0.01);
  assert.equal(distanceKm({lat:10,lng:120},{lat:11,lng:121}),distanceKm({lat:11,lng:121},{lat:10,lng:120}));
  assert.ok(Number.isFinite(distanceKm({lat:0,lng:0},{lat:0,lng:180})));
  for(const point of [null,{lat:null,lng:null},{lat:91,lng:0},{lat:0,lng:181},{lat:NaN,lng:0},{lat:'10',lng:120}]) { assert.equal(validPoint(point),false); assert.equal(distanceKm(point,{lat:0,lng:0}),null); }
});
test('nearest-store results are radius-bound, sorted from the chosen pin and retain only supplied registered store identities', () => {
  const stores=[{store_id:3,latitude:0,longitude:0.2},{store_id:2,latitude:0,longitude:0.02},{store_id:1,latitude:0,longitude:0.01},{store_id:4,latitude:null,longitude:null}];
  assert.deepEqual(nearbyStores(stores,{lat:0,lng:0},5).map(store=>store.store_id),[1,2]);
  assert.deepEqual(nearbyStores(stores,null,5),[]); assert.deepEqual(nearbyStores(stores,{lat:0,lng:0},-1),[]);
  assert.deepEqual(nearbyStores(stores,{lat:0,lng:1},5),[]);
});
test('directions use the selected store coordinates and optional chosen origin without a Maps API key', () => {
  const url=new URL(directionsUrl({latitude:10,longitude:123},{lat:11,lng:124}));
  assert.equal(url.origin,'https://www.google.com'); assert.equal(url.searchParams.get('api'),'1'); assert.equal(url.searchParams.get('destination'),'10,123'); assert.equal(url.searchParams.get('origin'),'11,124'); assert.equal(url.searchParams.has('key'),false);
  assert.equal(new URL(directionsUrl({latitude:10,longitude:123},null)).searchParams.has('origin'),false);
  assert.equal(directionsUrl({latitude:null,longitude:null},null),null);
});
