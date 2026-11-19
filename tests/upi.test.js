import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upiLink } from '../src/upi.js';
import { t, strings } from '../src/i18n.js';

test('upiLink builds a upi://pay link with two-decimal amount', () => {
  const link = upiLink({ pa: '6366594660@upi', pn: 'AKSHOBYA A S', amount: 1750, note: 'Amma Khata' });
  assert.ok(link.startsWith('upi://pay?'));
  const q = new URLSearchParams(link.slice('upi://pay?'.length));
  assert.equal(q.get('pa'), '6366594660@upi');
  assert.equal(q.get('pn'), 'AKSHOBYA A S');
  assert.equal(q.get('am'), '1750.00');
  assert.equal(q.get('cu'), 'INR');
  assert.equal(q.get('tn'), 'Amma Khata');
});
test('upiLink rejects zero or negative amounts', () => {
  assert.throws(() => upiLink({ pa: 'x@upi', pn: 'X', amount: 0, note: '' }));
});
test('every English string has a Kannada string and the reverse', () => {
  assert.deepEqual(Object.keys(strings.kn).sort(), Object.keys(strings.en).sort());
});
test('t returns the right language', () => {
  assert.equal(t('balance', 'en'), 'Balance due');
  assert.equal(t('balance', 'kn'), 'ಬಾಕಿ');
  assert.equal(t('confirmed', 'kn'), 'ಪಾವತಿ ಯಶಸ್ವಿ');
});
test('t returns the key for a missing string', () => {
  assert.equal(t('nope', 'en'), 'nope');
});
test('upiLink keeps @ in the UPI ID and encodes spaces as %20', () => {
  const link = upiLink({ pa: '6366594660@upi', pn: 'AKSHOBYA A S', amount: 95, note: 'Amma Khata' });
  assert.match(link, /pa=6366594660@upi&/);
  assert.match(link, /pn=AKSHOBYA%20A%20S/);
  assert.doesNotMatch(link, /\+/);
});
