import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balance, unpaid, allocate, canEdit, isStale, cancel } from '../src/ledger.js';
import { opening } from './fixtures.js';

const pay = (o) => ({ id: 'p', amount: 0, expenseIds: [], method: 'upi', status: 'waiting', createdAt: 0, ...o });

test('balance of the opening list with no payments is 5210', () => {
  assert.equal(balance(opening, []), 5210);
});
test('a confirmed 1000 lowers the balance to 4210', () => {
  assert.equal(balance(opening, [pay({ amount: 1000, status: 'confirmed' })]), 4210);
});
test('waiting, cancelled and needs_check payments do not lower the balance', () => {
  const ps = ['waiting', 'cancelled', 'needs_check'].map(status => pay({ amount: 1000, status }));
  assert.equal(balance(opening, ps), 5210);
});
test('unpaid lists unpaid expenses oldest first', () => {
  const list = [{ ...opening[1], date: '2026-11-14' }, opening[0], { ...opening[2], paidBy: 'p1' }];
  assert.deepEqual(unpaid(list).map(e => e.id), ['e0', 'e1']);
});
test('allocate 2000 covers Petrol only and leaves 250 credit', () => {
  assert.deepEqual(allocate(2000, unpaid(opening)), { expenseIds: ['e0'], credit: 250 });
});
test('allocate exactly the total covers everything with no credit', () => {
  const r = allocate(5210, unpaid(opening));
  assert.equal(r.expenseIds.length, 9);
  assert.equal(r.credit, 0);
});
test('an expense in a waiting payment cannot be edited', () => {
  assert.equal(canEdit(opening[0], [pay({ expenseIds: ['e0'] })]), false);
});
test('a paid expense cannot be edited', () => {
  assert.equal(canEdit({ ...opening[0], paidBy: 'p1' }, []), false);
});
test('an unpaid expense in a cancelled payment can be edited', () => {
  assert.equal(canEdit(opening[0], [pay({ expenseIds: ['e0'], status: 'cancelled' })]), true);
});
test('a waiting payment is stale just after 24 hours', () => {
  const day = 24 * 3600 * 1000;
  assert.equal(isStale(pay({ createdAt: 0 }), day), false);
  assert.equal(isStale(pay({ createdAt: 0 }), day + 1), true);
  assert.equal(isStale(pay({ createdAt: 0, status: 'confirmed' }), day + 1), false);
});
test('cancel turns waiting into cancelled', () => {
  assert.equal(cancel(pay({})).status, 'cancelled');
});
test('cancel on a confirmed payment throws', () => {
  assert.throws(() => cancel(pay({ status: 'confirmed' })));
});
import { pickable } from '../src/ledger.js';
test('pickable leaves out items in someone else’s waiting payment', () => {
  const ps = [pay({ id: 'w', expenseIds: ['e0'] })];
  assert.deepEqual(pickable(opening, ps).map(e => e.id).includes('e0'), false);
});
test('pickable keeps the items of the payment being checked', () => {
  const ps = [pay({ id: 'w', expenseIds: ['e0'] })];
  assert.equal(pickable(opening, ps, 'w')[0].id, 'e0');
});
