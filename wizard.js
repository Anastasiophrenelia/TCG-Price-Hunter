/*!
 * TCG Price Hunter — © 2026 Anastasiophrenelia. Tous droits réservés.
 * https://github.com/Anastasiophrenelia/TCG-Price-Hunter
 * Toute copie, modification ou redistribution sans autorisation écrite de l'auteur est interdite (voir LICENSE).
 */
// Page des résultats du Shopping Wizard : ajoute « Frais de port en lettre suivie » et « Total en lettre suivie »
// (le Wizard compte toujours l'envoi le moins cher). La comparaison de TCG Price Hunter relit ces valeurs.
(async () => {
  'use strict';
  if (document.getElementById('tcgph-tracked')) return;
  const I = self.I18N;
  const d = await chrome.storage.local.get('cmSettings');
  const S = d.cmSettings || {};
  try { I.setLang(S.uiLang || 'fr'); } catch {}
  const T = (s) => { try { return I.T(s); } catch { return s; } };
  const my = +S.myCountry || 12;
  const euro = (v) => v.toFixed(2).replace('.', ',') + ' €';

  // tarifs officiels (pays du vendeur -> ton pays) : ceux déjà gardés par l'extension, sinon demandés à l'extension
  const getTable = async (from) => {
    const k = `ship_${from}_${my}`;
    const c = (await chrome.storage.local.get(k))[k];
    const fix = (m) => m.map((x) => ({ ...x, maxValue: x.maxValue == null ? Infinity : x.maxValue }));
    if (c && Date.now() - c.date < 14 * 24 * 3600 * 1000) return fix(c.methods);
    const r = await chrome.runtime.sendMessage({ type: 'shipTable', from, to: my }).catch(() => null);
    return r && r.methods ? fix(r.methods) : null;
  };

  // les résultats détaillés peuvent arriver un peu après le chargement
  for (let i = 0; i < 40 && !document.querySelector('.detailed-result-card'); i++) await new Promise((r) => setTimeout(r, 250));
  const summary = document.querySelector('#ShoppingWizardResult dl');
  if (!summary || !document.querySelector('.detailed-result-card')) return;

  const res = await self.CMWizard.compute(document, getTable);
  const add = (dl, label, value, id) => {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    const ref = dl.querySelector('dt');
    dt.className = (ref && ref.className) || ''; dd.className = (dl.querySelector('dd') || {}).className || 'text-end';
    dt.innerHTML = '<span class="me-2">🔒</span>'; dt.appendChild(document.createTextNode(label));
    dt.style.color = dd.style.color = '#1b63e0'; dd.style.fontWeight = '700';
    dd.textContent = value;
    if (id) dd.id = id;
    dl.append(dt, dd);
    return dd;
  };
  add(summary, T('Frais de port en lettre suivie'), euro(res.tShip));
  const tot = add(summary, T('Total en lettre suivie'), euro(res.tTotal), 'tcgph-tracked');
  Object.assign(tot.dataset, { total: res.tTotal, ship: res.tShip, wizTotal: res.total, orders: res.orders.length });
  // dans chaque commande : le port en suivi quand il change
  for (const o of res.orders) {
    if (o.tShip - o.ship < 0.005) continue;
    const dl = o.card.querySelector('dl'); if (!dl) continue;
    add(dl, T('Frais de port en lettre suivie'), euro(o.tShip));
  }
})();
