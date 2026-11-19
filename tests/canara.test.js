import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load the file the way Apps Script will: plain script, no import/export.
const src = readFileSync(new URL('../src/canara.js', import.meta.url), 'utf8');
const ctx = { module: { exports: {} } };
vm.runInNewContext(src, ctx);
const { parseCanara, isAmma, matchCredit } = ctx.module.exports;

const body = (amt, date, payer, ref, kind = 'CREDITED') =>
  `Dear Customer,\n\nThanking you for banking with Canara Bank.\n\nAn amount of INR ${amt} has been ${kind} on ${date} to your account  XXX289 from ${payer} with UPI Ref No.:${ref}. Total Available Balance INR 1,672.96.If you are not expecting this credit or suspect any fraudulent activity, please contact: 18001030`;
const names = ['A T SRIDHAR', 'U A BHAVANTH'];
const plain = (o) => JSON.parse(JSON.stringify(o));

test('file has no import or export so it runs in Apps Script', () => {
  assert.doesNotMatch(src, /^\s*(import|export)\s/m);
});
test('parses the Aishwarya 1,000.00 credit', () => {
  assert.deepEqual(plain(parseCanara(body('1,000.00', '15/11/26', 'AISHWARYA KR', '234852670580'))),
    { amount: 1000, date: '2026-11-15', payer: 'AISHWARYA KR', upiRef: '234852670580' });
});
test('parses the U A BHAVANTH 2,000.00 credit as 2000', () => {
  const c = parseCanara(body('2,000.00', '11/11/26', 'U A BHAVANTH', '631597313720'));
  assert.equal(c.amount, 2000);
  assert.equal(c.payer, 'U A BHAVANTH');
});
test('parses the A T SRIDHAR 720.00 credit', () => {
  const c = parseCanara(body('720.00', '11/11/26', 'A T SRIDHAR', '132712428801'));
  assert.equal(c.amount, 720);
  assert.equal(c.upiRef, '132712428801');
});
test('parses a payer name containing a lowercase surname', () => {
  assert.equal(parseCanara(body('170.00', '16/11/26', 'Darshan J Pa', '632084893707')).payer, 'Darshan J Pa');
});
test('a debit alert returns null', () => {
  assert.equal(parseCanara(body('500.00', '16/11/26', 'X', '111111111111', 'DEBITED')), null);
});
test('unrelated text returns null', () => {
  assert.equal(parseCanara('Your OTP is 1234'), null);
});
test('isAmma matches her names ignoring case and spaces at the ends', () => {
  assert.equal(isAmma(' u a bhavanth ', names), true);
  assert.equal(isAmma('A T SRIDHAR', names), true);
});
test('isAmma compares only the first 12 characters', () => {
  assert.equal(isAmma('U A BHAVANTHU', names), true);
});
test('isAmma rejects other payers', () => {
  assert.equal(isAmma('AISHWARYA KR', names), false);
});
const credit = { amount: 720, date: '2026-11-11', payer: 'A T SRIDHAR', upiRef: '132712428801' };
const p = (id, amount, createdAt, status = 'waiting') => ({ id, amount, createdAt, status, expenseIds: [] });
test('the oldest waiting payment with the same amount is confirmed', () => {
  assert.deepEqual(plain(matchCredit(credit, [p('b', 720, 2), p('a', 720, 1)], new Set())), { action: 'confirm', paymentId: 'a' });
});
test('a reference already seen is a duplicate', () => {
  assert.equal(matchCredit(credit, [p('a', 720, 1)], new Set(['132712428801'])).action, 'duplicate');
});
test('no waiting payment with that amount needs checking', () => {
  assert.equal(matchCredit(credit, [p('a', 700, 1), p('b', 720, 1, 'confirmed')], new Set()).action, 'needs_check');
});
test('a stale UPI payment (needs_check, no ref) is confirmed when its email arrives late', () => {
  const ps = [{ id: 's', amount: 720, createdAt: 1, status: 'needs_check', method: 'upi', upiRef: null, expenseIds: [] }];
  assert.deepEqual(plain(matchCredit(credit, ps, new Set())), { action: 'confirm', paymentId: 's' });
});
test('a UPI payment the owner already confirmed by hand gets the ref attached, not a second credit', () => {
  const ps = [{ id: 'm', amount: 720, createdAt: 1, status: 'confirmed', method: 'upi', upiRef: null, expenseIds: [] }];
  assert.deepEqual(plain(matchCredit(credit, ps, new Set())), { action: 'attach', paymentId: 'm' });
});
test('cash payments of the same amount are never matched to a UPI credit', () => {
  const ps = [{ id: 'c', amount: 720, createdAt: 1, status: 'confirmed', method: 'cash', upiRef: null, expenseIds: [] }];
  assert.equal(matchCredit(credit, ps, new Set()).action, 'needs_check');
});
test('a waiting payment is preferred over attaching to a confirmed one', () => {
  const ps = [{ id: 'm', amount: 720, createdAt: 1, status: 'confirmed', method: 'upi', upiRef: null, expenseIds: [] },
              { id: 'w', amount: 720, createdAt: 2, status: 'waiting', method: 'upi', upiRef: null, expenseIds: [] }];
  assert.equal(matchCredit(credit, ps, new Set()).paymentId, 'w');
});
