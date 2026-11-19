// Pure ledger rules. No Firebase, no DOM.

const DAY_MS = 24 * 3600 * 1000;

export function balance(expenses, payments) {
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const paid = payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0);
  return spent - paid;
}

const byAge = (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt;

export function unpaid(expenses) {
  return expenses.filter(e => e.paidBy == null).sort(byAge);
}

// Oldest first; an item is covered only when the remaining amount covers all of it.
export function allocate(amount, unpaidExpenses) {
  let left = amount;
  const expenseIds = [];
  for (const e of unpaidExpenses) {
    if (left < e.amount) break;
    expenseIds.push(e.id);
    left -= e.amount;
  }
  return { expenseIds, credit: left };
}

export function canEdit(expense, payments) {
  if (expense.paidBy != null) return false;
  return !payments.some(p => p.status === 'waiting' && p.expenseIds.includes(expense.id));
}

export function isStale(payment, now) {
  return payment.status === 'waiting' && now - payment.createdAt > DAY_MS;
}

export function cancel(payment) {
  if (payment.status !== 'waiting') throw new Error(`Cannot cancel a ${payment.status} payment`);
  return { ...payment, status: 'cancelled' };
}

// Unpaid items the owner may assign to a payment: not tied up in another waiting payment.
export function pickable(expenses, payments, forPaymentId = null) {
  const busy = new Set(payments.filter(p => p.status === 'waiting' && p.id !== forPaymentId).flatMap(p => p.expenseIds));
  return unpaid(expenses).filter(e => !busy.has(e.id));
}
