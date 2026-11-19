// Sample data for ?demo=amma / ?demo=owner previews.
export function demoData() {
  const items = [['Petrol', 1750], ['Bangalore trip', 1540], ['Electricity', 95], ['Vegetables', 87],
    ['Socks', 320], ['Kerchief', 200], ['Body wash', 675], ['Face wash', 328], ['Body lotion', 215]];
  const expenses = items.map(([item, amount], i) => ({ id: 'e' + i, item, amount, date: '2026-11-13', createdAt: i, notifiedAt: null, paidBy: null }));
  expenses.push({ id: 'old1', item: 'Grocery', amount: 720, date: '2026-11-10', createdAt: -2, paidBy: 'pold1' });
  const payments = [{ id: 'pold1', amount: 720, expenseIds: ['old1'], method: 'upi', status: 'confirmed', by: 'u-amma', createdAt: Date.parse('2026-11-11T09:42:00Z'), resolvedAt: 1 }];
  payments.push({ id: 'pchk', amount: 2000, expenseIds: [], method: 'unmatched', status: 'needs_check', payerName: 'U A BHAVANTH', upiRef: '631597313720', createdAt: Date.parse('2026-11-16T09:00:00Z'), resolvedAt: null });
  return { expenses, payments };
}
