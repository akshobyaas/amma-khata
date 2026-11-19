# Amma Khata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free, installable two-phone app where Akshobya logs expenses, Amma pays any part by UPI, and Canara Bank emails confirm payments.

**Architecture:** Static web app (vanilla JS ES modules, no build step) hosted on GitHub Pages, data in Firestore, push via Firebase Cloud Messaging. A Google Apps Script in Akshobya's Gmail reads Canara alerts, confirms payments, and sends the scheduled notifications (11 pm, 8 am), so no paid Firebase scheduler is needed. All business rules live in pure modules tested with `node --test`.

**Tech Stack:** HTML/CSS/JS (ES modules), Firebase JS SDK v10 from `gstatic.com` CDN (Auth anonymous, Firestore, Messaging), Google Apps Script (V8), Node 22 test runner.

**Spec:** Design doc "Amma Khata — Design" https://claude.ai/artifact/QBKAvy37iUtqJ9P8P86Ycr, plus the frontend design plan agreed in chat (ledger-page look, tokens below).

## Global Constraints

- Must stay free: Firebase Spark plan, no billing card; no paid APIs (no WhatsApp Business API, no payment gateway, no AI/OCR).
- Payee UPI ID: `6366594660@upi`; payee name: `AKSHOBYA A S`.
- Amma's payer names as Canara prints them: `A T SRIDHAR`, `U A BHAVANTH` (compare first 12 chars, case-insensitive).
- Canara alert: from `canarabank@canarabank.com`, label `Canara Transactions`; search must include Trash (`in:anywhere`).
- Notifications: Amma 23:00 IST only if items were added that day and not yet notified; Amma 08:00 IST while balance > 0; Akshobya on confirm and on needs-check.
- A payment waiting > 24 h moves to `needs_check`. Paid expenses cannot be edited or deleted.
- Unallocated or "other amount" payments pay oldest unpaid items first; overpayment stays as credit (balance can go negative).
- Every screen has an EN | ಕನ್ನಡ toggle, remembered per device.
- Tokens: kumkuma `#A3122A` (top band, balance only, never warnings), arishina `#F2B705` (main Pay button only), ledger blue `#C9D6EA` (rules), ink `#23305A` (text), paid green `#1E7B4F` (confirmed only), page `#FFFFFF`. Fonts: Hind Mysuru (all text), Baloo Tamma 2 (balance figure only). Sentence case, no all-caps labels.
- Opening data: the 13 Nov list (Petrol 1750, Bangalore trip 1540, Electricity 95, Vegetables 87, Socks 320, Kerchief 200, Body wash 675, Face wash 328, Body lotion 215 = ₹5,210), unpaid.

## Review Focus

- The same Canara email seen twice (re-run, thread re-read) → counted once (processed UPI refs). Test in Task 2.
- Two waiting payments with the same amount → the older one matches. Test in Task 2.
- Amma taps Pay, then backs out of the UPI app → she can tap "I didn't pay" to cancel the waiting payment; otherwise it moves to needs_check after 24 h. Test in Task 1.
- Amounts written "1,000.00" or "INR 2,000.00" → parsed as 1000 / 2000, not 1. Test in Task 2.
- An expense that is part of a waiting payment → cannot be edited or deleted until that payment resolves. Test in Task 1.

---

## File Structure

```
index.html            app shell, loads app.js
app.js                boot: auth, role lookup, route to amma/owner view, language toggle
styles.css            tokens + ledger page
manifest.webmanifest  PWA manifest
firebase-messaging-sw.js  push service worker
src/ledger.js         pure: balance, allocation, edit rules, payment state changes
src/canara.js         pure: parse alert, match credit to waiting payment (also copied into Apps Script)
src/upi.js            pure: build upi:// link
src/i18n.js           EN/KN strings + t(key, lang)
src/db.js             Firestore read/write + listeners
src/push.js           FCM token registration
src/views/amma.js     Amma's screen
src/views/owner.js    Akshobya's screen
firebase-config.js    project keys (filled in at setup)
firestore.rules       security rules
apps-script/Code.gs   Gmail check, Firestore REST, FCM send, triggers
apps-script/canara.gs copy of src/canara.js
tests/*.test.js       node --test
README.md             setup steps for Akshobya
```

**Firestore model**
- `expenses/{id}`: `{item: string, amount: number, date: 'YYYY-MM-DD', createdAt: ms, notifiedAt: ms|null, paidBy: paymentId|null}`
- `payments/{id}`: `{amount: number, expenseIds: string[], method: 'upi'|'cash'|'unmatched', status: 'waiting'|'confirmed'|'needs_check'|'cancelled', upiRef: string|null, payerName: string|null, createdAt: ms, resolvedAt: ms|null}`
- `devices/{uid}`: `{role: 'amma'|'owner', fcmToken: string|null, lang: 'en'|'kn'}`
- `refs/{upiRef}`: `{paymentId, at: ms}`
- `config/setup`: `{key: string}` (never readable by clients)

---

### Task 1: Ledger rules

**Files:** Create `src/ledger.js`, `tests/ledger.test.js`

**Interfaces — Produces:**
- `balance(expenses, payments) -> number` = Σ expense.amount − Σ amount of payments with status `confirmed`.
- `unpaid(expenses) -> Expense[]` where `paidBy == null`, oldest `date` then `createdAt` first.
- `allocate(amount, unpaidExpenses) -> {expenseIds: string[], credit: number}` oldest first; an expense is covered only when the remaining amount ≥ its amount; leftover is `credit`.
- `canEdit(expense, payments) -> boolean` false if `paidBy` set or the id is in any `waiting` payment.
- `isStale(payment, now) -> boolean` true when `waiting` and `now - createdAt > 24*3600*1000`.
- `cancel(payment) -> payment` `waiting` → `cancelled`; any other status throws.

- [ ] Write tests: balance of the opening list with no payments = 5210; with a confirmed 1000 = 4210; a `waiting` 1000 is ignored. `allocate(2000, opening)` covers Petrol (1750) and leaves credit 250 — Bangalore 1540 not covered. `canEdit` false for an expense in a waiting payment. `isStale` true at 24 h + 1 ms. `cancel` on confirmed throws.
- [ ] Run `node --test tests/ledger.test.js` → FAIL (module missing).
- [ ] Implement `src/ledger.js`.
- [ ] Run → PASS. Commit `feat: ledger rules`.

### Task 2: Canara parser and matcher

**Files:** Create `src/canara.js`, `tests/canara.test.js`

**Interfaces — Produces:**
- `parseCanara(body: string) -> {amount: number, date: 'YYYY-MM-DD', payer: string, upiRef: string} | null` for CREDITED alerts; `null` for anything else (debits, unparseable).
- `isAmma(payer: string, names: string[]) -> boolean` first 12 chars, case-insensitive, trimmed.
- `matchCredit(credit, payments, seenRefs: Set<string>) -> {action: 'duplicate'|'confirm'|'needs_check', paymentId?: string}`: duplicate if `upiRef` in seenRefs; else the oldest `waiting` payment with equal amount → confirm; else needs_check.
- File ends with `if (typeof module !== 'undefined') module.exports = {...}` and has no `import`/`export`, so the same text runs in Apps Script.

- [ ] Write tests with the three real bodies: "INR 1,000.00 … on 15/11/26 … from AISHWARYA KR with UPI Ref No.:234852670580" → `{amount:1000, date:'2026-11-15', payer:'AISHWARYA KR', upiRef:'234852670580'}`; "INR 2,000.00 … 11/11/26 … from U A BHAVANTH … 631597313720" → amount 2000; "INR 720.00 … A T SRIDHAR … 132712428801" → amount 720. A body with "DEBITED" → null. `isAmma('u a bhavanth', names)` true; `isAmma('AISHWARYA KR', names)` false. Two waiting 720s (createdAt 1 and 2) → confirm the one at 1. Seen ref → duplicate.
- [ ] Run → FAIL. Implement. Run → PASS. Commit `feat: canara parser and matcher`.

### Task 3: UPI link and strings

**Files:** Create `src/upi.js`, `src/i18n.js`, `tests/upi.test.js`

**Interfaces — Produces:**
- `upiLink({pa, pn, amount, note}) -> string` = `upi://pay?pa=…&pn=…&am=<amount, 2 decimals>&cu=INR&tn=…` with URL-encoding.
- `t(key: string, lang: 'en'|'kn') -> string`; missing key returns the key. Keys cover every visible string in Tasks 5–6 (e.g. `balance`: "Balance due" / "ಬಾಕಿ", `paySelected`: "Pay selected" / "ಆಯ್ಕೆ ಮಾಡಿದ್ದು ಪಾವತಿಸಿ", `payAll`, `otherAmount`, `waiting`: "Waiting for confirmation" / "ದೃಢೀಕರಣಕ್ಕೆ ಕಾಯುತ್ತಿದೆ", `confirmed`: "Payment received" / "ಪಾವತಿ ಯಶಸ್ವಿ", `didntPay`: "I didn't pay" / "ನಾನು ಪಾವತಿಸಿಲ್ಲ", `history`, `addExpense`, `needsChecking`, `recordCash`).
- Item names are shown as typed (no translation).

- [ ] Test: `upiLink({pa:'6366594660@upi', pn:'AKSHOBYA A S', amount:1750, note:'Amma Khata'})` contains `am=1750.00` and `pn=AKSHOBYA+A+S` or `%20`-encoded; every key used has both languages (loop over `Object.keys(strings.en)` equals keys of `strings.kn`).
- [ ] FAIL → implement → PASS. Commit `feat: upi link and strings`.

### Task 4: Data layer, auth and rules

**Files:** Create `firebase-config.js`, `src/db.js`, `firestore.rules`

**Interfaces — Consumes:** Firestore model above. **Produces:**
- `initFirebase() -> {auth, db}` (anonymous sign-in, offline persistence on).
- `bindDevice(role, key) -> Promise<void>` writes `devices/{uid}` with role; rules allow it only when `key == get(config/setup).data.key`.
- `myRole() -> Promise<'amma'|'owner'|null>`.
- `watchLedger(cb: ({expenses, payments}) => void) -> unsubscribe`.
- `addExpense({item, amount, date})`, `updateExpense(id, patch)`, `deleteExpense(id)`, `startPayment({amount, expenseIds}) -> paymentId`, `cancelPayment(id)`, `resolvePayment(id, {expenseIds})` (owner confirms by hand), `recordCash({amount, expenseIds})`.
- Rules: only uids in `devices` read/write; only `owner` writes expenses and resolves/records payments; `amma` creates `waiting` payments and cancels her own waiting ones; nobody reads `config/*` or `refs/*` from the client.

- [ ] Verify by hand against the Firebase console Rules playground: amma create expense → denied; amma create waiting payment → allowed; unknown uid read → denied. Commit `feat: data layer and rules`.

### Task 5: Amma's screen

**Files:** Create `index.html`, `styles.css`, `app.js`, `src/views/amma.js`

**Interfaces — Consumes:** Tasks 1–4.

- Kumkuma band with `t('balance')` and the figure in Baloo Tamma 2; language toggle top right.
- Ruled ledger rows (blue rules, red left margin line): tap a row to tick it; amount right-aligned, tabular figures.
- Fixed yellow bar: `paySelected` with live total (disabled at ₹0); under it text buttons `payAll` and `otherAmount` (numeric input sheet).
- Pay → `startPayment` then navigate to `upiLink(...)`; screen shows the waiting state with `didntPay` (→ `cancelPayment`).
- Confirmed payments flash `confirmed` in paid green once, then appear in `history`.
- Touch targets ≥ 48 px, body text ≥ 18 px, visible focus, `prefers-reduced-motion` respected.

- [ ] Check in a 390×844 viewport screenshot: balance readable, 9 opening rows, pay bar not covering the last row. Commit `feat: amma view`.

### Task 6: Akshobya's screen

**Files:** Create `src/views/owner.js`; modify `app.js` routing.

- Same ledger page plus an `addExpense` row at top (item, amount, date defaulting to today IST).
- Edit/delete only when `canEdit`.
- `needsChecking` strip only when payments with status `needs_check` or stale `waiting` exist; each opens a sheet to choose the expenses it covers (pre-ticked with `allocate`) and confirm.
- `recordCash` sheet with the same picker.

- [ ] Screenshot check at 390×844; add then delete a test expense against the live project. Commit `feat: owner view`.

### Task 7: Install and push

**Files:** Create `manifest.webmanifest`, `firebase-messaging-sw.js`, `src/push.js`; modify `app.js`.

**Interfaces — Produces:** `registerPush(vapidKey) -> Promise<string|null>` stores the token on `devices/{uid}.fcmToken`.

- First open with `#setup-amma` or `#setup-owner` asks for the setup key once, calls `bindDevice`, then `registerPush`.
- Manifest: name "Amma Khata", theme `#A3122A`, standalone, icons as inline-generated PNGs.

- [ ] On Akshobya's phone: install, allow notifications, send a test message from the Firebase console → it arrives with the app closed. Commit `feat: install and push`.

### Task 8: Gmail script

**Files:** Create `apps-script/Code.gs`, `apps-script/canara.gs` (copy of `src/canara.js`).

**Interfaces — Consumes:** `parseCanara`, `isAmma`, `matchCredit`. **Produces** time-driven triggers:
- `checkCanara()` every 5 min: `GmailApp.search('from:canarabank@canarabank.com CREDITED in:anywhere newer_than:3d')`, every message in each thread; skip non-Amma; write `refs/{upiRef}` and payment updates via Firestore REST; unmatched Amma credits create a `payments` doc with method `unmatched`, status `needs_check`; notify owner.
- `markStale()` hourly: stale waiting → `needs_check`.
- `nightly()` at 23:00 IST: if expenses with `notifiedAt == null` exist → notify Amma with count and total, set `notifiedAt`.
- `morning()` at 08:00 IST: if balance > 0 → notify Amma.
- Auth to Firestore and FCM with a service-account JWT signed by `Utilities.computeRsaSha256Signature`; key in Script Properties, never in the repo.

- [ ] Run `checkCanara` by hand in the editor after a real ₹1 payment from Amma → the waiting payment flips to confirmed and both phones get a notification. Run it again → no second confirmation. Commit `feat: gmail script`.

### Task 9: Setup guide and opening data

**Files:** Create `README.md`, `tools/seed.html` (owner-only page that writes the opening list once).

- [ ] README covers, in order: create Firebase project (Spark), enable Anonymous auth, create Firestore, paste config, set `config/setup.key`, deploy rules, GitHub Pages, Apps Script paste + Script Properties + triggers, install on both phones, battery-optimisation off. Follow it end to end once. Commit `docs: setup guide`.
