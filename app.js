/*!
 * TCG Price Hunter — © 2026 Anastasiophrenelia. Tous droits réservés.
 * https://github.com/Anastasiophrenelia/TCG-Price-Hunter
 * Toute copie, modification ou redistribution sans autorisation écrite de l'auteur est interdite (voir LICENSE).
 */
// ===== TCG Price Hunter — page principale (cartes scannées, meilleur panier, réglages) =====
const ORIGIN = 'https://www.cardmarket.com';
const START_GAP = 1200;       // ms entre 2 requêtes par défaut : 50 par minute
const BETA = false;           // version de test : affiche « BETA » à côté du numéro
const CART_GAP = 1000;         // ms entre deux ajouts au panier
const MAX_PER_MIN = 280;      // jamais plus de 280 cartes (requêtes) par minute
const baseGap = () => Math.ceil(60000 / MAX_PER_MIN); // ≈ 215 ms minimum entre deux requêtes ; sinon la suivante part dès qu'une carte est finie
const SCAN_TIMEOUT = 180000;  // une carte qui met plus de 3 min = échec

const LANGS = [ // nom affiché par Cardmarket -> code court
  ['Français', 'FR'], ['Anglais', 'EN'], ['Chinois-S', 'ZH'], ['Coréen', 'KO'], ['Japonais', 'JA'], ['Allemand', 'DE'],
  ['Espagnol', 'ES'], ['Italien', 'IT'], ['Portugais', 'PT'], ['Russe', 'RU'], ['Chinois-T', 'ZH-T'],
];
const LANG_CODE = Object.fromEntries(LANGS);
const EN_TO_FR = { French: 'Français', English: 'Anglais', 'S-Chinese': 'Chinois-S', Korean: 'Coréen', Japanese: 'Japonais', German: 'Allemand', Spanish: 'Espagnol', Italian: 'Italien', Portuguese: 'Portugais', Russian: 'Russe', 'T-Chinese': 'Chinois-T' };
const CONDS = [['MT', 'Mint'], ['NM', 'Near Mint'], ['EX', 'Excellent'], ['GD', 'Good'], ['LP', 'Light Played'], ['PL', 'Played'], ['PO', 'Poor']];
const COND_RANK = Object.fromEntries(CONDS.map(([c], i) => [c, i + 1]));
const RATING_RANK = { outstanding: 5, 'very-good': 4, good: 3, average: 2, bad: 1 };

// Pays Cardmarket (id = celui de Cardmarket, utilisé dans les filtres et l'API des frais de port)
const COUNTRIES = [[12, 'France'], [7, 'Allemagne'], [1, 'Autriche'], [2, 'Belgique'], [3, 'Bulgarie'], [33, 'Canada'], [5, 'Chypre'], [35, 'Croatie'],
  [8, 'Danemark'], [10, 'Espagne'], [9, 'Estonie'], [11, 'Finlande'], [14, 'Grèce'], [15, 'Hongrie'], [16, 'Irlande'], [37, 'Islande'], [17, 'Italie'],
  [36, 'Japon'], [21, 'Lettonie'], [18, 'Liechtenstein'], [19, 'Lituanie'], [20, 'Luxembourg'], [22, 'Malte'], [24, 'Norvège'], [23, 'Pays-Bas'],
  [25, 'Pologne'], [26, 'Portugal'], [27, 'Roumanie'], [13, 'Royaume-Uni'], [6, 'Rép. Tchèque'], [29, 'Singapour'], [31, 'Slovaquie'], [30, 'Slovénie'],
  [4, 'Suisse'], [28, 'Suède']];
const COUNTRY_EN = { 7: 'Germany', 1: 'Austria', 2: 'Belgium', 3: 'Bulgaria', 5: 'Cyprus', 35: 'Croatia', 8: 'Denmark', 10: 'Spain', 9: 'Estonia', 11: 'Finland',
  14: 'Greece', 15: 'Hungary', 16: 'Ireland', 37: 'Iceland', 17: 'Italy', 36: 'Japan', 21: 'Latvia', 19: 'Lithuania', 22: 'Malta', 24: 'Norway',
  23: 'Netherlands', 25: 'Poland', 27: 'Romania', 13: 'United Kingdom', 6: 'Czech Republic', 29: 'Singapore', 31: 'Slovakia', 30: 'Slovenia', 4: 'Switzerland', 28: 'Sweden' };
const countryName = (id) => (COUNTRIES.find(([i]) => i === +id) || [0, '?'])[1];
const _ckey = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
const COUNTRY_BY_KEY = {};
COUNTRIES.forEach(([id, n]) => { COUNTRY_BY_KEY[_ckey(n)] = id; if (COUNTRY_EN[id]) COUNTRY_BY_KEY[_ckey(COUNTRY_EN[id])] = id; });
Object.assign(COUNTRY_BY_KEY, { royaumeuni: 13, reptcheque: 6, republiquetcheque: 6, czechia: 6, uk: 13, bulgaria: 3 });
const countryId = (name) => COUNTRY_BY_KEY[_ckey(name)] || 0; // "Localisation de l'article: Rép. Tchèque" -> 6

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euro = (v) => (v == null || isNaN(v) ? '—' : v.toFixed(2).replace('.', ',') + ' €');
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const imgUrl = (s) => (!s ? '' : s.startsWith('/') ? ORIGIN + s : s);

let list = {};        // id -> {id,name,sub,game,url,img,qty,checked,added,langs,cond}
let scans = {};       // id -> {date, offers, partial, loggedOut, url}
let settings = {};
let ignored = {};     // "id|vendeur|prix|état|langue" -> 1
let blocked = {};     // vendeur -> 1
let lastResult = null;
let cats = [];        // noms des catégories
let viewCat = '';     // '' = toutes, '__none' = sans catégorie, sinon le nom

// ---------- Stockage ----------
async function loadAll() {
  const d = await chrome.storage.local.get(null);
  list = d.cmList || {};
  settings = { ...Optimizer.DEFAULTS, maxOffers: 50, freshHours: 0, concurrency: 3, avgScanSec: 8, customs: true, minRating: 0, minSales: 0, defaultLangs: [], defaultCond: '', ...(d.cmSettings || {}) };
  if (!settings.v714) { settings.concurrency = 3; settings.maxOffers = 50; settings.freshHours = 0; settings.v714 = true; }
  if (!settings.v69) { settings.maxOffers = 50; if (settings.freshHours == null) settings.freshHours = 6; settings.v69 = true; } // 1 requête par carte
  if (!settings.v101) { settings.concurrency = 3; settings.v101 = true; }
  settings.concurrency = 3; // toujours 3 cartes scannées en même temps
  delete settings.reqPerMin;
  settings.maxOffers = 50; // 50 offres max par carte = 1 seule requête (au-delà, Cardmarket bloque : erreur 1015)
  // langue de l'extension : prise UNE fois au 1er lancement (langue du navigateur, pas l'IP → un VPN ne change rien)
  if (!settings.uiLang) {
    const det = I18N.detect();
    settings.uiLang = det.lang;
    settings.uiRegion = det.region;
    chrome.storage.local.set({ cmSettings: settings });
  }
  if (!settings.v65) { settings.countryFromLang = true; settings.v65 = true; chrome.storage.local.set({ cmSettings: settings }); } // coché de base pour tout le monde
  if (settings.countryFromLang) settings.myCountry = countryForLang(settings.uiLang, settings.uiRegion);
  I18N.setLang(settings.uiLang);
  if (!settings.myCountry) settings.myCountry = 12;                       // pays où tu te fais livrer
  if (!Array.isArray(settings.sellerCountries)) settings.sellerCountries = settings.franceOnly === false ? [] : [settings.myCountry]; // [] = tous les pays
  cats = d.cmCats || [];
  ignored = d.cmIgnored || {};
  blocked = d.cmBlocked || {};
  lastCartFailed = Array.isArray(d.cmCartFailed) ? d.cmCartFailed : [];
  scans = {};
  for (const k of Object.keys(d)) if (k.startsWith('scan_')) scans[k.slice(5)] = d[k];
}
// pays de livraison d'après la langue (région du navigateur si elle colle, sinon le pays principal de la langue)
const REGION_ID = { FR: 12, DE: 7, AT: 1, BE: 2, BG: 3, CA: 33, CY: 5, HR: 35, DK: 8, ES: 10, EE: 9, FI: 11, GR: 14, HU: 15, IE: 16, IS: 37, IT: 17, JP: 36, LV: 21, LI: 18, LT: 19, LU: 20, MT: 22, NO: 24, NL: 23, PL: 25, PT: 26, RO: 27, GB: 13, UK: 13, CZ: 6, SG: 29, SK: 31, SI: 30, CH: 4, SE: 28 };
const LANG_COUNTRY = { fr: 12, en: 13, de: 7, es: 10, it: 17 };
const LANG_REGIONS = { fr: ['FR', 'BE', 'CH', 'LU', 'CA'], en: ['GB', 'UK', 'IE', 'MT', 'CA', 'SG'], de: ['DE', 'AT', 'CH', 'LI', 'LU'], es: ['ES'], it: ['IT', 'CH'] };
function countryForLang(lang, region) {
  if (region && REGION_ID[region] && (LANG_REGIONS[lang] || []).includes(region)) return REGION_ID[region];
  return LANG_COUNTRY[lang] || 12;
}
const T = (s) => I18N.T(s), TF = (s, v) => I18N.TF(s, v);
const TP = (fr, key, v) => (I18N.getLang() === 'fr' ? fr : TF(key, v)); // garde les vrais pluriels en français
const saveList = () => chrome.storage.local.set({ cmList: list });
const saveSettings = () => chrome.storage.local.set({ cmSettings: settings });
const saveCats = () => chrome.storage.local.set({ cmCats: cats });
const items = () => Object.values(list).sort((a, b) => (b.added || 0) - (a.added || 0));

// ---------- Filtres des offres ----------
const langOf = (o) => {
  const l = (o.lang || '').split(',').map((x) => x.trim()).find((x) => LANG_CODE[x] || EN_TO_FR[x]) || '';
  return EN_TO_FR[l] || l;
};
const cardLangs = (it) => (Array.isArray(it.langs) ? it.langs : settings.defaultLangs || []);
const cardCond = (it) => (it.cond != null ? it.cond : settings.defaultCond || '');
const offerKey = (id, o) => [id, o.seller, o.price, o.cond, o.lang].join('|');
// le vendeur est-il dans les pays choisis, et peut-il t'envoyer la carte ?
const inScope = (o) => {
  const id = countryId(o.country);
  if (settings.sellerCountries.length && !settings.sellerCountries.includes(id)) return false;
  const t = shipTables[`${id}_${settings.myCountry}`];
  return !(Array.isArray(t) && !t.length); // tarifs chargés mais vides = pas d'envoi entre ces pays
};
const inFrance = inScope; // (ancien nom)

// offres qui passent TOUS les filtres (langue, état, vendeur, bloqués, ignorés)
function filteredOffers(it) {
  const s = scans[it.id];
  if (!s) return [];
  const langs = cardLangs(it), minC = cardCond(it);
  return s.offers.filter((o) =>
    inFrance(o) &&
    (!langs.length || langs.includes(langOf(o))) &&
    (!minC || (COND_RANK[o.cond] || 9) <= COND_RANK[minC]) &&
    (RATING_RANK[o.rating] || 0) >= (+settings.minRating || 0) &&
    (o.sales || 0) >= (+settings.minSales || 0) &&
    !blocked[o.seller] &&
    !ignored[offerKey(it.id, o)]);
}

function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return TF('il y a {n} min', { n: m });
  const h = Math.round(m / 60);
  if (h < 48) return TF('il y a {n} h', { n: h });
  return TF('il y a {n} j', { n: Math.round(h / 24) });
}

// ---------- Scan par requêtes (plus d'onglets : marche même en plein écran / fenêtre cachée) ----------
// Pour chaque carte : on télécharge la page (50 premières offres), puis on demande la suite exactement
// comme le bouton "Montrer plus de résultats" (POST AjaxAction/Product_LoadMoreArticles), jusqu'au bout.
// Toutes les requêtes passent par slot() : une toutes les 0,5 s au total (on ralentit si Cardmarket freine).
// Captcha Cloudflare : un onglet s'ouvre devant toi pour que tu coches la case, le reste attend.
const job = { active: false, queue: [], running: new Map(), done: 0, total: 0, failed: [], pausedUntil: 0, strikes: 0,
  challenge: null, loggedOut: false, t0: 0, durations: [], nextReq: 0, gap: baseGap(), workerTab: null, appTab: null, timer: null, pauseReason: '', workerOpened: 0, lastErr: '' };
const LAUNCH_STEP = 300; // (pour l'estimation)

// filtres envoyés directement à Cardmarket : il ne renvoie que les offres utiles (triées par prix)
// → les 50 premières suffisent presque toujours = 1 seule requête par carte
const CM_LANG_ID = { Anglais: 1, Français: 2, Allemand: 3, Espagnol: 4, Italien: 5, 'Chinois-S': 6, Japonais: 7, Portugais: 8, Russe: 9, Coréen: 10, 'Chinois-T': 11 };
function scanQuery(it) {
  const q = new URLSearchParams();
  if (settings.sellerCountries.length === 1) q.set('sellerCountry', settings.sellerCountries[0]);
  const langs = cardLangs(it).map((l) => CM_LANG_ID[l]).filter(Boolean).sort((a, b) => a - b);
  if (langs.length) q.set('language', langs.join(','));
  const c = cardCond(it);
  if (c && COND_RANK[c] > 1) q.set('minCondition', COND_RANK[c]);
  return q.toString().replace(/%2C/g, ',');
}
function scanUrl(it) {
  const u = new URL(ORIGIN + it.url.split('#')[0]);
  for (const k of ['sellerCountry', 'language', 'minCondition']) u.searchParams.delete(k);
  for (const [k, v] of new URLSearchParams(scanQuery(it))) u.searchParams.set(k, v);
  return u.toString().replace(/%2C/g, ',');
}
// scan encore bon ? (récent, et fait avec les mêmes filtres)
const scanFresh = (it) => {
  const s = scans[it.id], h = +settings.freshHours;
  return !!(s && h && s.q === scanQuery(it) && Date.now() - s.date < h * 3600e3);
};
const ajaxUrl = (pageUrl) => {
  const [, lang, game] = new URL(pageUrl).pathname.split('/');
  return `${ORIGIN}/${lang}/${game}/AjaxAction/Product_LoadMoreArticles`;
};

async function slot() {
  for (;;) {
    if (!job.active) throw new Error('stop');
    const now = Date.now();
    if (job.pausedUntil > now || job.challenge) { await sleep(400); continue; }
    if (job.probe && job.probeBusy) { await sleep(300); continue; } // après un captcha : une seule requête test à la fois
    if (job.nextReq <= now) { job.nextReq = now + job.gap; if (job.probe) { job.probeBusy = true; return true; } return false; }
    await sleep(Math.min(job.nextReq - now, 300));
  }
}

// La "porte" : UNE page Cardmarket (épinglée). Toutes les cartes sont téléchargées en texte À TRAVERS elle
// (Cloudflare refuse les requêtes qui viennent directement de l'extension, mais accepte celles faites depuis
// une vraie page Cardmarket, avec tes cookies). Elle s'affiche une seconde au début pour bien se charger.
let workerPromise = null; // une seule porte, même si 5 cartes la demandent en même temps
async function workerTab() {
  if (job.workerTab != null) {
    try {
      const t = await chrome.tabs.get(job.workerTab);
      if (t && t.discarded) { await chrome.tabs.reload(t.id); await waitTab(t.id, 30000); } // mise en veille quand même : on la réveille
      if (t) return job.workerTab;
    } catch {}
    job.workerTab = null;
  }
  if ((job.workerOpened || 0) >= 2) throw new Error(job.lastErr || 'la page Cardmarket ne répond pas'); // pas de boucle ouvrir/fermer
  if (workerPromise) return workerPromise;
  workerPromise = openWorker().finally(() => { workerPromise = null; });
  return workerPromise;
}
// remet la page de l'extension devant (onglet + fenêtre), même si on ne connaît pas encore son onglet
async function backToApp() {
  try {
    let tab = job.appTab && (await chrome.tabs.get(job.appTab.id).catch(() => null));
    if (!tab) {
      tab = (await chrome.tabs.getCurrent().catch(() => null)) ||
        (await chrome.tabs.query({ url: chrome.runtime.getURL('app.html') + '*' }).catch(() => []))[0];
      if (tab) job.appTab = tab;
    }
    if (!tab) return;
    await chrome.tabs.update(tab.id, { active: true });
    if (chrome.windows && tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  } catch {}
}
async function openWorker() {
  const t = await chrome.tabs.create({ url: ORIGIN + '/fr', active: true, pinned: true, windowId: job.appTab ? job.appTab.windowId : undefined });
  job.workerTab = t.id;
  job.workerOpened = (job.workerOpened || 0) + 1;
  // Chrome : "ne jamais mettre cet onglet en veille"
  try { await chrome.tabs.update(t.id, { autoDiscardable: false }); } catch {}
  await waitTab(t.id, 30000);
  await sleep(1500); // on laisse la page Cardmarket finir de bien charger (cookies, scripts) avant la 1re requête
  // vérification anti-robot sur la porte ? on attend que tu coches la case
  const tt = await chrome.tabs.get(t.id).catch(() => null);
  if (tt && /Un instant|Just a moment|Attention Required|Vérification/i.test(tt.title || '')) {
    job.challenge = true;
    banner("🛡️ Cardmarket demande une vérification anti-robot : coche la case dans l'onglet Cardmarket ouvert. Le scan démarre tout seul après.");
    for (let i = 0; i < 200; i++) {
      await sleep(1500);
      const x = await chrome.tabs.get(t.id).catch(() => null);
      if (!x || (x.status === 'complete' && !/Un instant|Just a moment|Attention Required|Vérification/i.test(x.title || ''))) break;
    }
    job.challenge = null; banner(null);
  }
  // on te rend ta page
  backToApp();
  return job.workerTab;
}
function waitTab(tabId, ms) {
  return new Promise((resolve) => {
    const done = () => { chrome.tabs.onUpdated.removeListener(l); clearTimeout(to); resolve(); };
    const l = (id, info) => { if (id === tabId && info.status === 'complete') done(); };
    chrome.tabs.onUpdated.addListener(l);
    const to = setTimeout(done, ms);
    chrome.tabs.get(tabId).then((t) => { if (t && t.status === 'complete' && t.url && t.url.startsWith(ORIGIN)) done(); }).catch(() => {});
  });
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), ms))]);

// téléchargement en texte, fait DEPUIS la page Cardmarket (monde "MAIN" = exactement comme le site lui-même)
async function rawFetch(url, form) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const tabId = await workerTab();
    try {
      const [res] = await withTimeout(chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: async (u, f) => {
          const o = { credentials: 'include' };
          if (f) { o.method = 'POST'; o.body = new FormData(); for (const k in f) o.body.append(k, f[k]); }
          try { const r = await fetch(u, o); return { status: r.status, text: await r.text() }; }
          catch (e) { return { status: 0, text: 'ERREUR ' + e }; }
        },
        args: [url, form || null],
      }), 45000);
      if (res && res.result) return res.result;
      throw new Error('pas de réponse de la page Cardmarket');
    } catch (e) {
      job.lastErr = 'page Cardmarket : ' + e.message;
      // la porte ne répond pas : on essaie de la réveiller (recharger) une fois, sans la fermer
      if (attempt === 0) {
        // la page est peut-être en train de charger ou d'afficher un captcha : on attend qu'elle soit prête, SANS la recharger
        // (recharger relancerait un nouveau captcha). On ne recharge que si elle est prête et ne répond toujours pas.
        const tt = await chrome.tabs.get(tabId).catch(() => null);
        const busy = job.challenge || !tt || tt.status !== 'complete' || /Un instant|Just a moment|Attention Required|Vérification/i.test(tt.title || '');
        try {
          if (busy) { for (let i = 0; i < 200 && job.active && (job.challenge || (await chrome.tabs.get(tabId)).status !== 'complete'); i++) await sleep(500); await sleep(1500); }
          else { await chrome.tabs.reload(tabId); await waitTab(tabId, 30000); await sleep(1500); }
        } catch { job.workerTab = null; }
        continue;
      }
      return { status: 0, text: 'ERREUR ' + e.message };
    }
  }
}

// une requête, avec gestion des blocages / captcha
// ---------- Journal des requêtes (pour voir quand Cardmarket freine) ----------
let reqLog = [];
let reqLogSave = null;
function logReq(e) {
  const now = Date.now(), prev = reqLog[reqLog.length - 1];
  reqLog.push({ t: now, since: prev ? now - prev.t : 0, ...e });
  if (reqLog.length > 5000) reqLog = reqLog.slice(-5000);
  clearTimeout(reqLogSave); reqLogSave = setTimeout(() => chrome.storage.local.set({ cmReqLog: reqLog }), 1500);
  const n = $('nReqLog'); if (n) n.textContent = reqLog.length;
}
const reqKind = (url, form) => (/ShoppingCart/.test(url) ? 'panier' : /LoadMore/.test(url) ? 'plus d\'offres' : form ? 'autre' : 'page carte');
function exportReqLog() {
  const L = reqLog, fmt = (t) => new Date(t).toLocaleString('fr-FR');
  const blocks = L.filter((e) => e.result !== 'ok' && e.result !== 'connexion');
  const first = blocks[0];
  const iFirst = first ? L.indexOf(first) : -1;
  const lines = [
    'Journal des requêtes TCG Price Hunter — exporté le ' + fmt(Date.now()),
    `Requêtes : ${L.length}` + (L.length ? ` (du ${fmt(L[0].t)} au ${fmt(L[L.length - 1].t)})` : ''),
    first ? `1er blocage : requête n°${iFirst + 1}, ${first.result}, ${Math.round((first.t - L[0].t) / 1000)} s après la 1re requête` : 'Aucun blocage enregistré',
    `Blocages : ${blocks.length} (1015 : ${L.filter((e) => e.result === '1015').length}, 429 : ${L.filter((e) => e.result === '429').length}, captcha : ${L.filter((e) => e.result === 'captcha').length}, 403 : ${L.filter((e) => e.result === '403').length})`,
    '',
    'n;date;écart avec la précédente (ms);type;statut HTTP;résultat;durée (ms);rythme réglé (ms)',
    ...L.map((e, i) => [i + 1, fmt(e.t), e.since, e.kind, e.status, e.result, e.ms, e.gap].join(';')),
  ];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
  a.download = 'tcg-price-hunter-requetes-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.txt';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function request(url, form) {
  let lastErr = '';
  for (let attempt = 0; attempt < 10; attempt++) {
    const probe = await slot();
    let res;
    const t0 = Date.now();
    try { res = await rawFetch(url, form); }
    catch (e) { res = { status: 0, text: String(e) }; }
    if (probe) job.probeBusy = false;
    const t = res.text || '';
    const head = t.slice(0, 3000);
    {
      const r1015 = /error\s*1015|being rate limited/i.test(t.slice(0, 20000));
      const result = res.status === 0 ? 'réseau' : r1015 ? '1015'
        : /<title>\s*(Just a moment|Un instant|Attention Required)/i.test(head) ? 'captcha'
        : res.status === 429 ? '429'
        : res.status === 403 && /Access denied|Too Many/i.test(head) ? '403'
        : /^\s*Please login to continue/i.test(t) ? 'connexion' : 'ok';
      logReq({ kind: reqKind(url, form), status: res.status, result, ms: Date.now() - t0, gap: job.gap });
    }
    if (res.status === 0) { lastErr = t.replace(/^ERREUR\s*/, '').slice(0, 120); if ((job.workerOpened || 0) >= 2) break; continue; }
    // Cloudflare "Error 1015 - You are being rate limited" = blocage temporaire pour trop de requêtes
    const is1015 = /error\s*1015|being rate limited/i.test(t.slice(0, 20000));
    // captcha (vérification anti-robot) : Cloudflare l'envoie parfois avec le code 429 « trop de requêtes »,
    // mais ce n'est PAS un blocage : on met tout en pause, tu coches la case, et le scan reprend
    if (!is1015 && /<title>\s*(Just a moment|Un instant|Attention Required)/i.test(head)) {
      await solveChallenge(url.includes('AjaxAction') ? null : url);
      continue;
    }
    if (is1015 || res.status === 429 || (res.status === 403 && /Access denied|Too Many/i.test(head))) {
      // pas de pause : Cardmarket bloque de toute façon pendant un moment -> on arrête le scan tout de suite
      // (les cartes déjà scannées sont gardées, relance plus tard pour le reste)
      if (job.active) {
        job.stopReason = is1015 ? T('Cardmarket t\'a bloqué pour trop de requêtes (erreur 1015) : scan arrêté. Les cartes déjà scannées sont gardées, relance le reste plus tard.')
          : T('Cardmarket freine (trop de requêtes) : scan arrêté. Les cartes déjà scannées sont gardées, relance le reste plus tard.');
        job.queue.length = 0; job.active = false;
      }
      throw new Error('stop');
    }
    if (/^\s*Please login to continue/i.test(t)) return { login: true };
    if (probe) { job.probe = false; job.challenges = 0; if (bannerKey === 'captcha-wait') banner(null); } // la requête test est passée : tout le monde repart
    return res;
  }
  throw new Error(lastErr ? 'erreur réseau : ' + lastErr : 'bloqué par Cardmarket');
}

// Captcha : la page Cardmarket "porte" passe devant toi (pas de nouvel onglet), tu coches la case, tout reprend
let challengePromise = null;
function solveChallenge(url) {
  if (challengePromise) return challengePromise;
  challengePromise = (async () => {
    job.challenges = (job.challenges || 0) + 1;
    if (job.challenges > 5) { // redemandé en boucle : on arrête proprement plutôt que d'ouvrir/fermer sans fin
      job.stopReason = "Cardmarket redemande la vérification anti-robot en boucle. Ouvre cardmarket.com, visite 2-3 pages normalement, puis relance le scan (avec moins de cartes en même temps).";
      job.active = false;
      return;
    }
    job.challenge = true;
    renderProgress();
    banner(T('🛡️ Cardmarket demande une vérification anti-robot : coche la case « Vérifiez que vous êtes humain » dans la page Cardmarket qui vient de passer devant, puis attends quelques secondes : le scan reprend tout seul. Ne recharge pas la page.'), 'captcha');
    let tabId = job.workerTab;
    try { if (tabId == null || !(await chrome.tabs.get(tabId))) tabId = null; } catch { tabId = null; }
    if (tabId == null) {
      const t = await chrome.tabs.create({ url: url || ORIGIN + '/fr', active: true, pinned: true, windowId: job.appTab ? job.appTab.windowId : undefined });
      tabId = job.workerTab = t.id;
      try { await chrome.tabs.update(tabId, { autoDiscardable: false }); } catch {}
    } else {
      // la page affiche déjà le captcha (ou charge) : on la met juste devant, sans la recharger
      const cur = await chrome.tabs.get(tabId).catch(() => null);
      const showing = cur && (cur.status !== 'complete' || /Un instant|Just a moment|Attention Required|Vérification/i.test(cur.title || ''));
      await chrome.tabs.update(tabId, showing ? { active: true } : { active: true, url: url || ORIGIN + '/fr' }).catch(() => {});
    }
    const t0 = Date.now();
    try {
      await sleep(1500);
      while (Date.now() - t0 < 300000 && job.active) {
        const t = await chrome.tabs.get(tabId).catch(() => null);
        if (!t) { job.workerTab = null; break; }
        if (t.status === 'complete' && t.title && !/Un instant|Just a moment|Attention Required|Vérification/i.test(t.title)) break;
        await sleep(1500);
      }
    } finally {
      await backToApp(); // captcha validé : on te ramène sur la page de l'extension
      if (job.active) banner(T('⏳ Vérification validée : attends quelques secondes, le scan reprend tout seul…'), 'captcha-wait'); else banner(null);
      // on repart en douceur : la page a le temps de se poser, puis les requêtes reprennent
      await sleep(2000);
      job.nextReq = Date.now() + 1000;
      job.probe = true; job.probeBusy = false; // 1 requête test d'abord ; si elle passe, les 3 repartent
      job.challenge = null;
      challengePromise = null;
    }
  })();
  return challengePromise;
}

// Scanne une carte : page + "Montrer plus" par requêtes
async function scanCard(id) {
  const it = list[id];
  const url = scanUrl(it);
  const max = +settings.maxOffers || 50;
  const r = job.running.get(id);

  let res = await request(url);
  if (res.login) throw new Error('connexion demandée');
  let doc = new DOMParser().parseFromString(res.text, 'text/html');
  let loggedOut = !!doc.querySelector('input[name="username"]');
  if (loggedOut) { job.loggedOut = true; const e = new Error('déconnecté'); e.logout = true; throw e; } // pas connecté : on arrête tout
  const info = CMParse.productInfo(doc, it.url);
  if (!info) {
    const title = (doc.title || '').trim().slice(0, 60) || (res.text || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    throw new Error(`page inattendue — statut ${res.status}, « ${title} »`);
  }
  const offers = [...doc.querySelectorAll('.article-row')].map(CMParse.parseRow).filter(Boolean);
  r.rows = offers.length;
  let partial = false;

  // la suite ("Montrer plus de résultats")
  const lm = CMParse.loadMoreParams(doc);
  if (lm && !loggedOut && offers.length >= 50) {
    let page = lm.page || '1';
    for (let guard = 0; guard < 200; guard++) {
      if (offers.length >= max) { partial = true; break; }
      const more = await request(ajaxUrl(url), { ...lm, page });
      if (more.login) break;
      let parsed = CMParse.parseLoadMore(more.text || '');
      if (!parsed) { partial = true; break; }
      offers.push(...parsed.offers);
      r.rows = offers.length;
      renderProgress();
      if (parsed.maxReached || !parsed.offers.length || !parsed.newPage) break;
      page = parsed.newPage;
    }
  }

  if (info.img && info.img !== it.img) { it.img = info.img; job.listDirty = true; } // enregistré une seule fois à la fin du scan
  scans[id] = { date: Date.now(), offers, url: it.url, partial, loggedOut, q: scanQuery(it) };
  await chrome.storage.local.set({ ['scan_' + id]: scans[id] });
}

async function startScan(ids) {
  ids = ids.filter((id) => list[id]);
  if (!ids.length) return banner('Coche au moins une carte.');
  banner(null);
  if (job.active) { // déjà en cours : on ajoute à la file
    ids.forEach((id) => { if (!job.queue.includes(id) && !job.running.has(id)) { job.queue.push(id); job.total++; } });
    return renderProgress();
  }
  try { chrome.permissions.request({ origins: [ORIGIN + '/*', 'https://product-images.s3.cardmarket.com/*', 'https://help.cardmarket.com/*'] }).catch(() => {}); } catch {}
  Object.assign(job, { active: true, queue: [...ids], running: new Map(), done: 0, total: ids.length, failed: [], pausedUntil: 0,
    strikes: 0, challenge: null, loggedOut: false, logoutStop: false, t0: Date.now(), durations: [], doneTimes: [], okIds: new Set(), nextReq: 0, gap: baseGap(), workerTab: null, workerOpened: 0, lastErr: '', challenges: 0, probe: false, probeBusy: false, stopReason: '', pauseReason: '' });
  job.appTab = await chrome.tabs.getCurrent().catch(() => null);
  job.timer = setInterval(renderProgress, 500);
  renderProgress();

  const par = Math.max(1, Math.min(5, +settings.concurrency || 3));
  const worker = async () => {
    while (job.active && job.queue.length) {
      const id = job.queue.shift();
      job.running.set(id, { t0: Date.now(), rows: 0 });
      renderProgress();
      try {
        await scanCard(id);
        job.okIds.add(id);
        job.durations.push((Date.now() - job.running.get(id).t0) / 1000);
        settings.avgScanSec = Math.max(2, Math.round(job.durations.reduce((a, b) => a + b, 0) / job.durations.length));
      } catch (e) {
        if (e.message === 'stop') { job.running.delete(id); break; }
        if (e.logout) { job.running.delete(id); job.queue.length = 0; job.active = false; job.logoutStop = true; break; }
        job.failed.push(`${list[id]?.name || id} (${e.message})`);
      }
      job.running.delete(id);
      job.done++;
      job.doneTimes.push(Date.now());
      renderSoon();
    }
  };
  // toutes les cartes partent tout de suite ('par' à la fois) ; si tu n'es pas connecté, la 1re réponse arrête tout
  await Promise.all(Array.from({ length: par }, worker));
  endScan(!job.active);
}

function endScan(stopped = false) {
  clearInterval(job.timer);
  job.active = false;
  if (job.listDirty) { job.listDirty = false; saveList(); }
  // cartes re-scannées : on les enlève de la liste « Pas ajoutés au panier » (recalcule puis réessaie l'ajout)
  if (job.okIds && lastCartFailed.some((f) => job.okIds.has(f.id))) setCartFailed(lastCartFailed.filter((f) => !job.okIds.has(f.id)));
  job.challenge = null;
  if (job.workerTab != null) { chrome.tabs.remove(job.workerTab).catch(() => {}); job.workerTab = null; }
  const ok = job.done - job.failed.length;
  const msgs = [];
  if (job.stopReason) msgs.push('⏹ ' + job.stopReason);
  if (job.failed.length) msgs.push('❌ Échec pour : ' + job.failed.join(' · '));
  if (job.logoutStop) {
    $('banner').classList.add('err');
    bannerHtml(`🔴 <b>${esc(T('Tu n\'es pas connecté à Cardmarket : scan arrêté.'))}</b><br>${esc(T('Connecte-toi sur')).replace(/$/, '')} ${CM_LINK} ${esc(T('puis relance le scan.'))}`, 'logout-' + job.t0);
  } else banner(msgs.join('\n') || null);
  $('scanbox').hidden = false;
  $('progTitle').textContent = stopped ? 'Scan arrêté' : 'Scan terminé';
  $('progCount').textContent = `${job.done}/${job.total}`;
  $('progText').textContent = (I18N.getLang() === 'fr' ? `✔ ${ok} carte${ok > 1 ? 's' : ''} scannée${ok > 1 ? 's' : ''}` : TF('✔ {n} carte(s) scannée(s)', { n: ok })) + (job.failed.length ? ' · ' + TF('{n} échec(s)', { n: job.failed.length }) : '');
  $('progRate').textContent = fmtRate(cardsPerMin(true));
  $('progEta').textContent = TF('⏱ Durée totale : {a}', { a: fmtDur((Date.now() - job.t0) / 1000) });
  $('progList').innerHTML = '';
  $('stopBtn').hidden = true;
  $('barFill').style.width = '100%';
  saveSettings(); // garde la durée moyenne par carte pour les prochaines estimations
  renderAll();
  decorateBg();
}

// temps restant estimé
const fmtDur = (sec) => {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60), r = sec % 60;
  return m < 60 ? `${m} min ${String(r).padStart(2, '0')}` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};
// vitesse réelle : cartes finies sur la dernière minute (sans compter l'ouverture de la page Cardmarket au début)
function cardsPerMin(final) {
  const ts = job.doneTimes || [];
  if (ts.length < 2) return 0;
  const now = final ? ts[ts.length - 1] : Date.now();
  if (final || now - ts[0] < 60000) { const m = (now - ts[0]) / 60000; return m > 0.02 ? (ts.length - 1) / m : 0; }
  return ts.filter((t) => t > now - 60000).length;
}
const fmtRate = (r) => r ? TF('⌀ {n} cartes par minute', { n: r.toLocaleString(I18N.getLang(), { maximumFractionDigits: r < 10 ? 1 : 0 }) }) : '';
// estimation : 130 cartes par minute + ~7 s de démarrage (ouverture et chargement de la page Cardmarket)
const EST_PER_MIN = 130, EST_START_SEC = 7;
function estimateSec(nCards, started) {
  return nCards ? (started ? 0 : EST_START_SEC) + (nCards / EST_PER_MIN) * 60 : 0;
}
function etaText() {
  const now = Date.now();
  let left = estimateSec(job.queue.length + job.running.size, job.done > 0);
  if (job.pausedUntil > now) left += (job.pausedUntil - now) / 1000;
  return TF('⏱ Écoulé {a} · reste environ {b}', { a: fmtDur((now - job.t0) / 1000), b: fmtDur(left) });
}

// fenêtre de chargement de l'ajout au panier
function showCartProg(on, stopped) {
  const el = $('cartProg');
  if (on) { el.hidden = false; el.classList.remove('done'); return; }
  el.classList.add('done');
  const ok = job.done - job.failed.length;
  $('cpTitle').textContent = stopped ? T('Ajout arrêté') : T('✔ Ajout terminé');
  $('cpText').textContent = TF('{ok} article(s) ajouté(s)', { ok }) + (job.failed.length ? ' · ' + TF('{n} échec(s)', { n: job.failed.length }) : '');
  $('cpEta').textContent = '';
  $('cpFill').style.width = '100%';
  $('cpStop').hidden = true;
  setTimeout(() => { $('cartProg').hidden = true; $('cpStop').hidden = false; }, 4000);
}
function renderCartProg() {
  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
  $('cpTitle').textContent = T('🛒 Ajout à ton panier Cardmarket…');
  $('cpCount').textContent = `${job.done} / ${job.total}`;
  $('cpFill').style.width = pct + '%';
  const cur = [...job.running.values()][0];
  const wait = Math.ceil((job.pausedUntil - Date.now()) / 1000);
  $('cpText').textContent = wait > 0 ? `⏸ ${T('Cardmarket freine')} : ${fmtDur(wait)}…` : job.challenge ? T('🛡️ Captcha à valider dans l\'onglet ouvert…') : cur ? cur.label : '';
  const el = (Date.now() - job.t0) / 1000;
  const left = (job.total - job.done) * (job.done ? el / job.done : 1);
  $('cpEta').textContent = `${pct} % · ` + TF('reste environ {a}', { a: fmtDur(left) }) + (job.failed.length ? ' · ' + TF('{n} échec(s)', { n: job.failed.length }) : '');
}

function renderProgress() {
  if (!job.active) return;
  if (job.kind === 'cart') renderCartProg();
  $('scanbox').hidden = false;
  $('stopBtn').hidden = false;
  $('progTitle').textContent = job.kind === 'cart' ? 'Ajout au panier Cardmarket' : 'Scan en cours';
  $('progCount').textContent = `${job.done}/${job.total}`;
  $('barFill').style.width = (job.total ? Math.round((job.done / job.total) * 100) : 0) + '%';
  const wait = Math.ceil((job.pausedUntil - Date.now()) / 1000);
  if (wait > 0) {
    const back = new Date(job.pausedUntil).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const key = (/1015/.test(job.pauseReason) ? '1015-' : 'pause-') + job.pauseStart;
    if (closedKey === key) {
      // message fermé avec ✕ : on ne le réaffiche pas pendant cette pause
    } else if (/1015/.test(job.pauseReason) && $('ban1015') && !$('banner').hidden) {
      $('banWait').textContent = fmtDur(wait); $('banBack').textContent = back; // seul le compte à rebours change (les liens restent cliquables)
    } else if (/1015/.test(job.pauseReason)) {
      bannerHtml(`<b id="ban1015">⏸ Erreur 1015 : ${CM_LINK} t'a bloqué temporairement.</b><br>
        <b>Raison :</b> trop de requêtes en peu de temps (protection anti-robot Cloudflare de ${CM_LINK}).<br>
        <b>Il faut réessayer plus tard :</b> le scan fait une pause de <span id="banWait">${fmtDur(wait)}</span> (reprise vers <span id="banBack">${back}</span>) et repart tout seul, avec des requêtes plus espacées. Si c'est encore bloqué à la reprise, il refait une pause de 10 min.<br>
        <b>Pendant la pause :</b> ne recharge pas ${CM_LINK}, ça peut prolonger le blocage. Tu peux continuer à regarder tes cartes et calculer le panier avec ce qui est déjà scanné.<br>
        <b>Si ça revient souvent :</b> baisse « Cartes scannées en même temps » dans les Réglages, ou scanne tes cartes par catégorie plutôt que tout d'un coup.<br>
        <a href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1015/" target="_blank">En savoir plus sur l'erreur 1015 (Cloudflare)</a>`, key);
    } else {
      banner(`⏸ ${job.pauseReason || 'Cardmarket freine'}. Pause de ${fmtDur(wait)} (reprise vers ${back}), le scan repart tout seul. Les requêtes seront ensuite plus espacées.`, key);
    }
    job.pauseShown = true;
  } else if (job.pauseShown) { banner(null); job.pauseShown = false; }
  $('progText').textContent = wait > 0 ? `⏸ ${/1015/.test(job.pauseReason) ? 'Trop de requêtes (erreur 1015)' : 'Cardmarket freine'} : pause ${fmtDur(wait)}…`
    : job.challenge ? T('🛡️ Captcha à valider dans l\'onglet ouvert…')
    : job.probe ? T('⏳ Captcha validé : reprise en cours, attends quelques secondes…')
    : TF('{n} en cours · {q} en attente', { n: job.running.size, q: job.queue.length }) + (job.failed.length ? ' · ' + TF('{n} échec(s)', { n: job.failed.length }) : '');
  $('progRate').textContent = job.kind !== 'cart' ? fmtRate(cardsPerMin()) : '';
  $('progEta').textContent = job.challenge ? T('⏱ En pause le temps du captcha, attends…') : job.probe ? T('⏱ Reprise du scan…') : job.kind === 'cart' ? '' : etaText();
  $('progList').innerHTML = [...job.running.entries()].map(([id, r]) =>
    `<div>⏳ ${esc(r.label || list[id]?.name || id)}${r.rows ? ` <i>${r.rows} offres</i>` : ''}</div>`).join('');
}

// ---------- Ajouter le meilleur panier au panier Cardmarket ----------
// Même chose que le bouton 🛒 "Ajouter à mon panier" de chaque offre :
// POST AjaxAction/ShoppingCart_Add_AddArticlesFromProductPage { __cmtkn, idArticle[N], amount[N] }
// Rien n'est acheté : tu vérifies et tu payes toi-même sur Cardmarket.
// réponse de Cardmarket à un ajout au panier : <ajaxResponse><resultType>base64</resultType><systemMessage>base64(HTML)</systemMessage>
let lastCartFailed = [];
const setCartFailed = (arr) => { lastCartFailed = arr; chrome.storage.local.set({ cmCartFailed: arr }); };
// cartes (de ta liste) qui n'ont pas pu aller dans le panier
const cartFailedIds = () => [...new Set(lastCartFailed.map((f) => f.id || Object.values(list).find((it) => it.url === f.url)?.id).filter((id) => id && list[id]))];
function b64(s) { try { return new TextDecoder().decode(Uint8Array.from(atob((s || '').trim()), (c) => c.charCodeAt(0))); } catch { return ''; } }
function cartAnswer(t) {
  const type = b64((t.match(/<resultType>([\s\S]*?)<\/resultType>/) || [])[1]).trim().toLowerCase();
  const html = b64((t.match(/<systemMessage>([\s\S]*?)<\/systemMessage>/) || [])[1]);
  const msg = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  const bad = type === 'error' || /alert-danger|alert-warning/.test(html) || /<error\b/i.test(t);
  if (bad) return { ok: false, msg: msg || 'refusé par Cardmarket' };
  if (!/<ajaxResponse/i.test(t) && !type) return { ok: false, msg: 'réponse inattendue de Cardmarket' };
  return { ok: true, msg };
}
async function addToCart(orders) {
  if (job.active) return banner('Un scan ou un ajout est déjà en cours, attends la fin.');
  const items = [];
  orders.forEach((o) => o.lines.forEach(({ line, opt }) => opt.picked.forEach((p) =>
    items.push({ id: line.id, aid: p.aid, take: p.take, price: p.price, name: line.name, seller: o.seller, url: line.url }))));
  if (!items.length) return;
  const noAid = items.filter((i) => !i.aid);
  if (noAid.length) return banner(`Re-scanne d'abord ces cartes (scannées avec une ancienne version, il manque le n° d'article) : ${[...new Set(noAid.map((i) => i.name))].join(', ')}`);
  const nCards = items.reduce((a, i) => a + i.take, 0);
  const total = items.reduce((a, i) => a + i.take * i.price, 0);
  if (!confirm(`Ajouter ${nCards} carte${nCards > 1 ? 's' : ''} (${euro(total)} hors port, ${new Set(items.map((i) => i.seller)).size} vendeur(s)) au panier de ton compte Cardmarket ?\n\nRien n'est acheté : tu vérifies et tu payes toi-même sur Cardmarket.`)) return;
  try { chrome.permissions.request({ origins: [ORIGIN + '/*'] }).catch(() => {}); } catch {}

  Object.assign(job, { active: true, queue: [], running: new Map(), done: 0, total: items.length, failed: [], pausedUntil: 0, strikes: 0,
    challenge: null, loggedOut: false, t0: Date.now(), durations: [], nextReq: 0, gap: baseGap(), workerTab: null, workerOpened: 0,
    lastErr: '', challenges: 0, probe: false, probeBusy: false, stopReason: '', pauseReason: '', kind: 'cart' });
  job.gap = CART_GAP; // ajout au panier : plus doux qu'un scan (1 article par seconde), sinon Cardmarket refuse en silence
  job.appTab = await chrome.tabs.getCurrent().catch(() => null);
  job.timer = setInterval(renderProgress, 500);
  job.cartItems = items.length;
  showCartProg(true);
  renderProgress();
  const game = new URL(ORIGIN + items[0].url).pathname.split('/')[2];
  let token = null;
  const getToken = async (it) => { // jeton de sécurité de Cardmarket (le même que celui des boutons de la page)
    const res = await request(ORIGIN + it.url.split('#')[0]);
    const d = new DOMParser().parseFromString(res.text || '', 'text/html');
    if (d.querySelector('input[name="username"]')) throw new Error("tu n'es pas connecté à Cardmarket");
    const tk = d.querySelector('input[name="__cmtkn"]')?.value;
    if (!tk) throw new Error('jeton Cardmarket introuvable');
    return tk;
  };
  const failedItems = [];
  for (const it of items) {
    if (!job.active) break;
    job.running.set(it.aid, { t0: Date.now(), rows: 0, label: `${it.name} ×${it.take} — ${it.seller}` });
    renderProgress();
    try {
      const [, lang, g] = new URL(ORIGIN + it.url).pathname.split('/');
      for (let tries = 0; ; tries++) {
        if (!token) token = await getToken(it);
        const res = await request(`${ORIGIN}/${lang}/${g}/AjaxAction/ShoppingCart_Add_AddArticlesFromProductPage`,
          { __cmtkn: token, [`idArticle[${it.aid}]`]: it.aid, [`amount[${it.aid}]`]: String(it.take) });
        if (res.login) throw new Error('connexion demandée');
        if (res.status !== 200) throw new Error(`refusé (statut ${res.status})`);
        const ans = cartAnswer(res.text || '');
        if (ans.ok) break;
        // « Time-out, merci de réessayer » = jeton périmé : on en reprend un et on réessaie une fois
        if (tries === 0 && /time-?out|refresh|réessayer|actualise/i.test(ans.msg)) { token = null; continue; }
        throw new Error(ans.msg || 'refusé par Cardmarket');
      }
    } catch (e) {
      if (e.message === 'stop') { job.running.delete(it.aid); break; }
      job.failed.push(`${it.name} chez ${it.seller} (${e.message})`);
      failedItems.push({ ...it, reason: e.message });
      token = null;
    }
    job.running.delete(it.aid);
    job.done++;
  }
  // vérification : on regarde ce qui est VRAIMENT dans ton panier Cardmarket
  if (job.done) {
    try {
      const [, lang] = new URL(ORIGIN + items[0].url).pathname.split('/');
      const res = await request(`${ORIGIN}/${lang}/${game}/ShoppingCart`);
      const html = res.text || '';
      const tried = items.slice(0, job.done).filter((it) => !failedItems.some((f) => f.aid === it.aid));
      const has = (aid) => new RegExp(`(^|\\D)${aid}(\\D|$)`).test(html);
      const found = tried.filter((it) => has(it.aid));
      if (found.length) { // la page du panier montre bien les n° d'articles : on peut se fier à la vérification
        for (const it of tried) if (!has(it.aid)) {
          job.failed.push(`${it.name} chez ${it.seller} (pas dans le panier)`);
          failedItems.push({ ...it, reason: T('pas dans ton panier (refusé par Cardmarket)') });
        }
      }
    } catch (e) { /* vérification impossible : on garde le résultat des réponses */ }
  }
  setCartFailed(failedItems);
  clearInterval(job.timer);
  const stopped = !job.active;
  showCartProg(false, stopped);
  job.active = false; job.kind = '';
  if (job.workerTab != null) { chrome.tabs.remove(job.workerTab).catch(() => {}); job.workerTab = null; }
  const ok = job.done - job.failed.length;
  $('progTitle').textContent = stopped ? 'Ajout arrêté' : 'Ajout au panier terminé';
  $('progCount').textContent = `${job.done}/${job.total}`;
  $('progText').textContent = `✔ ${ok} article${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''}` + (job.failed.length ? ` · ${job.failed.length} échec(s)` : '');
  $('progEta').textContent = ''; $('progList').innerHTML = ''; $('stopBtn').hidden = true; $('barFill').style.width = '100%';
  bannerHtml(`<b>🛒 ${ok} article${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''} à ton panier ${CM_LINK}.</b> ` +
    `<a href="${ORIGIN}/fr/${encodeURIComponent(game)}/ShoppingCart" target="_blank">Ouvrir mon panier Cardmarket</a> pour vérifier et payer.` +
    (job.failed.length ? `<br>❌ ${job.failed.length} pas ajouté(s) au panier : la liste est à droite, dans « Pas ajoutés au panier ».` : '') +
    (job.stopReason ? `<br>⏹ ${esc(job.stopReason)}` : ''));
  if (lastResult) renderBest(); // affiche la liste « Pas ajoutés au panier » à droite
}

// ---------- Vue : Cartes scannées ----------
// la carte n'a AUCUNE offre dans la langue choisie -> en rouge
function missingLang(it) {
  const s = scans[it.id], langs = cardLangs(it);
  if (!s || !langs.length) return false;
  return !s.offers.some((o) => inFrance(o) && langs.includes(langOf(o)));
}
function inView(it, q) {
  if (q && !norm(it.name + ' ' + it.sub).includes(q)) return false;
  if (viewCat === '__none') return !it.cat || !cats.includes(it.cat);
  if (viewCat) return it.cat === viewCat;
  return true;
}
const visibleItems = () => items().filter((it) => inView(it, norm($('qScan').value)));

function renderLangBar() {
  const chosen = settings.defaultLangs || [];
  $('topLangs').innerHTML = LANGS.map(([n, c]) => `<span class="chip big ${chosen.includes(n) ? 'on' : ''}" data-toplang="${esc(n)}" title="${esc(n)}">${c}</span>`).join('') +
    `<span class="chip big ${chosen.length ? '' : 'on'}" data-toplang="" title="Toutes les langues">Toutes</span>`;
  const miss = items().filter(missingLang);
  $('langWarn').innerHTML = miss.length ? `<span class="tag bad">${I18N.getLang() === 'fr' ? `⚠ ${miss.length} carte${miss.length > 1 ? 's' : ''} sans offre dans cette langue (en rouge)` : TF('⚠ {n} carte(s) sans offre dans cette langue (en rouge)', { n: miss.length })}</span>` : '';
}
function catOptions(selected, withNew = true) {
  return `<option value="">Sans catégorie</option>` + cats.map((c) => `<option ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('') +
    (withNew ? '<option value="__new">➕ Nouvelle catégorie…</option>' : '');
}
function renderCatBar() {
  const all = items();
  const count = (c) => all.filter((it) => it.cat === c).length;
  const none = all.filter((it) => !it.cat || !cats.includes(it.cat)).length;
  const chip = (val, label, n) => `<span class="chip big ${viewCat === val ? 'on' : ''}" data-viewcat="${esc(val)}">${label} <i>${n}</i></span>`;
  let h = '<b>📁 Catégories :</b>' + chip('', 'Toutes', all.length) + cats.map((c) => chip(c, esc(c), count(c))).join('');
  if (cats.length) h += chip('__none', 'Sans catégorie', none);
  h += '<button class="btn ghost sm" data-catact="new">➕ Catégorie</button>';
  if (viewCat && viewCat !== '__none') h += '<button class="btn ghost sm" data-catact="rename">✎ Renommer</button><button class="btn ghost sm danger-t" data-catact="delete">🗑 Supprimer</button>';
  $('catBar').innerHTML = h;
  $('bulkCat').innerHTML = '<option value="__label">📁 Ranger la sélection dans…</option>' + catOptions('', true).replace('<option value="">Sans catégorie</option>', '<option value="__clear">Sans catégorie</option>');
}
function newCategory() {
  const name = (prompt('Nom de la nouvelle catégorie :') || '').trim();
  if (!name) return null;
  if (!cats.includes(name)) { cats.push(name); saveCats(); }
  return name;
}
function langChips(it, offersAll) {
  // langues présentes dans les offres (en France si coché) + celles déjà choisies
  const counts = {};
  offersAll.filter(inFrance).forEach((o) => { const l = langOf(o); if (l) counts[l] = (counts[l] || 0) + 1; });
  const chosen = cardLangs(it);
  const names = LANGS.map(([n]) => n).filter((n) => counts[n] || chosen.includes(n));
  if (!names.length) return '';
  return `<div class="chips small">${names.map((n) => `<span class="chip ${chosen.includes(n) ? 'on' : ''}" data-lang="${esc(n)}" title="${esc(n)}">${LANG_CODE[n] || n}${counts[n] ? ` <i>${counts[n]}</i>` : ''}</span>`).join('')}
    ${chosen.length ? '<span class="chip clear" data-lang="" title="Toutes les langues">toutes</span>' : '<span class="hint">toutes langues</span>'}</div>`;
}
function condSelect(it) {
  const c = cardCond(it);
  return `<select data-cond title="État minimum"><option value="">Tous états</option>${CONDS.slice(0, 6).map(([k, l]) => `<option value="${k}" ${c === k ? 'selected' : ''}>${TF('{c} et mieux', { c: k })}</option>`).join('')}</select>
    <a class="help" href="https://help.cardmarket.com/fr/CardCondition" target="_blank" title="À quoi correspondent les états ?">?</a>`;
}

// série d'une carte = l'extension dans son lien (/Pokemon/Products/Singles/<Série>/…), sinon le type de produit
const SER_COLORS = ['#2f80ff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#8b5cf6', '#ec4899', '#a0603a', '#f1f5f9']; // bleu, rouge, orange, jaune, vert, violet, rose, marron, blanc
const seriesKey = (it) => { const p = (it.url || '').split('/'); return (p[2] || '') + '/' + (p[4] === 'Singles' ? p[5] : p[4] || ''); };
function renderScanned() {
  const q = norm($('qScan').value);
  const all = items();
  const noOffer = (it) => (scans[it.id] && (missingLang(it) || !filteredOffers(it).length) ? 1 : 0);
  // cartes regroupées par série (même nom = ensemble, dans l'ordre où la série apparaît), cartes sans offre tout en haut
  const serIdx = {};
  all.forEach((it) => { const k = seriesKey(it); if (!(k in serIdx)) serIdx[k] = Object.keys(serIdx).length; });
  const rows = all.filter((it) => inView(it, q)).map((it, i) => ({ it, i }))
    .sort((a, b) => noOffer(b.it) - noOffer(a.it) || serIdx[seriesKey(a.it)] - serIdx[seriesKey(b.it)] || a.i - b.i).map((x) => x.it);
  renderLangBar(); renderCatBar();
  const nChecked = all.filter((it) => it.checked).length;
  $('scanSel').textContent = `${T('🔍 Scanner la sélection')} (${nChecked})`;
  $('scanAll').textContent = `${T('Tout scanner')} (${all.length})`;
  { const nf = cartFailedIds().length; $('scanFailed').hidden = !nf; $('scanFailed').textContent = `${T('🔁 Re-scanner les pas ajoutées au panier')} (${nf})`; }
  $('scanEstimate').textContent = nChecked ? TF('⏱ ≈ {a} pour {n} carte(s)', { a: fmtDur(estimateSec(nChecked)), n: nChecked }) : '';
  if (!rows.length && all.length) {
    $('scanRows').innerHTML = `<div class="empty">Aucune carte dans cette catégorie.<br>Coche des cartes et utilise « 📁 Ranger la sélection dans… », ou change la catégorie d'une carte avec son menu.</div>`;
    return;
  }
  if (!all.length) {
    $('scanRows').innerHTML = `<div class="empty"><b>Aucune carte pour l'instant.</b><br><br>Sur Cardmarket, ouvre une carte : sous le titre il y a <b>🔍 Scanner cette page</b> et <b>➕ Ajouter sans scanner</b>.</div>`;
    return;
  }
  // une couleur par série (extension) : barre à gauche de chaque carte, pour repérer les séries en descendant
  // une couleur bien distincte par série : la 1re toujours en bleu, puis rouge, orange, jaune, vert, violet, rose, marron, blanc (puis on recommence)
  const serColor = {};
  Object.entries(serIdx).forEach(([k, i]) => { serColor[k] = SER_COLORS[i % SER_COLORS.length]; });
  $('scanRows').innerHTML = `<div class="colhead" id="scanHead"><span></span><span></span><span>Carte · langue · état</span><span class="num">Qté</span><span class="num">Offres</span><span class="num">Dès</span><span class="num">Vendeurs</span><span class="num">Scan</span></div>` +
    rows.map((it) => {
      const s = scans[it.id];
      const running = job.active && (job.running.has(it.id) || job.queue.includes(it.id));
      const offers = filteredOffers(it);
      const prices = offers.map((o) => o.price).filter((v) => v != null);
      const sellers = new Set(offers.map((o) => o.seller));
      const tags = [];
      if (running) tags.push(`<span class="tag warn">${job.running.has(it.id) ? 'scan en cours…' : 'en attente'}</span>`);
      else if (!s) tags.push('<span class="tag">pas encore scannée</span>');
      else {
        if (missingLang(it)) tags.push(`<span class="tag bad">${TF("pas d'offre en {l}", { l: cardLangs(it).map((l) => LANG_CODE[l] || l).join('/') })}</span>`);
        else if (!offers.length) tags.push('<span class="tag bad">aucune offre avec ces filtres</span>');
        if (s.q != null && s.q !== scanQuery(it)) tags.push(`<span class="tag warn">${T('filtres changés : re-scanne')}</span>`);
        else if (s.partial) tags.push(`<span class="tag">${T('les moins chères')}</span>`);
        if (s.loggedOut) tags.push('<span class="tag warn">non connecté (50 max)</span>');
        if (s.offers.length && s.offers[0].rating === undefined && (+settings.minRating || +settings.minSales)) tags.push('<span class="tag warn">re-scanne pour filtrer les vendeurs</span>');
      }
      return `<div class="row ser ${missingLang(it) ? 'missing' : ''} ${it.checked ? '' : 'off'}" data-id="${esc(it.id)}" style="--ser:${serColor[seriesKey(it)]}">
        <input type="checkbox" data-chk ${it.checked ? 'checked' : ''} title="Sélection (scan + calcul)">
        <a href="${esc(ORIGIN + it.url)}" target="_blank" title="Voir la carte sur Cardmarket"><img loading="lazy" src="${esc(imgUrl(it.img))}" alt=""></a>
        <div class="cardcol"><div class="nm">${esc(it.name)}</div><div class="sub">${esc(it.sub)}${it.cat && cats.includes(it.cat) ? ` · <span class="catname">📁 ${esc(it.cat)}</span>` : ''}</div>
          ${s ? langChips(it, s.offers) : ''}
          <div class="tags">${condSelect(it)}<select data-cat title="Catégorie">${catOptions(it.cat)}</select>${tags.join('')}</div></div>
        <div class="num"><input type="number" min="1" max="99" value="${it.qty}" data-qty title="Quantité"></div>
        <div class="num"><b>${s ? offers.length : '—'}</b><span>${s && s.offers.length !== offers.length ? 'sur ' + s.offers.length : ''}</span></div>
        <div class="num"><b>${prices.length ? euro(Math.min(...prices)) : '—'}</b></div>
        <div class="num"><b>${s ? sellers.size : '—'}</b></div>
        <div class="num"><span>${s ? ago(s.date) : ''}</span> <button class="icon" data-rescan title="Scanner cette carte">↻</button> <button class="icon rm" data-rm title="Retirer">✕</button></div>
      </div>`;
    }).join('');
}

// ---------- Frais de port officiels (API publique de l'aide Cardmarket) ----------
// https://help.cardmarket.com/api/shippingCosts?fromCountry=<vendeur>&toCountry=<toi>
let shipTables = {}; // "from_to" -> [{name, tracked, maxValue, maxWeight, price, virtual}]
const SHIP_MAX_AGE = 14 * 24 * 3600 * 1000; // les tarifs changent rarement : 14 jours
async function loadShipTable(from, to) {
  const key = `${from}_${to}`;
  if (Array.isArray(shipTables[key])) return shipTables[key];
  const cached = (await chrome.storage.local.get('ship_' + key))['ship_' + key];
  if (cached && Date.now() - cached.date < SHIP_MAX_AGE) return (shipTables[key] = cached.methods);
  try {
    const r = await fetch(`https://help.cardmarket.com/api/shippingCosts?locale=fr&fromCountry=${from}&toCountry=${to}&preview=false`);
    const j = await r.json();
    const methods = (Array.isArray(j) ? j : []).map((m) => ({
      name: m.name, tracked: !!m.isTracked, virtual: !!m.isVirtual, letter: !!m.isLetter,
      maxValue: CMParse.parsePrice(m.maxValue) || Infinity, maxWeight: +m.maxWeight || 0, price: CMParse.parsePrice(m.price),
    })).filter((m) => m.price != null && m.maxWeight > 0);
    shipTables[key] = methods;
    chrome.storage.local.set({ ['ship_' + key]: { date: Date.now(), methods } });
    return methods;
  } catch { return null; } // pas de réseau : on utilisera les tarifs manuels des réglages
}
// charge les tarifs pour tous les pays de vendeurs présents dans les scans
async function ensureShipTables() {
  const ids = new Set();
  for (const s of Object.values(scans)) for (const o of s.offers || []) { const id = countryId(o.country); if (id) ids.add(id); }
  if (settings.sellerCountries.length) for (const id of [...ids]) if (!settings.sellerCountries.includes(id)) ids.delete(id);
  ids.add(+settings.myCountry);
  await Promise.all([...ids].map((id) => loadShipTable(id, settings.myCountry)));
}
// ---------- Douane / TVA à l'import (estimation) ----------
// Pays de l'UE (union douanière) : entre eux, pas de douane. Hors UE : Royaume-Uni, Suisse/Liechtenstein, Norvège, Islande, Japon…
const EU_IDS = new Set([12, 7, 1, 2, 3, 5, 35, 8, 10, 9, 11, 14, 15, 16, 17, 21, 19, 20, 22, 23, 25, 26, 27, 6, 31, 30, 28]);
// TVA normale du pays où tu te fais livrer (%)
const VAT_RATE = { 12: 20, 7: 19, 1: 20, 2: 21, 3: 20, 5: 19, 35: 25, 8: 25, 10: 21, 9: 24, 11: 25.5, 14: 24, 15: 27, 16: 23, 17: 22, 21: 21, 19: 21,
  20: 17, 22: 18, 23: 21, 25: 23, 26: 23, 27: 21, 6: 21, 31: 23, 30: 22, 28: 25, 13: 20, 24: 25, 37: 24 };
const customsZone = (id) => (EU_IDS.has(id) ? 'EU' : id === 4 || id === 18 ? 'CH' : 'C' + id);
// règle pour un vendeur de ce pays -> toi : TVA du pays de livraison sur (cartes + port)
//  + UE : droit de douane fixe de 3 € par colis jusqu'à 150 € (depuis juillet 2026), au-delà frais de dédouanement du transporteur (~10 €)
//  + Royaume-Uni / Norvège : au-delà de 135 £ / 3000 NOK, frais de dédouanement du transporteur (~10 €)
//  Suisse : Cardmarket prend déjà la TVA sur toutes les ventes vers la Suisse, d'où qu'elles viennent -> rien en plus selon le pays
const customsRule = (from, to) => { // règle entre deux pays (ids), ou null s'il n'y a rien à payer en plus
  if (!from || !to || customsZone(from) === customsZone(to)) return null;
  if (to === 4 || to === 18) return null;
  const rate = (VAT_RATE[to] || 0) / 100;
  if (EU_IDS.has(to)) return { rate, limit: 150, flat: 3, over: 10 };
  if (to === 13) return { rate, limit: 155, flat: 0, over: 10 };
  if (to === 24) return { rate, limit: 260, flat: 0, over: 10 };
  return { rate, limit: Infinity, flat: 0, over: 0 };
};
const customsFor = (country) => (settings.customs ? customsRule(countryId(country), +settings.myCountry) : null);

// explication de la douane pour un trajet (vue Frais de port), avec des exemples chiffrés
function customsExplain(from, to, table) {
  const A = esc(countryName(from)), B = esc(countryName(to));
  const zoneName = (id) => (EU_IDS.has(id) ? T('Union européenne') : id === 4 || id === 18 ? T('Suisse et Liechtenstein') : esc(countryName(id)));
  if (from === to) return `<div class="customs ok"><b>${esc(T('✅ Pas de douane : même pays.'))}</b></div>`;
  if (customsZone(from) === customsZone(to)) return `<div class="customs ok"><b>${esc(TF('✅ Pas de douane de {a} vers {b} : même zone douanière ({z}).', { a: countryName(from), b: countryName(to), z: zoneName(to) }))}</b></div>`;
  if (to === 4 || to === 18) return `<div class="customs ok"><b>${esc(T('ℹ️ Pas de surcoût lié au pays du vendeur : Cardmarket prend déjà la TVA suisse sur toutes les ventes vers la Suisse et le Liechtenstein, même entre vendeurs suisses.'))}</b></div>`;
  const R = customsRule(from, to);
  const lines = [TF('• la TVA de {b} ({r} %) sur cartes + port ;', { b: countryName(to), r: String(Math.round(R.rate * 1000) / 10).replace('.', ',') })];
  if (EU_IDS.has(to)) lines.push(T("• + un droit de douane fixe de 3 € par colis jusqu'à 150 € (UE, depuis juillet 2026) ;"), T('• au-delà de 150 € : environ 10 € de frais de dédouanement du transporteur à la place.'));
  else if (to === 13) lines.push(T('• au-delà de 135 £ (≈ 155 €) : environ 10 € de frais de dédouanement du transporteur.'));
  else if (to === 24) lines.push(T('• au-delà de 3000 NOK (≈ 260 €) : environ 10 € de frais de dédouanement du transporteur.'));
  const S = { ...Optimizer.DEFAULTS, ...settings, alwaysTracked: false };
  const ex = [[4, 5], [17, 20], [40, 50], [40, 120], [60, 200]].map(([n, v]) => {
    const port = Optimizer.shipping(n, v, false, S, Array.isArray(table) && table.length ? table : null).cost;
    const base = v + port, vat = base * R.rate, fix = base <= R.limit ? R.flat : R.over, duty = vat + fix;
    return `<tr><td>${esc(TF('{n} cartes pour {v}', { n, v: euro(v) }))}</td><td class="r">${euro(port)}</td><td class="r">${euro(vat)}</td><td class="r">${fix ? euro(fix) : '—'}</td><td class="r"><b>${euro(duty)}</b></td><td class="r">${euro(base + duty)}</td></tr>`;
  }).join('');
  return `<div class="customs">
    <h4>${esc(TF('🛃 Douane {a} → {b}', { a: countryName(from), b: countryName(to) }))}</h4>
    <p>${esc(TF('Le vendeur est hors de ta zone douanière : à la livraison en {b}, il faut compter :', { b: countryName(to) }))}</p>
    <p>${lines.map(esc).join('<br>')}</p>
    <table class="t"><tr><th>${esc(T('Exemple de commande'))}</th><th class="r">${esc(T('Port'))}</th><th class="r">${esc(T('TVA'))}</th><th class="r">${esc(T('Droit / dédouanement'))}</th><th class="r">${esc(T('Douane'))}</th><th class="r">${esc(T('Total'))}</th></tr>${ex}</table>
    <p class="muted">${esc(T('Ces frais sont ajoutés automatiquement à chaque commande dans « Meilleur panier » : un vendeur de ce pays peut donc perdre face à un vendeur plus proche.'))}
    ${esc(T('Estimation : les frais du transporteur varient, et le droit de 3 € est compté une fois par colis.'))}</p>
    ${settings.customs ? '' : `<p class="warn">${esc(T("⚠ Désactivé dans les Réglages : la douane n'est pas comptée dans le meilleur panier."))}</p>`}
  </div>`;
}
const shipTableFor = (country) => {
  const t = shipTables[`${countryId(country)}_${settings.myCountry}`];
  return Array.isArray(t) && t.length ? t : null;
};

// ---------- Vue : Meilleur panier ----------
function compute() {
  const lines = items()
    .filter((it) => it.checked && scans[it.id])
    .map((it) => ({ id: it.id, name: it.name, sub: it.sub, game: it.game, url: it.url, qty: it.qty, offers: filteredOffers(it) }));
  lastResult = lines.length ? { r: Optimizer.optimize(lines, { ...settings, shipTableFor, customsFor }), lines, date: Date.now() } : null;
  // on garde le plan pour entourer en vert les bons vendeurs sur les pages Cardmarket
  if (lastResult) {
    const cards = {};
    lastResult.r.orders.forEach((o) => o.lines.forEach(({ line, opt }) => { cards[line.id] = { seller: o.seller, price: opt.picked[0] ? opt.picked[0].price : opt.cost }; }));
    chrome.storage.local.set({ cmPlan: { date: Date.now(), cards, sellers: lastResult.r.orders.map((o) => o.seller) } });
  }
}

function sellerUrl(seller, game) {
  return `${ORIGIN}/fr/${encodeURIComponent(game || 'Riftbound')}/Users/${encodeURIComponent(seller)}`;
}

function renderBest() {
  if (!lastResult) {
    $('best').innerHTML = `<div class="empty">Scanne des cartes d'abord, puis clique <b>Calculer le meilleur panier</b>.</div>`;
    return;
  }
  const { r, lines } = lastResult;
  const game = lines[0].game;
  const n = r.nLines;
  const nAvail = n - r.unavailable.length;
  const S = r.settings;
  let h = '';

  // avertissements
  const warns = [];
  if (r.short.length) warns.push(`<b>Quantité incomplète</b> (aucun vendeur n'en a assez) : ${r.short.map((l) => `${esc(l.name)} ×${l.qty}`).join(', ')} — le max dispo est pris.`);
  if (lines.some((l) => scans[l.id]?.loggedOut)) warns.push("Certaines cartes ont été scannées sans être connecté (50 offres max) : re-scanne-les une fois connecté.");
  if (warns.length) h += `<div class="warnbox">${warns.join('<br>')}</div>`;

  // tuiles
  const saving = r.naive.total - r.total;
  h += `<div class="tiles">
    <div class="tile main"><div class="k">Total à payer</div><div class="v">${euro(r.total)}</div></div>
    <div class="tile"><div class="k">Cartes</div><div class="v">${euro(r.items)}</div></div>
    <div class="tile"><div class="k">${TP(`Frais de port · ${r.orders.length} commande${r.orders.length > 1 ? 's' : ''}`, 'Frais de port · {n} commande(s)', { n: r.orders.length })}</div><div class="v">${euro(r.ship)}</div>${r.duty > 0.004 ? `<div class="k" style="margin-top:4px">${esc(TF('+ douane / TVA ≈ {a}', { a: euro(r.duty) }))}</div>` : ''}</div>
    <div class="tile"><div class="k">Tu économises (vs chaque carte au moins cher)</div><div class="v" style="color:${saving > 0.005 ? 'var(--ok)' : 'var(--mut)'}">${saving > 0.005 ? euro(saving) : '0 €'}</div></div>
  </div>`;

  // comparaison des stratégies
  const best = Math.min(r.total, r.naive.total, r.single ? r.single.total : Infinity);
  const hasDuty = r.duty > 0.004 || r.naive.duty > 0.004 || (r.single && r.single.duty > 0.004);
  const dutyCell = (d) => (hasDuty ? `<td class="r">${d == null ? '—' : euro(d)}</td>` : '');
  const row = (label, a, b, c, isBest, d) => `<tr class="${isBest ? 'best' : ''}"><td>${label}</td><td class="r">${a}</td><td class="r">${b}</td>${dutyCell(d)}<td class="r">${c}</td></tr>`;
  h += `<div class="panel"><h3>Comparaison</h3><table class="t">
    <tr><th>Stratégie</th><th class="r">Cartes</th><th class="r">Port</th>${hasDuty ? `<th class="r">${esc(T('Douane / TVA'))}</th>` : ''}<th class="r">Total</th></tr>
    ${row(I18N.getLang() === 'fr' ? `🏆 Meilleur panier — ${r.orders.length} commande${r.orders.length > 1 ? 's' : ''}` : TF('🏆 Meilleur panier — {n} commande(s)', { n: r.orders.length }), euro(r.items), euro(r.ship), euro(r.total), r.total <= best + 1e-9, r.duty)}
    ${row('Chaque carte chez le moins cher (sans regarder le port)', euro(r.naive.items), euro(r.naive.ship), euro(r.naive.total), false, r.naive.duty)}
    ${r.single
      ? row(`Tout chez un seul vendeur : <a href="${esc(sellerUrl(r.single.seller, game))}" target="_blank">${esc(r.single.seller)}</a>`, euro(r.single.items), euro(r.single.ship), euro(r.single.total), false, r.single.duty)
      : row(`Tout chez un seul vendeur : <span class="muted">personne n'a tout (le meilleur en a ${r.top[0] ? r.top[0].covered : 0}/${nAvail})</span>`, '—', '—', '—', false, null)}
  </table></div>`;

  // commandes
  const nArt = r.orders.reduce((a, o) => a + o.n, 0);
  h += `<div class="cartbar"><button class="btn primary" data-cart="all">${TP(`🛒 Tout ajouter à mon panier Cardmarket (${nArt} carte${nArt > 1 ? 's' : ''})`, '🛒 Tout ajouter à mon panier Cardmarket ({n} carte(s))', { n: nArt })}</button>
    <span class="muted">⚠ Les modes de livraison ne sont pas sélectionnés : tu dois les choisir toi-même dans ton panier Cardmarket avant de payer.</span></div>`;
  h += `<h2 class="sectionTitle">🛒 Les commandes à passer</h2>`;
  h += r.orders.map((o, k) => `<div class="order ${k > 2 ? 'closed' : ''}">
      <div class="oh" data-toggle>
        <span class="chev">▾</span>
        <div><div class="who"><a href="${esc(sellerUrl(o.seller, game))}" target="_blank">${esc(o.seller)}</a></div>
          <div class="tags"><span class="tag">${TP(`${o.n} carte${o.n > 1 ? 's' : ''}`, '{n} carte(s)', { n: o.n })}</span><span class="tag ok">${esc(o.shipName)} ${euro(o.ship)}</span>${o.tracked ? '<span class="tag warn">envoi suivi seulement</span>' : ''}${o.duty > 0.004 ? `<span class="tag warn" title="${esc(T('Vendeur hors de ta zone douanière : TVA à l\'import + droit de douane / frais de dédouanement (estimation)'))}">${esc(TF('douane ≈ {a}', { a: euro(o.duty) }))}</span>` : ''}</div></div>
        <div class="tot"><b>${euro(o.total)}</b><span>${euro(o.items)} + port ${euro(o.ship)}${o.duty > 0.004 ? ` + ${esc(T('douane'))} ${euro(o.duty)}` : ''}</span></div>
        <button class="btn ghost sm" data-cart="${esc(o.seller)}" title="Ajouter seulement cette commande au panier Cardmarket">🛒 Ajouter</button>
      </div>
      <div class="ob"><table class="t fixed"><colgroup><col style="width:52%"><col style="width:20%"><col style="width:14%"><col style="width:14%"></colgroup>
        <tr><th>Carte</th><th>État / langue</th><th class="r">Prix</th><th class="r">Sous-total</th></tr>
        ${o.lines.map(({ line, opt, missing }) => `<tr>
          <td><a href="${esc(ORIGIN + line.url)}" target="_blank">${esc(line.name)}</a> ${line.qty > 1 ? `<span class="muted">×${line.qty}</span>` : ''}${missing ? ` <span class="tag bad">manque ${missing}</span>` : ''}</td>
          <td class="muted">${esc([...new Set(opt.picked.map((p) => [p.cond, p.lang].filter(Boolean).join(' ')))].join(' · '))}</td>
          <td class="r">${opt.picked.map((p) => euro(p.price) + (p.take > 1 ? ` ×${p.take}` : '')).join(' + ')}</td>
          <td class="r"><b>${euro(opt.cost)}</b></td></tr>`).join('')}
      </table></div>
    </div>`).join('');

  // top vendeurs
  h += `<h2 class="sectionTitle">📊 Top vendeurs <span class="muted" style="font-size:13px;font-weight:normal">— une seule commande chez eux pour ce qu'ils ont</span></h2>
    <div class="panel"><table class="t">
      <tr><th>#</th><th>Vendeur</th><th class="r">Cartes</th><th class="r">Prix cartes</th><th class="r">Port</th><th class="r">Total</th><th class="r">€ / carte</th></tr>
      ${r.top.map((t, i) => `<tr>
        <td class="muted">${i + 1}</td>
        <td><a href="${esc(sellerUrl(t.seller, game))}" target="_blank">${esc(t.seller)}</a>${t.tracked ? ' <span class="tag warn">suivi</span>' : ''}</td>
        <td class="r"><b>${t.covered}</b>/${nAvail}</td>
        <td class="r">${euro(t.items)}</td>
        <td class="r">${euro(t.ship)} <span class="muted">${esc(t.shipName)}</span>${t.duty > 0.004 ? `<br><span class="muted">+ ${esc(T('douane'))} ${euro(t.duty)}</span>` : ''}</td>
        <td class="r"><b>${euro(t.total)}</b></td>
        <td class="r">${euro(t.total / t.n)}</td></tr>`).join('')}
    </table></div>`;

  const sideUnavail = r.unavailable.length ? `<aside class="unavail"><h3>🚫 ${esc(T('Introuvable avec tes filtres'))} <span>${r.unavailable.length}</span></h3>
    <p class="muted">${esc(T('(pays des vendeurs, langue, état…)'))}</p>
    <ul>${r.unavailable.map((l) => `<li><a href="${esc(ORIGIN + l.url)}" target="_blank">${esc(l.name)}</a></li>`).join('')}</ul></aside>` : '';
  const sideCart = lastCartFailed.length ? `<aside class="unavail cartfail"><h3>🛒 ${esc(T('Pas ajoutés au panier'))} <span>${lastCartFailed.length}</span></h3>
    <p class="muted">${esc(T('(souvent : déjà vendus entre-temps, re-scanne ces cartes puis réessaie)'))}</p>
    <button class="btn sm warnbtn" data-rescanfailed>${esc(T('🔁 Re-scanner ces cartes'))}</button>
    <ul>${lastCartFailed.map((f) => `<li><a href="${esc(ORIGIN + f.url)}" target="_blank">${esc(f.name)}</a>${f.take > 1 ? ` ×${f.take}` : ''}<div class="muted">${esc(f.seller)} · ${esc(f.reason)}</div></li>`).join('')}</ul></aside>` : '';
  const side = sideUnavail || sideCart ? `<div class="sidecol">${sideUnavail}${sideCart}</div>` : '';
  $('best').innerHTML = `<div class="bestMain">${h}</div>${side}`;
  $('best').classList.toggle('withSide', !!side);
  const scope = !settings.sellerCountries.length ? 'vendeurs de tous les pays' : settings.sellerCountries.length === 1 ? 'vendeurs : ' + countryName(settings.sellerCountries[0]) : settings.sellerCountries.length + ' pays de vendeurs';
  $('bestSub').textContent = `${n} carte${n > 1 ? 's' : ''} · ${scope} · livré en ${countryName(settings.myCountry)} · frais de port officiels Cardmarket${settings.alwaysTracked ? ' · toujours en suivi' : ''}${settings.customs ? ' · ' + T('douane comptée (estimation)') : ''}`;
}

// ---------- Vue : Réglages ----------
function renderSettings() {
  document.querySelectorAll('[data-s]').forEach((el) => {
    const v = settings[el.dataset.s];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
  });
  const own = shipTables[`${settings.myCountry}_${settings.myCountry}`];
  $('letterInfo').innerHTML = Array.isArray(own) && own.length
    ? `<b>Tarifs officiels ${esc(countryName(settings.myCountry))} → ${esc(countryName(settings.myCountry))}</b> (mis à jour tout seuls) :<br>` +
      [[4, 5], [17, 20], [40, 30], [80, 60]].map(([n, v]) => { const x = Optimizer.shipping(n, v, false, settings, own); return `${n} cartes (${v} €) : ${esc(x.name)} ${euro(x.cost)}`; }).join('<br>') +
      `<br><span class="muted">Lettre 20 g = 4 cartes, 50 g = 17, 100 g = 40. Suivi obligatoire au-dessus de 25 €. Chaque vendeur a les tarifs de SON pays vers le tien.</span>`
    : 'Tarifs officiels pas encore chargés (ils se chargent au calcul du panier). En attendant, les tarifs manuels ci-dessous sont utilisés.';
  $('defLangs').innerHTML = LANGS.map(([n, c]) => `<span class="chip ${settings.defaultLangs.includes(n) ? 'on' : ''}" data-deflang="${esc(n)}" title="${esc(n)}">${c}</span>`).join('');
  $('defCond').innerHTML = `<option value="">Tous états</option>` + CONDS.slice(0, 6).map(([k, l]) => `<option value="${k}" ${settings.defaultCond === k ? 'selected' : ''}>${TF('{c} et mieux', { c: `${k} (${l})` })}</option>`).join('');
  // pays
  const opts = COUNTRIES.map(([id, n]) => `<option value="${id}" ${+settings.myCountry === id ? 'selected' : ''}>${esc(cLabel(id, n))}</option>`).join('');
  document.querySelectorAll('select[data-s="myCountry"]').forEach((el) => { el.innerHTML = opts; el.value = String(settings.myCountry); el.disabled = !!settings.countryFromLang; el.title = settings.countryFromLang ? T('Même pays que la langue de l\'extension') : ''; });
  $('countryFromLang').checked = !!settings.countryFromLang;
  $('uiLang').innerHTML = I18N.LANGS.map(([c, n, f]) => `<option value="${c}" ${settings.uiLang === c ? 'selected' : ''}>${f} ${n}</option>`).join('');
  const sc = settings.sellerCountries;
  $('sellerChips').innerHTML = COUNTRIES.map(([id, n]) => `<span class="chip ${sc.includes(id) ? 'on' : ''}" data-sellerc="${id}">${esc(cLabel(id, n))}</span>`).join('');
  $('sellerScope').value = !sc.length ? 'all' : sc.length === 1 && sc[0] === +settings.myCountry ? 'mine' : 'custom';
  $('sellerScope').querySelector('[value=custom]').textContent = sc.length && !(sc.length === 1 && sc[0] === +settings.myCountry) ? `Choisis (${sc.length} pays)…` : 'Choisir des pays…';
  const bl = Object.keys(blocked).sort();
  $('nBlocked').textContent = bl.length ? `(${bl.length})` : '';
  $('blockedList').innerHTML = bl.length ? bl.map((s) => `<span class="chip on" data-unblock="${esc(s)}" title="Débloquer">${esc(s)} ✕</span>`).join('') : '<span class="muted">Aucun. Bloque un vendeur avec 🚫 sur une page Cardmarket.</span>';
  $('nIgnored').textContent = `${Object.keys(ignored).length} offre(s)`;
}

// ---------- UI générale ----------
// Redessiner toute la liste coûte cher quand il y a beaucoup de cartes (≈ 0,5 s pour 1000) :
// pendant un scan on le fait au plus toutes les 3 s au lieu d'à chaque carte, sinon ça ralentit le scan.
let renderTimer = null;
function renderSoon() {
  if (renderTimer) return;
  renderTimer = setTimeout(() => { renderTimer = null; renderCounts(); renderScanned(); }, 3000);
}
function renderCounts() {
  $('nScanned').textContent = Object.keys(list).length;
}
function renderAll() {
  renderCounts(); renderScanned(); renderSettings();
  if (!$('v-best').hidden) refreshBest();
}
function switchView(v) {
  document.querySelectorAll('.nav').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view').forEach((s) => (s.hidden = s.id !== 'v-' + v));
  if (v === 'best') refreshBest();
  if (v === 'settings') ensureShipTables().then(renderSettings);
  if (v === 'shipping') renderShipping();
}
async function refreshBest() {
  $('best').innerHTML = '<div class="empty">Chargement des frais de port officiels…</div>';
  await ensureShipTables();
  compute(); renderBest(); renderSettings();
}
// Messages en haut de la page : ✕ pour fermer ; le mot "Cardmarket" est un lien vers le site
const CM_LINK = '<a href="https://www.cardmarket.com" target="_blank" class="cmlink" title="Aller sur Cardmarket">Cardmarket</a>';
let bannerKey = null, closedKey = null;
function showBanner(html, key) { // key = identifiant du message : fermé avec ✕, il ne revient pas tant que c'est le même message
  if (!key || !String(key).startsWith('logout-')) $('banner').classList.remove('err');
  if (!html) { $('banner').hidden = true; $('bannerMsg').innerHTML = ''; bannerKey = null; return; }
  key = key || html;
  if (closedKey === key) return;
  bannerKey = key;
  $('banner').hidden = false;
  $('bannerMsg').innerHTML = html;
}
function banner(t, key) { showBanner(t ? esc(t).replace(/\bCardmarket\b/g, CM_LINK).replace(/\n/g, '<br>') : null, key); }
function bannerHtml(h, key) { showBanner(h, key); } // (texte écrit par l'extension seulement)
$('bannerClose').addEventListener('click', () => { closedKey = bannerKey; $('banner').hidden = true; });

// ---------- Événements ----------
document.querySelectorAll('.nav').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
$('qScan').addEventListener('input', renderScanned);
$('calcBtn').addEventListener('click', () => switchView('best'));
$('recalcBtn').addEventListener('click', refreshBest);
// (tout cocher / décocher agit sur les cartes affichées : catégorie + recherche)
$('allOn').addEventListener('click', () => { visibleItems().forEach((it) => (it.checked = true)); saveList(); renderScanned(); });
$('allOff').addEventListener('click', () => { visibleItems().forEach((it) => (it.checked = false)); saveList(); renderScanned(); });
$('bulkCat').addEventListener('change', (e) => {
  let v = e.target.value;
  if (v === '__label') return;
  if (v === '__new') v = newCategory();
  if (v === null) return renderScanned();
  const checked = items().filter((it) => it.checked);
  if (!checked.length) { banner('Coche d\'abord les cartes à ranger.'); return renderScanned(); }
  checked.forEach((it) => (it.cat = v === '__clear' ? '' : v));
  saveList(); renderScanned();
});
// langue voulue en haut : s'applique à toutes les cartes
$('topLangs').addEventListener('click', (e) => {
  const c = e.target.closest('[data-toplang]'); if (!c) return;
  const l = c.dataset.toplang;
  const cur = settings.defaultLangs || [];
  settings.defaultLangs = !l ? [] : cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l];
  items().forEach((it) => { it.langs = [...settings.defaultLangs]; });
  saveSettings(); saveList(); renderScanned(); renderSettings();
});
$('catBar').addEventListener('click', (e) => {
  const v = e.target.closest('[data-viewcat]');
  if (v) { viewCat = v.dataset.viewcat; return renderScanned(); }
  const a = e.target.closest('[data-catact]')?.dataset.catact;
  if (a === 'new') { const n = newCategory(); if (n) viewCat = n; renderScanned(); }
  if (a === 'rename') {
    const n = (prompt('Nouveau nom :', viewCat) || '').trim();
    if (n && n !== viewCat) {
      cats = cats.map((c) => (c === viewCat ? n : c)).filter((c, i, arr) => arr.indexOf(c) === i);
      items().forEach((it) => { if (it.cat === viewCat) it.cat = n; });
      viewCat = n; saveCats(); saveList(); renderScanned();
    }
  }
  if (a === 'delete' && confirm(`Supprimer la catégorie « ${viewCat} » ? (les cartes restent, sans catégorie)`)) {
    items().forEach((it) => { if (it.cat === viewCat) it.cat = ''; });
    cats = cats.filter((c) => c !== viewCat);
    viewCat = ''; saveCats(); saveList(); renderScanned();
  }
});
function bulkScan(its) {
  const todo = its.filter((it) => !scanFresh(it));
  const skip = its.length - todo.length;
  if (!todo.length && skip) return banner(TF('Déjà à jour : {n} carte(s) scannée(s) il y a moins de {h} h avec les mêmes filtres (↻ sur une carte pour forcer).', { n: skip, h: settings.freshHours }));
  startScan(todo.map((it) => it.id));
  if (skip) banner(TF('{n} carte(s) déjà à jour pas re-scannée(s) (moins de {h} h) — 0 requête pour elles.', { n: skip, h: settings.freshHours }));
}
$('scanSel').addEventListener('click', () => bulkScan(items().filter((it) => it.checked)));
$('scanAll').addEventListener('click', () => bulkScan(items()));
// re-scan forcé des cartes refusées par le panier (même si elles ont été scannées il y a peu : les offres ont changé)
const rescanCartFailed = () => { const ids = cartFailedIds(); if (ids.length) startScan(ids); };
$('scanFailed').addEventListener('click', rescanCartFailed);
document.addEventListener('click', (e) => { if (e.target.closest('[data-rescanfailed]')) { switchView('scanned'); rescanCartFailed(); } });
$('stopBtn').addEventListener('click', () => { job.queue = []; job.active = false; renderProgress(); $('progText').textContent = 'Arrêt…'; });
$('clearAll').addEventListener('click', () => {
  if (!confirm('Effacer toutes les cartes et leurs scans ?')) return;
  chrome.storage.local.remove([...Object.keys(scans).map((id) => 'scan_' + id), 'cmPlan']);
  list = {}; scans = {};
  saveList(); renderAll();
});

$('scanRows').addEventListener('change', (e) => {
  const row = e.target.closest('.row'); if (!row) return;
  const it = list[row.dataset.id];
  if (e.target.matches('[data-chk]')) { it.checked = e.target.checked; e.target.closest('.row')?.classList.toggle('off', !it.checked); }
  if (e.target.matches('[data-qty]')) it.qty = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1));
  if (e.target.matches('[data-cond]')) it.cond = e.target.value;
  if (e.target.matches('[data-cat]')) {
    const v = e.target.value === '__new' ? newCategory() : e.target.value;
    if (v !== null) it.cat = v;
  }
  saveList(); renderScanned();
});
$('scanRows').addEventListener('click', (e) => {
  const row = e.target.closest('.row'); if (!row) return;
  const id = row.dataset.id, it = list[id];
  const chip = e.target.closest('[data-lang]');
  if (chip) {
    const l = chip.dataset.lang;
    const cur = [...cardLangs(it)];
    it.langs = !l ? [] : cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l];
    saveList(); renderScanned();
    return;
  }
  if (e.target.closest('[data-rescan]')) return startScan([id]);
  if (e.target.closest('[data-rm]')) {
    delete list[id]; delete scans[id];
    chrome.storage.local.remove('scan_' + id);
    saveList(); renderAll();
  }
});

$('best').addEventListener('click', (e) => {
  const c = e.target.closest('[data-cart]');
  if (c && lastResult) {
    e.stopPropagation();
    const orders = c.dataset.cart === 'all' ? lastResult.r.orders : lastResult.r.orders.filter((o) => o.seller === c.dataset.cart);
    return addToCart(orders);
  }
  const t = e.target.closest('[data-toggle]');
  if (t && !e.target.closest('a')) t.parentElement.classList.toggle('closed');
});

// réglages (y compris les copies dans "Cartes scannées" et "Meilleur panier")
document.addEventListener('change', (e) => {
  const k = e.target.dataset.s; if (!k) return;
  settings[k] = e.target.type === 'checkbox' ? e.target.checked : (k === 'defaultCond' ? e.target.value : parseFloat(e.target.value) || 0);
  if (k === 'myCountry') { // nouveau pays de livraison : "mon pays" suit, et on charge ses tarifs
    if (settings.sellerCountries.length === 1) settings.sellerCountries = [settings.myCountry];
    ensureShipTables().then(() => { renderSettings(); renderScanned(); });
  }
  saveSettings(); renderSettings(); renderScanned();
  if (!$('v-best').hidden) refreshBest();
});
$('v-settings').addEventListener('click', (e) => {
  const dl = e.target.closest('[data-deflang]');
  if (dl) {
    const l = dl.dataset.deflang;
    settings.defaultLangs = settings.defaultLangs.includes(l) ? settings.defaultLangs.filter((x) => x !== l) : [...settings.defaultLangs, l];
    saveSettings(); renderSettings(); renderScanned();
  }
  const ub = e.target.closest('[data-unblock]');
  if (ub) { delete blocked[ub.dataset.unblock]; chrome.storage.local.set({ cmBlocked: blocked }); renderSettings(); }
});
$('sellerScope').addEventListener('change', (e) => {
  const v = e.target.value;
  if (v === 'all') settings.sellerCountries = [];
  else if (v === 'mine') settings.sellerCountries = [+settings.myCountry];
  else { switchView('settings'); $('sellerChips').scrollIntoView({ block: 'center' }); return; }
  saveSettings(); renderSettings(); renderScanned();
});
$('sellerChips').addEventListener('click', (e) => {
  const c = e.target.closest('[data-sellerc]'); if (!c) return;
  const id = +c.dataset.sellerc, cur = settings.sellerCountries;
  settings.sellerCountries = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  saveSettings(); renderSettings(); renderScanned();
});
$('allCountries').addEventListener('click', () => { settings.sellerCountries = []; saveSettings(); renderSettings(); renderScanned(); });
$('myCountryOnly').addEventListener('click', () => { settings.sellerCountries = [+settings.myCountry]; saveSettings(); renderSettings(); renderScanned(); });
$('applyDefaults').addEventListener('click', () => {
  items().forEach((it) => { it.langs = [...settings.defaultLangs]; it.cond = settings.defaultCond; });
  saveList(); renderScanned();
});
$('resetIgnored').addEventListener('click', () => { ignored = {}; chrome.storage.local.set({ cmIgnored: {} }); renderAll(); });

// Mise à jour en direct (scan sur Cardmarket, onglets en arrière-plan, ✕ / 🚫 sur les pages)
chrome.storage.onChanged.addListener((ch) => {
  let changed = false;
  if (ch.cmList) { list = ch.cmList.newValue || {}; changed = true; }
  if (ch.cmIgnored) { ignored = ch.cmIgnored.newValue || {}; changed = true; }
  if (ch.cmBlocked) { blocked = ch.cmBlocked.newValue || {}; changed = true; }
  if (ch.cmCats) { cats = ch.cmCats.newValue || []; changed = true; }
  for (const k of Object.keys(ch)) {
    if (k.startsWith('scan_')) {
      const id = k.slice(5);
      if (ch[k].newValue) { scans[id] = ch[k].newValue; if (ch[k].newValue.loggedOut) job.loggedOut = true; } else delete scans[id];
      changed = true;
    }
  }
  if (changed) { if (job.active) renderSoon(); else renderAll(); } // pendant un scan : la liste est redessinée au plus toutes les 3 s
});
window.addEventListener('beforeunload', () => { if (job.workerTab != null) chrome.tabs.remove(job.workerTab).catch(() => {}); });


// ---------- Vue : Frais de port (tous les pays) ----------
function shipMethodsTable(methods) {
  if (methods === null) return '<div class="empty">Impossible de charger les tarifs (pas de réseau ?).</div>';
  if (!methods || !methods.length) return '<div class="empty">Cardmarket n\'envoie pas entre ces deux pays.</div>';
  const rows = methods.slice().sort((a, b) => a.price - b.price);
  return `<table class="t"><tr><th>Mode d'envoi</th><th>Suivi</th><th class="r">Valeur max</th><th class="r">Poids max</th><th class="r">Cartes max</th><th class="r">Prix</th></tr>
    ${rows.map((m) => `<tr><td>${esc(m.name)}</td><td>${m.tracked ? '✅' : '—'}</td><td class="r">${isFinite(m.maxValue) ? euro(m.maxValue) : '—'}</td><td class="r">${m.maxWeight} g</td>
      <td class="r">${m.maxWeight >= 100 && m.maxWeight < 250 ? 40 : m.maxWeight >= 50 && m.maxWeight < 100 ? 17 : m.maxWeight >= 20 && m.maxWeight < 50 ? 4 : '≈ ' + Math.floor((m.maxWeight - 30) / 2.5)}</td>
      <td class="r"><b>${euro(m.price)}</b></td></tr>`).join('')}</table>`;
}
// résumé d'un trajet : lettre (≤4 cartes) / lettre suivie / colis 40 cartes
function shipSummary(methods) {
  if (!Array.isArray(methods)) return '<span class="muted">…</span>';
  if (!methods.length) return '<span class="muted">pas d\'envoi</span>';
  const S = { ...settings, alwaysTracked: false };
  const a = Optimizer.shipping(4, 5, false, S, methods), b = Optimizer.shipping(4, 5, true, S, methods), c = Optimizer.shipping(40, 30, false, S, methods);
  return `${euro(a.cost)} <span class="muted">·</span> ${euro(b.cost)} <span class="muted">·</span> ${euro(c.cost)}`;
}
async function renderShipping() {
  const opts = (sel) => COUNTRIES.map(([id, n]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
  if (!$('shipFrom').options.length) { $('shipFrom').innerHTML = opts(+settings.myCountry); $('shipTo').innerHTML = opts(+settings.myCountry); }
  const from = +$('shipFrom').value, to = +$('shipTo').value;
  $('shipTable').innerHTML = '<div class="muted">Chargement…</div>';
  const tbl = await loadShipTable(from, to);
  $('shipTable').innerHTML = shipMethodsTable(tbl) + customsExplain(from, to, tbl);
  const me = +settings.myCountry;
  $('toMeTitle').textContent = `Tous les pays → ${countryName(me)}`;
  $('fromMeTitle').textContent = `${countryName(me)} → tous les pays`;
  const head = '<tr><th>Pays</th><th class="r">Lettre 4 cartes · suivie · 40 cartes</th></tr>';
  const draw = async (elId, pair) => {
    $(elId).innerHTML = `<table class="t">${head}${COUNTRIES.map(([id, n]) => `<tr data-pair="${pair(id).join('_')}"><td>${esc(n)}</td><td class="r" data-sum></td></tr>`).join('')}</table>`;
    for (const [id] of COUNTRIES) {
      const [f, t] = pair(id);
      const cached = Array.isArray(shipTables[`${f}_${t}`]);
      const m = await loadShipTable(f, t);
      const cell = $(elId).querySelector(`tr[data-pair="${f}_${t}"] [data-sum]`);
      if (cell) cell.innerHTML = shipSummary(m);
      if (!cached) await sleep(350); // doucement avec le site d'aide Cardmarket
    }
  };
  draw('toMe', (id) => [id, me]);
  draw('fromMe', (id) => [me, id]);
}
// télécharger TOUS les trajets (35 × 35), doucement, gardés 14 jours
let dlShipRunning = false;
async function downloadAllShipping() {
  if (dlShipRunning) { dlShipRunning = false; return; }
  dlShipRunning = true;
  $('dlAllShip').textContent = '⏹ Arrêter le téléchargement';
  $('dlShipInfo').hidden = false;
  const pairs = [];
  for (const [f] of COUNTRIES) for (const [t] of COUNTRIES) pairs.push([f, t]);
  let done = 0, fetched = 0;
  for (const [f, t] of pairs) {
    if (!dlShipRunning) break;
    const had = Array.isArray(shipTables[`${f}_${t}`]) || (await chrome.storage.local.get(`ship_${f}_${t}`))[`ship_${f}_${t}`];
    await loadShipTable(f, t);
    done++;
    if (!had) { fetched++; await sleep(700); } // doucement avec le site d'aide
    $('dlShipInfo').textContent = `⬇ Tarifs : ${done}/${pairs.length} trajets (${countryName(f)} → ${countryName(t)})…`;
  }
  $('dlShipInfo').textContent = dlShipRunning ? `✔ Tous les tarifs sont téléchargés (${pairs.length} trajets, ${fetched} nouveaux). Ils sont gardés 14 jours.` : `Téléchargement arrêté (${done}/${pairs.length}).`;
  dlShipRunning = false;
  $('dlAllShip').textContent = '⬇ Télécharger tous les tarifs';
}
$('shipFrom').addEventListener('change', renderShipping);
$('shipTo').addEventListener('change', renderShipping);
$('shipSwap').addEventListener('click', () => { const f = $('shipFrom').value; $('shipFrom').value = $('shipTo').value; $('shipTo').value = f; renderShipping(); });
$('dlAllShip').addEventListener('click', downloadAllShipping);
$('v-shipping').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-pair]'); if (!tr) return;
  const [f, t] = tr.dataset.pair.split('_');
  $('shipFrom').value = f; $('shipTo').value = t; renderShipping();
  $('shipTable').scrollIntoView({ block: 'center' });
});
// image introuvable -> logo à la place
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName === 'IMG' && !img.classList.contains('noimg')) { img.classList.add('noimg'); img.src = 'icons/96.png'; }
}, true);

// Démarrage
// ---------- Export / import (tout sauf les scans) ----------
const BACKUP_KEYS = ['cmList', 'cmCats', 'cmSettings', 'cmIgnored', 'cmBlocked'];
$('exportBtn').addEventListener('click', async () => {
  const d = await chrome.storage.local.get(BACKUP_KEYS);
  const file = { app: 'tcg-price-hunter', format: 1, date: new Date().toISOString(), data: d };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }));
  a.download = 'tcg-price-hunter-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  banner(TF('Sauvegarde exportée : {n} carte(s), catégories et réglages (sans les scans).', { n: Object.keys(d.cmList || {}).length }));
});
$('importBtn').addEventListener('click', () => { if (job.active) return banner('Un scan ou un ajout est en cours, attends la fin.'); $('importFile').value = ''; $('importFile').click(); });
$('importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  let file;
  try { file = JSON.parse(await f.text()); } catch { return banner(T('Fichier illisible : ce n\'est pas une sauvegarde TCG Price Hunter.')); }
  if (!file || !['tcg-price-hunter', 'panier-malin'].includes(file.app) || !file.data || typeof file.data.cmList !== 'object') return banner(T('Fichier illisible : ce n\'est pas une sauvegarde TCG Price Hunter.'));
  const n = Object.keys(file.data.cmList).length;
  if (!confirm(TF('Importer cette sauvegarde ({n} carte(s)) ?\n\nTa liste, tes catégories et tes réglages actuels seront remplacés. Les cartes reviennent « pas encore scannées ».', { n }))) return;
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('scan_') || k === 'cmPlan'));
  const data = {};
  for (const k of BACKUP_KEYS) if (file.data[k] != null) data[k] = file.data[k];
  await chrome.storage.local.set(data);
  location.reload();
});

// ---------- Langue de l'extension ----------
const ID_ISO = Object.fromEntries(Object.entries(REGION_ID).filter(([k]) => k !== 'UK').map(([k, v]) => [v, k]));
let regionNames = null;
function cLabel(id, fr) { // nom du pays dans la langue de l'extension
  if (settings.uiLang === 'fr' || !ID_ISO[id]) return fr;
  try { regionNames = regionNames && regionNames.lang === settings.uiLang ? regionNames : Object.assign(new Intl.DisplayNames([settings.uiLang], { type: 'region' }), { lang: settings.uiLang }); return regionNames.of(ID_ISO[id]) || fr; } catch { return fr; }
}
$('uiLang').addEventListener('change', (e) => {
  settings.uiLang = e.target.value;
  if (settings.countryFromLang) { settings.myCountry = countryForLang(settings.uiLang, settings.uiRegion); if (settings.sellerCountries.length === 1) settings.sellerCountries = [settings.myCountry]; }
  saveSettings();
  location.reload(); // tout se réaffiche dans la nouvelle langue
});
$('countryFromLang').addEventListener('change', (e) => {
  settings.countryFromLang = e.target.checked;
  if (settings.countryFromLang) {
    settings.myCountry = countryForLang(settings.uiLang, settings.uiRegion);
    if (settings.sellerCountries.length === 1) settings.sellerCountries = [settings.myCountry];
    ensureShipTables().then(() => { renderSettings(); renderScanned(); });
  }
  saveSettings(); renderSettings(); renderScanned();
});
// ---------- Thème clair / sombre (auto = comme le navigateur) ----------
function applyTheme() { document.documentElement.dataset.theme = 'dark'; } // un seul thème : sombre

// traduit la page et tout ce qui s'affiche ensuite
function startI18n() {
  document.documentElement.lang = settings.uiLang;
  if (settings.uiLang === 'fr') return;
  I18N.translateTree(document.body);
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) I18N.translateTree(n);
      else if (n.nodeType === 3 && n.parentNode) I18N.translateTree(n.parentNode);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

// fond : les vraies cartes de ta liste (images Cardmarket) à la place des dos de carte
function decorateBg() {
  const imgs = [...new Set(Object.values(list).map((it) => it.img).filter(Boolean))];
  for (let i = imgs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [imgs[i], imgs[j]] = [imgs[j], imgs[i]]; }
  const slots = [...document.querySelectorAll('#bgfx .fx-hand .fx-card'), ...document.querySelectorAll('#bgfx .fx-fl'), ...document.querySelectorAll('#bgfx .fx-fly')];
  slots.forEach((el, k) => {
    const src = imgs.length ? imgs[k % imgs.length] : '';
    el.classList.toggle('real', !!src && (k < imgs.length || imgs.length >= 3));
    el.style.backgroundImage = el.classList.contains('real') ? `url("${imgUrl(src).replace(/"/g, '%22')}")` : '';
  });
}

chrome.storage.local.get('cmReqLog').then((d) => { reqLog = d.cmReqLog || []; const n = $('nReqLog'); if (n) n.textContent = reqLog.length; });
$('exportReqLog').addEventListener('click', exportReqLog);
$('cpStop').addEventListener('click', () => $('stopBtn').click());
$('clearReqLog').addEventListener('click', () => { reqLog = []; chrome.storage.local.set({ cmReqLog: [] }); $('nReqLog').textContent = 0; });

loadAll().then(() => { applyTheme(); startI18n(); renderAll(); decorateBg(); });

// numéro de version affiché sous le logo (BETA tant que la version n'est pas validée)
try { const m = (globalThis.browser || globalThis.chrome).runtime.getManifest(); const vt = document.getElementById('verTag'); if (vt) vt.textContent = 'v' + m.version + (BETA ? ' BETA' : ''); } catch (e) {}
