import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inr, todayIST, payPlan } from '../src/format.js';
import { opening } from './fixtures.js';

test('inr groups the Indian way', () => {
  assert.equal(inr(5210), '₹5,210');
  assert.equal(inr(125000), '₹1,25,000');
  assert.equal(inr(87), '₹87');
});
test('inr shows paise only when present', () => {
  assert.equal(inr(12.5), '₹12.50');
});
test('todayIST uses Indian time, not UTC', () => {
  // 20:00 UTC on 16 Nov is 01:30 on 17 Nov in India
  assert.equal(todayIST(Date.UTC(2026, 10, 16, 20, 0)), '2026-11-17');
});
test('payPlan for selected items pays their sum', () => {
  assert.deepEqual(payPlan({ kind: 'selected', ids: ['e0', 'e2'] }, opening, []), { amount: 1845, expenseIds: ['e0', 'e2'] });
});
test('payPlan for pay all pays the balance and covers every unpaid item', () => {
  const r = payPlan({ kind: 'all' }, opening, []);
  assert.equal(r.amount, 5210);
  assert.equal(r.expenseIds.length, 9);
});
test('payPlan for pay all subtracts earlier extra payment', () => {
  const extra = [{ id: 'p', amount: 250, status: 'confirmed', expenseIds: [] }];
  assert.equal(payPlan({ kind: 'all' }, opening, extra).amount, 4960);
});
test('payPlan for another amount covers oldest items it fully pays', () => {
  assert.deepEqual(payPlan({ kind: 'other', amount: 2000 }, opening, []), { amount: 2000, expenseIds: ['e0'] });
});
import { parseAmount } from '../src/format.js';
test('parseAmount reads typed amounts', () => {
  assert.equal(parseAmount('1,750'), 1750);
  assert.equal(parseAmount(' 87.5 '), 87.5);
});
test('parseAmount rejects empty, zero, negative and text', () => {
  for (const s of ['', '0', '-5', 'abc']) assert.equal(parseAmount(s), null);
});
