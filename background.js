/*!
 * TCG Price Hunter — © 2026 Anastasiophrenelia. Tous droits réservés.
 * https://github.com/Anastasiophrenelia/TCG-Price-Hunter
 * Toute copie, modification ou redistribution sans autorisation écrite de l'auteur est interdite (voir LICENSE).
 */
// Ouvre (ou ramène au premier plan) la page "TCG Price Hunter"
async function openApp() {
  const url = chrome.runtime.getURL('app.html');
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => (t.url || '').startsWith(url));
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId != null) chrome.windows.update(existing.windowId, { focused: true }).catch(() => {});
  } else {
    await chrome.tabs.create({ url });
  }
}

chrome.action.onClicked.addListener(openApp);

// même lecture des prix que parse.js (« 1,55 € », « 1.234,50 € », ou un nombre)
function num(s) {
  if (typeof s === 'number') return s;
  const m = String(s ?? '').replace(/\s/g, '').match(/[\d.,]+/);
  if (!m) return null;
  let x = m[0];
  if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.');
  const v = parseFloat(x);
  return isNaN(v) ? null : v;
}
// tarifs officiels Cardmarket (pays -> pays) pour la page des résultats du Shopping Wizard
async function shipTable(from, to) {
  const k = `ship_${from}_${to}`;
  const r = await fetch(`https://help.cardmarket.com/api/shippingCosts?locale=fr&fromCountry=${from}&toCountry=${to}&preview=false`);
  const j = await r.json();
  const methods = (Array.isArray(j) ? j : []).map((m) => ({
    name: m.name, tracked: !!m.isTracked, virtual: !!m.isVirtual, letter: !!m.isLetter,
    maxValue: num(m.maxValue) || null, maxWeight: +m.maxWeight || 0, price: num(m.price),
  })).filter((m) => m.price != null && m.maxWeight > 0);
  if (methods.length) chrome.storage.local.set({ [k]: { date: Date.now(), methods } });
  return methods;
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg && msg.type === 'openApp') openApp();
  if (msg && msg.type === 'shipTable') {
    shipTable(+msg.from, +msg.to).then((methods) => reply({ methods }), () => reply({ methods: null }));
    return true; // réponse asynchrone
  }
});
