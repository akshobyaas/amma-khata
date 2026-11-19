// In-memory store with the same API as src/db.js, for previewing screens without Firebase.
export function createFakeStore({ role = 'amma', expenses = [], payments = [] } = {}) {
  const state = { expenses: structuredClone(expenses), payments: structuredClone(payments) };
  const subs = new Set();
  let n = 100;
  const emit = () => subs.forEach(cb => cb(structuredClone(state)));
  const now = () => Date.now();
  const find = (list, id) => state[list].find(x => x.id === id);
  return {
    uid: 'u-' + role,
    async myDevice() { return { role, lang: 'kn' }; },
    async bindDevice() {}, async saveToken() {}, async setLang() {},
    watch(cb) { subs.add(cb); queueMicrotask(() => cb(structuredClone(state))); return () => subs.delete(cb); },
    async addExpense(e) { state.expenses.push({ id: 'e' + n++, createdAt: now(), notifiedAt: null, paidBy: null, ...e }); emit(); },
    async updateExpense(id, patch) { Object.assign(find('expenses', id), patch); emit(); },
    async deleteExpense(id) { state.expenses = state.expenses.filter(e => e.id !== id); emit(); },
    async startPayment({ amount, expenseIds }) {
      const id = 'p' + n++;
      state.payments.push({ id, amount, expenseIds, method: 'upi', status: 'waiting', by: 'u-amma', createdAt: now(), resolvedAt: null });
      emit(); return id;
    },
    async cancelPayment(id) { find('payments', id).status = 'cancelled'; emit(); },
    async resolvePayment(id, expenseIds) {
      Object.assign(find('payments', id), { status: 'confirmed', expenseIds, resolvedAt: now() });
      expenseIds.forEach(e => (find('expenses', e).paidBy = id)); emit();
    },
    async rejectPayment(id) { find('payments', id).status = 'cancelled'; emit(); },
    async recordCash({ amount, expenseIds }) {
      const id = 'p' + n++;
      state.payments.push({ id, amount, expenseIds, method: 'cash', status: 'confirmed', createdAt: now(), resolvedAt: now() });
      expenseIds.forEach(e => (find('expenses', e).paidBy = id)); emit();
    },
    _confirm(id) { const p = find('payments', id); this.resolvePayment(id, p.expenseIds); }
  };
}
