import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load canara.js + Code.gs together, as Apps Script does with its files.
function load() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../src/canara.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), ctx);
  return ctx;
}
const body = (amt, payer, ref) => `An amount of INR ${amt} has been CREDITED on 16/11/26 to your account XXX289 from ${payer} with UPI Ref No.:${ref}. Total Available Balance INR 1.00.`;
const NAMES = ['A T SRIDHAR', 'U A BHAVANTH'];

function fakeIo({ expenses = [], payments = [], refs = [], messages = [], failOn = null }) {
  const db = { expenses: structuredClone(expenses), payments: structuredClone(payments), refs: refs.map(id => ({ id })) };
  const sent = [];
  let last = 0;
  const io = {
    db, sent, reads: 0,
    now: () => 1_000_000_000,
    messages: () => messages,
    getLast: () => last, setLast: ms => { last = ms; },
    hasRef(id) { io.reads++; return db.refs.some(r => r.id === id); },
    paymentsWithAmount(a) { const r = db.payments.filter(p => p.amount === a); io.reads += r.length || 1; return structuredClone(r); },
    listWhere(col, field, value) { const r = db[col].filter(d => (d[field] ?? null) === value); io.reads += r.length || 1; return structuredClone(r); },
    list(col) { io.reads += db[col].length || 1; return structuredClone(db[col]); },
    newId: (() => { let n = 0; return () => 'new' + n++; })(),
    commit(writes) {
      if (failOn && writes.some(w => w.id === failOn)) throw new Error('commit failed');
      for (const w of writes) {
        const list = db[w.col];
        const i = list.findIndex(d => d.id === w.id);
        if (w.op === 'create') { if (i >= 0) throw new Error('exists'); list.push({ id: w.id, ...w.data }); }
        else Object.assign(list[i], w.data);
      }
    },
    notify(role, msg) { sent.push({ role, en: msg.en }); }
  };
  return io;
}
const waiting = (id, amount, createdAt, expenseIds = []) => ({ id, amount, createdAt, expenseIds, status: 'waiting', method: 'upi', upiRef: null });

test('a matching Amma credit confirms the waiting payment and marks its items paid', () => {
  const g = load();
  const io = fakeIo({
    expenses: [{ id: 'e0', amount: 1750, paidBy: null }],
    payments: [waiting('p1', 1750, 5, ['e0'])],
    messages: [{ body: body('1,750.00', 'U A BHAVANTH', '111122223333'), time: 2_000_000_000 }]
  });
  g.runCheck(io, NAMES, 0);
  assert.equal(io.db.payments[0].status, 'confirmed');
  assert.equal(io.db.payments[0].upiRef, '111122223333');
  assert.equal(io.db.expenses[0].paidBy, 'p1');
  assert.ok(io.db.refs.some(r => r.id === '111122223333'));
  assert.deepEqual(io.sent.map(s => s.role).sort(), ['amma', 'owner']);
});
test('the same email read twice is counted once', () => {
  const g = load();
  const m = { body: body('720.00', 'A T SRIDHAR', '132712428801'), time: 2_000_000_000 };
  const io = fakeIo({ payments: [waiting('p1', 720, 1), waiting('p2', 720, 2)], messages: [m, m] });
  g.runCheck(io, NAMES, 0);
  g.runCheck(io, NAMES, 0);
  assert.deepEqual(io.db.payments.map(p => p.status), ['confirmed', 'waiting']);
});
test('a credit from someone else is ignored', () => {
  const g = load();
  const io = fakeIo({ payments: [waiting('p1', 1000, 1)], messages: [{ body: body('1,000.00', 'AISHWARYA KR', '234852670580'), time: 2_000_000_000 }] });
  g.runCheck(io, NAMES, 0);
  assert.equal(io.db.payments[0].status, 'waiting');
  assert.equal(io.sent.length, 0);
});
test('an Amma credit with no waiting payment becomes a needs-check payment for the owner', () => {
  const g = load();
  const io = fakeIo({ messages: [{ body: body('500.00', 'A T SRIDHAR', '999988887777'), time: 2_000_000_000 }] });
  g.runCheck(io, NAMES, 0);
  assert.equal(io.db.payments.length, 1);
  assert.equal(io.db.payments[0].status, 'needs_check');
  assert.equal(io.db.payments[0].payerName, 'A T SRIDHAR');
  assert.deepEqual(io.sent.map(s => s.role), ['owner']);
});
test('emails from before the start time are skipped', () => {
  const g = load();
  const io = fakeIo({ messages: [{ body: body('500.00', 'A T SRIDHAR', '999988887777'), time: 100 }] });
  g.runCheck(io, NAMES, 200);
  assert.equal(io.db.payments.length, 0);
});
test('a waiting payment older than a day moves to needs_check', () => {
  const g = load();
  const io = fakeIo({ payments: [waiting('p1', 100, 1_000_000_000 - 86_400_001), waiting('p2', 100, 1_000_000_000 - 1000)] });
  g.runStale(io);
  assert.deepEqual(io.db.payments.map(p => p.status), ['needs_check', 'waiting']);
});
test('nightly tells Amma about new items once', () => {
  const g = load();
  const io = fakeIo({ expenses: [{ id: 'a', item: 'Milk', amount: 60, notifiedAt: null, paidBy: null }, { id: 'b', item: 'Old', amount: 5, notifiedAt: 1, paidBy: null }] });
  g.runNightly(io);
  g.runNightly(io);
  assert.equal(io.sent.length, 1);
  assert.match(io.sent[0].en, /1 new.*₹60/);
});
test('morning reminds Amma only while something is due', () => {
  const g = load();
  const io = fakeIo({ expenses: [{ id: 'a', amount: 100, paidBy: null }], payments: [{ id: 'p', amount: 100, status: 'confirmed' }] });
  g.runMorning(io);
  assert.equal(io.sent.length, 0);
  io.db.expenses.push({ id: 'b', amount: 5210, paidBy: null });
  g.runMorning(io);
  assert.match(io.sent[0].en, /₹5,210/);
});
test('Firestore values round-trip', () => {
  const g = load();
  const obj = { a: 'x', n: 1750, d: 12.5, b: true, z: null, l: ['e0', 'e1'] };
  assert.deepEqual(JSON.parse(JSON.stringify(g.fromFields(g.toFields(obj)))), obj);
});
test('apps-script/canara.gs is an exact copy of src/canara.js', () => {
  assert.equal(readFileSync(new URL('../apps-script/canara.gs', import.meta.url), 'utf8'),
               readFileSync(new URL('../src/canara.js', import.meta.url), 'utf8'));
});

const msg = (amt, payer, ref, time = 2_000_000_000) => ({ body: body(amt, payer, ref), time });
test('a run with no new emails reads nothing from Firestore', () => {
  const g = load();
  const io = fakeIo({ payments: [waiting('p1', 720, 1)], messages: [msg('720.00', 'A T SRIDHAR', '132712428801', 50)] });
  io.setLast(100);
  g.runCheck(io, NAMES, 0);
  assert.equal(io.reads, 0);
});
test('the last-processed time moves forward so emails are not re-read', () => {
  const g = load();
  const io = fakeIo({ payments: [waiting('p1', 720, 1)], messages: [msg('720.00', 'A T SRIDHAR', '132712428801', 500)] });
  g.runCheck(io, NAMES, 0);
  assert.equal(io.getLast(), 500);
  const before = io.reads;
  g.runCheck(io, NAMES, 0);
  assert.equal(io.reads, before);
});
test('a confirmed-by-hand UPI payment gets its ref attached without a second credit', () => {
  const g = load();
  const io = fakeIo({ payments: [{ ...waiting('m', 720, 1), status: 'confirmed' }], messages: [msg('720.00', 'A T SRIDHAR', '132712428801')] });
  g.runCheck(io, NAMES, 0);
  assert.equal(io.db.payments.length, 1);
  assert.equal(io.db.payments[0].upiRef, '132712428801');
  assert.ok(io.db.refs.some(r => r.id === '132712428801'));
});
test('one failing email does not stop later ones, and is retried next run', () => {
  const g = load();
  const io = fakeIo({ payments: [waiting('bad', 100, 1), waiting('ok', 200, 2)], failOn: 'bad',
    messages: [msg('100.00', 'A T SRIDHAR', '111111111111', 300), msg('200.00', 'A T SRIDHAR', '222222222222', 400)] });
  g.runCheck(io, NAMES, 0);
  assert.equal(io.db.payments.find(p => p.id === 'ok').status, 'confirmed');
  assert.ok(io.getLast() < 300, 'last time must stay before the failed email');
});
test('pageUrl encodes the page token', () => {
  const g = load();
  assert.equal(g.pageUrl('https://x/docs', 'expenses', 'a+b/c='), 'https://x/docs/expenses?pageSize=300&pageToken=a%2Bb%2Fc%3D');
  assert.equal(g.pageUrl('https://x/docs', 'expenses', ''), 'https://x/docs/expenses?pageSize=300');
});
