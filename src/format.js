import { balance, unpaid, allocate } from './ledger.js';

export function inr(n) {
  const whole = Number.isInteger(n);
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

export function todayIST(now = Date.now()) {
  return new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

// What a Pay button asks for: { amount, expenseIds }.
export function payPlan(choice, expenses, payments) {
  const open = unpaid(expenses);
  if (choice.kind === 'selected') {
    const picked = open.filter(e => choice.ids.includes(e.id));
    return { amount: picked.reduce((s, e) => s + e.amount, 0), expenseIds: picked.map(e => e.id) };
  }
  if (choice.kind === 'all') {
    return { amount: Math.max(balance(expenses, payments), 0), expenseIds: open.map(e => e.id) };
  }
  return { amount: choice.amount, expenseIds: allocate(choice.amount, open).expenseIds };
}

// A typed amount like "1,750" → 1750; anything not a positive number → null.
export function parseAmount(s) {
  const n = Number(String(s).replace(/,/g, '').trim());
  return String(s).trim() !== '' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
