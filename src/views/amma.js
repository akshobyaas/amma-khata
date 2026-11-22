import { h, langToggle, shortDate } from '../dom.js';
import { t } from '../i18n.js';
import { balance, unpaid } from '../ledger.js';
import { inr, payPlan, parseAmount } from '../format.js';
import { historyList } from './shared.js';
import { upiLink } from '../upi.js';

// Amma's screen: balance, the unpaid page of the khata, and the pay bar.
export function mountAmma(root, { store, payee, getLang, setLang, notice = null, openLink = url => { location.href = url; } }) {
  const picked = new Set();
  let data = { expenses: [], payments: [] };
  let seenConfirmed = null;   // ids of confirmed payments already known, to flash new ones once
  let flash = null;           // payment just confirmed
  let flashTimer = null;

  const stop = store.watch(next => {
    data = next;
    const mineConfirmed = data.payments.filter(p => p.status === 'confirmed' && p.by === store.uid);
    if (seenConfirmed) {
      const fresh = mineConfirmed.find(p => !seenConfirmed.has(p.id));
      if (fresh) {
        flash = fresh;
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => { flash = null; render(); }, 8000);
      }
    }
    seenConfirmed = new Set(mineConfirmed.map(p => p.id));
    render();
  });

  let paying = false;
  async function pay(choice) {
    const plan = payPlan(choice, data.expenses, data.payments);
    if (!(plan.amount > 0) || paying) return;
    paying = true;
    try { await store.startPayment(plan); } finally { paying = false; }
    picked.clear();
    // No auto-open: GPay blocks link payments to personal UPI IDs. The waiting panel shows how to pay.
  }

  function otherAmountSheet(lang) {
    const input = h('input', { type: 'number', inputmode: 'decimal', min: '1', step: '1', required: true, id: 'other-amt' });
    const dlg = h('dialog', { 'aria-labelledby': 'other-title' },
      h('form', { method: 'dialog', onsubmit: e => {
        e.preventDefault();
        const amount = parseAmount(input.value);
        if (amount == null) { input.focus(); return; }
        dlg.close(); dlg.remove(); pay({ kind: 'other', amount });
      } },
        h('h2', { id: 'other-title' }, t('otherAmount', lang)),
        h('label', { class: 'field' }, h('span', {}, t('enterAmount', lang) + ' (₹)'), input),
        h('div', { class: 'sheet-actions' },
          h('button', { type: 'button', class: 'btn btn-line', onclick: () => { dlg.close(); dlg.remove(); } }, t('cancel', lang)),
          h('button', { type: 'submit', class: 'btn btn-pay' }, t('pay', lang)))));
    document.body.append(dlg);
    dlg.showModal();
    input.focus();
  }

  function render() {
    const lang = getLang();
    document.documentElement.lang = lang;
    const due = balance(data.expenses, data.payments);
    const open = unpaid(data.expenses);
    const waiting = data.payments.filter(p => p.status === 'waiting' && p.by === store.uid)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    const busy = new Set(data.payments.filter(p => p.status === 'waiting').flatMap(p => p.expenseIds));
    for (const id of [...picked]) if (!open.some(e => e.id === id) || busy.has(id)) picked.delete(id);
    const pickedTotal = open.filter(e => picked.has(e.id)).reduce((s, e) => s + e.amount, 0);

    const band = h('header', { class: 'band' },
      h('div', { class: 'band-top' },
        h('span', { class: 'band-label' }, due > 0 ? t('balance', lang) : due < 0 ? t('credit', lang) : t('allClear', lang)),
        langToggle(lang, setLang)),
      h('div', { class: 'figure' }, inr(Math.abs(due))));

    const rows = open.length
      ? open.map(e => {
          const isBusy = busy.has(e.id);
          const box = h('input', { type: 'checkbox', id: 'x-' + e.id, checked: picked.has(e.id), disabled: isBusy || !!waiting,
            onchange: ev => { ev.target.checked ? picked.add(e.id) : picked.delete(e.id); render(); } });
          return h('li', { class: 'row' + (picked.has(e.id) ? ' is-picked' : '') + (isBusy ? ' is-waiting' : '') },
            h('label', { for: 'x-' + e.id },
              h('span', { class: 'cell' }, box, h('span', { class: 'tick', 'aria-hidden': 'true' })),
              h('span', { class: 'what' }, h('span', { class: 'name' }, e.item),
                h('span', { class: 'meta' }, isBusy ? t('statusWaiting', lang) : shortDate(e.date, lang))),
              h('span', { class: 'amt' }, inr(e.amount))));
        })
      : [h('li', { class: 'empty' }, t('allClear', lang))];

    let bar;
    if (flash) {
      bar = h('div', { class: 'status ok', role: 'status' },
        h('h2', {}, '✓ ' + t('confirmed', lang)), h('p', {}, inr(flash.amount)));
    } else if (waiting) {
      const amt = waiting.amount;
      const copyBtn = h('button', { type: 'button', class: 'btn btn-line', onclick: async () => {
        try { await navigator.clipboard.writeText(String(amt)); copyBtn.textContent = '✓ ' + t('copied', lang); } catch {}
      } }, t('copyAmount', lang) + ' ' + inr(amt));
      bar = h('div', { class: 'status', role: 'status' },
        h('h2', {}, t('sendTo', lang) + ' ' + inr(amt)),
        h('p', {}, h('span', { class: 'dot', 'aria-hidden': 'true' }), t('waitingHint', lang)),
        h('a', { class: 'btn btn-pay', style: 'display:flex;align-items:center;justify-content:center;text-decoration:none',
          href: 'https://wa.me/' + (payee.wa || '') + '?text=' + encodeURIComponent('Amma Khata · ' + inr(amt) + ' · ' + payee.pa) }, t('openWhatsApp', lang)),
        h('div', { style: 'margin-top:8px' }, copyBtn),
        h('div', { class: 'quiet-row' },
          h('button', { type: 'button', class: 'btn-quiet', onclick: () => openLink(upiLink({ ...payee, amount: amt, note: 'Amma Khata' })) }, t('tryUpi', lang)),
          h('button', { type: 'button', class: 'btn-quiet', onclick: () => store.cancelPayment(waiting.id) }, t('didntPay', lang))));
    } else {
      const allAmt = Math.max(due, 0);
      bar = [
        h('button', { type: 'button', class: 'btn btn-pay', disabled: pickedTotal === 0,
          onclick: () => pay({ kind: 'selected', ids: [...picked] }) }, t('paySelected', lang) + ' ' + inr(pickedTotal)),
        h('div', { class: 'quiet-row' },
          h('button', { type: 'button', class: 'btn-quiet', disabled: allAmt === 0, onclick: () => pay({ kind: 'all' }) }, t('payAll', lang) + ' ' + inr(allAmt)),
          h('button', { type: 'button', class: 'btn-quiet', onclick: () => otherAmountSheet(lang) }, t('otherAmount', lang)))
      ];
    }

    root.replaceChildren(
      band, notice,
      h('main', {},
        h('h2', { class: 'page-title' }, t('unpaidItems', lang)),
        h('ul', { class: 'ledger' }, rows),
        h('h2', { class: 'page-title' }, t('history', lang)),
        historyList(data.payments, lang)),
      h('div', { class: 'paybar' }, h('div', { class: 'paybar-inner' }, bar)));
  }

  return () => { stop(); clearTimeout(flashTimer); };
}
