import assert from 'node:assert/strict';
import test from 'node:test';
import { total } from '../src/total.mjs';

test('commande fictive sans remise', () => {
  assert.equal(total(12, 3, 0), 36);
});
