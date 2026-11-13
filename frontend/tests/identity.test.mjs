import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialsFor } from '../src/services/identity.js';
test('initials use current names safely including missing and unicode names', () => {
  assert.equal(initialsFor({ first_name: ' John ', last_name: 'Leon' }), 'JL');
  assert.equal(initialsFor({ firstName: 'Maria', lastName: 'Santos' }), 'MS');
  assert.equal(initialsFor({ first_name: 'Éva', last_name: '' }), 'É');
  assert.equal(initialsFor({ first_name: '', last_name: 'Espinosa' }), 'E');
  assert.equal(initialsFor(null), '?');
});
