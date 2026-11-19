// Firestore-backed store. The views only use this API, so tests can swap in a fake store.
const V = '10.14.1';
const base = `https://www.gstatic.com/firebasejs/${V}`;

export async function createStore(firebaseConfig) {
  const { initializeApp } = await import(`${base}/firebase-app.js`);
  const { getAuth, signInAnonymously, onAuthStateChanged } = await import(`${base}/firebase-auth.js`);
  const fs = await import(`${base}/firebase-firestore.js`);
  const { initializeFirestore, persistentLocalCache, collection, doc, getDoc, setDoc, addDoc,
          updateDoc, deleteDoc, onSnapshot, writeBatch } = fs;

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { localCache: persistentLocalCache() });

  const user = await new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, u => { if (u) { stop(); resolve(u); } });
    signInAnonymously(auth).catch(reject);
  });
  const uid = user.uid;
  const now = () => Date.now();

  return {
    app, uid,
    async myDevice() {
      const s = await getDoc(doc(db, 'devices', uid));
      return s.exists() ? s.data() : null;
    },
    async bindDevice(role, key) {
      await setDoc(doc(db, 'devices', uid), { role, key, fcmToken: null, lang: 'kn', at: now() });
    },
    async saveToken(fcmToken) { await updateDoc(doc(db, 'devices', uid), { fcmToken }); },
    async setLang(lang) { await updateDoc(doc(db, 'devices', uid), { lang }); },

    watch(cb) {
      let expenses = null, payments = null;
      const list = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
      const emit = () => { if (expenses && payments) cb({ expenses, payments }); };
      const a = onSnapshot(collection(db, 'expenses'), s => { expenses = list(s); emit(); });
      const b = onSnapshot(collection(db, 'payments'), s => { payments = list(s); emit(); });
      return () => { a(); b(); };
    },

    addExpense({ item, amount, date }) {
      return addDoc(collection(db, 'expenses'), { item, amount, date, createdAt: now(), notifiedAt: null, paidBy: null });
    },
    updateExpense(id, patch) { return updateDoc(doc(db, 'expenses', id), patch); },
    deleteExpense(id) { return deleteDoc(doc(db, 'expenses', id)); },

    async startPayment({ amount, expenseIds }) {
      const r = await addDoc(collection(db, 'payments'), {
        amount, expenseIds, method: 'upi', status: 'waiting', by: uid,
        upiRef: null, payerName: null, createdAt: now(), resolvedAt: null
      });
      return r.id;
    },
    cancelPayment(id) { return updateDoc(doc(db, 'payments', id), { status: 'cancelled', resolvedAt: now() }); },

    // Owner: confirm a payment by hand and mark the items it covers as paid.
    async resolvePayment(id, expenseIds) {
      const b = writeBatch(db);
      b.update(doc(db, 'payments', id), { status: 'confirmed', expenseIds, resolvedAt: now() });
      expenseIds.forEach(e => b.update(doc(db, 'expenses', e), { paidBy: id }));
      await b.commit();
    },
    rejectPayment(id) { return updateDoc(doc(db, 'payments', id), { status: 'cancelled', resolvedAt: now() }); },
    async recordCash({ amount, expenseIds }) {
      const ref = doc(collection(db, 'payments'));
      const b = writeBatch(db);
      b.set(ref, { amount, expenseIds, method: 'cash', status: 'confirmed', by: uid,
                   upiRef: null, payerName: null, createdAt: now(), resolvedAt: now() });
      expenseIds.forEach(e => b.update(doc(db, 'expenses', e), { paidBy: ref.id }));
      await b.commit();
    }
  };
}
