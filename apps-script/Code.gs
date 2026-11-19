// Amma Khata — Gmail script. Runs in Akshobya's Google account, free.
// Needs canara.gs (copy of src/canara.js) in the same project.
//
// Script Properties (Project Settings → Script Properties):
//   PROJECT_ID   Firebase project id
//   SA_EMAIL     service account client_email
//   SA_KEY       service account private_key (the whole -----BEGIN PRIVATE KEY----- block)
//   AMMA_NAMES   A T SRIDHAR,U A BHAVANTH
//   APP_URL      https://akshobyaas.github.io/amma-khata/
// Then run setup() once from the editor.

var DAY_MS = 24 * 3600 * 1000;

// ---------- pure logic (tested with node) ----------

function inr(n) {
  var neg = n < 0; n = Math.abs(n);
  var whole = Math.floor(n), paise = Math.round((n - whole) * 100);
  var s = String(whole), last3 = s.slice(-3), rest = s.slice(0, -3);
  if (rest) last3 = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  return (neg ? '-' : '') + '₹' + last3 + (paise ? '.' + (paise < 10 ? '0' : '') + paise : '');
}

// Reads Firestore only when there is a new Canara email, so the free read quota lasts.
function runCheck(io, names, startMs) {
  var last = Math.max(io.getLast() || 0, startMs || 0);
  var msgs = io.messages().filter(function (m) { return m.time > last; })
    .sort(function (a, b) { return a.time - b.time; });
  if (!msgs.length) return;
  var newLast = last, blocked = false;
  msgs.forEach(function (m) {
    try {
      checkOne_(io, m, names);
      if (!blocked) newLast = m.time;
    } catch (e) {
      blocked = true; // keep LAST before this email so the next run retries it
      if (typeof console !== 'undefined') console.warn('Could not process an email: ' + e);
    }
  });
  if (newLast > last) io.setLast(newLast);
}

function checkOne_(io, m, names) {
  var c = parseCanara(m.body);
  if (!c || !isAmma(c.payer, names)) return;
  if (io.hasRef(c.upiRef)) return;
  var r = matchCredit(c, io.paymentsWithAmount(c.amount), new Set());
  var now = io.now();
  var ref = { col: 'refs', id: c.upiRef, op: 'create', data: { at: now } };
  if (r.action === 'attach') {
    io.commit([ref, { col: 'payments', id: r.paymentId, op: 'update', data: { upiRef: c.upiRef, payerName: c.payer } }]);
  } else if (r.action === 'confirm') {
    var p = io.paymentsWithAmount(c.amount).filter(function (x) { return x.id === r.paymentId; })[0];
    var writes = [ref, { col: 'payments', id: p.id, op: 'update',
      data: { status: 'confirmed', upiRef: c.upiRef, payerName: c.payer, resolvedAt: now } }];
    (p.expenseIds || []).forEach(function (e) { writes.push({ col: 'expenses', id: e, op: 'update', data: { paidBy: p.id } }); });
    io.commit(writes);
    io.notify('amma', { en: 'Payment received · ' + inr(c.amount), kn: 'ಪಾವತಿ ಯಶಸ್ವಿ · ' + inr(c.amount) });
    io.notify('owner', { en: 'Received ' + inr(c.amount) + ' from ' + c.payer, kn: c.payer + ' ಇಂದ ' + inr(c.amount) + ' ತಲುಪಿದೆ' });
  } else {
    io.commit([ref, { col: 'payments', id: io.newId(), op: 'create', data: {
      amount: c.amount, expenseIds: [], method: 'unmatched', status: 'needs_check', by: null,
      upiRef: c.upiRef, payerName: c.payer, createdAt: now, resolvedAt: null } }]);
    io.notify('owner', { en: inr(c.amount) + ' from ' + c.payer + ' needs checking', kn: c.payer + ' ಇಂದ ' + inr(c.amount) + ' ಪರಿಶೀಲಿಸಬೇಕು' });
  }
}

function pageUrl(base, col, token) {
  return base + '/' + col + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : '');
}

function runStale(io) {
  var now = io.now();
  var stale = io.listWhere('payments', 'status', 'waiting').filter(function (p) { return now - p.createdAt > DAY_MS; });
  if (!stale.length) return;
  io.commit(stale.map(function (p) { return { col: 'payments', id: p.id, op: 'update', data: { status: 'needs_check' } }; }));
  stale.forEach(function (p) {
    io.notify('owner', { en: inr(p.amount) + ' still not confirmed after a day — needs checking', kn: inr(p.amount) + ' ಒಂದು ದಿನವಾದರೂ ದೃಢವಾಗಿಲ್ಲ' });
  });
}

function runNightly(io) {
  var fresh = io.listWhere('expenses', 'notifiedAt', null).filter(function (e) { return e.paidBy == null; });
  if (!fresh.length) return;
  var total = fresh.reduce(function (s, e) { return s + e.amount; }, 0);
  var now = io.now();
  io.commit(fresh.map(function (e) { return { col: 'expenses', id: e.id, op: 'update', data: { notifiedAt: now } }; }));
  io.notify('amma', {
    en: fresh.length + ' new expense' + (fresh.length > 1 ? 's' : '') + ' · ' + inr(total),
    kn: fresh.length + ' ಹೊಸ ಖರ್ಚು · ' + inr(total)
  });
}

function runMorning(io) {
  var spent = io.list('expenses').reduce(function (s, e) { return s + e.amount; }, 0);
  var paid = io.list('payments').filter(function (p) { return p.status === 'confirmed'; })
    .reduce(function (s, p) { return s + p.amount; }, 0);
  var due = spent - paid;
  if (due > 0) io.notify('amma', { en: 'Balance due ' + inr(due), kn: 'ಬಾಕಿ ' + inr(due) });
}

// Firestore REST value format <-> plain objects
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(obj) {
  var f = {};
  Object.keys(obj).forEach(function (k) { f[k] = toValue(obj[k]); });
  return f;
}
function fromValue(v) {
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  return null;
}
function fromFields(f) {
  var o = {};
  Object.keys(f || {}).forEach(function (k) { o[k] = fromValue(f[k]); });
  return o;
}

// ---------- Google services (not run in tests) ----------

function props_() { return PropertiesService.getScriptProperties(); }
function prop_(k) { var v = props_().getProperty(k); if (!v) throw new Error('Missing script property ' + k); return v; }

function b64url_(bytesOrString) {
  return Utilities.base64EncodeWebSafe(bytesOrString).replace(/=+$/, '');
}

function accessToken_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('token');
  if (hit) return hit;
  var now = Math.floor(Date.now() / 1000);
  var header = b64url_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claim = b64url_(JSON.stringify({
    iss: prop_('SA_EMAIL'),
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  }));
  var key = prop_('SA_KEY').replace(/\\n/g, '\n');
  var sig = b64url_(Utilities.computeRsaSha256Signature(header + '.' + claim, key));
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claim + '.' + sig }
  });
  var token = JSON.parse(res.getContentText()).access_token;
  cache.put('token', token, 3000);
  return token;
}

function docsBase_() {
  return 'projects/' + prop_('PROJECT_ID') + '/databases/(default)/documents';
}

function api_(url, method, body) {
  var res = UrlFetchApp.fetch(url, {
    method: method || 'get', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + accessToken_() },
    payload: body ? JSON.stringify(body) : undefined
  });
  var code = res.getResponseCode();
  if (code >= 300) throw new Error(method + ' ' + url + ' → ' + code + ' ' + res.getContentText());
  return JSON.parse(res.getContentText() || '{}');
}

function realIo_() {
  var base = 'https://firestore.googleapis.com/v1/' + docsBase_();
  return {
    now: function () { return Date.now(); },
    newId: function () { return Utilities.getUuid().replace(/-/g, '').slice(0, 20); },
    messages: function () {
      var out = [];
      GmailApp.search('from:canarabank@canarabank.com CREDITED in:anywhere newer_than:3d').forEach(function (t) {
        t.getMessages().forEach(function (m) { out.push({ body: m.getPlainBody(), time: m.getDate().getTime() }); });
      });
      return out;
    },
    list: function (col) {
      var docs = [], token = '';
      do {
        var r = api_(pageUrl(base, col, token));
        (r.documents || []).forEach(function (d) {
          var o = fromFields(d.fields); o.id = d.name.split('/').pop(); docs.push(o);
        });
        token = r.nextPageToken || '';
      } while (token);
      return docs;
    },
    getLast: function () { return Number(props_().getProperty('LAST_MS') || 0); },
    setLast: function (ms) { props_().setProperty('LAST_MS', String(ms)); },
    hasRef: function (id) {
      var res = UrlFetchApp.fetch(base + '/refs/' + encodeURIComponent(id), {
        muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + accessToken_() } });
      if (res.getResponseCode() === 404) return false;
      if (res.getResponseCode() >= 300) throw new Error('refs read ' + res.getResponseCode());
      return true;
    },
    listWhere: function (col, field, value) {
      var where = value === null
        ? { unaryFilter: { op: 'IS_NULL', field: { fieldPath: field } } }
        : { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: toValue(value) } };
      var rows = api_(base + ':runQuery', 'post', { structuredQuery: { from: [{ collectionId: col }], where: where } });
      return (rows || []).filter(function (r) { return r.document; }).map(function (r) {
        var o = fromFields(r.document.fields); o.id = r.document.name.split('/').pop(); return o;
      });
    },
    paymentsWithAmount: function (amount) { return this.listWhere('payments', 'amount', amount); },
    commit: function (writes) {
      api_(base + ':commit', 'post', { writes: writes.map(function (w) {
        var name = docsBase_() + '/' + w.col + '/' + w.id;
        var out = { update: { name: name, fields: toFields(w.data) } };
        if (w.op === 'create') out.currentDocument = { exists: false };
        else { out.updateMask = { fieldPaths: Object.keys(w.data) }; out.currentDocument = { exists: true }; }
        return out;
      }) });
    },
    notify: function (role, msg) {
      var devices = this.list('devices').filter(function (d) { return d.role === role && d.fcmToken; });
      devices.forEach(function (d) {
        try {
          api_('https://fcm.googleapis.com/v1/projects/' + prop_('PROJECT_ID') + '/messages:send', 'post', { message: {
            token: d.fcmToken,
            webpush: {
              notification: { title: 'Amma Khata', body: d.lang === 'en' ? msg.en : msg.kn, icon: prop_('APP_URL') + 'icon-192.png' },
              fcm_options: { link: prop_('APP_URL') }
            }
          } });
        } catch (e) { console.warn('Push failed for ' + role + ': ' + e); }
      });
    }
  };
}

function names_() { return prop_('AMMA_NAMES').split(',').map(function (s) { return s.trim(); }); }

// ---------- triggers ----------

function checkCanara() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try { runCheck(realIo_(), names_(), Number(props_().getProperty('START_MS') || 0)); }
  finally { lock.releaseLock(); }
}
function markStale() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try { runStale(realIo_()); } finally { lock.releaseLock(); }
}
function nightly() { runNightly(realIo_()); }
function morning() { runMorning(realIo_()); }

// Run once from the editor. Safe to run again: it replaces the old triggers.
function setup() {
  if (!props_().getProperty('START_MS')) props_().setProperty('START_MS', String(Date.now()));
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkCanara').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('markStale').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('nightly').timeBased().atHour(23).nearMinute(0).everyDays(1).inTimezone('Asia/Kolkata').create();
  ScriptApp.newTrigger('morning').timeBased().atHour(8).nearMinute(0).everyDays(1).inTimezone('Asia/Kolkata').create();
  accessToken_(); // fails now, not at 11 pm, if the key is wrong
  console.log('Set up. Checking Canara emails every 5 minutes.');
}

// Sends a test notification to both phones.
function testPush() {
  var io = realIo_();
  io.notify('owner', { en: 'Test from Amma Khata', kn: 'ಪರೀಕ್ಷೆ' });
  io.notify('amma', { en: 'Test from Amma Khata', kn: 'ಪರೀಕ್ಷೆ' });
}
