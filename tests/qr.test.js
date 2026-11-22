import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qrModules } from '../src/qr.js';

test('qrModules returns a square grid of dark/light cells for a UPI link', () => {
  const grid = qrModules('upi://pay?pa=6366594660@upi&pn=AKSHOBYA%20A%20S&am=1750.00&cu=INR&tn=Amma%20Khata');
  assert.ok(grid.length >= 21);
  assert.ok(grid.every(row => row.length === grid.length));
  assert.equal(grid[0][0], true); // finder pattern corner is dark
});
