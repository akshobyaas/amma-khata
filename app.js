import { h, langToggle } from './src/dom.js';
import { t } from './src/i18n.js';
import { mountAmma } from './src/views/amma.js';

const root = document.getElementById('app');
const params = new URLSearchParams(location.search);

function storedLang(fallback) {
  try { return localStorage.getItem('lang') || fallback; } catch { return fallback; }
}
function saveLang(lang) { try { localStorage.setItem('lang', lang); } catch {} }

function message(text) {
  root.replaceChildren(h('div', { class: 'setup' }, h('p', {}, text)));
}

async function loadStore() {
  const demo = params.get('demo');
  if (demo) {
    const { createFakeStore } = await import('./dev/fake-store.js');
    const { demoData } = await import('./dev/demo-data.js');
    return { store: createFakeStore({ role: demo, ...demoData() }), payee: { pa: '6366594660@upi', pn: 'AKSHOBYA A S' } };
  }
  const cfg = await import('./firebase-config.js');
  if (cfg.firebaseConfig.apiKey === 'PASTE_HERE') {
    message('Firebase keys are missing. Fill in firebase-config.js (see README).');
    return null;
  }
  const { createStore } = await import('./src/db.js');
  return { store: await createStore(cfg.firebaseConfig), payee: cfg.payee, vapidKey: cfg.vapidKey };
}

function setupView(store, role, done) {
  let lang = storedLang(role === 'amma' ? 'kn' : 'en');
  const draw = (err) => {
    const input = h('input', { type: 'password', id: 'key', autocomplete: 'off', required: true });
    root.replaceChildren(
      h('header', { class: 'band' }, h('div', { class: 'band-top' },
        h('span', { class: 'band-label' }, 'Amma Khata'), langToggle(lang, l => { lang = l; saveLang(l); draw(); }))),
      h('form', { class: 'setup', onsubmit: async e => {
        e.preventDefault();
        try { await store.bindDevice(role, input.value.trim()); saveLang(lang); history.replaceState(null, '', location.pathname); done(); }
        catch { draw(true); }
      } },
        h('h1', { style: 'font-size:22px' }, t('setupTitle', lang)),
        h('label', { class: 'field' }, h('span', {}, t('setupKey', lang)), input),
        err ? h('p', { class: 'error', role: 'alert' }, t('setupWrong', lang)) : null,
        h('button', { class: 'btn btn-pay', type: 'submit' }, t('setupButton', lang))));
    input.focus();
  };
  draw(false);
}

async function start() {
  let loaded;
  try { loaded = await loadStore(); }
  catch (e) { message('Could not connect. Check the internet and reopen the app.'); console.error(e); return; }
  if (!loaded) return;
  const { store, payee, vapidKey } = loaded;

  const setup = location.hash.match(/^#setup-(amma|owner)$/);
  if (setup) return setupView(store, setup[1], start);

  const device = await store.myDevice();
  if (!device) return message(t('notSetUp', storedLang('kn')) + ' / ' + t('notSetUp', 'en'));

  let lang = storedLang(device.role === 'amma' ? 'kn' : 'en');
  let unmount = null;
  const notice = h('div', { id: 'notice' });
  const ctx = {
    store, payee, notice,
    getLang: () => lang,
    setLang: l => { lang = l; saveLang(l); store.setLang(l).catch(() => {}); mount(); }
  };
  async function mount() {
    if (unmount) unmount();
    if (device.role === 'amma') unmount = mountAmma(root, ctx);
    else {
      const { mountOwner } = await import('./src/views/owner.js');
      unmount = mountOwner(root, ctx);
    }
  }
  await mount();

  if (vapidKey && !params.get('demo')) {
    const { offerPush } = await import('./src/push.js');
    offerPush(notice, store, vapidKey, () => lang, device);
  }
}

start();
