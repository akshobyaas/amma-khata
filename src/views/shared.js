import { h, shortDate } from '../dom.js';
import { t } from '../i18n.js';
import { inr } from '../format.js';

const stateKey = { waiting: 'statusWaiting', confirmed: 'statusConfirmed', needs_check: 'statusNeedsCheck', cancelled: 'statusCancelled' };
const istDay = ms => new Date(ms + 5.5 * 3600e3).toISOString().slice(0, 10);

export function historyList(payments, lang, { showCancelled = false } = {}) {
  const list = payments.filter(p => showCancelled || p.status !== 'cancelled')
    .sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  if (!list.length) return h('ul', { class: 'ledger history' }, h('li', { class: 'empty' }, t('noPayments', lang)));
  return h('ul', { class: 'ledger history' }, list.map(p => h('li', { class: 'row' },
    h('span', { class: 'badge', 'aria-hidden': 'true' }, p.status === 'confirmed' ? '✓' : '·'),
    h('span', { class: 'what' },
      h('span', { class: 'name' }, shortDate(istDay(p.createdAt), lang) + (p.method === 'cash' ? ' · ' + t('cash', lang) : '') + (p.payerName ? ' · ' + p.payerName : '')),
      h('span', { class: 'state ' + (p.status === 'needs_check' ? 'waiting' : p.status) }, t(stateKey[p.status], lang))),
    h('span', { class: 'amt' }, inr(p.amount)))));
}

// A tickable list of unpaid items for sheets. Returns { el, ids() }.
export function pickList(open, preselected, lang, onChange = () => {}) {
  const chosen = new Set(preselected);
  const el = h('ul', { class: 'ledger pick' }, open.map(e => {
    const box = h('input', { type: 'checkbox', id: 'pk-' + e.id, checked: chosen.has(e.id),
      onchange: ev => { ev.target.checked ? chosen.add(e.id) : chosen.delete(e.id); onChange(); } });
    return h('li', { class: 'row' }, h('label', { for: 'pk-' + e.id },
      h('span', { class: 'cell' }, box, h('span', { class: 'tick', 'aria-hidden': 'true' })),
      h('span', { class: 'what' }, h('span', { class: 'name' }, e.item), h('span', { class: 'meta' }, shortDate(e.date, lang))),
      h('span', { class: 'amt' }, inr(e.amount))));
  }));
  return { el, ids: () => open.filter(e => chosen.has(e.id)).map(e => e.id) };
}

export function sheet(titleText, body, actions) {
  const dlg = h('dialog', { 'aria-label': titleText }, h('h2', {}, titleText), body, h('div', { class: 'sheet-actions' }, actions));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}
