import { h, langToggle, shortDate } from '../dom.js';
import { t } from '../i18n.js';
import { balance, unpaid, allocate, canEdit, isStale, pickable } from '../ledger.js';
import { inr, todayIST, parseAmount } from '../format.js';
import { historyList, pickList, sheet } from './shared.js';
import { upiLink } from '../upi.js';
import { qrPng } from '../qr.js';

// Akshobya's screen: add expenses, check payments, record cash.
export function mountOwner(root, { store, payee, getLang, setLang, notice = null }) {
  let data = { expenses: [], payments: [] };
  const stop = store.watch(next => { data = next; render(); });

  function field(label, input) { return h('label', { class: 'field' }, h('span', {}, label), input); }

  function checkSheet(p, lang) {
    const open = pickable(data.expenses, data.payments, p.id);
    const pre = p.expenseIds && p.expenseIds.length ? p.expenseIds : allocate(p.amount, open).expenseIds;
    const picker = pickList(open, pre, lang);
    const who = [p.payerName, p.upiRef && 'UPI ' + p.upiRef].filter(Boolean).join(' · ');
    const dlg = sheet(t('needsChecking', lang) + ' · ' + inr(p.amount),
      [who ? h('p', { class: 'note' }, who) : null, h('p', { class: 'note' }, t('coversItems', lang)), picker.el],
      [h('button', { type: 'button', class: 'btn btn-line', onclick: async () => { await store.rejectPayment(p.id); dlg.close(); } }, t('notReceived', lang)),
       h('button', { type: 'button', class: 'btn btn-ink', onclick: async () => { await store.resolvePayment(p.id, picker.ids()); dlg.close(); } }, t('confirmReceived', lang))]);
  }

  function cashSheet(lang) {
    const open = pickable(data.expenses, data.payments);
    const amt = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off' });
    let picker = pickList(open, [], lang);
    const pickBox = h('div', {}, picker.el);
    const err = h('p', { class: 'error', role: 'alert', hidden: true }, t('enterAmount', lang));
    amt.addEventListener('input', () => {
      const a = parseAmount(amt.value);
      if (a != null) { picker = pickList(open, allocate(a, open).expenseIds, lang); pickBox.replaceChildren(picker.el); }
    });
    const dlg = sheet(t('recordCash', lang),
      [field(t('amount', lang) + ' (₹)', amt), err, h('p', { class: 'note' }, t('coversItems', lang)), pickBox],
      [h('button', { type: 'button', class: 'btn btn-line', onclick: () => dlg.close() }, t('cancel', lang)),
       h('button', { type: 'button', class: 'btn btn-ink', onclick: async () => {
         const a = parseAmount(amt.value);
         if (a == null) { err.hidden = false; amt.focus(); return; }
         await store.recordCash({ amount: a, expenseIds: picker.ids() }); dlg.close();
       } }, t('save', lang))]);
    amt.focus();
  }

  // Makes a QR for the ticked items and shares it (WhatsApp → Amma). Recorded as waiting only once shared,
  // so her payment from that QR auto-confirms.
  function sendQrSheet(lang) {
    const open = pickable(data.expenses, data.payments);
    const total = () => open.filter(e => picker.ids().includes(e.id)).reduce((s, e) => s + e.amount, 0);
    const label = h('p', { class: 'note' });
    const update = () => { label.textContent = t('amount', lang) + ': ' + inr(total()); };
    const picker = pickList(open, open.map(e => e.id), lang, update);
    const box = h('div', {}, picker.el);
    const err = h('p', { class: 'error', role: 'alert', hidden: true });
    let busy = false;
    const shareBtn = h('button', { type: 'button', class: 'btn btn-ink', onclick: async () => {
      const ids = picker.ids(), amount = total();
      if (!amount || busy) return;
      busy = true;
      try {
        const blob = await qrPng(upiLink({ ...payee, amount, note: 'Amma Khata' }), amount);
        const file = new File([blob], 'amma-khata-' + amount + '.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], text: 'Amma Khata · ' + inr(amount) }); }
          catch (e) { if (e && e.name === 'AbortError') return; throw e; }
          await store.startPayment({ amount, expenseIds: ids });
          dlg.close();
        } else {
          // No share sheet (e.g. laptop): show the image to save, then record once sent.
          const url = URL.createObjectURL(blob);
          box.replaceChildren(
            h('img', { src: url, alt: 'QR ' + inr(amount), style: 'width:100%;max-width:320px;display:block;margin:0 auto' }),
            h('p', { class: 'note' }, t('qrSaveHint', lang)),
            h('a', { class: 'btn btn-line', href: url, download: file.name, style: 'display:flex;align-items:center;justify-content:center;text-decoration:none' }, t('saveQr', lang)));
          shareBtn.textContent = t('iSentIt', lang);
          shareBtn.onclick = async () => { await store.startPayment({ amount, expenseIds: ids }); dlg.close(); };
        }
      } catch (e) {
        err.hidden = false; err.textContent = String(e && e.message || e);
      } finally { busy = false; }
    } }, t('shareQr', lang));
    update();
    const dlg = sheet(t('sendQr', lang), [h('p', { class: 'note' }, t('coversItems', lang)), box, label, err],
      [h('button', { type: 'button', class: 'btn btn-line', onclick: () => dlg.close() }, t('cancel', lang)), shareBtn]);
  }

  function editSheet(e, lang) {
    const item = h('input', { type: 'text', value: e.item });
    const amt = h('input', { type: 'text', inputmode: 'decimal', value: String(e.amount) });
    const date = h('input', { type: 'date', value: e.date });
    const dlg = sheet(t('edit', lang),
      [field(t('item', lang), item), field(t('amount', lang) + ' (₹)', amt), field(t('date', lang), date)],
      [h('button', { type: 'button', class: 'btn btn-line', onclick: async () => { await store.deleteExpense(e.id); dlg.close(); } }, t('delete', lang)),
       h('button', { type: 'button', class: 'btn btn-ink', onclick: async () => {
         const a = parseAmount(amt.value);
         if (!item.value.trim() || a == null || !date.value) return;
         await store.updateExpense(e.id, { item: item.value.trim(), amount: a, date: date.value }); dlg.close();
       } }, t('save', lang))]);
  }

  function addForm(lang) {
    const item = h('input', { type: 'text', placeholder: t('item', lang), 'aria-label': t('item', lang), autocomplete: 'off', enterkeyhint: 'next' });
    const amt = h('input', { type: 'text', inputmode: 'decimal', placeholder: '₹', 'aria-label': t('amount', lang), autocomplete: 'off' });
    const date = h('input', { type: 'date', value: todayIST(), 'aria-label': t('date', lang) });
    const err = h('p', { class: 'error full', role: 'alert', hidden: true }, t('item', lang) + ' + ' + t('amount', lang));
    return h('form', { class: 'add', onsubmit: async ev => {
      ev.preventDefault();
      const a = parseAmount(amt.value);
      if (!item.value.trim() || a == null) { err.hidden = false; return; }
      await store.addExpense({ item: item.value.trim(), amount: a, date: date.value || todayIST() });
      item.value = ''; amt.value = ''; item.focus();
    } }, item, amt, date, h('button', { type: 'submit', class: 'btn btn-ink' }, t('addExpense', lang)), err);
  }

  function render() {
    const lang = getLang();
    document.documentElement.lang = lang;
    const due = balance(data.expenses, data.payments);
    const open = unpaid(data.expenses);
    const now = Date.now();
    const toCheck = data.payments.filter(p => p.status === 'needs_check' || p.status === 'waiting')
      .sort((a, b) => a.createdAt - b.createdAt);
    const busy = new Set(data.payments.filter(p => p.status === 'waiting').flatMap(p => p.expenseIds));

    const alerts = toCheck.map(p => h('div', { class: 'alert' },
      h('span', {}, h('strong', {}, inr(p.amount)), ' · ',
        t(p.status === 'needs_check' || isStale(p, now) ? 'needsChecking' : 'statusWaiting', lang)),
      h('button', { type: 'button', class: 'btn-quiet', style: 'flex:0 0 auto', onclick: () => checkSheet(p, lang) }, t('check', lang))));

    const rows = open.length ? open.map(e => h('li', { class: 'row' + (busy.has(e.id) ? ' is-waiting' : '') },
      canEdit(e, data.payments)
        ? h('button', { type: 'button', class: 'icon-btn row-actions', 'aria-label': t('edit', lang) + ' ' + e.item, onclick: () => editSheet(e, lang) }, '✎')
        : h('span', { class: 'badge', 'aria-hidden': 'true' }, '·'),
      h('span', { class: 'what' }, h('span', { class: 'name' }, e.item),
        h('span', { class: 'meta' }, busy.has(e.id) ? t('statusWaiting', lang) : shortDate(e.date, lang))),
      h('span', { class: 'amt' }, inr(e.amount))))
      : [h('li', { class: 'empty' }, t('allClear', lang))];

    root.replaceChildren(
      h('header', { class: 'band' },
        h('div', { class: 'band-top' },
          h('span', { class: 'band-label' }, due >= 0 ? t('balance', lang) : t('credit', lang)),
          langToggle(lang, setLang)),
        h('div', { class: 'figure small' }, inr(Math.abs(due)))),
      notice,
      h('main', {},
        alerts,
        addForm(lang),
        h('h2', { class: 'page-title' }, t('unpaidItems', lang)),
        h('ul', { class: 'ledger' }, rows),
        h('h2', { class: 'page-title' }, t('history', lang)),
        historyList(data.payments, lang, { showCancelled: true })),
      h('div', { class: 'paybar' }, h('div', { class: 'paybar-inner' },
        h('button', { type: 'button', class: 'btn btn-ink', disabled: !open.length, onclick: () => sendQrSheet(lang) }, t('sendQr', lang)),
        h('div', { class: 'quiet-row' },
          h('button', { type: 'button', class: 'btn-quiet', onclick: () => cashSheet(lang) }, t('recordCash', lang))))));
  }

  return stop;
}
