// ---------- Tuto interactif (au 1er lancement, et via « Revoir le tuto » dans les Réglages) ----------
// Tout devient sombre sauf l'élément montré. Aux étapes « Clique ici », on clique vraiment dessus
// et le tuto passe tout seul à la suite quand l'action est faite (carte ajoutée, deck importé, scan fini…).
// chargé après app.js et deck.js : utilise leurs variables (list, job, settings, cmCompare, deckState…)
'use strict';

const TUTO_CARD = 'https://www.cardmarket.com/{l}/Riftbound/Products/Singles/Unleashed/Vex-Apathetic-V2-Showcase?language=6';
const TUTO_DECK = 'https://riftdecks.com/riftbound-metagame/deck-kai-sa-daughter-of-the-void-363140';
const tutoCardUrl = () => TUTO_CARD.replace('{l}', ['fr', 'en', 'de', 'es', 'it'].includes(I18N.getLang()) ? I18N.getLang() : 'en');
const tutoVis = (q) => { const el = document.querySelector(q); return el && el.getClientRects().length && !el.closest('[hidden]') ? el : null; }; // (offsetParent ne marche pas sur les éléments « fixed »)
let tutoMark = {};
const tutoQty = () => Object.values(list).reduce((a, it) => a + (+it.qty || 1), 0); // nb total d'exemplaires (monte aussi si la carte y était déjà)
const tutoHasCard = () => Object.values(list).some((it) => /Vex-Apathetic-V2-Showcase/i.test(it.url || '')); // valeurs notées en entrant dans une étape (nb de cartes, heure…)

// sel : élément montré (liste = le 1er visible ; null = bulle au centre) ; plus : zones ajoutées au trou (menu ouvert…)
// click : on peut cliquer dans le trou ; done() : passe tout seul à la suite ; skip() : étape sautée
const TUTO_STEPS = [
  { sel: null, icon: '🎯', title: 'Bienvenue sur TCG Price Hunter', enter: tutoSnap,
    text: 'Trouve le panier le moins cher pour tes cartes, port compris. On le fait ensemble, en vrai : suis les bulles.' },
  { id: 'card', need: true, sel: null, icon: '➕', title: 'Ajoute ta 1re carte', view: 'scanned', link: tutoCardUrl, linkTxt: '🔗 Ouvrir la carte sur Cardmarket',
    enter: () => { tutoMark.n = tutoQty(); tutoMark.had = tutoHasCard(); },
    done: () => tutoQty() > tutoMark.n || tutoMark.had || (tutoHasCard() && !tutoMark.had),
    text: 'Clique sur le lien, puis sur « ➕ Ajouter » sous le titre de la carte. Reviens ici : la suite se lance toute seule.' },
  { id: 'deck', need: true, sel: '#deckImport', view: 'scanned', click: true, title: 'Bravo ! Maintenant un deck entier', copy: TUTO_DECK,
    enter: () => { if (typeof deckState !== 'undefined') { deckState.url = TUTO_DECK; deckState.game = 'Riftbound'; } tutoMark.deckN = tutoQty(); },
    done: () => !!tutoVis('#deckModal #dkUrl'),
    text: 'Clique sur « Importer un deck ». Le lien de ce deck est déjà collé dedans.' },
  { id: 'deckGo', need: true, sel: '#deckModal .wn', click: true, title: 'Lance l\'import',
    route: () => (!tutoVis('#deckModal') ? 'deck' : null), // fenêtre fermée sans importer : on y retourne
    done: () => !tutoVis('#deckModal #dkUrl'),
    text: 'Choisis « Le moins cher possible », puis clique « Importer » en bas.' },
  { id: 'deckAdd', need: true, sel: '#deckModal .wn', click: true, title: 'Ajoute le deck à ta liste',
    done: () => tutoQty() > tutoMark.deckN,
    route: () => (tutoQty() > tutoMark.deckN ? null : tutoVis('#deckModal #dkUrl') ? 'deckGo' : !tutoVis('#deckModal') ? 'deck' : null), // erreur ou fermé sans ajouter
    text: 'Avant → après = ce que tu économises avec des versions moins chères. Quand c\'est prêt, clique « Ajouter à ma liste ».' },
  { sel: '#scanEstimate', plus: ['#scanEstimate .sm-menu'], view: 'scanned', click: true, title: 'Choisis ⚡ Rapide pour le test',
    done: () => settings.scanMode === 'fast' && !$('scanEstimate')?.classList.contains('open'),
    text: 'Clique ici puis « ⚡ Rapide ». Pour un vrai achat, prends 🔍 Long : tu peux économiser bien plus.' },
  { id: 'scan', sel: '#scanSel', view: 'scanned', click: true, title: 'Lance le scan',
    done: () => job.active,
    text: 'Clique ici. Si Cardmarket demande une vérification anti-robot, coche la case dans son onglet.' },
  { id: 'scanning', sel: '#scanbox', title: 'Scan en cours…', wait: true,
    skip: () => !job.active,
    done: () => !job.active,
    text: 'Patiente quelques secondes, je continue dès que c\'est fini.' },
  { id: 'login', need: true, sel: '#scanSel', view: 'scanned', click: true, title: 'Tu n\'es pas connecté à Cardmarket', link: () => tutoCardUrl().replace(/\/Products.*$/, ''), linkTxt: '🔗 Ouvrir Cardmarket',
    skip: () => !job.loggedOut,
    done: () => job.active, next: 'scanning',
    text: 'Connecte-toi sur Cardmarket (en haut à droite), puis reviens et clique ici pour relancer le scan.' },
  { id: 'best', sel: '[data-view="best"]', click: true, title: 'Ouvre le meilleur panier',
    route: () => (job.loggedOut && !job.active ? 'login' : null),
    done: () => !$('v-best').hidden && !!tutoVis('#best .tile.cmp'),
    text: 'Clique ici : l\'extension combine les vendeurs pour payer le moins possible.' },
  { sel: '#best .tile.cmp', view: 'best', click: true, title: 'Compare avec Cardmarket',
    enter: () => { tutoMark.t = Date.now(); tutoMark.cmpClick = 0; },
    done: () => !job.active && (!!(cmCompare && cmCompare.date >= tutoMark.t) || (tutoMark.cmpClick && Date.now() - tutoMark.cmpClick > 2500)),
    text: 'Ça lance le Shopping Wizard (le comparateur de Cardmarket) sur les mêmes cartes. Cardmarket l\'autorise 10 fois par jour par compte : le compteur montre ce qu\'il te reste. Clique pour tester.' },
  { sel: '#best .tile.cmp', view: 'best', title: 'La différence',
    skip: () => !(cmCompare && cmCompare.date >= tutoMark.t),
    text: 'Le montant = ce que tu économises par rapport au Shopping Wizard. En vert : l\'extension est moins chère. En rouge : Cardmarket a trouvé mieux (en Long, l\'extension voit beaucoup plus d\'offres).' },
  { sel: '#best [data-cart="all"]', view: 'best', cart: true, icon: '🛒', title: 'Tout ajouter à mon panier Cardmarket',
    text: 'Ce bouton met d\'un coup toutes les cartes dans ton panier Cardmarket. Tu vérifies et tu payes là-bas.' },
  { id: 'restore', sel: null, icon: '↩', title: 'Fini ! On remet ta liste',
    skip: () => !tutoMark.snap || !Object.keys(tutoMark.snap.list).length,
    restore: true, done: () => tutoMark.restored,
    text: 'Tu avais déjà des cartes avant le tuto : clique ci-dessous pour retrouver ta liste comme avant (les cartes du test partent). Tu peux revoir le tuto dans les Réglages.' },
  { id: 'clear', sel: '#clearAll', view: 'scanned', click: true, title: 'Fini ! Vide ta liste de test',
    skip: () => !!(tutoMark.snap && Object.keys(tutoMark.snap.list).length),
    done: () => !Object.keys(list).length,
    text: 'Clique sur « Tout effacer » pour repartir avec tes propres cartes. Tu peux revoir le tuto dans les Réglages. Bonne chasse aux prix !' },
];

let tutoStep = 0, tutoTimer = null;
const tutoIdx = (id) => Math.max(0, TUTO_STEPS.findIndex((x) => x.id === id));
function tutoTarget(s) {
  for (const q of [].concat(s.sel || [])) { const el = tutoVis(q); if (el) return el; }
  return null;
}
function tutoEls() {
  let root = $('tuto');
  if (!root) {
    root = document.createElement('div');
    root.id = 'tuto';
    root.innerHTML = '<div class="tt-b"></div><div class="tt-b"></div><div class="tt-b"></div><div class="tt-b"></div><div class="tt-lock"></div><div class="tt-hole"></div><div class="tt-bubble" role="dialog" aria-modal="true"></div>';
    root.addEventListener('click', async (e) => {
      const cp = e.target.closest('[data-ttcopy]');
      if (cp) { try { await navigator.clipboard.writeText(cp.dataset.ttcopy); cp.textContent = '✔ ' + T('Copié'); } catch {} return; }
      if (e.target.closest('[data-ttrestore]')) return tutoRestore();
      if (e.target.closest('[data-tt="next"]')) tutoNext();
    });
    document.addEventListener('keydown', (e) => {
      if (root.hidden || e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight' && !TUTO_STEPS[tutoStep].done) { e.preventDefault(); tutoNext(); }
    });
    // clic sur « Comparer avec Cardmarket » pendant le tuto (même si la comparaison échoue, on peut continuer après)
    document.addEventListener('click', (e) => { if (!root.hidden && e.target.closest?.('[data-cmcompare]')) tutoMark.cmpClick = Date.now(); }, true);
    window.addEventListener('resize', () => { if (!root.hidden) placeTuto(); });
    window.addEventListener('scroll', () => { if (!root.hidden) placeTuto(); }, true);
    document.body.appendChild(root);
  }
  return root;
}

function showTuto(step = 0, dir = 1) {
  const root = tutoEls();
  step = Math.max(0, Math.min(step, TUTO_STEPS.length - 1));
  while (TUTO_STEPS[step].skip?.() && step + dir >= 0 && step + dir < TUTO_STEPS.length) step += dir; // étape sans objet : on saute
  tutoStep = step;
  const s = TUTO_STEPS[step], last = step === TUTO_STEPS.length - 1;
  if (s.view && $('v-' + s.view)?.hidden) switchView(s.view);
  s.enter?.();
  const el = tutoTarget(s);
  const showCart = s.cart && !el; // pas encore de meilleur panier : on montre une copie du bouton
  const link = typeof s.link === 'function' ? s.link() : s.link;
  const bubble = root.querySelector('.tt-bubble');
  bubble.innerHTML = `
    ${s.wait ? `<div class="tt-where">⏳ ${esc(T('En cours'))}</div>` : el && s.click ? `<div class="tt-where">👆 ${esc(T('Clique ici'))}</div>` : el ? '' : `<div class="tt-ico">${s.icon || '💡'}</div>`}
    <h3>${esc(T(s.title))}</h3>
    <p>${esc(T(s.text))}</p>
    ${link ? `<a class="btn primary tt-link" href="${esc(link)}" target="_blank" rel="noopener">${esc(T(s.linkTxt))}</a><div class="tt-url">${esc(link)}</div>` : ''}
    ${s.copy ? `<div class="tt-copy"><code>${esc(s.copy)}</code><button class="btn ghost sm" data-ttcopy="${esc(s.copy)}">📋 ${esc(T('Copier'))}</button></div>` : ''}
    ${showCart ? `<div class="tt-cart"><button class="btn primary" disabled tabindex="-1" aria-disabled="true">${esc(TF('🛒 Tout ajouter à mon panier Cardmarket ({n} carte(s))', { n: 12 }))}</button></div>` : ''}
    ${s.restore ? `<button class="btn primary tt-link" data-ttrestore>${esc(T('↩ Remettre ma liste d\'avant'))}</button>` : ''}
    ${s.cart ? `<div class="tt-warn">⚠️ <b>${esc(T('Attention aux abus : Cardmarket peut bannir ton compte.'))}</b><br>${esc(T('N\'ajoute que ce que tu vas vraiment acheter. Ajouter puis retirer des cartes en boucle, ou les laisser dans le panier pour les garder, c\'est de l\'abus.'))}</div>` : ''}
    <div class="tt-foot">
      <span class="tt-count">${step + 1} / ${TUTO_STEPS.length}</span>
      ${s.done ? '' : `<button class="btn primary" data-tt="next">${esc(T('Suivant'))} →</button>`}
    </div>`;
  root.hidden = false;
  if (el) el.scrollIntoView({ block: 'center' });
  requestAnimationFrame(placeTuto);
  clearInterval(tutoTimer);
  tutoTimer = setInterval(tutoTick, 400); // suit la page (menus, fenêtre d'import) et attend l'action demandée
}

function tutoTick() {
  const root = $('tuto');
  if (!root || root.hidden) return clearInterval(tutoTimer);
  const s = TUTO_STEPS[tutoStep];
  let ok = false, to = null;
  try { to = s.route?.() || null; ok = !to && !!s.done?.(); } catch {}
  if (to) return showTuto(tutoIdx(to), -1);
  if (ok) return s.next ? showTuto(tutoIdx(s.next)) : tutoNext();
  placeTuto();
}

// place le trou autour de l'élément (+ ses menus), les 4 caches autour, et la bulle à côté
function placeTuto() {
  const root = $('tuto'); if (!root || root.hidden) return;
  const s = TUTO_STEPS[tutoStep];
  const hole = root.querySelector('.tt-hole'), bubble = root.querySelector('.tt-bubble'), lock = root.querySelector('.tt-lock');
  const vw = window.innerWidth, vh = window.innerHeight;
  const el = tutoTarget(s);
  let r = el ? el.getBoundingClientRect() : null;
  if (r && r.width) {
    let { left, top, right, bottom } = r;
    for (const q of s.plus || []) { const p = tutoVis(q); if (!p) continue; const b = p.getBoundingClientRect(); left = Math.min(left, b.left); top = Math.min(top, b.top); right = Math.max(right, b.right); bottom = Math.max(bottom, b.bottom); }
    const pad = 8;
    r = { left: left - pad, top: top - pad, right: right + pad, bottom: bottom + pad };
  } else r = null;
  const [b1, b2, b3, b4] = root.querySelectorAll('.tt-b');
  if (!r) {
    root.classList.add('centered');
    hole.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0;`;
    b1.style.cssText = 'left:0;top:0;width:100%;height:100%;'; b2.style.cssText = b3.style.cssText = b4.style.cssText = 'display:none';
    lock.style.display = 'none';
    bubble.style.left = Math.max(12, (vw - bubble.offsetWidth) / 2) + 'px';
    bubble.style.top = Math.max(12, (vh - bubble.offsetHeight) / 2) + 'px';
    return;
  }
  root.classList.remove('centered');
  const w = r.right - r.left, h = r.bottom - r.top;
  hole.style.cssText = `left:${r.left}px;top:${r.top}px;width:${w}px;height:${h}px;`;
  b1.style.cssText = `left:0;top:0;width:100%;height:${Math.max(0, r.top)}px;`;
  b2.style.cssText = `left:0;top:${r.bottom}px;width:100%;bottom:0;`;
  b3.style.cssText = `left:0;top:${r.top}px;width:${Math.max(0, r.left)}px;height:${h}px;`;
  b4.style.cssText = `left:${r.right}px;top:${r.top}px;right:0;height:${h}px;`;
  lock.style.cssText = s.click ? 'display:none' : `left:${r.left}px;top:${r.top}px;width:${w}px;height:${h}px;`; // sinon on ne peut pas cliquer dessus
  const gap = 16;
  bubble.style.width = '';
  let bw = bubble.offsetWidth, bh = bubble.offsetHeight;
  let top = r.bottom + gap, arrow = 'up';
  if (top + bh > vh - 12) { top = r.top - gap - bh; arrow = 'down'; }
  let left = r.left + w / 2 - bw / 2;
  if (top < 12) { // ni dessous ni dessus : à côté
    top = Math.min(Math.max(12, r.top), vh - bh - 12);
    arrow = 'side';
    const spaceR = vw - r.right - gap - 12, spaceL = r.left - gap - 12; // à côté : la bulle rétrécit pour ne pas cacher l'élément
    const room = Math.max(spaceR, spaceL);
    if (room < bw && room >= 280) { bubble.style.width = room + 'px'; bw = room; bh = bubble.offsetHeight; top = Math.min(Math.max(12, r.top), vh - bh - 12); }
    left = spaceR >= bw ? r.right + gap : r.left - gap - bw;
  }
  left = Math.min(Math.max(12, left), vw - bw - 12);
  bubble.style.left = left + 'px'; bubble.style.top = top + 'px';
  bubble.dataset.arrow = arrow;
  bubble.style.setProperty('--ax', Math.min(Math.max(18, r.left + w / 2 - left), bw - 18) + 'px');
}

// étape suivante (en sautant celles sans objet) ; plus rien : le tuto est fini
function tutoNext() {
  let i = tutoStep + 1;
  while (i < TUTO_STEPS.length && TUTO_STEPS[i].skip?.()) i++;
  if (i >= TUTO_STEPS.length) return closeTuto();
  showTuto(i);
}
// photo de la liste avant le tuto (gardée si la page se recharge pendant le tuto), pour la remettre à la fin
function tutoSnap() {
  chrome.storage.local.get('cmTutoSnap').then((o) => {
    if (o.cmTutoSnap) { tutoMark.snap = o.cmTutoSnap; return; }
    tutoMark.snap = { list: JSON.parse(JSON.stringify(list)), cats: [...cats], scanIds: Object.keys(scans) };
    chrome.storage.local.set({ cmTutoSnap: tutoMark.snap });
  });
}
function tutoRestore() {
  const snap = tutoMark.snap; if (!snap) return;
  const drop = Object.keys(scans).filter((id) => !snap.scanIds.includes(id)); // scans des cartes du test
  if (drop.length) chrome.storage.local.remove(drop.map((id) => 'scan_' + id));
  for (const id of drop) delete scans[id];
  list = snap.list; cats = snap.cats; viewCat = '';
  saveList(); saveCats(); renderAll();
  tutoMark.restored = true;
}

function closeTuto() {
  const root = $('tuto'); if (root) root.hidden = true;
  clearInterval(tutoTimer);
  chrome.storage.local.remove('cmTutoSnap'); tutoMark = {};
  if (!settings.tutoDone) { settings.tutoDone = true; saveSettings(); }
}
document.getElementById('tutoBtn')?.addEventListener('click', () => showTuto(0));
