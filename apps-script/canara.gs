// Canara Bank credit-alert parser and payment matcher.
// Plain script (no import/export): the same text is copied into Apps Script as canara.gs.

var CANARA_RE = /INR\s+([\d,]+(?:\.\d+)?)\s+has been CREDITED on\s+(\d{2})\/(\d{2})\/(\d{2})\b.*?\bfrom\s+(.+?)\s+with UPI Ref No\.?:\s*(\d{12})/s;

function parseCanara(body) {
  var m = CANARA_RE.exec(String(body).replace(/\s+/g, ' '));
  if (!m) return null;
  return {
    amount: Number(m[1].replace(/,/g, '')),
    date: '20' + m[4] + '-' + m[3] + '-' + m[2],
    payer: m[5].trim(),
    upiRef: m[6]
  };
}

function nameKey(s) {
  return String(s).trim().toUpperCase().slice(0, 12);
}

function isAmma(payer, names) {
  var key = nameKey(payer);
  return names.some(function (n) { return nameKey(n) === key; });
}

function matchCredit(credit, payments, seenRefs) {
  if (seenRefs.has(credit.upiRef)) return { action: 'duplicate' };
  var oldest = function (pred) {
    var list = payments.filter(function (p) { return p.amount === credit.amount && pred(p); })
      .sort(function (a, b) { return a.createdAt - b.createdAt; });
    return list.length ? list[0] : null;
  };
  var noRefUpi = function (p) { return p.method === 'upi' && !p.upiRef; };
  // 1. a payment still waiting  2. one that went stale before its email came
  var hit = oldest(function (p) { return p.status === 'waiting'; }) ||
            oldest(function (p) { return p.status === 'needs_check' && noRefUpi(p); });
  if (hit) return { action: 'confirm', paymentId: hit.id };
  // 3. one the owner already confirmed by hand: record the ref, don't credit again
  var manual = oldest(function (p) { return p.status === 'confirmed' && noRefUpi(p); });
  if (manual) return { action: 'attach', paymentId: manual.id };
  return { action: 'needs_check' };
}

if (typeof module !== 'undefined') module.exports = { parseCanara: parseCanara, isAmma: isAmma, matchCredit: matchCredit };
