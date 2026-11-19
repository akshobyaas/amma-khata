// Tiny element builder: h('div', {class: 'x', onclick: fn}, child, 'text')
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

export function langToggle(lang, onChange) {
  const b = (code, label) => h('button', { type: 'button', 'aria-pressed': String(lang === code), lang: code, onclick: () => onChange(code) }, label);
  return h('div', { class: 'lang', role: 'group', 'aria-label': 'Language / ಭಾಷೆ' }, b('en', 'EN'), b('kn', 'ಕನ್ನಡ'));
}

export function shortDate(iso, lang) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(lang === 'kn' ? 'kn-IN' : 'en-IN', { day: 'numeric', month: 'short' });
}
