/*!
 * TCG Price Hunter — © 2026 Anastasiophrenelia. Tous droits réservés.
 * https://github.com/Anastasiophrenelia/TCG-Price-Hunter
 * Toute copie, modification ou redistribution sans autorisation écrite de l'auteur est interdite (voir LICENSE).
 */
// TCG Price Hunter — tourne sur les pages produit Cardmarket
// 1) barre sous le titre : "Scanner cette page" / "Ajouter" (prend les offres affichées, sans « Montrer plus de résultats »)
// 2) sur chaque offre : ✕ ignorer cette offre · 🚫 bloquer le vendeur
// 3) entoure en vert les vendeurs choisis dans ton meilleur panier
// 4) scan automatique quand la page est ouverte par TCG Price Hunter (adresse qui finit par #cmpm-scan=ID)
(() => {
  if (window.__cmPanier) return;
  window.__cmPanier = true;

  const rows = () => document.querySelectorAll('.article-row');
  const visible = (el) => !!el && el.offsetParent !== null;
  // lecture des offres / de la carte : voir parse.js (partagé avec le site de l'extension)
  const { parseRow, sellerOf } = self.CMParse;
  const productInfo = () => self.CMParse.productInfo(document, location.pathname + location.search);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // langue de l'extension (choisie dans TCG Price Hunter)
  const I = self.I18N;
  chrome.storage.local.get('cmSettings').then((d) => { I.setLang((d.cmSettings || {}).uiLang || 'fr'); renderBox().catch(() => {}); });
  const T = (s) => I.T(s), TF = (s, v) => I.TF(s, v);
  const TP = (fr, key, v) => (I.getLang() === 'fr' ? fr : TF(key, v));
  const offerKey = (id, o) => [id, o.seller, o.price, o.cond, o.lang].join('|');

  const pageState = () => ({
    blocked: /Access denied|Too Many Requests|Attention Required|Accès refusé/i.test(document.title),
    challenge: /Just a moment|Un instant|Vérification|Checking your browser/i.test(document.title) || !!document.querySelector('#challenge-form, .cf-turnstile, #cf-challenge-running'),
    needLogin: !document.querySelector('h1') && /login/i.test((document.body?.innerText || '').slice(0, 300)),
  });

  // ---------- Scan de la page ----------
  let scanning = false, stopScan = false, scanMsg = '', pendingQty = 1, autoId = null;

  async function waitFor(fn, ms) {
    const t = Date.now();
    while (Date.now() - t < ms) { if (fn()) return true; if (stopScan) return false; await sleep(300); }
    return false;
  }
  const getList = async () => (await chrome.storage.local.get('cmList')).cmList || {};

  async function addToList(info, qty) {
    const list = await getList();
    list[info.id] = { ...(list[info.id] || {}), ...info, qty, checked: list[info.id]?.checked ?? true, added: list[info.id]?.added || Date.now() };
    await chrome.storage.local.set({ cmList: list });
    return list;
  }

  // Enregistre les offres affichées sur la page (sans cliquer sur « Montrer plus de résultats »)
  async function scanPage(auto = false) {
    if (scanning) return 0;
    const info = productInfo();
    if (!info) return 0;
    const settings = (await chrome.storage.local.get('cmSettings')).cmSettings || {};
    const qtyInput = document.querySelector('#cmpm-box input[data-a="qty"]');
    if (qtyInput && !auto) pendingQty = parseInt(qtyInput.value, 10) || 1;
    scanning = true; stopScan = false;
    let count = 0;
    try {
      // on prend seulement les offres affichées : jamais de clic sur « Montrer plus de résultats » (ça fait bloquer Cardmarket, erreur 1015)
      const offers = [...rows()].map(parseRow).filter(Boolean);
      count = offers.length;
      const list = await getList();
      const qty = auto ? list[info.id]?.qty || 1 : pendingQty;
      await addToList(info, qty);
      await chrome.storage.local.set({
        ['scan_' + info.id]: {
          date: Date.now(), offers, url: info.url,
          partial: visible(document.getElementById('loadMoreButton')),
          loggedOut: !!document.querySelector('input[name="username"]'),
        },
      });
      scanMsg = TF('✔ {n} offres scannées', { n: offers.length }) + (stopScan ? ' — arrêté' : '');
    } catch (e) {
      scanMsg = '❌ ' + e.message;
      throw e;
    } finally {
      scanning = false;
      renderBox();
    }
    return count;
  }

  // ---------- Style ----------
  function injectStyle() {
    if (document.getElementById('cmpm-style-5')) return;
    document.querySelectorAll('#cmpm-style, #cmpm-style-3, #cmpm-style-4').forEach((e) => e.remove());
    const st = document.createElement('style');
    st.id = 'cmpm-style-5';
    st.textContent = `
      #cmpm-box{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:10px 0 4px;padding:8px 10px;background:#0f1720;border:2px solid #1f6feb;border-radius:10px;color:#e7eaef;font:13px/1.4 system-ui,sans-serif;font-style:normal;font-weight:normal}
      #cmpm-box.in{border-color:#2ecc71}
      #cmpm-box.floating{position:fixed;left:14px;bottom:14px;z-index:9999;width:280px;box-shadow:0 8px 28px #000a}
      #cmpm-box .t{font-weight:700;white-space:nowrap}
      #cmpm-box button{border:0;border-radius:7px;padding:7px 14px;font-weight:700;cursor:pointer;background:#2ecc71;color:#06210f;white-space:nowrap}
      #cmpm-box button.sec{background:#1d2633;color:#e7eaef;border:1px solid #2b333f}
      #cmpm-box button.stop{background:#1d2633;color:#e7eaef;border:1px solid #f0514a}
      #cmpm-box label{margin:0;display:flex;align-items:center;gap:5px;white-space:nowrap}
      #cmpm-box input{width:52px;background:#1d2633;color:#fff;border:1px solid #2b333f;border-radius:5px;padding:3px 5px}
      #cmpm-box a{color:#6cb0ff;cursor:pointer;text-decoration:none;white-space:nowrap}
      #cmpm-box .c{color:#8b95a5;font-size:12px;margin-left:auto;white-space:nowrap}
      #cmpm-box .f{color:#b9c3d1;font-size:12px}
      #cmpm-box .best{flex-basis:100%;padding:6px 8px;border-radius:7px;background:#2ecc7122;color:#7ee2a8;font-size:12px}
      .article-row.cmpm-best{box-shadow:inset 0 0 0 3px #2ecc71!important;background:rgba(46,204,113,.22)!important;border-radius:4px}
      .article-row.cmpm-best>*{background:transparent!important}
      .article-row.cmpm-basket{box-shadow:inset 0 0 0 2px rgba(46,204,113,.6)!important;background:rgba(46,204,113,.07)!important;border-radius:4px}
      .article-row.cmpm-ignored *:not(.cmpm-ctl b),.article-row.cmpm-blocked *:not(.cmpm-ctl b){color:#5c6370!important}
      .article-row.cmpm-ignored :is(.badge,.icon,img,[class*=fonticon]),.article-row.cmpm-blocked :is(.badge,.icon,img,[class*=fonticon]){filter:grayscale(1) opacity(.35)}
      .article-row.cmpm-blocked{background:rgba(240,81,74,.10)!important}
      .article-row.cmpm-blocked .seller-name a{text-decoration:line-through}
      .cmpm-badge{display:inline-block;margin-left:6px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:700;background:#2ecc71;color:#06210f;white-space:nowrap}
      .cmpm-badge.soft{background:transparent;color:#2ecc71;border:1px solid #2ecc71}
      .cmpm-ctl{display:inline-flex;gap:2px;margin:0 4px;vertical-align:middle}
      .cmpm-ctl b{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:4px;cursor:pointer;font-size:11px;line-height:1;color:#8b95a5;border:1px solid #3a4554;background:#1d2633;font-weight:700;user-select:none}
      .cmpm-ctl b:hover{color:#fff;border-color:#6b7787}
      .cmpm-ctl b.on{background:#f0514a;border-color:#f0514a;color:#fff}`;
    document.head.appendChild(st);
  }

  // ---------- ✕ ignorer l'offre / 🚫 bloquer le vendeur + vert du meilleur panier ----------
  let plan = null, ignored = {}, blocked = {};
  function decorate() {
    const info = productInfo();
    if (!info) return;
    injectStyle();
    const chosen = plan && plan.cards ? plan.cards[info.id] : null;
    const basket = new Set(plan && plan.sellers ? plan.sellers : []);
    rows().forEach((r) => {
      const o = parseRow(r);
      if (!o) return;
      const key = offerKey(info.id, o);
      // boutons juste après l'icône de note du vendeur (l'"étoile")
      let ctl = r.querySelector('.cmpm-ctl');
      if (!ctl) {
        ctl = document.createElement('span');
        ctl.className = 'cmpm-ctl';
        ctl.innerHTML = `<b data-ig title="${T('Ignorer cette offre')}">✕</b><b data-bl title="${T('Bloquer ce vendeur (toutes ses offres)')}">🚫</b>`;
        const star = r.querySelector('[class*="fonticon-seller-rating-"]');
        if (star) star.insertAdjacentElement('afterend', ctl);
        else (r.querySelector('.seller-name') || r).prepend(ctl);
      }
      ctl.dataset.key = key;
      ctl.dataset.seller = o.seller;
      const isIg = !!ignored[key], isBl = !!blocked[o.seller];
      ctl.querySelector('[data-ig]').classList.toggle('on', isIg);
      ctl.querySelector('[data-bl]').classList.toggle('on', isBl);
      r.classList.toggle('cmpm-ignored', isIg);
      r.classList.toggle('cmpm-blocked', isBl);

      const isBest = !!chosen && o.seller === chosen.seller && !isBl;
      const inBasket = !isBest && basket.has(o.seller) && !isBl;
      r.classList.toggle('cmpm-best', isBest);
      r.classList.toggle('cmpm-basket', inBasket);
      r.querySelector('.cmpm-badge')?.remove();
      if (isBest || inBasket) {
        const b = document.createElement('span');
        b.className = 'cmpm-badge' + (isBest ? '' : ' soft');
        b.textContent = isBest ? T('🛒 À acheter ici') : T('🛒 Dans ton panier');
        r.querySelector('.seller-name')?.appendChild(b);
      }
    });
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('.cmpm-ctl b');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const ctl = b.parentElement;
    if (b.hasAttribute('data-ig')) {
      const k = ctl.dataset.key;
      if (ignored[k]) delete ignored[k]; else ignored[k] = 1;
      await chrome.storage.local.set({ cmIgnored: ignored });
    } else {
      const s = ctl.dataset.seller;
      if (blocked[s]) delete blocked[s]; else blocked[s] = 1;
      await chrome.storage.local.set({ cmBlocked: blocked });
    }
  }, true);

  // ---------- Barre sous le titre ----------
  async function renderBox() {
    const info = productInfo();
    if (!info) return;
    injectStyle();
    let box = document.getElementById('cmpm-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'cmpm-box';
      const h1 = document.querySelector('.flex-fill > h1') || document.querySelector('h1');
      if (h1) h1.insertAdjacentElement('afterend', box);
      else { box.classList.add('floating'); document.body.appendChild(box); }
      box.addEventListener('click', onBoxClick);
      box.addEventListener('change', onBoxChange);
    }
    const list = await getList();
    const it = list[info.id];
    const n = Object.keys(list).length;
    if (it && info.img && it.img !== info.img) { it.img = info.img; chrome.storage.local.set({ cmList: list }); }
    const chosen = plan && plan.cards ? plan.cards[info.id] : null;
    const scan = (await chrome.storage.local.get('scan_' + info.id))['scan_' + info.id];
    box.classList.toggle('in', !!it);
    box.innerHTML = `
      <span class="t">${T('🎯 TCG Price Hunter')}</span>
      ${scanning
        ? `<button data-a="stop" class="stop">${TF('⏹ Arrêter ({n} offres)', { n: rows().length })}</button>`
        : `<button data-a="scan">${scan ? T('🔍 Re-scanner cette page') : T('🔍 Scanner cette page')}</button>
           <button data-a="add" class="sec">${it ? T('✔ Dans ma liste — retirer') : T('➕ Ajouter (offres de la page)')}</button>`}
      <label>${T('Qté')} <input type="number" min="1" max="99" value="${it ? it.qty : pendingQty}" data-a="qty"></label>
      ${scanMsg ? `<span class="f">${scanMsg}</span>` : scan ? `<span class="f">${TF('Déjà scannée : {n} offres', { n: scan.offers.length })}</span>` : ''}
      ${chosen ? `<div class="best">${TF('Meilleur panier : acheter chez {s} ({p}) — entouré en vert ci-dessous', { s: '<b>' + chosen.seller.replace(/[<>&]/g, '') + '</b>', p: String(chosen.price.toFixed(2)).replace('.', ',') + ' €' })}</div>` : ''}
      <span class="c">${TP(`${n} carte${n > 1 ? 's' : ''} dans ta liste`, '{n} carte(s) dans ta liste', { n })} · <a data-a="open">${T('Ouvrir mon panier →')}</a></span>`;
  }

  async function onBoxClick(e) {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'open') chrome.runtime.sendMessage({ type: 'openApp' }).catch(() => {});
    if (a === 'scan') scanPage().catch(() => {});
    if (a === 'stop') stopScan = true;
    if (a === 'add') {
      const info = productInfo();
      const list = await getList();
      if (list[info.id]) {
        delete list[info.id];
        scanMsg = '';
        await chrome.storage.local.remove('scan_' + info.id);
        await chrome.storage.local.set({ cmList: list });
      } else {
        const q = parseInt(document.querySelector('#cmpm-box input[data-a="qty"]')?.value, 10) || 1;
        await addToList(info, q);
        // les offres déjà affichées sur la page sont gardées : 0 requête en plus
        const offers = [...rows()].map(parseRow).filter(Boolean);
        if (offers.length) await chrome.storage.local.set({
          ['scan_' + info.id]: { date: Date.now(), offers, url: info.url, partial: visible(document.getElementById('loadMoreButton')),
            loggedOut: !!document.querySelector('input[name="username"]'), q: null },
        });
      }
    }
  }

  async function onBoxChange(e) {
    if (e.target.dataset.a !== 'qty') return;
    pendingQty = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1));
    const info = productInfo();
    const list = await getList();
    if (list[info.id]) {
      list[info.id].qty = pendingQty;
      await chrome.storage.local.set({ cmList: list });
    }
  }

  // ---------- Scan automatique (page ouverte en arrière-plan par TCG Price Hunter) ----------
  // l'id vient de l'adresse (#cmpm-scan=ID) ; si Cloudflare recharge la page sans le #, on le retrouve dans sessionStorage
  let auto = location.hash.match(/cmpm-scan=(\d+)/);
  try {
    if (auto) sessionStorage.cmpmAuto = auto[1];
    else if (sessionStorage.cmpmAuto) auto = [null, sessionStorage.cmpmAuto];
  } catch {}
  if (auto) {
    const id = auto[1];
    const status = (state, msg = '') => chrome.storage.local.set({ ['cmAuto_' + id]: { state, msg, t: Date.now() } });
    const st = pageState();
    if (st.challenge) { status('challenge'); return; } // tu coches la case, la page se recharge et ce script repart
    if (st.blocked) { status('blocked'); return; }
    if (st.needLogin) { status('login'); return; }
    if (!productInfo()) { status('error', 'page sans offres'); return; }
  }

  // ---------- Démarrage ----------
  if (!productInfo()) return;
  chrome.storage.local.get(['cmPlan', 'cmIgnored', 'cmBlocked']).then((d) => {
    plan = d.cmPlan || null; ignored = d.cmIgnored || {}; blocked = d.cmBlocked || {};
    renderBox(); decorate();
    if (auto) {
      const id = auto[1];
      autoId = id;
      try { delete sessionStorage.cmpmAuto; } catch {}
      chrome.storage.local.set({ ['cmAuto_' + id]: { state: 'scanning', t: Date.now() } }); // (captcha passé)
      scanPage(true)
        .then((n) => chrome.storage.local.set({ ['cmAuto_' + id]: { state: 'done', msg: String(n), t: Date.now() } }))
        .catch((err) => chrome.storage.local.set({ ['cmAuto_' + id]: { state: 'error', msg: err.message, t: Date.now() } }));
    }
  });
  chrome.storage.onChanged.addListener((ch) => {
    if (ch.cmPlan) plan = ch.cmPlan.newValue || null;
    if (ch.cmIgnored) ignored = ch.cmIgnored.newValue || {};
    if (ch.cmBlocked) blocked = ch.cmBlocked.newValue || {};
    if (ch.cmPlan || ch.cmIgnored || ch.cmBlocked) decorate();
    if (ch.cmPlan || ch.cmList) renderBox();
  });
  // quand "Montrer plus de résultats" ajoute des lignes, on ajoute les boutons et le vert
  const body = document.querySelector('.table-body');
  if (body) {
    let t;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(decorate, 200); }).observe(body, { childList: true });
  }
})();
