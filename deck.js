// ---------- Import de deck (Riftbound, Yu-Gi-Oh!, Pokémon, Magic) ----------
// chargé après app.js : utilise ses fonctions (request, job, list, cats, T, TF, esc, euro…)
'use strict';

// clé = chemin du jeu sur Cardmarket ; exact: false = le site ne donne pas l'édition des cartes (seulement « le moins cher »)
const DECK_SITES = {
  Riftbound: [
    { name: 'Piltover Archive', host: 'piltoverarchive.com', origin: 'https://piltoverarchive.com/*', url: 'https://piltoverarchive.com/decks', ex: 'https://piltoverarchive.com/decks/view/…', parse: (h, side) => parsePiltover(h, side) },
    { name: 'Riftdecks', host: 'riftdecks.com', origin: 'https://riftdecks.com/*', url: 'https://riftdecks.com/riftbound-decks', ex: 'https://riftdecks.com/riftbound-metagame/…', parse: (h, side) => parseRiftdecks(h, side) },
  ],
  YuGiOh: [
    { name: 'YGOPRODeck', host: 'ygoprodeck.com', origin: 'https://ygoprodeck.com/*', url: 'https://ygoprodeck.com/category/format/tournament%20meta%20decks', ex: 'https://ygoprodeck.com/deck/…', exact: false, parse: (h, side) => parseYgopro(h, side) },
  ],
  Pokemon: [
    { name: 'Limitless TCG', host: 'limitlesstcg.com', origin: 'https://limitlesstcg.com/*', url: 'https://limitlesstcg.com/decks', ex: 'https://limitlesstcg.com/decks/list/…', parse: (h) => parseLimitless(h) },
  ],
  Magic: [
    { name: 'MTGGoldfish', host: 'mtggoldfish.com', origin: 'https://www.mtggoldfish.com/*', url: 'https://www.mtggoldfish.com/metagame/standard', ex: 'https://www.mtggoldfish.com/deck/…', parse: (h, side) => parseGoldfish(h, side) },
  ],
};
const GAME_LABEL = { Riftbound: 'Riftbound', YuGiOh: 'Yu-Gi-Oh!', Pokemon: 'Pokémon', Magic: 'Magic' };
const gameExact = (g) => (DECK_SITES[g] || []).some((x) => x.exact !== false);
const DISCORD_URL = 'https://discord.gg/Vm8vfqznh2';
let deckState = { game: 'Riftbound', mode: 'same', side: false, url: '' };

const dkNorm = (s) => String(s || '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();
const dkBase = (s) => dkNorm(String(s || '').replace(/\s*\((?:V\.\d+[^)]*)\)\s*$/i, ''));
const dkKey = (s) => dkBase(s).replace(/[^a-z0-9]/g, '');
const dkNum = (s) => String(s || '').toLowerCase().replace(/^0+(?=\d)/, '');
// même numéro de carte ? (« 128 », « 128/167 », « TWM 128 » → 128)
const dkNumEq = (a, b) => { if (dkNum(a) === dkNum(b)) return true; const d = (x) => (String(x || '').match(/\d+/) || [''])[0].replace(/^0+(?=\d)/, ''); return !!d(a) && d(a) === d(b); };

// ---- lecture des sites de decks ----
function jsonObjectAt(s, i) {
  let d = 0, q = false;
  for (let j = i; j < s.length; j++) {
    const ch = s[j];
    if (q) { if (ch === '\\') j++; else if (ch === '"') q = false; continue; }
    if (ch === '"') q = true; else if (ch === '{') d++; else if (ch === '}') { d--; if (!d) return s.slice(i, j + 1); }
  }
  return '';
}
// Piltover Archive (Next.js) : la liste est dans les données « self.__next_f.push » de la page
function parsePiltover(html, withSide) {
  const flight = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => { try { return JSON.parse('"' + m[1] + '"'); } catch { return ''; } }).join('');
  const k = flight.indexOf('"maindeck":[');
  if (k < 0) return null;
  let d = 0, start = -1;
  for (let j = k; j >= 0; j--) { const ch = flight[j]; if (ch === '}') d++; else if (ch === '{') { if (!d) { start = j; break; } d--; } }
  let deck;
  try { deck = JSON.parse(jsonObjectAt(flight, start)); } catch { return null; }
  const cards = [];
  const push = (qty, card, variant, section) => {
    if (!card || !qty) return;
    const vn = (variant && variant.variantNumber) || '';
    const m = vn.match(/^([A-Z0-9]+)-(\w+\*?)$/i);
    cards.push({ qty: +qty, name: card.name, set: m ? m[1].toUpperCase() : '', num: m ? m[2] : '', section });
  };
  if (deck.legend) push(1, deck.legend.card, deck.legend, 'legend');
  for (const sec of ['champions', 'battlefields', 'runes', 'maindeck'].concat(withSide ? ['sideboard'] : [])) {
    for (const e of deck[sec] || []) {
      const v = (e.card && e.card.cardVariants || []).find((x) => x.id === e.variantId) || (e.card && e.card.cardVariants || [])[0];
      push(e.quantity, e.card, v, sec);
    }
  }
  return { name: deck.name || '', cards };
}
// Riftdecks : une ligne <tr class="card-list-item" data-quantity data-image-src="/img/cards/riftbound/RAD/rad-141-167_full.png">
function parseRiftdecks(html, withSide) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const cards = [];
  for (const tr of doc.querySelectorAll('tr.card-list-item')) {
    const section = tr.dataset.cardType || '';
    if (section === 'sideboard' && !withSide) continue;
    const name = tr.querySelector('a')?.textContent.trim();
    const m = (tr.dataset.imageSrc || '').match(/\/([A-Z0-9]+)\/[a-z0-9]+-(\w+?)-\d+_/i);
    if (name) cards.push({ qty: +tr.dataset.quantity || 1, name, set: m ? m[1].toUpperCase() : '', num: m ? m[2] : '', section });
  }
  const t = (doc.querySelector('h1')?.textContent || doc.title || '').replace(/\s*\|\s*riftDecks.*$/i, '').trim();
  return cards.length ? { name: t.replace(/\s+by\s+.*$/i, '').trim() || t, cards } : null;
}

// YGOPRODeck : une image par exemplaire, data-cardname, dans #main_deck / #extra_deck / #side_deck
function parseYgopro(html, withSide) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const cards = [];
  for (const [sel, section] of [['#main_deck', 'main'], ['#extra_deck', 'extra']].concat(withSide ? [['#side_deck', 'side']] : [])) {
    const count = new Map();
    doc.querySelectorAll(sel + ' [data-cardname]').forEach((el) => { const n = el.dataset.cardname.trim(); if (n) count.set(n, (count.get(n) || 0) + 1); });
    for (const [name, qty] of count) cards.push({ qty, name, set: '', num: '', section });
  }
  const t = (doc.querySelector('h1')?.textContent || doc.title || '').replace(/\s*-\s*YGOPRODeck.*$/i, '').trim();
  return cards.length ? { name: t, cards } : null;
}
// Limitless TCG : <div class="decklist-card" data-set="TWM" data-number="128" data-name="Dreepy"><span class="card-count">4</span>
function parseLimitless(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const cards = [];
  for (const el of doc.querySelectorAll('.decklist-card')) {
    const name = (el.dataset.name || el.querySelector('.card-name')?.textContent || '').trim();
    const qty = parseInt(el.querySelector('.card-count')?.textContent, 10) || 1;
    if (name) cards.push({ qty, name, set: (el.dataset.set || '').toUpperCase(), num: el.dataset.number || '', section: el.dataset.type || '' });
  }
  const t = (doc.title || '').replace(/\s*[–-]\s*Limitless\s*$/i, '').trim();
  return cards.length ? { name: t, cards } : null;
}
// MTGGoldfish : liste texte dans <input id="deck_input_deck"> (« 4 Llanowar Elves », puis « sideboard »)
function parseGoldfish(html, withSide) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const txt = doc.querySelector('#deck_input_deck')?.getAttribute('value') || doc.querySelector('#deck_input_deck')?.value || '';
  const cards = [];
  let section = 'main';
  for (const line of txt.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    if (/^sideboard$/i.test(l)) { section = 'side'; continue; }
    const m = l.match(/^(\d+)x?\s+(.+)$/);
    if (m && (section === 'main' || withSide)) cards.push({ qty: +m[1], name: m[2].trim(), set: '', num: '', section });
  }
  // édition de chaque carte : les liens du tableau du deck (/price/<Extension>/<Carte>), ex. Invasion ou The List
  const ed = new Map();
  for (const a of doc.querySelectorAll('a[href*="/price/"]')) {
    const m = (a.getAttribute('href') || '').match(/\/price\/([^/#?]+)\/([^/#?]+)/);
    if (!m) continue;
    const dec = (x) => { try { return decodeURIComponent(x.replace(/\+/g, ' ')); } catch { return x.replace(/\+/g, ' '); } };
    const card = dec(m[2]).replace(/\s*<[^>]*>\s*/g, ' ').trim(), setName = dec(m[1]).trim();
    if (!ed.has(dkKey(card)) && !/^(online|paper)$/i.test(setName)) ed.set(dkKey(card), setName);
  }
  for (const c of cards) { const sn = ed.get(dkKey(c.name)); if (sn) c.setName = sn; }
  const t = (doc.querySelector('h1')?.textContent || doc.title || '').split('\n').map((x) => x.trim()).filter(Boolean)[0] || '';
  return cards.length ? { name: t.replace(/\s+Deck(\s+for.*)?$/i, ''), cards } : null;
}
// page protégée (« Un instant… » de Cloudflare) ?
const dkChallenge = (html) => /<title>\s*(Just a moment|Un instant|Attention Required|Einen Moment|Un momento)/i.test(html || '');
// lit un deck : d'abord une simple requête ; si le site est protégé, on ouvre la page dans un onglet en arrière-plan
// (il s'affiche devant toi seulement si une vérification est à faire), puis on la lit une fois chargée
async function dkReadDeck(href, site, withSide) {
  try {
    const r = await fetch(href, { credentials: 'include' });
    const html = await r.text();
    if (r.ok && !dkChallenge(html)) { const d = site.parse(html, withSide); if (d && d.cards.length) return d; }
  } catch { /* on essaie avec un onglet */ }
  let tab = null, shown = false;
  try {
    tab = await chrome.tabs.create({ url: href, active: false });
    for (const t0 = Date.now(); Date.now() - t0 < 90000 && job.active;) {
      await sleep(1500);
      let html = '';
      try {
        const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => { document.querySelectorAll('input').forEach((i) => { if (i.value) i.setAttribute('value', i.value); }); return document.documentElement.outerHTML; } });
        html = res?.result || '';
      } catch { /* page pas encore prête */ }
      if (html && !dkChallenge(html)) { const d = site.parse(html, withSide); if (d && d.cards.length) return d; }
      if (!shown && Date.now() - t0 > 8000) { shown = true; chrome.tabs.update(tab.id, { active: true }).catch(() => {}); }
    }
    return null;
  } catch { return null; } finally {
    if (tab) chrome.tabs.remove(tab.id).catch(() => {});
    if (shown) backToApp();
  }
}

// ---- recherche Cardmarket (mode liste) ----
function parseCmSearch(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  for (const row of doc.querySelectorAll('[id^="productRow"]')) {
    const a = row.querySelector('a[href*="/Products/Singles/"]');
    if (!a) continue; // tapis, protège-cartes…
    const exp = row.querySelector('.expansion-symbol');
    const tip = row.querySelector('.thumbnail-icon')?.getAttribute('data-bs-title') || '';
    const img = (tip.match(/src="([^"]+)"/) || [])[1] || '';
    const price = dkPrice((row.querySelector('.col-price')?.textContent || '').trim());
    // Pokémon : l'édition est dans le nom (« Dreepy (TWM 128) ») et pas dans le symbole
    let name = a.textContent.trim(), en = (row.querySelector('.fst-italic')?.textContent || a.textContent).trim(), set = (exp?.textContent || '').trim().toUpperCase();
    const pm = name.match(/\s*\(([A-Za-z0-9-]+)\s+([A-Za-z0-9]+)\)\s*$/);
    if (pm && !set) { set = pm[1].toUpperCase(); name = name.slice(0, pm.index).trim(); en = en.replace(/\s*\([A-Za-z0-9-]+\s+[A-Za-z0-9]+\)\s*$/, '').trim(); }
    out.push({
      id: row.id.replace('productRow', ''),
      url: a.getAttribute('href').split('?')[0],
      name,
      en,
      set,
      expName: exp?.getAttribute('data-bs-original-title') || exp?.getAttribute('data-bs-title') || exp?.getAttribute('title') || exp?.getAttribute('aria-label') || '',
      num: (row.querySelector('.col-md-2 span:last-child')?.textContent || '').trim(),
      avail: parseInt((row.querySelector('.col-availability')?.textContent || '').replace(/\D/g, ''), 10) || 0,
      price: isFinite(price) ? price : Infinity,
      img: /^https?:/.test(img) ? img : '',
    });
  }
  return out;
}
// un seul résultat : Cardmarket ouvre directement la fiche de la carte
function parseCmProduct(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const id = doc.querySelector('input[name="idProduct"]')?.value;
  const url = (doc.querySelector('meta[property="og:url"]')?.getAttribute('content') || doc.querySelector('link[rel=canonical]')?.getAttribute('href') || '').replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  if (!id || !/\/Products\/Singles\//.test(url)) return null;
  const info = CMParse.productInfo(doc, url) || {};
  const dd = [...doc.querySelectorAll('dl dd')].map((x) => x.textContent.trim());
  const priceTxt = dd[4] && /€/.test(dd[4]) ? dd[4] : dd.find((x) => /€/.test(x)) || '';
  const parts = (info.sub || '').split(' - ');
  return {
    id: String(id), url, name: info.name || '', en: parts.length > 1 ? parts.slice(1).join(' - ') : info.name || '',
    set: ((doc.title.match(/\(([A-Z0-9]+)\)/) || [])[1] || '').toUpperCase(), expName: dd[2] || parts[0] || '',
    num: /^\w{0,4}\d{1,3}[a-z*]?$/i.test(dd[1] || '') ? dd[1] : '', avail: parseInt((dd[3] || '').replace(/\D/g, ''), 10) || 0,
    price: dkPrice(priceTxt), img: info.img || '',
  };
}
function dkPrice(s) { const v = parseEuro(s); return isNaN(v) ? Infinity : v; }

// ---- fenêtre ----
function deckModal() {
  let back = $('deckModal');
  if (!back) {
    back = document.createElement('div');
    back.id = 'deckModal'; back.className = 'wn-back';
    back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-dkclose]')) { if (!job.active || job.kind !== 'deck') back.hidden = true; } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !back.hidden && job.kind !== 'deck') back.hidden = true; });
    back.addEventListener('click', onDeckClick);
    back.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'dkmode') deckState.mode = t.value;
      if (t.id === 'dkSide') deckState.side = t.checked;
      if (t.dataset.dkqty != null) { const x = deckResults[deckTab]?.rows[+t.dataset.dkqty]; if (x) { x.card.qty = Math.max(1, Math.min(99, Math.round(+t.value) || 1)); dkRerender(); } }
    });
    back.addEventListener('input', (e) => { if (e.target.id === 'dkUrl') deckState.url = e.target.value; });
    document.body.appendChild(back);
  }
  return back;
}
const discordHint = () => `<p class="dk-hint">${esc(T('D\'autres sites à proposer ? Passe sur le Discord et mets un message dans le salon suggestions.'))} <a href="${DISCORD_URL}" target="_blank" rel="noopener">Discord ↗</a></p>`;

function showDeckImport() {
  const back = deckModal();
  const games = Object.keys(DECK_SITES);
  if (!games.includes(deckState.game)) deckState.game = games[0];
  const sites = DECK_SITES[deckState.game];
  back.innerHTML = `<div class="wn panel dk" role="dialog" aria-modal="true" aria-labelledby="dkTitle">
    <button class="wn-x" data-dkclose title="${esc(T('Fermer'))}">✕</button>
    <h2 id="dkTitle">📥 ${esc(T('Importer un deck'))}</h2>
    <div class="dk-step"><b>1.</b> ${esc(T('Jeu'))}</div>
    <div class="chips">${games.map((g) => `<span class="chip big ${g === deckState.game ? 'on' : ''}" data-dkgame="${esc(g)}">${esc(GAME_LABEL[g] || g)}</span>`).join('')}</div>
    <p class="dk-hint">${esc(T('Seuls les jeux qui ont un site de decks compatible sont affichés.'))}</p>
    <div class="dk-step"><b>2.</b> ${esc(TF('Colle le lien du deck (jusqu\'à {n}, un par ligne)', { n: MAX_DECKS }))}</div>
    <div class="dk-sites">${sites.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.ex)}">${esc(s.name)} ↗</a>`).join('')}</div>
    <textarea id="dkUrl" rows="3" spellcheck="false" placeholder="${esc(sites.map((x) => x.ex).join('\n'))}">${esc(deckState.url)}</textarea>
    ${discordHint()}
    <div class="dk-step"><b>3.</b> ${esc(T('Quelles cartes ?'))}</div>
    ${gameExact(deckState.game) ? `<label class="dk-opt"><input type="radio" name="dkmode" value="same" ${deckState.mode === 'same' ? 'checked' : ''}> <span><b>${esc(T('Deck identique'))}</b><i>${esc(T('Exactement les mêmes versions (édition, numéro, illustration).'))}</i></span></label>` : ''}
    <label class="dk-opt"><input type="radio" name="dkmode" value="cheap" ${deckState.mode === 'cheap' || !gameExact(deckState.game) ? 'checked' : ''}> <span><b>${esc(T('Le moins cher possible'))}</b><i>${esc(T('Pour chaque carte, la version la moins chère qui a le même nom (même effet, autre édition ou illustration).'))}</i></span></label>
    ${gameExact(deckState.game) ? '' : `<p class="dk-hint">${esc(TF('{s} ne donne pas l\'édition des cartes : l\'extension prend la version la moins chère de chaque carte.', { s: sites.map((x) => x.name).join(', ') }))}</p>`}
    <label class="dk-opt sw"><input type="checkbox" id="dkSide" ${deckState.side ? 'checked' : ''}> <span>${esc(T('Inclure le sideboard'))}</span></label>
    <div class="wn-foot"><span class="dk-err" id="dkErr"></span><button class="btn primary" data-dkgo>${esc(T('Importer'))}</button></div>
  </div>`;
  back.hidden = false;
  setTimeout(() => $('dkUrl')?.focus(), 30);
}

async function onDeckClick(e) {
  const g = e.target.closest('[data-dkgame]');
  if (g) { deckState.game = g.dataset.dkgame; return showDeckImport(); }
  if (e.target.closest('[data-dkgo]')) return startDeckImport();
  if (e.target.closest('[data-dkback]')) return showDeckImport();
  if (e.target.closest('[data-dkadd]')) return addDeckToList();
  if (e.target.closest('[data-dkstop]')) { if (job.kind === 'deck') job.active = false; }
  const kp = e.target.closest('[data-dkkeep]');
  if (kp) {
    const x = deckResults[deckTab]?.rows[+kp.dataset.dkkeep];
    if (x) { x.keep = kp.checked; dkRerender(); }
    return;
  }
  const dl = e.target.closest('[data-dkdel]');
  if (dl) { const r = deckResults[deckTab]; if (r) { r.rows.splice(+dl.dataset.dkdel, 1); dkRerender(); } return; }
  const tb = e.target.closest('[data-dktab]');
  if (tb) { deckTab = +tb.dataset.dktab; showDeckResult(); }
}

function deckErr(msg) { const el = $('dkErr'); if (el) el.textContent = msg; else banner(msg); }

const MAX_DECKS = 5;
async function startDeckImport() {
  if (job.active) return deckErr(T('Un scan ou un ajout est déjà en cours, attends la fin.'));
  const raw = ($('dkUrl')?.value ?? deckState.url ?? '');
  const lines = [...new Set(raw.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean))];
  if (!lines.length) return deckErr(T('Colle le lien complet du deck (il commence par https://).'));
  if (lines.length > MAX_DECKS) return deckErr(TF('{n} liens maximum à la fois.', { n: MAX_DECKS }));
  const decks = [];
  for (const l of lines) {
    let u;
    try { u = new URL(l); } catch { return deckErr(T('Colle le lien complet du deck (il commence par https://).') + ' (' + l.slice(0, 60) + ')'); }
    const site = (DECK_SITES[deckState.game] || []).find((s) => u.hostname === s.host || u.hostname.endsWith('.' + s.host));
    if (!site) return deckErr(T('Ce site n\'est pas encore compatible.') + ' (' + u.hostname + ')');
    decks.push({ u, site });
  }
  deckState.url = lines.join('\n');
  if (decks.some((d) => d.site.exact === false)) deckState.mode = 'cheap'; // pas d'édition sur ce site : forcément la moins chère
  logAction(`Import de deck lancé : ${lines.length} lien(s) (${deckState.mode === 'cheap' ? 'le moins cher' : 'identique'}) : ${lines.join(' ')}`);
  // autorisation de lire les sites (demandée tout de suite, pendant le clic)
  let ok = true;
  try { ok = await chrome.permissions.request({ origins: [...new Set(decks.map((d) => d.site.origin || `https://${d.site.host}/*`))] }); } catch { ok = true; }
  if (!ok) return deckErr(TF('Il faut autoriser l\'extension à lire {s} pour importer le deck.', { s: [...new Set(decks.map((d) => d.site.name))].join(', ') }));
  const back = deckModal();
  const progress = (txt, done, total) => {
    back.innerHTML = `<div class="wn panel dk"><h2>📥 ${esc(T('Importer un deck'))}</h2>
      <p>${esc(txt)}</p>${total ? `<div class="bar"><i style="width:${Math.round(100 * done / total)}%"></i></div><p class="dk-hint">${done} / ${total}</p>` : ''}
      <div class="wn-foot"><span></span><button class="btn ghost" data-dkstop>${esc(T('Arrêter'))}</button></div></div>`;
  };
  // 1) tous les decks en même temps
  progress(TF('Lecture de {n} deck(s)…', { n: decks.length }));
  job.active = true; job.kind = 'deck'; // pour pouvoir arrêter pendant la lecture
  await Promise.all(decks.map(async (d) => { d.deck = await dkReadDeck(d.u.href, d.site, deckState.side); }));
  job.active = false; job.kind = '';
  const bad = decks.filter((d) => !d.deck || !d.deck.cards.length);
  if (bad.length === decks.length) { logAction('Import de deck : aucun deck lisible : ' + decks.map((d) => d.u.href).join(' '), 'erreur'); showDeckImport(); return deckErr(TF('Impossible de lire ce deck sur {s}. Vérifie le lien (il doit être public).', { s: bad[0].site.name })); }
  const good = decks.filter((d) => d.deck && d.deck.cards.length);
  // on regroupe les mêmes versions dans chaque deck (une carte peut être dans 2 sections)
  for (const d of good) {
    const byKey = new Map();
    for (const c of d.deck.cards) {
      const key = c.set + '|' + dkNum(c.num) + '|' + dkNorm(c.name);
      const prev = byKey.get(key);
      if (prev) prev.qty += c.qty; else byKey.set(key, { ...c });
    }
    d.cards = [...byKey.values()];
  }
  // 2) une recherche Cardmarket par nom de carte (une seule fois même si plusieurs decks l'ont), 3 à la fois
  const labels = new Map();
  for (const d of good) for (const c of d.cards) if (!labels.has(dkNorm(c.name))) labels.set(dkNorm(c.name), c.name);
  const names = [...labels.keys()];
  const cmLang = ['fr', 'en', 'de', 'es', 'it'].includes(I18N.getLang()) ? I18N.getLang() : 'en';
  const gamePath = deckState.game;

  Object.assign(job, { active: true, queue: [], running: new Map(), done: 0, total: names.length, failed: [], pausedUntil: 0, strikes: 0,
    challenge: null, loggedOut: false, t0: Date.now(), durations: [], nextReq: 0, gap: baseGap() * 2, workerTab: null, workerOpened: 0, // recherches : 2 fois plus espacées (Cardmarket les bloque plus vite, erreur 1015)
    lastErr: '', challenges: 0, probe: false, probeBusy: false, stopReason: '', pauseReason: '', kind: 'deck', cont: [], hit1015: false });
  const pauseTick = setInterval(() => { // pause (erreur 1015) ou captcha : on le dit dans la fenêtre d'import
    const w = job.pausedUntil - Date.now();
    if (w > 0) progress('⏸ ' + TF('Cardmarket freine (erreur 1015) : pause de {t}, l\'import repart tout seul plus doucement…', { t: fmtDur(Math.ceil(w / 1000)) }), job.done, names.length);
    else if (job.challenge) progress(T('🛡️ Captcha à valider dans l\'onglet ouvert…'), job.done, names.length);
  }, 1000);
  job.appTab = await chrome.tabs.getCurrent().catch(() => null);
  const found = {}; // nom normalisé -> lignes Cardmarket
  let error = '';
  const parse = (t) => { let c = parseCmSearch(t || ''); if (!c.length) { const one = parseCmProduct(t || ''); if (one) c = [one]; } return c; };
  const search = async (q) => request(`${ORIGIN}/${cmLang}/${gamePath}/Products/Search?searchString=${encodeURIComponent(q)}&mode=list`);
  const queue = [...names];
  const worker = async () => {
    while (queue.length && job.active && !error) {
      const n = queue.shift(), label = labels.get(n);
      progress(TF('Recherche de {c} sur Cardmarket…', { c: label }), job.done, names.length);
      const res = await search(label);
      if (res.login) throw new Error(T('tu n\'es pas connecté à Cardmarket'));
      let cands = parse(res.text);
      // nom un peu différent sur le site du deck (ex. « Jarvaniv » au lieu de « Jarvan IV ») : on cherche aussi un bout du nom
      for (const part of label.includes(',') ? [label.split(',').slice(1).join(',').trim(), label.split(',')[0].trim()] : []) {
        if (cands.some((x) => dkKey(x.en) === dkKey(label) || dkKey(x.name) === dkKey(label))) break;
        if (part.length < 4) continue;
        cands = cands.concat(parse((await search(part)).text));
      }
      found[n] = cands;
      job.done++;
      progress(TF('Recherche de {c} sur Cardmarket…', { c: label }), job.done, names.length);
    }
  };
  try {
    await Promise.all([worker(), worker(), worker()].map((p) => p.catch((err) => { if (!error) error = err.message === 'stop' ? (job.stopReason || T('import arrêté')) : err.message; })));
    clearInterval(pauseTick);
    if (!error && !job.active) error = T('import arrêté');
  } catch (err) { error = err.message; }
  clearInterval(pauseTick);
  job.active = false; job.kind = ''; job.running.clear();
  if (job.workerTab != null) { chrome.tabs.remove(job.workerTab).catch(() => {}); job.workerTab = null; }
  backToApp();
  if (error) { logAction('Import de deck impossible : ' + error, 'erreur'); showDeckImport(); return deckErr(error); }

  // 3) choix des versions, deck par deck
  deckResults = good.map((d) => {
    const rows = [], missing = [];
    for (const c of d.cards) {
      const all = found[dkNorm(c.name)] || [];
      // même nom (sans tenir compte des espaces), sinon même édition + même numéro (le numéro vient du site du deck)
      let cands = all.filter((x) => dkKey(x.en) === dkKey(c.name) || dkKey(x.name) === dkKey(c.name));
      const same = c.set && c.num ? all.find((x) => x.set === c.set && dkNumEq(x.num, c.num)) : null;
      if (!cands.length && same) cands = all.filter((x) => dkKey(x.en) === dkKey(same.en));
      { const seen = new Set(); cands = cands.filter((x) => !seen.has(x.id) && seen.add(x.id)); }
      // Magic (MTGGoldfish) : l'édition est donnée par son nom ; sur Cardmarket elle est dans le lien (/Magic/Products/Singles/<Extension>/…)
      const slugOf = (x) => dkKey(((x.url || '').split('/')[5] || '').replace(/-/g, ' '));
      const exact = c.set ? cands.filter((x) => x.set === c.set && dkNumEq(x.num, c.num)).sort((a, b) => a.price - b.price)[0] || null
        : c.setName ? cands.filter((x) => slugOf(x) === dkKey(c.setName) || dkKey(x.expName) === dkKey(c.setName)).sort((a, b) => a.price - b.price)[0] || null : null;
      let pick = exact, approx = false;
      if (deckState.mode === 'cheap') {
        const cheap = cands.filter((x) => x.avail > 0 && isFinite(x.price)).sort((a, b) => a.price - b.price)[0];
        if (cheap && (!exact || !isFinite(exact.price) || cheap.price < exact.price - 0.001)) pick = cheap;
      }
      // deck identique mais version exacte introuvable sur Cardmarket : la moins chère du même nom (signalée)
      if (!pick && cands.length) { pick = cands.filter((x) => isFinite(x.price)).sort((a, b) => a.price - b.price)[0] || cands[0]; approx = true; }
      if (!pick) { missing.push(c); continue; }
      rows.push({ card: c, before: exact, after: pick, approx });
    }
    return { name: (d.deck.name || T('Deck importé')).slice(0, 40), game: gamePath, mode: deckState.mode, rows, missing };
  });
  deckUnread = bad.map((d) => d.u.href);
  logAction('Import de deck : ' + deckResults.map((r) => `« ${r.name} » ${r.rows.length} carte(s) trouvée(s)` + (r.missing.length ? `, introuvables : ${r.missing.map((c) => c.name + (c.set ? ` (${c.set} ${c.num})` : '')).join(', ')}` : '')).join(' · ') + (deckUnread.length ? ' · illisibles : ' + deckUnread.join(' ') : ''), deckUnread.length || deckResults.some((r) => r.missing.length) ? 'erreur' : 'info');
  deckTab = 0;
  showDeckResult();
}
let deckResults = [], deckTab = 0, deckUnread = [];
// version retenue : la moins chère, sauf si l'utilisateur garde la version d'origine pour cette carte
const dkUse = (x) => (x.keep && x.before ? x.before : x.after);
function dkRerender() { const sc = document.querySelector('#deckModal .dk-table')?.scrollTop || 0; showDeckResult(); const t = document.querySelector('#deckModal .dk-table'); if (t) t.scrollTop = sc; }

function showDeckResult() {
  const r = deckResults[deckTab], back = deckModal();
  if (!r) return;
  const cheap = r.mode === 'cheap';
  const sum = (get) => r.rows.reduce((a, x) => { const p = get(x); return a + (p && isFinite(p.price) ? p.price * x.card.qty : 0); }, 0);
  const nCards = r.rows.reduce((a, x) => a + x.card.qty, 0);
  const img = (p) => p && p.img ? `<img class="zoomable" src="${esc(p.img)}" alt="${esc(p.name || '')}" title="${esc(T('Cliquer pour agrandir'))}" loading="lazy">` : '<span class="noimg">?</span>';
  const pr = (p) => p && isFinite(p.price) ? euro(p.price) : '—';
  const line = (x, i) => {
    const alt = cheap && x.before && x.before !== x.after; // une version moins chère existe
    const use = dkUse(x), changed = alt && !x.keep;
    const save = changed && isFinite(x.before.price) ? (x.before.price - x.after.price) * x.card.qty : 0;
    const keep = alt ? `<label class="dk-keep" title="${esc(T('Garder la version d\'origine du deck pour cette carte'))}"><input type="checkbox" data-dkkeep="${i}" ${x.keep ? 'checked' : ''}> ${esc(T('Garder l\'original'))}</label>` : '';
    return `<tr class="${changed ? 'chg' : ''}${alt && x.keep ? ' kept' : ''}"><td class="q"><input type="number" class="dk-qty" min="1" max="99" value="${x.card.qty}" data-dkqty="${i}" title="${esc(T('Nombre d\'exemplaires'))}"></td>
      ${cheap ? `<td class="im">${img(changed ? x.before : use)}</td><td class="ar">${changed ? '→' : ''}</td><td class="im">${changed ? img(x.after) : ''}</td>` : `<td class="im">${img(use)}</td>`}
      <td class="nm"><b>${esc(use.name)}</b><i>${esc([use.set || use.expName, use.num && '#' + use.num].filter(Boolean).join(' '))}${changed ? ` · ${esc(T('au lieu de'))} ${esc(x.before.set || x.before.expName)}${x.before.num ? ' #' + esc(x.before.num) : ''}` : ''}${x.approx && !cheap && (x.card.set || x.card.setName) ? ` · <span class="dk-approx" title="${esc(T('Cette édition n\'a pas été trouvée sur Cardmarket : version la moins chère du même nom'))}">${esc(TF('{s} introuvable : la moins chère', { s: [x.card.set || x.card.setName, x.card.num].filter(Boolean).join(' ') }))}</span>` : ''}</i></td>
      ${cheap ? `<td class="kp">${keep}</td>` : ''}<td class="pr">${changed ? `<s>${pr(x.before)}</s> ` : ''}${pr(use)}${save > 0.004 ? `<em>−${euro(save)}</em>` : ''}</td><td class="dl"><button class="dk-del" data-dkdel="${i}" title="${esc(T('Retirer cette carte'))}">✕</button></td></tr>`;
  };
  const before = sum((x) => x.before), after = sum(dkUse);
  const tabs = deckResults.length > 1 ? `<div class="chips dk-tabs">${deckResults.map((d, i) => `<span class="chip ${i === deckTab ? 'on' : ''}" data-dktab="${i}">${esc(d.name)}${d.missing.length ? ' ⚠' : ''}</span>`).join('')}</div>` : '';
  back.innerHTML = `<div class="wn panel dk wide" role="dialog" aria-modal="true">
    <button class="wn-x" data-dkclose title="${esc(T('Fermer'))}">✕</button>
    <h2>📥 ${esc(r.name)}</h2>
    ${tabs}
    ${deckUnread.length ? `<div class="dk-miss"><b>${esc(T('Deck(s) illisible(s) (le lien doit être public) :'))}</b> ${esc(deckUnread.join(', '))}</div>` : ''}
    <p class="dk-hint">${esc(TF('{n} cartes trouvées sur Cardmarket', { n: nCards }))} · ${esc(cheap ? T('Le moins cher possible') : T('Deck identique'))} · ${esc(T('prix « à partir de » sur Cardmarket, tous états et langues'))}</p>
    ${cheap && r.rows.some((x) => x.before) ? `<div class="dk-sum"><span>${esc(T('Avant'))} <b>${euro(before)}</b></span><span>→</span><span>${esc(T('Après'))} <b>${euro(after)}</b></span><span class="ok">${esc(T('Économie'))} <b>${euro(Math.max(0, before - after))}</b></span></div>` : ''}
    ${r.missing.length ? `<div class="dk-miss"><b>${esc(TF('{n} carte(s) introuvable(s) sur Cardmarket :', { n: r.missing.length }))}</b> ${esc(r.missing.map((c) => `${c.qty}× ${c.name}${c.set ? ` (${c.set} ${c.num})` : ''}`).join(', '))}
      <br>${esc(T('Signale-le sur le Discord pour qu\'on corrige ça.'))} <a href="${DISCORD_URL}" target="_blank" rel="noopener">Discord ↗</a></div>` : ''}
    <div class="dk-table">${r.rows.length ? `<table>${r.rows.map(line).join('')}</table>` : `<p class="dk-empty">${esc(T('Aucune carte dans ce deck.'))}</p>`}</div>
    ${cheap && r.rows.some((x) => x.before && x.before !== x.after) ? `<p class="dk-hint">${esc(T('Coche « Garder l\'original » sur une carte pour garder sa version du deck au lieu de la moins chère.'))}</p>` : ''}
    <div class="wn-foot"><button class="btn ghost" data-dkback>← ${esc(T('Retour'))}</button>
      <button class="btn primary" data-dkadd ${deckResults.some((d) => d.rows.length) ? '' : 'disabled'}>${esc(deckResults.length > 1 ? TF('Ajouter les {n} decks à ma liste (une catégorie par deck)', { n: deckResults.length }) : TF('Ajouter à ma liste (catégorie « {c} »)', { c: r.name }))}</button></div>
  </div>`;
  back.hidden = false;
}

function addDeckToList() {
  let added = 0, merged = 0;
  const names = [];
  for (const r of deckResults) {
    if (!r.rows.length) continue;
    let cat = r.name.trim() || T('Deck importé');
    if (!cats.includes(cat)) { cats.push(cat); saveCats(); }
    names.push(cat);
    const qtyBy = new Map();
    for (const x of r.rows) { const p = dkUse(x); qtyBy.set(p.id, { p, qty: (qtyBy.get(p.id)?.qty || 0) + x.card.qty }); }
    for (const { p, qty } of qtyBy.values()) {
      const old = list[p.id];
      if (old) { old.qty = (+old.qty || 0) + qty; old.checked = true; if (!old.cat) old.cat = cat; merged++; continue; }
      list[p.id] = { id: p.id, name: p.name, sub: [p.expName, p.en !== p.name ? p.en : ''].filter(Boolean).join(' - '), game: r.game, url: p.url,
        img: p.img, qty, checked: true, added: Date.now(), cat };
      added++;
    }
  }
  if (!names.length) return;
  saveList();
  viewCat = names.length === 1 ? names[0] : ''; saveCats();
  $('deckModal').hidden = true;
  renderAll();
  banner(TF('Deck « {d} » ajouté : {a} nouvelle(s) carte(s){m}. Tu peux lancer le scan.', { d: names.join(' », « '), a: added, m: merged ? TF(', {n} déjà dans ta liste (quantité ajoutée)', { n: merged }) : '' }));
}

document.getElementById('deckImport')?.addEventListener('click', showDeckImport);
