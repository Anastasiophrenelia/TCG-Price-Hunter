/*!
 * TCG Price Hunter — © 2026 Anastasiophrenelia. Tous droits réservés.
 * https://github.com/Anastasiophrenelia/TCG-Price-Hunter
 * Toute copie, modification ou redistribution sans autorisation écrite de l'auteur est interdite (voir LICENSE).
 */
// ===== TCG Price Hunter — page principale (cartes scannées, meilleur panier, réglages) =====
const ORIGIN = 'https://www.cardmarket.com';
const START_GAP = 1200;       // ms entre 2 requêtes par défaut : 50 par minute
const BETA = false;           // version de test : affiche « BETA » à côté du numéro
const CART_GAP = 1000;
const MAX_OFFERS = 300, MAX_SLICES = 9, MAX_SLICES_LONG = 60; // MAX_SLICES : pages en plus par carte au maximum (ton pays découpé + les autres pays ensemble)

const MAX_PER_MIN = 280;      // pages Cardmarket par minute, par défaut (réglable dans les Réglages : 30 à 1000)
const maxPerMin = () => Math.min(1000, Math.max(30, Math.round(+settings?.pagesPerMin || MAX_PER_MIN)));
const baseGap = () => Math.ceil(60000 / maxPerMin()); // 280 / min ≈ 215 ms minimum entre deux requêtes ; sinon la suivante part dès qu'une carte est finie
// vitesse par rapport au réglage par défaut (au-dessus, Cardmarket répond moins vite que la limite : on plafonne l'estimation)
// erreurs 1015 des 7 derniers jours (une par scan / import au plus) : si elles reviennent souvent, Cardmarket limite
// sans doute le nombre de pages que ton compte peut charger -> on prévient (bandeau 1015 + Réglages)
function note1015() {
  if (job.noted1015 === job.t0) return;
  job.noted1015 = job.t0;
  settings.hits1015 = (settings.hits1015 || []).filter((d) => Date.now() - d < 7 * 864e5).concat(Date.now());
  saveSettings();
}
const freq1015 = () => (settings.hits1015 || []).filter((d) => Date.now() - d < 7 * 864e5).length;
const warn1015Text = () => TF('⚠ {n} erreur(s) 1015 ces 7 derniers jours : Cardmarket limite sans doute le nombre de pages que ton compte peut charger. Tant que cette limite est là, l\'extension ne pourra pas scanner normalement avec ce compte.', { n: freq1015() });
const rateFactor = () => Math.min(1.6, maxPerMin() / MAX_PER_MIN);
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
  settings = { ...Optimizer.DEFAULTS, maxOffers: 50, freshHours: 0, pagesPerMin: MAX_PER_MIN, concurrency: 3, avgScanSec: 8, customs: true, minRating: 0, defaultLangs: [], defaultCond: '', ...(d.cmSettings || {}) };
  if (!settings.v714) { settings.concurrency = 3; settings.maxOffers = 50; settings.freshHours = 0; settings.v714 = true; }
  if (!settings.v69) { settings.maxOffers = 50; if (settings.freshHours == null) settings.freshHours = 6; settings.v69 = true; } // 1 requête par carte
  if (!settings.v101) { settings.concurrency = 3; settings.v101 = true; }
  if (!settings.v140long) { if (!settings.scanMode || settings.scanMode === 'medium') settings.scanMode = 'long'; settings.v140long = true; } // 1.40 : Long par défaut
  settings.concurrency = 5; // toujours 5 cartes scannées en même temps (la limite de 280 pages / min reste la même)
  delete settings.reqPerMin;
  settings.maxOffers = MAX_OFFERS; // plusieurs pages filtrées par carte (pays, type de vendeur, langue), sans « Montrer plus »
  // langue de l'extension : prise UNE fois au 1er lancement (langue du navigateur, pas l'IP → un VPN ne change rien)
  if (!settings.uiLang) {
    const det = I18N.detect();
    settings.uiLang = det.lang;
    settings.uiRegion = det.region;
    chrome.storage.local.set({ cmSettings: settings });
  }
  // pays de livraison : deviné une fois (fuseau horaire + langues du navigateur), puis tu le changes librement
  if (!settings.v120) {
    settings.v120 = true;
    if (settings.countryFromLang !== false || !settings.myCountry) settings.myCountry = detectHomeCountry(); // l'ancienne case « même pays que la langue » disparaît
    delete settings.countryFromLang;
    chrome.storage.local.set({ cmSettings: settings });
  }
  I18N.setLang(settings.uiLang);
  if (!settings.myCountry) settings.myCountry = 12;                       // pays où tu te fais livrer
  if (!Array.isArray(settings.sellerCountries)) settings.sellerCountries = []; // [] = tous les pays (par défaut)
  // par défaut : pays de l'UE -> « Europe (sans douane) », sinon « seulement mon pays » (réglé une fois, puis plus besoin de toucher)
  if (!settings.v112) { settings.v112 = true; settings.sellerPreset = settings.sellerPreset === 'custom' ? 'custom' : 'auto'; }
  if (!settings.v113) { settings.v113 = true; if (settings.sellerPreset === 'nocustoms') settings.sellerPreset = 'auto'; }
  if (!settings.v130) { settings.v130 = true; settings.sellerPreset = 'europe'; chrome.storage.local.set({ cmSettings: settings }); } // 1.3 : « sans frais de douane » pour tout le monde
  if (['auto', 'europe'].includes(settings.sellerPreset)) setSellerPreset(settings.sellerPreset);
  cats = d.cmCats || [];
  ignored = d.cmIgnored || {};
  blocked = d.cmBlocked || {};
  lastCartQty = d.cmCartQty || null; cartAdj = d.cmCartAdj || null;
  lastCartFailed = (Array.isArray(d.cmCartFailed) ? d.cmCartFailed : []).map((f) => (/pas dans ton panier|not in your cart/i.test(f.reason || '') ? { ...f, check: true } : f)); // (ancienne vérification peu fiable : à vérifier, pas d'alternative)
  cartRetryIds = Array.isArray(d.cmCartRetry) ? d.cmCartRetry : [];
  cartResume = Array.isArray(d.cmCartResume) ? d.cmCartResume : [];
  cmCompare = d.cmCompare || null;
  scans = {};
  for (const k of Object.keys(d)) if (k.startsWith('scan_')) scans[k.slice(5)] = d[k];
}
// pays de livraison d'après la langue (région du navigateur si elle colle, sinon le pays principal de la langue)
const REGION_ID = { FR: 12, DE: 7, AT: 1, BE: 2, BG: 3, CA: 33, CY: 5, HR: 35, DK: 8, ES: 10, EE: 9, FI: 11, GR: 14, HU: 15, IE: 16, IS: 37, IT: 17, JP: 36, LV: 21, LI: 18, LT: 19, LU: 20, MT: 22, NO: 24, NL: 23, PL: 25, PT: 26, RO: 27, GB: 13, UK: 13, CZ: 6, SG: 29, SK: 31, SI: 30, CH: 4, SE: 28 };
const LANG_COUNTRY = { fr: 12, en: 13, de: 7, es: 10, it: 17, pt: 26, nl: 23, pl: 25 };
const LANG_REGIONS = { fr: ['FR', 'BE', 'CH', 'LU', 'CA'], en: ['GB', 'UK', 'IE', 'MT', 'CA', 'SG'], de: ['DE', 'AT', 'CH', 'LI', 'LU'], es: ['ES'], it: ['IT', 'CH'], pt: ['PT'], nl: ['NL', 'BE'], pl: ['PL'] };
function countryForLang(lang, region) {
  if (region && REGION_ID[region] && (LANG_REGIONS[lang] || []).includes(region)) return REGION_ID[region];
  return LANG_COUNTRY[lang] || 12;
}
// pays où tu habites, deviné sans IP (un VPN ne change rien) : fuseau horaire de l'ordinateur + langues du navigateur.
// Sous Windows, un fuseau couvre plusieurs pays (Europe/Berlin = Allemagne, Pays-Bas, Italie, Suisse…) : la langue départage.
const TZ_COUNTRIES = {
  'Europe/Paris': [12, 2, 10, 8], 'Europe/Berlin': [7, 23, 17, 1, 4, 28, 24, 20, 18, 22], 'Europe/Busingen': [7], 'Europe/Budapest': [15, 6, 31, 30],
  'Europe/Warsaw': [25, 35], 'Europe/Kiev': [11, 9, 21, 19, 3], 'Europe/Kyiv': [11, 9, 21, 19, 3], 'Europe/Bucharest': [27, 14, 5], 'Europe/London': [13, 16, 26],
  'Europe/Belfast': [13], 'Europe/Brussels': [2], 'Europe/Madrid': [10], 'Atlantic/Canary': [10], 'Africa/Ceuta': [10], 'Europe/Copenhagen': [8],
  'Europe/Amsterdam': [23], 'Europe/Rome': [17], 'Europe/Vienna': [1], 'Europe/Zurich': [4, 18], 'Europe/Stockholm': [28], 'Europe/Oslo': [24],
  'Europe/Luxembourg': [20], 'Europe/Vaduz': [18], 'Europe/Malta': [22], 'Europe/Prague': [6], 'Europe/Bratislava': [31], 'Europe/Ljubljana': [30],
  'Europe/Zagreb': [35], 'Europe/Helsinki': [11], 'Europe/Tallinn': [9], 'Europe/Riga': [21], 'Europe/Vilnius': [19], 'Europe/Sofia': [3],
  'Europe/Athens': [14], 'Asia/Nicosia': [5], 'Europe/Nicosia': [5], 'Asia/Famagusta': [5], 'Europe/Dublin': [16], 'Europe/Lisbon': [26],
  'Atlantic/Madeira': [26], 'Atlantic/Azores': [26], 'Atlantic/Reykjavik': [37], 'Asia/Tokyo': [36], 'Asia/Singapore': [29],
  'America/Toronto': [33], 'America/Montreal': [33], 'America/Vancouver': [33], 'America/Edmonton': [33], 'America/Winnipeg': [33],
  'America/Halifax': [33], 'America/St_Johns': [33], 'America/Regina': [33], 'America/Moncton': [33],
};
const LANG_HOME = { ...LANG_COUNTRY, sv: 28, nb: 24, nn: 24, no: 24, da: 8, cs: 6, sk: 31, sl: 30, hr: 35, hu: 15, fi: 11, et: 9, lv: 21, lt: 19, bg: 3, ro: 27, el: 14, is: 37, ga: 16, mt: 22, ja: 36, lb: 20 };
function detectHomeCountry() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
  const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).map((l) => String(l));
  const regions = langs.map((l) => REGION_ID[(l.split('-')[1] || '').toUpperCase()]).filter(Boolean); // fr-CH -> Suisse
  const fromLang = [...langs.map((l) => LANG_HOME[l.slice(0, 2).toLowerCase()]), LANG_HOME[settings.uiLang]].filter(Boolean); // de -> Allemagne
  const cands = TZ_COUNTRIES[tz];
  if (cands) return regions.find((id) => cands.includes(id)) || fromLang.find((id) => cands.includes(id)) || cands[0];
  return regions[0] || countryForLang(settings.uiLang, settings.uiRegion);
}
const T = (s) => I18N.T(s), TF = (s, v) => I18N.TF(s, v);
const TP = (fr, key, v) => (I18N.getLang() === 'fr' ? fr : TF(key, v)); // garde les vrais pluriels en français
const saveList = () => chrome.storage.local.set({ cmList: list });
const saveSettings = () => chrome.storage.local.set({ cmSettings: settings });
const saveCats = () => chrome.storage.local.set({ cmCats: cats });
// une catégorie qui avait des cartes et qui tombe à 0 (cartes supprimées ou rangées ailleurs) disparaît toute seule ;
// une catégorie créée vide (0 → 0) reste
const catCounts = () => { const m = {}; Object.values(list).forEach((it) => { if (it.cat) m[it.cat] = (m[it.cat] || 0) + 1; }); return m; };
function dropEmptiedCats(before) {
  const now = catCounts();
  const gone = cats.filter((c) => (before[c] || 0) > 0 && !now[c]);
  if (!gone.length) return;
  cats = cats.filter((c) => !gone.includes(c));
  if (gone.includes(viewCat)) viewCat = '';
  saveCats();
}
const items = () => Object.values(list).sort((a, b) => (b.added || 0) - (a.added || 0));

// ---------- Filtres des offres ----------
const langOf = (o) => {
  const l = (o.lang || '').split(',').map((x) => x.trim()).find((x) => LANG_CODE[x] || EN_TO_FR[x]) || '';
  return EN_TO_FR[l] || l;
};
const cardLangs = (it) => (Array.isArray(it.langs) ? it.langs : settings.defaultLangs || []);
const cardCond = (it) => (it.cond != null ? it.cond : settings.defaultCond || '');
// langue choisie dans « Meilleur panier » (sans re-scan) : remplace celle de chaque carte pour le calcul et la comparaison
const effLangs = (it) => (Array.isArray(settings.bestLangs) && settings.bestLangs.length ? settings.bestLangs : cardLangs(it));
// scan complémentaire pour une langue choisie dans « Meilleur panier » : les offres sont gardées à part (s.extra), sans toucher au scan normal
let scanLangOverride = null, topUpPrevMode = null;
const langKey = (langs) => langs.map((l) => CM_LANG_ID[l]).filter(Boolean).sort((a, b) => a - b).join(',');
// le scan de cette carte peut-il avoir raté des offres dans ces langues ? (filtre de langue différent ET offres coupées)
const needsLangTopUp = (it, langs) => {
  const s = scans[it.id], k = langKey(langs);
  if (!s || !k || !s.partial || (s.extra && s.extra[k])) return false;
  return (new URLSearchParams(s.q || '').get('language') || '') !== k;
};
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
function filteredOffers(it, langs = cardLangs(it)) {
  const s = scans[it.id];
  if (!s) return [];
  const minC = cardCond(it);
  let all = s.offers;
  const ex = s.extra && langs.length && s.extra[langKey(langs)];
  if (ex) { const seen = new Set(all.map(artKey)); all = all.concat(ex.offers.filter((o) => !seen.has(artKey(o)))); }
  for (const extra of [s.wiz, s.stock]) if (extra && Date.now() - extra.date < 24 * 3600e3) { const seen = new Set(all.map(artKey)); all = all.concat(extra.offers.filter((o) => !seen.has(artKey(o)))); }
  return all.filter((o) =>
    inFrance(o) &&
    (!langs.length || langs.includes(langOf(o))) &&
    (!minC || (COND_RANK[o.cond] || 9) <= COND_RANK[minC]) &&
    (RATING_RANK[o.rating] || 0) >= (+settings.minRating || 0) &&
    !blocked[o.seller] &&
    !o.restricted &&                       // offre restreinte par le vendeur : impossible à acheter
    (!it.foil || (it.foil === 'Y') === isFoilOffer(o)) && // Magic : foil seulement / sans foil
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
// filtres de la colonne de gauche de Cardmarket, testés : sellerCountry=7,1,17 (plusieurs pays), sellerReputation=1 (Extraordinaire) … 5 (Mauvais)
function scanQuery(it) {
  const q = new URLSearchParams();
  const sc = settings.sellerCountries;
  if (sc.length && sc.length < COUNTRIES.length) q.set('sellerCountry', [...sc].map(Number).sort((a, b) => a - b).join(','));
  const rep = +settings.minRating || 0; // 2 = Moyen et + … 5 = Extraordinaire  ->  Cardmarket : 4 … 1
  if (rep >= 2) q.set('sellerReputation', 6 - rep);
  const langs = (scanLangOverride || cardLangs(it)).map((l) => CM_LANG_ID[l]).filter(Boolean).sort((a, b) => a - b);
  if (langs.length) q.set('language', langs.join(','));
  const c = cardCond(it);
  if (c && COND_RANK[c] > 1) q.set('minCondition', COND_RANK[c]);
  if (it.foil && isMagic(it)) q.set('isFoil', it.foil); // Magic : filtre foil de Cardmarket
  return q.toString().replace(/%2C/g, ',');
}
function scanUrl(it) {
  const u = new URL(ORIGIN + it.url.split('#')[0]);
  for (const k of ['sellerCountry', 'sellerReputation', 'language', 'minCondition', 'isFoil']) u.searchParams.delete(k);
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
    const wait = job.nextReq - now;
    if (wait <= 0) { job.nextReq = now + job.gap; if (job.probe) { job.probeBusy = true; return true; } return false; }
    await sleep(Math.min(wait, 300));
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
// ---------- Journal d'activité (pour aider quand quelqu'un signale un bug) ----------
// Chaque ligne = une vraie action (scan, comparaison, import de deck, ajout au panier…) ou une requête à Cardmarket,
// avec ce qu'elle visait (quelle carte, quel filtre). Les lignes de plus de 7 jours sont supprimées une par une.
const LOG_DAYS = 7, LOG_MAX = 5000;
let reqLog = [];
let reqLogSave = null;
function pruneLog() { const min = Date.now() - LOG_DAYS * 86400000; reqLog = reqLog.filter((e) => e.t >= min).slice(-LOG_MAX); }
function pushLog(e) {
  const now = Math.round(Date.now()), prev = reqLog[reqLog.length - 1];
  reqLog.push({ t: now, since: prev ? Math.round(now - prev.t) : 0, ...e });
  if (reqLog.length > LOG_MAX || (reqLog[0] && reqLog[0].t < now - LOG_DAYS * 86400000)) pruneLog();
  clearTimeout(reqLogSave); reqLogSave = setTimeout(() => chrome.storage.local.set({ cmReqLog: reqLog }), 1500);
  const n = $('nReqLog'); if (n) n.textContent = reqLog.length;
}
const logReq = (e) => pushLog({ type: 'requête', ...e });
// action de la personne ou étape importante (level : info | erreur)
const logAction = (what, level = 'info') => pushLog({ type: level === 'erreur' ? 'ERREUR' : 'action', what: String(what).slice(0, 300) });
const reqKind = (url, form) => (/ShoppingCart/.test(url) ? 'panier' : /AddWantByProduct/.test(url) ? 'liste de souhaits' : /Products\/Search/.test(url) ? 'recherche' : /ShoppingWizard/.test(url) ? 'shopping wizard' : form ? 'autre' : /\/Products\//.test(url) ? 'page carte' : 'page');
// ce que visait la requête, en clair : « Charme · France particuliers · FR »
function reqWhat(url, form) {
  try {
    const u = new URL(url, ORIGIN);
    if (form && form.idProduct) return (list[form.idProduct]?.name || 'carte ' + form.idProduct) + (form.amount ? ' ×' + form.amount : '');
    if (form && form.idArticle) return 'article ' + form.idArticle;
    const q = u.searchParams.get('searchString'); if (q) return '« ' + q + ' »';
    if (/\/Products\//.test(u.pathname)) {
      const it = Object.values(list).find((x) => x.url && u.pathname.endsWith(x.url.split('?')[0].replace(/^\/\w\w\//, '/')));
      const parts = [it ? it.name : decodeURIComponent(u.pathname.split('/').pop())];
      const c = (u.searchParams.get('sellerCountry') || '').split(',').filter(Boolean);
      if (c.length === 1) parts.push(COUNTRIES.find(([x]) => String(x) === c[0])?.[1] || c[0]); else if (c.length > 1) parts.push(c.length + ' pays');
      const t = u.searchParams.get('sellerType'); if (t) parts.push(t === '0' ? 'particuliers' : 'pros');
      const l = u.searchParams.get('language'); if (l && /^\d+$/.test(l)) parts.push('langue ' + l);
      return parts.join(' · ');
    }
    if (/\/Users\//.test(u.pathname)) return decodeURIComponent(u.pathname.split('/Users/')[1].split('/')[0]) + ' · ' + (u.search ? decodeURIComponent(u.search.slice(1)) : 'stock').slice(0, 80);
    return u.pathname.replace(/^\/\w\w\/\w+\//, '').slice(0, 60);
  } catch { return ''; }
}
function exportReqLog() {
  pruneLog();
  const L = reqLog, fmt = (t) => new Date(t).toLocaleString('fr-FR');
  const reqs = L.filter((e) => e.type !== 'action' && e.type !== 'ERREUR');
  const blocks = reqs.filter((e) => e.result && e.result !== 'ok' && e.result !== 'connexion');
  const errs = L.filter((e) => e.type === 'ERREUR');
  const cl = (id) => COUNTRIES.find(([x]) => x === +id)?.[1] || id;
  const lines = [
    'Journal d\'activité TCG Price Hunter — exporté le ' + fmt(Date.now()),
    `Version : ${appVersion} (${BUILD}) · Navigateur : ${navigator.userAgent.replace(/\s*\(.*?\)\s*/g, ' ').trim()}`,
    `Réglages : mode de scan ${scanMode()} · livré en ${cl(settings.myCountry)} · vendeurs ${settings.sellerPreset || '?'} (${settings.sellerCountries.length || 'tous les'} pays) · note min ${settings.minRating || 0} · état min ${settings.defaultCond || 'tous'} · langues ${(settings.defaultLangs || []).join(',') || 'toutes'}`,
    `Cartes dans la liste : ${Object.keys(list).length} (${Object.values(list).filter((i) => i.checked).length} cochées) · lignes gardées ${LOG_DAYS} jours`,
    `Lignes : ${L.length}` + (L.length ? ` (du ${fmt(L[0].t)} au ${fmt(L[L.length - 1].t)})` : '') + ` · requêtes : ${reqs.length} · erreurs : ${errs.length}`,
    `Blocages : ${blocks.length} (1015 : ${reqs.filter((e) => e.result === '1015').length}, 429 : ${reqs.filter((e) => e.result === '429').length}, captcha : ${reqs.filter((e) => e.result === 'captcha').length}, 403 : ${reqs.filter((e) => e.result === '403').length})`,
    '',
    'date;type;quoi;détail;statut HTTP;résultat;durée (ms);écart (ms)',
    ...L.map((e) => [fmt(e.t), e.type || 'requête', e.kind || '', (e.what || '').replace(/;/g, ','), e.status ?? '', e.result || '', e.ms ?? '', e.since ?? ''].join(';')),
  ];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
  a.download = 'tcg-price-hunter-journal-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.txt';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function request(url, form, slow = false) {
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
      logReq({ kind: reqKind(url, form), what: reqWhat(url, form), status: res.status, result, ms: Date.now() - t0 });
    }
    if (res.status === 0) { lastErr = t.replace(/^ERREUR\s*/, '').slice(0, 120); if ((job.workerOpened || 0) >= 2) break; continue; }
    // Cloudflare "Error 1015 - You are being rate limited" = blocage temporaire pour trop de requêtes
    const is1015 = /error\s*1015|being rate limited/i.test(t.slice(0, 20000));
    if (is1015) note1015();
    // captcha (vérification anti-robot) : Cloudflare l'envoie parfois avec le code 429 « trop de requêtes »,
    // mais ce n'est PAS un blocage : on met tout en pause, tu coches la case, et le scan reprend
    if (!is1015 && /<title>\s*(Just a moment|Un instant|Attention Required)/i.test(head)) {
      await solveChallenge(url.includes('AjaxAction') ? null : url);
      continue;
    }
    // 1re erreur 1015 pendant un scan : pause de 1 min 30, puis on repart plus doucement avec 50 offres par carte
    // (les cartes gardent les offres déjà chargées). Une 2e fois : on arrête, comme avant.
    // (pareil pendant l'import de deck et la vérification des stocks : pause puis on repart plus doucement)
    if ((is1015 || res.status === 429) && job.active && (!job.kind || job.kind === 'deck' || job.kind === 'stock') && !job.hit1015) {
      job.hit1015 = true; job.noMore = true;
      job.gap = Math.max(job.gap * 2, 500);
      job.pauseStart = Date.now(); job.pausedUntil = Date.now() + 90000;
      job.pauseReason = is1015 ? 'Trop de requêtes (erreur 1015)' : 'Cardmarket freine';
      if (slow || /Product_LoadMoreArticles/.test(url)) throw new Error('pause'); // la carte garde ce qu'elle a déjà
      continue;
    }
    if (is1015 || res.status === 429 || (res.status === 403 && /Access denied|Too Many/i.test(head))) {
      // pas de pause : Cardmarket bloque de toute façon pendant un moment -> on arrête le scan tout de suite
      // (les cartes déjà scannées sont gardées, relance plus tard pour le reste)
      if (job.active) {
        job.stopReason = is1015 ? T('Cardmarket t\'a bloqué pour trop de requêtes (erreur 1015) : scan arrêté. Les cartes déjà scannées sont gardées, relance le reste plus tard.')
          : T('Cardmarket freine (trop de requêtes) : scan arrêté. Les cartes déjà scannées sont gardées, relance le reste plus tard.');
        if (is1015 && freq1015() >= 1) job.stopReason += ' ' + warn1015Text();
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

// Scanne une carte : 1re page (50 offres). S'il y en a plus ET que la 50e est encore assez bon marché pour compter,
// on recharge la page avec d'autres filtres (ton pays par type de vendeur puis par langue, puis les autres pays ensemble).
// Jamais de « Montrer plus ».
async function scanCard(id) {
  const it = list[id];
  const url = scanUrl(it);
  const r = job.running.get(id);
  const res = await request(url);
  if (res.login) throw new Error('connexion demandée');
  const doc = new DOMParser().parseFromString(res.text, 'text/html');
  const loggedOut = !!doc.querySelector('input[name="username"]');
  if (loggedOut) { job.loggedOut = true; const e = new Error('déconnecté'); e.logout = true; throw e; } // pas connecté : on arrête tout
  const info = CMParse.productInfo(doc, it.url);
  if (!info) {
    const title = (doc.title || '').trim().slice(0, 60) || (res.text || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    throw new Error(`page inattendue — statut ${res.status}, « ${title} »`);
  }
  if (info.img && info.img !== it.img) { it.img = info.img; job.listDirty = true; } // enregistré une seule fois à la fin du scan
  if (info.id && (it.idProduct !== info.id || (info.metacard && it.idMetacard !== info.metacard))) { it.idProduct = info.id; if (info.metacard) it.idMetacard = info.metacard; job.listDirty = true; } // pour le comparateur
  const offers = [...doc.querySelectorAll('.article-row')].map(CMParse.parseRow).filter(Boolean);
  r.rows = offers.length;
  const lm = CMParse.loadMoreParams(doc);
  const st = { id, url, offers, seen: new Set(offers.map(artKey)), t0: r.t0 };
  // plus de 50 offres : au lieu de « Montrer plus » (qui fait bloquer Cardmarket, erreur 1015), on recharge la page
  // avec d'autres filtres de pays : les 50 moins chères de ton pays, puis des pays aux frais de port les plus bas
  // découpage intelligent : une offre plus chère ne peut faire baisser le panier que de l'économie d'un envoi au plus.
  // Si la 50e offre coûte déjà plus que « la moins chère + un envoi », les autres pages ne servent à rien : 1 page suffit.
  // 3 modes (menu sous « Scanner ») : rapide = 1 page ; moyen (par défaut) = pages en plus seulement si elles peuvent servir ;
  // long = ton pays découpé + chaque autre pays un par un, sans limite de prix
  const mode = scanMode();
  st.mode = mode;
  st.cutoff = mode === 'long' ? Infinity : cutoffPrice(offers);
  if (mode !== 'fast' && lm && !job.noMore && offers.length >= 50 && lastPrice(offers) <= st.cutoff) {
    st.slices = sliceCountries(it, mode); st.left = mode === 'long' ? MAX_SLICES_LONG : MAX_SLICES;
    try { while (await scanMore(st)) { /* page suivante, sans pause */ } }
    catch (e) { await finishCard(st, true); throw e; } // scan arrêté : la carte garde ce qu'elle a déjà
    return finishCard(st, true);
  }
  return finishCard(st, !!lm);
}
const prices = (offers) => offers.map((o) => o.price).filter((p) => isFinite(p) && p > 0);
const lastPrice = (offers) => Math.max(...prices(offers), 0); // la page est triée par prix : la plus chère = la 50e
// la plus chère offre qui peut encore servir : la moins chère + ce que coûte un envoi (port + douane) depuis le pays le plus cher choisi
function cutoffPrice(offers) {
  const p = prices(offers);
  if (!p.length) return Infinity;
  if (job.shipMax == null) { // calculé une fois par scan
    const allowed = settings.sellerCountries.length ? settings.sellerCountries.map(Number) : COUNTRIES.map(([x]) => x);
    let ship = 0;
    for (const c of allowed) { const f = feeInfo(c); if (f) ship = Math.max(ship, ...f.parts); }
    job.shipMax = ship || 5; // tarifs pas encore chargés : 5 € par prudence
  }
  return Math.min(...p) + job.shipMax;
}
const artKey = (o) => o.aid || [o.seller, o.price, o.cond, o.lang, o.extra, o.qty].join('|');
// pages en plus : TON pays (celui de livraison, pas forcément la France) coupé en particuliers / pros + power sellers,
// puis tous les autres pays autorisés ensemble sur une seule page
function sliceCountries(it, mode) {
  const allowed = settings.sellerCountries.length ? settings.sellerCountries.map(Number) : COUNTRIES.map(([x]) => x);
  const home = +settings.myCountry;
  const others = allowed.filter((c) => c !== home);
  const mine = allowed.includes(home) ? [{ c: [home], t: '0' }, { c: [home], t: '1,2' }] : [];
  if (mode === 'long') {
    // les gros marchés de Cardmarket un par un ; les petits pays regroupés par 6 sur une seule page.
    // Un groupe qui a moins de 50 offres = tout vu en 1 page ; 50 ou plus = il est coupé en deux (jusqu'au pays seul).
    const score = (c) => feeInfo(c)?.score ?? 99;
    const sorted = others.sort((a, b) => score(a) - score(b));
    const small = sorted.filter((c) => !BIG_MARKETS.includes(c));
    const out = sorted.filter((c) => BIG_MARKETS.includes(c)).map((c) => ({ c: [c], one: true }));
    for (let i = 0; i < small.length; i += 6) { const g = small.slice(i, i + 6); out.push(g.length > 1 ? { c: g, pack: true } : { c: g, one: true }); }
    return mine.concat(out.sort((a, b) => score(a.c[0]) - score(b.c[0])));
  }
  // tous les autres pays d'un coup (1 seule page) : les 50 moins chères hors de chez toi
  return mine.concat(others.length ? [{ c: others }] : []);
}
// gros marchés : interrogés pays par pays en scan Long (Allemagne, France, Italie, Espagne, Pays-Bas, Belgique, Autriche, Portugal)
const BIG_MARKETS = [7, 12, 17, 10, 23, 2, 1, 26];
const SCAN_MODES = { fast: 640, medium: 30, long: 13 }; // cartes par minute (1.40 : petits pays regroupés + 5 cartes à la fois ; avant : 19,2 / 6,6 mesurés à 3 cartes)
const scanMode = () => (SCAN_MODES[settings.scanMode] ? settings.scanMode : 'long'); // Long par défaut
function sliceUrl(url, sl) {
  const u = new URL(url);
  u.searchParams.set('sellerCountry', sl.c.join(','));
  if (sl.t) u.searchParams.set('sellerType', sl.t); else u.searchParams.delete('sellerType');
  if (sl.l) u.searchParams.set('language', sl.l);
  return u.toString().replace(/%2C/g, ',');
}
// une page de plus pour la carte (autre pays / type de vendeur / langue) ; renvoie false quand c'est fini
async function scanMore(st) {
  const r = job.running.get(st.id);
  if (job.noMore || !job.active || !st.slices.length || st.left <= 0) return false;
  const sl = st.slices.shift(); st.left--;
  let res;
  try { res = await request(sliceUrl(st.url, sl), null, true); }
  catch (e) { if (e.message === 'stop') throw e; return false; } // garde ce qu'on a déjà
  if (res.login) return false;
  const doc = new DOMParser().parseFromString(res.text || '', 'text/html');
  const got = [...doc.querySelectorAll('.article-row')].map(CMParse.parseRow).filter(Boolean);
  for (const o of got) { const k = artKey(o); if (!st.seen.has(k)) { st.seen.add(k); st.offers.push(o); } }
  // ce groupe a encore plus de 50 offres : on le redécoupe (type de vendeur, puis langue).
  // Ton pays passe d'abord ; les autres pays aussi s'il reste de la place (utile si ton pays a peu d'offres, ex. Hongrie)
  if (sl.pack && got.length >= 50 && CMParse.loadMoreParams(doc)) { // groupe de petits pays trop rempli : coupé en deux
    const h = Math.ceil(sl.c.length / 2);
    st.slices.unshift(...[sl.c.slice(0, h), sl.c.slice(h)].map((c) => (c.length > 1 ? { c, pack: true } : { c, one: true })));
    st.left++; // (le découpage ne mange pas le budget de pages)
  } else if (got.length >= 50 && CMParse.loadMoreParams(doc) && !sl.l && !sl.one && !sl.pack && lastPrice(got) <= st.cutoff) { // seulement si ce morceau peut encore cacher des offres utiles
    let kids = [];
    if (!sl.t) kids = ['0', '1,2'].map((t) => ({ c: sl.c, t }));
    else {
      const it = list[st.id] || {};
      const chosen = (scanLangOverride || cardLangs(it)).map((l) => CM_LANG_ID[l]).filter(Boolean);
      const counts = {};
      if (chosen.length !== 1) got.forEach((o) => { const n = CM_LANG_ID[o.lang]; if (n && (!chosen.length || chosen.includes(n))) counts[n] = (counts[n] || 0) + 1; });
      const langs = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3);
      if (langs.length >= 2) kids = langs.map((l) => ({ c: sl.c, t: sl.t, l }));
    }
    st.slices.unshift(...kids);
  }
  if (r) r.rows = st.offers.length;
  renderProgress();
  return st.slices.length > 0 && st.left > 0;
}
async function finishCard(st, partial) {
  if (scanLangOverride && scans[st.id]) { // scan complémentaire de langue : rangé à part, le scan normal ne change pas
    const s = scans[st.id];
    s.extra = { ...(s.extra || {}), [langKey(scanLangOverride)]: { date: Date.now(), offers: st.offers } };
    await chrome.storage.local.set({ ['scan_' + st.id]: s });
    return 'done';
  }
  const keepWiz = scans[st.id]?.wiz, keepStock = scans[st.id]?.stock;
  scans[st.id] = { date: Date.now(), offers: st.offers, url: list[st.id]?.url, partial, loggedOut: false, q: scanQuery(list[st.id]) };
  if (keepWiz && Date.now() - keepWiz.date < 24 * 3600e3) scans[st.id].wiz = keepWiz;
  if (keepStock && Date.now() - keepStock.date < 24 * 3600e3) scans[st.id].stock = keepStock;
  await chrome.storage.local.set({ ['scan_' + st.id]: scans[st.id] });
  return 'done';
}

async function startScan(ids) {
  ids = ids.filter((id) => list[id]);
  if (!ids.length) return banner('Coche au moins une carte.');
  banner(null);
  if (job.active && scanLangOverride) return banner(T('Attends la fin de la recherche des offres dans la langue choisie, puis relance.'));
  if (job.active) { // déjà en cours : on ajoute à la file
    ids.forEach((id) => { if (!job.queue.includes(id) && !job.running.has(id)) { job.queue.push(id); job.total++; } });
    return renderProgress();
  }
  logAction(`Scan lancé : ${ids.length} carte(s), mode ${scanMode()}`);
  try { chrome.permissions.request({ origins: [ORIGIN + '/*', 'https://product-images.s3.cardmarket.com/*', 'https://help.cardmarket.com/*'] }).catch(() => {}); } catch {}
  Object.assign(job, { active: true, queue: [...ids], running: new Map(), done: 0, total: ids.length, failed: [], pausedUntil: 0,
    strikes: 0, cont: [], challenge: null, loggedOut: false, logoutStop: false, t0: Date.now(), durations: [], doneTimes: [], okIds: new Set(), nextReq: 0, gap: baseGap(), workerTab: null, workerOpened: 0, lastErr: '', challenges: 0, probe: false, probeBusy: false, stopReason: '', pauseReason: '', hit1015: false, noMore: false, shipMax: null });
  job.appTab = await chrome.tabs.getCurrent().catch(() => null);
  job.timer = setInterval(renderProgress, 500);
  showScanSite();
  renderProgress();
  await Promise.race([loadEuropeTables().catch(() => {}), sleep(3000)]); // tarifs de port : pour savoir quand une page en plus peut servir

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

const showScanSite = () => { const el = $('progSite'); if (el) el.textContent = '🌐 ' + TF('Sur {s}', { s: siteOf(settings.site).name }); };
function endScan(stopped = false) {
  clearInterval(job.timer);
  job.active = false;
  // cartes encore en pause (scan arrêté) : on garde les offres déjà chargées
  (job.cont || []).splice(0).forEach((c) => { finishCard(c.st, true); job.okIds?.add(c.st.id); });
  if (job.listDirty) { job.listDirty = false; saveList(); }
  // cartes re-scannées : on les enlève de la liste « Pas ajoutés au panier » (recalcule puis réessaie l'ajout)
  if (job.okIds && lastCartFailed.some((f) => job.okIds.has(f.id))) setCartFailed(lastCartFailed.filter((f) => !job.okIds.has(f.id)));
  job.challenge = null;
  if (job.workerTab != null) { chrome.tabs.remove(job.workerTab).catch(() => {}); job.workerTab = null; }
  const ok = job.done - job.failed.length;
  const msgs = [];
  logAction(`Scan ${stopped ? 'arrêté' : 'terminé'} : ${ok}/${job.total} carte(s) scannée(s)` + (job.failed.length ? ` · échecs : ${job.failed.join(', ')}` : '') + (job.stopReason ? ` · ${job.stopReason}` : ''), job.stopReason || job.failed.length ? 'erreur' : 'info');
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
  if (topUpPrevMode !== null) { settings.scanMode = topUpPrevMode; topUpPrevMode = null; } // complément de langue fini : on remet ton mode de scan
  saveSettings(); // garde la durée moyenne par carte pour les prochaines estimations
  const wasTopUp = !!scanLangOverride;
  scanLangOverride = null;
  renderAll();
  decorateBg();
  if (wasTopUp && !$('v-best').hidden) refreshBest(); // offres de la langue choisie chargées : on recalcule
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
function estimateSec(nCards, started, mode = scanMode()) {
  return nCards ? (started ? 0 : EST_START_SEC) + (nCards / ((SCAN_MODES[mode] || EST_PER_MIN) * rateFactor())) * 60 : 0;
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
  if (!job.active || job.kind === 'stock' || job.kind === 'deck') return; // (ces deux-là ont leur propre fenêtre de progression)
  if (job.kind === 'cart') renderCartProg();
  $('scanbox').hidden = false;
  $('stopBtn').hidden = false;
  $('progTitle').textContent = job.kind === 'cart' ? 'Ajout au panier Cardmarket' : job.kind === 'compare' ? T('Comparaison avec Cardmarket') : 'Scan en cours';
  $('progCount').textContent = `${job.done}/${job.total}`;
  $('barFill').style.width = (job.total ? Math.round((job.done / job.total) * 100) : 0) + '%';
  const wait = Math.ceil((job.pausedUntil - Date.now()) / 1000);
  if (wait > 0) {
    const back = new Date(job.pausedUntil).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const key = (/1015/.test(job.pauseReason) ? '1015-' : 'pause-') + job.pauseStart;
    if (closedKey === key) {
      // message fermé avec ✕ : on ne le réaffiche pas pendant cette pause
    } else if (/1015/.test(job.pauseReason) && $('ban1015') && !$('banner').hidden) {
      if ($('banWait')) $('banWait').textContent = fmtDur(wait); if ($('banBack')) $('banBack').textContent = back; // seul le compte à rebours change (les liens restent cliquables)
    } else if (/1015/.test(job.pauseReason)) {
      bannerHtml(`<b id="ban1015">⏸ Erreur 1015 : ${CM_LINK} t'a bloqué temporairement.</b><br>
        <b>Raison :</b> trop de requêtes en peu de temps (protection anti-robot Cloudflare de ${CM_LINK}).<br>
        <b>Pendant la pause :</b> ne recharge pas ${CM_LINK}, ça peut prolonger le blocage. Tu peux continuer à regarder tes cartes et calculer le panier avec ce qui est déjà scanné.<br>
        <b>${esc(warn1015Text())}</b><br>
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
  $('progRate').textContent = !job.kind ? fmtRate(cardsPerMin()) : '';
  $('progEta').textContent = job.challenge ? T('⏱ En pause le temps du captcha, attends…') : job.probe ? T('⏱ Reprise du scan…') : job.kind ? '' : etaText();
  $('progList').innerHTML = [...job.running.entries()].map(([id, r]) =>
    `<div>${r.paused ? '⏸' : '⏳'} ${esc(r.label || list[id]?.name || id)}${r.rows ? ` <i>${esc(TF('{n} offres', { n: r.rows }))}</i>` : ''}</div>`).join('');
}

// ---------- Ajouter le meilleur panier au panier Cardmarket ----------
// Même chose que le bouton 🛒 "Ajouter à mon panier" de chaque offre :
// POST AjaxAction/ShoppingCart_Add_AddArticlesFromProductPage { __cmtkn, idArticle[N], amount[N] }
// Rien n'est acheté : tu vérifies et tu payes toi-même sur Cardmarket.
// réponse de Cardmarket à un ajout au panier : <ajaxResponse><resultType>base64</resultType><systemMessage>base64(HTML)</systemMessage>
let lastCartFailed = [];
let lastCartQty = null; // carte -> quantité dans ton panier Cardmarket (dernière lecture)
let cartAdj = null; // { sig, extra } : écart des remplacements pour ce meilleur panier
const setCartFailed = (arr) => { lastCartFailed = arr; chrome.storage.local.set({ cmCartFailed: arr }); };
// cartes re-scannées depuis « Pas ajoutés au panier » (bouton « ajouter les re-scannées ») et articles restants après un ⏹ (bouton « reprendre »)
let cartRetryIds = [], cartResume = [];
const setCartRetry = (ids) => { cartRetryIds = ids; chrome.storage.local.set({ cmCartRetry: ids }); };
const setCartResume = (arr) => { cartResume = arr; chrome.storage.local.set({ cmCartResume: arr }); };
// cartes (de ta liste) qui n'ont pas pu aller dans le panier
const cartFailedIds = () => [...new Set(lastCartFailed.map((f) => f.id || Object.values(list).find((it) => it.url === f.url)?.id).filter((id) => id && list[id]))];
function b64(s) { try { return new TextDecoder().decode(Uint8Array.from(atob((s || '').trim()), (c) => c.charCodeAt(0))); } catch { return ''; } }
function cartAnswer(t) {
  const type = b64((t.match(/<resultType>([\s\S]*?)<\/resultType>/) || [])[1]).trim().toLowerCase();
  const html = b64((t.match(/<systemMessage>([\s\S]*?)<\/systemMessage>/) || [])[1]);
  const msg = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
  const bad = type === 'error' || /alert-danger|alert-warning/.test(html) || /<error\b/i.test(t);
  if (bad) return { ok: false, msg: msg || 'refusé par Cardmarket' };
  if (!/<ajaxResponse/i.test(t) && !type) return { ok: false, msg: 'réponse inattendue de Cardmarket' };
  return { ok: true, msg };
}
// Contenu de ton panier Cardmarket, lu par vendeur + carte : Set de « vendeur|/Jeu/Products/... »
const cartKey = (seller, url) => String(seller || '').toLowerCase() + '|' + String(url || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/[a-z]{2}\//, '/').split(/[?#]/)[0];
async function cartIndex(lang, game) {
  const doc = docOf(await request(`${ORIGIN}/${lang}/${game}/ShoppingCart`));
  const sellerOf = (el) => { // le bloc d'envoi autour de la ligne : le seul lien vers un vendeur qu'il contient
    for (; el && el !== doc.body; el = el.parentElement) {
      const us = [...new Set([...el.querySelectorAll('a[href*="/Users/"]')].map((a) => decodeURIComponent(((a.getAttribute('href') || '').split('/Users/')[1] || '').split(/[/?#]/)[0])).filter(Boolean))];
      if (us.length === 1) return us[0];
      if (us.length > 1) return null;
    }
    return null;
  };
  const idx = new Map(); // « vendeur|carte » -> quantité dans le panier
  const seen = new Set();
  for (const tr of doc.querySelectorAll('tr[data-article-id]')) { // lignes du panier (en double dans la page : vue ordinateur / mobile)
    const id = tr.getAttribute('data-article-id'), a = tr.querySelector('a[href*="/Products/"]');
    if (!id || seen.has(id) || !a) continue;
    seen.add(id);
    const s = sellerOf(tr);
    if (s) { const k = cartKey(s, a.getAttribute('href')); idx.set(k, (idx.get(k) || 0) + (+tr.getAttribute('data-amount') || 1)); }
  }
  if (!idx.size) for (const a of doc.querySelectorAll('a[href*="/Products/"]')) { // (page sans ces lignes : seulement « présent »)
    const s = sellerOf(a);
    if (s) idx.set(cartKey(s, a.getAttribute('href')), Infinity);
  }
  return idx.size ? idx : null; // panier vide ou page illisible : on ne peut rien conclure
}
// 🧹 Nettoyer le panier : retire de ton panier Cardmarket les doublons et les cartes de TA liste qui ne sont plus dans
// le meilleur panier — seulement quand la bonne offre y est déjà (on ne retire jamais le seul exemplaire d'une carte).
// Les retraits se font en cliquant le vrai bouton 🗑 de Cardmarket dans l'onglet Cardmarket, un par un, puis on vérifie.
// Vider TOUT le panier Cardmarket : clic sur son propre bouton « Vider le panier » (un seul clic), puis vérification
async function clickEmptyCart(cartUrl) {
  await workerGo(cartUrl);
  const tabId = await workerTab();
  const ok = await inWorker(() => {
    window.confirm = () => true;
    const b = [...document.querySelectorAll('input[type="submit"], button[type="submit"]')].find((x) => !x.closest('tr') &&
      /vider le panier|empty (the )?(shopping )?cart|warenkorb leeren|vaciar (la )?cesta|svuota (il )?carrello|esvaziar|winkelwagen legen|opróżnij/i.test(x.value || x.title || x.textContent || ''));
    if (!b) return false;
    b.click();
    return true;
  }).catch(() => false);
  if (!ok) return false;
  await new Promise((resolve) => { // on laisse Cardmarket recharger la page
    let seen = false;
    const l = (id, info) => { if (id !== tabId) return; if (info.status === 'loading') seen = true; if (info.status === 'complete' && seen) done(); };
    const done = () => { chrome.tabs.onUpdated.removeListener(l); clearTimeout(to); clearTimeout(to2); resolve(); };
    chrome.tabs.onUpdated.addListener(l);
    const to = setTimeout(done, 15000), to2 = setTimeout(() => { if (!seen) done(); }, 4000);
  });
  await sleep(800);
  await workerGo(cartUrl);
  return !(await inWorker(() => !!document.querySelector('tr[data-article-id]')).catch(() => true)); // vide = réussi
}
// bouton « 🗑 Vider mon panier Cardmarket »
async function emptyCartButton() {
  if (job.active) return banner(T('Un scan ou un ajout est déjà en cours, attends la fin.'));
  const it0 = lastResult?.lines[0] || Object.values(list)[0];
  const [, lang, game] = new URL(ORIGIN + (it0?.url || '/fr/Riftbound/')).pathname.split('/');
  const cartUrl = `${ORIGIN}/${lang}/${game}/ShoppingCart`;
  if (!confirm(T('Vider entièrement ton panier Cardmarket ? Tous les articles, de tous les vendeurs, sont retirés (ça ne s\'annule pas).'))) return;
  Object.assign(job, { active: true, queue: [], running: new Map(), done: 0, total: 0, failed: [], pausedUntil: 0, strikes: 0,
    challenge: null, loggedOut: false, t0: Date.now(), durations: [], nextReq: 0, gap: CART_GAP, workerTab: null, workerOpened: 0,
    lastErr: '', challenges: 0, probe: false, probeBusy: false, stopReason: '', pauseReason: '', kind: 'clean', cont: [], hit1015: false });
  job.appTab = await chrome.tabs.getCurrent().catch(() => null);
  busy(true, T('Vidage de ton panier Cardmarket…'));
  let ok = false;
  try { ok = await clickEmptyCart(cartUrl); } catch (e) { /* message ci-dessous */ }
  job.active = false; job.kind = ''; busy(false);
  if (job.workerTab != null) { chrome.tabs.remove(job.workerTab).catch(() => {}); job.workerTab = null; }
  backToApp();
  logAction(ok ? 'Panier Cardmarket vidé' : 'Vidage du panier : pas confirmé', ok ? 'info' : 'erreur');
  if (ok) { lastCartQty = {}; chrome.storage.local.set({ cmCartQty: {} }); setCartFailed([]); cartAdj = null; chrome.storage.local.remove('cmCartAdj'); }
  bannerHtml(ok ? '🗑 ' + esc(T('Ton panier Cardmarket est vide.')) : '⚠ ' + esc(T('Le panier n\'a pas pu être vidé : vide-le à la main sur Cardmarket.')) + ` <a href="${cartUrl}" target="_blank">${esc(T('Ouvrir mon panier Cardmarket'))}</a>`);
  if (lastResult) renderBest();
}
// pre = true : avant « Tout ajouter » -> le panier doit devenir exactement le meilleur panier : on ne garde que les offres
// prévues (vendeur + carte), tout le reste de ce jeu est retiré (les offres prévues manquantes sont ajoutées juste après)
let cartPreNote = '';
async function cleanCart(pre = false) {
  if (job.active) return banner(T('Un scan ou un ajout est déjà en cours, attends la fin.'));
  if (!lastResult || !lastResult.r.orders.length) return;
  const plan = new Map(), paths = new Set();
  let lang = 'fr', game = 'Riftbound';
  for (const o of lastResult.r.orders) for (const { line, opt } of o.lines) {
    const k = cartKey(o.seller, line.url), p = k.split('|')[1];
    plan.set(k, (plan.get(k) || 0) + opt.picked.reduce((t, x) => t + (x.take || 0), 0));
    paths.add(p);
    [, lang, game] = new URL(ORIGIN + line.url).pathname.split('/');
  }
  const cartUrl = `${ORIGIN}/${lang}/${game}/ShoppingCart`;
  Object.assign(job, { active: true, queue: [], running: new Map(), done: 0, total: 0, failed: [], pausedUntil: 0, strikes: 0,
    challenge: null, loggedOut: false, t0: Date.now(), durations: [], nextReq: 0, gap: CART_GAP, workerTab: null, workerOpened: 0,
    lastErr: '', challenges: 0, probe: false, probeBusy: false, stopReason: '', pauseReason: '', kind: 'clean', cont: [], hit1015: false });
  job.appTab = await chrome.tabs.getCurrent().catch(() => null);
  const end = (html) => { job.active = false; job.kind = ''; busy(false); if (job.workerTab != null) { chrome.tabs.remove(job.workerTab).catch(() => {}); job.workerTab = null; } if (pre) { cartPreNote = html || ''; return; } backToApp(); if (html) bannerHtml(html); };
  // lignes du panier, lues dans la vraie page : <tr data-article-id data-amount data-name>, vendeur = bloc d'envoi autour
  // (la page contient chaque ligne en double — vue ordinateur / mobile — : on dédoublonne par n° d'article)
  const readRows = () => inWorker(() => {
    const out = new Map();
    for (const tr of document.querySelectorAll('tr[data-article-id]')) {
      const id = tr.getAttribute('data-article-id');
      if (!id || out.has(id) || !tr.querySelector('.fonticon-delete')) continue;
      const a = tr.querySelector('a[href*="/Products/"]');
      if (!a) continue;
      let seller = null;
      for (let el = tr; el && el !== document.body; el = el.parentElement) {
        const us = [...new Set([...el.querySelectorAll('a[href*="/Users/"]')].map((x) => decodeURIComponent(((x.getAttribute('href') || '').split('/Users/')[1] || '').split(/[/?#]/)[0])).filter(Boolean))];
        if (us.length === 1) { seller = us[0]; break; }
        if (us.length > 1) break;
      }
      if (seller) out.set(id, { id, seller, href: a.getAttribute('href'), qty: +tr.getAttribute('data-amount') || 1, price: parseFloat(tr.getAttribute('data-price')) || 0, name: tr.getAttribute('data-name') || a.textContent.trim() });
    }
    return [...out.values()];
  });
  const toRemoveStrict = (rows) => { // avant l'ajout : seules les offres prévues restent (jusqu'à la quantité prévue)
    const kept = new Map(), del = [];
    for (const r of rows.filter((x) => (x.href || '').includes(`/${game}/`))) {
      const k = cartKey(r.seller, r.href), n = plan.get(k) || 0, have = kept.get(k) || 0;
      if (n && have < n) kept.set(k, have + r.qty); else del.push({ ...r, other: !paths.has(cartKey('', r.href).split('|')[1]) });
    }
    return del;
  };
  const toRemove = (rows) => pre ? toRemoveStrict(rows) : toRemoveSoft(rows);
  const toRemoveSoft = (rows) => { // lignes à retirer, carte par carte : on garde d'abord les offres du meilleur panier,
    // puis (s'il en manque) les moins chères déjà dans le panier, jusqu'au nombre voulu ; le reste est en trop
    const del = [];
    for (const p of paths) {
      const mine = rows.filter((r) => cartKey('', r.href).split('|')[1] === p);
      const want = [...plan.entries()].filter(([k]) => k.split('|')[1] === p).reduce((t, [, n]) => t + n, 0);
      if (!want || !mine.length) continue;
      const keep = new Set(), perKey = new Map();
      let kept = 0;
      for (const r of mine) { // 1) les offres prévues
        const k = cartKey(r.seller, r.href), n = plan.get(k) || 0, have = perKey.get(k) || 0;
        if (have < n && kept < want) { keep.add(r); perKey.set(k, have + r.qty); kept += r.qty; }
      }
      for (const r of mine.filter((x) => !keep.has(x)).sort((x, y) => x.price - y.price)) if (kept < want) { keep.add(r); kept += r.qty; } // 2) les moins chères
      mine.filter((r) => !keep.has(r)).forEach((r) => del.push(r));
    }
    return del;
  };
  try {
    busy(true, T('Lecture de ton panier Cardmarket…'));
    await workerGo(cartUrl);
    const rows = await readRows() || [];
    const del = toRemove(rows);
    if (!rows.length) return end(pre ? '' : esc(T('Ton panier Cardmarket est vide (ou illisible) : rien à nettoyer.')));
    if (!del.length) return end(pre ? '' : '✔ ' + esc(T('Ton panier ne contient pas de doublon de tes cartes : rien à retirer.')));
    busy(false);
    const lines = del.slice(0, 25).map((r) => `• ${r.seller} : ${r.name} ×${r.qty}${r.price ? ` (${euro(r.price)})` : ''}${r.other ? ' — ' + T('pas dans ta liste') : ''}`).join('\n') + (del.length > 25 ? `\n… +${del.length - 25}` : '');
    if (!confirm((pre
      ? TF('Avant d\'ajouter : retirer {n} ligne(s) de ton panier Cardmarket qui ne sont pas dans ce meilleur panier ?\n(OK = retirer puis ajouter · Annuler = ajouter sans rien retirer)', { n: del.length })
      : TF('Retirer {n} ligne(s) de ton panier Cardmarket ? (doublons et cartes qui ne sont plus dans ce meilleur panier ; la bonne offre de chaque carte reste)', { n: del.length })) + '\n\n' + lines)) return end('');
    let removed = 0;
    if (del.length > 1 && del.length >= rows.length) { // rien à garder : on vide tout le panier d'un coup (bouton « Vider le panier » de Cardmarket)
      busy(true, T('Vidage de ton panier Cardmarket…'));
      if (await clickEmptyCart(cartUrl)) {
        logAction(`Panier Cardmarket vidé (${del.length} ligne(s)) avant l'ajout`);
        return end(`🧹 <b>${esc(TF('{n} ligne(s) retirée(s) de ton panier Cardmarket.', { n: del.length }))}</b>`);
      }
      await workerGo(cartUrl); // bouton introuvable : ligne par ligne
    }
    for (const [i, r] of del.entries()) {
      if (!job.active) break;
      busy(true, TF('Retrait {a} / {b} : {c}', { a: i + 1, b: del.length, c: `${r.name} ×${r.qty} — ${r.seller}` }));
      let clicked = await inWorker((id) => { // le vrai bouton 🗑 de la ligne (celle qui est visible si elle est en double)
        window.confirm = () => true;
        const trs = [...document.querySelectorAll(`tr[data-article-id="${id}"]`)];
        const btn = (trs.find((t) => t.offsetParent !== null) || trs[0])?.querySelector('form button[type="submit"], .fonticon-delete');
        if (!btn) return false;
        (btn.closest('button') || btn).click();
        return true;
      }, [r.id]).catch(() => false);
      if (!clicked) { await workerGo(cartUrl); continue; } // page changée : on la recharge et on passe à la suite
      // retrait en direct (sans rechargement) : on attend que la ligne disparaisse de la page, sinon on la recharge
      let gone = false;
      for (let w = 0; w < 15 && !gone; w++) { await sleep(400); gone = await inWorker((id) => !document.querySelector(`tr[data-article-id="${id}"]`), [r.id]).catch(() => false); }
      if (!gone) await workerGo(cartUrl);
      await sleep(600);
    }
    // vérification
    busy(true, T('Vérification de ton panier…'));
    await workerGo(cartUrl);
    const left = toRemove(await readRows() || []);
    removed = del.length - left.length;
    logAction(`Panier nettoyé : ${removed}/${del.length} ligne(s) retirée(s)` + (left.length ? ` · restent : ${left.map((r) => r.seller + ' ' + r.name).join(', ')}` : ''), left.length ? 'erreur' : 'info');
    end(`🧹 <b>${esc(TF('{n} ligne(s) retirée(s) de ton panier Cardmarket.', { n: removed }))}</b>` +
      (left.length ? `<br>⚠ ${esc(TF('{n} n\'ont pas pu être retirées : retire-les à la main ({l}).', { n: left.length, l: left.slice(0, 6).map((r) => `${r.seller} · ${r.name}`).join(', ') }))}` : '') +
      ` <a href="${cartUrl}" target="_blank">${esc(T('Ouvrir mon panier Cardmarket'))}</a>`);
  } catch (e) {
    if (pre) { logAction('Nettoyage du panier avant l\'ajout impossible : ' + e.message, 'erreur'); return end(''); } // l'ajout se fait quand même
    end('⚠ ' + esc(e.message === 'stop' ? T('arrêté') : e.message));
  }
}
// Pour chaque carte refusée : la meilleure autre offre DÉJÀ scannée (pas de re-scan), port en plus compris, et l'écart de prix
function cartAlternatives() {
  if (!lastResult || !lastCartFailed.length) return { list: [], extra: 0, n: 0 };
  const S = { ...Optimizer.DEFAULTS, ...settings };
  const bad = new Set(lastCartFailed.map((f) => String(f.aid)));
  const country = {};
  for (const l of lastResult.lines) for (const o of l.offers) if (o.country && !country[o.seller]) country[o.seller] = o.country;
  const agg = new Map(lastResult.r.orders.map((o) => [o.seller, { n: o.n, value: o.items, tracked: !!o.tracked }]));
  const cost = (seller, n, value, tracked) => {
    if (n <= 0) return 0;
    const c = country[seller], sh = Optimizer.shipping(n, value, tracked, S, shipTableFor(c)).cost;
    return sh + Optimizer.customs(value, sh, customsFor(c));
  };
  const out = [];
  const seenCard = new Set();
  for (const f0 of lastCartFailed) {
    if (f0.check) { out.push({ f: f0, alt: null, extra: null, check: true }); continue; } // peut-être bien dans le panier : pas d'alternative (sinon doublon)
    if (seenCard.has(f0.id)) continue; seenCard.add(f0.id);
    // quantité qui manque vraiment : ce que tu veux moins ce qui est déjà dans ton panier (tous vendeurs)
    const want = +(list[f0.id]?.qty) || f0.take, inCart = lastCartQty ? (lastCartQty[cartKey('', f0.url).split('|')[1]] || 0) : null;
    const need = inCart == null ? lastCartFailed.filter((x) => x.id === f0.id).reduce((t, x) => t + (x.take || 1), 0) : want - inCart;
    if (need <= 0) continue;
    const f = { ...f0, take: Math.min(need, want) };
    const it = list[f.id];
    let best = null;
    if (it) for (const o of filteredOffers(it).filter((o) => o.aid && !bad.has(String(o.aid)) && (o.qty || 1) >= f.take).sort((x, y) => x.price - y.price).slice(0, 60)) {
      country[o.seller] = country[o.seller] || o.country;
      const a = agg.get(o.seller) || { n: 0, value: 0, tracked: !!settings.alwaysTracked };
      const add = o.price * f.take;
      const c = add + cost(o.seller, a.n + f.take, a.value + add, a.tracked) - cost(o.seller, a.n, a.value, a.tracked);
      if (!best || c < best.c - 1e-9) best = { o, c, add };
    }
    if (best) { const a = agg.get(best.o.seller) || { n: 0, value: 0, tracked: !!settings.alwaysTracked }; agg.set(best.o.seller, { ...a, n: a.n + f.take, value: a.value + best.add }); }
    out.push({ f, alt: best ? best.o : null, extra: best ? Math.round((best.c - f.price * f.take) * 100) / 100 : null });
  }
  const ok = out.filter((x) => x.alt);
  return { list: out, extra: ok.reduce((t, x) => t + x.extra, 0), n: ok.reduce((t, x) => t + x.f.take, 0) };
}
async function addToCart(orders, preset, mode) {
  if (job.active) return banner('Un scan ou un ajout est déjà en cours, attends la fin.');
  let items = preset ? preset.slice() : [];
  const allItems = items; // (avant le tri « déjà dans le panier »)
  if (!preset) orders.forEach((o) => o.lines.forEach(({ line, opt }) => opt.picked.forEach((p) =>
    items.push({ id: line.id, aid: p.aid, take: p.take, price: p.price, name: line.name, seller: o.seller, url: line.url }))));
  if (!items.length) return;
  allItems.splice(0, allItems.length, ...items);
  const baseTotal = lastResult ? lastResult.r.total : 0; // total du meilleur panier au moment de l'ajout
  logAction(`Ajout au panier lancé : ${items.length} article(s)`);
  const noAid = items.filter((i) => !i.aid);
  if (noAid.length) return banner(`Re-scanne d'abord ces cartes (scannées avec une ancienne version, il manque le n° d'article) : ${[...new Set(noAid.map((i) => i.name))].join(', ')}`);
  const nCards = items.reduce((a, i) => a + i.take, 0);
  const total = items.reduce((a, i) => a + i.take * i.price, 0);
  if (!confirm(`Ajouter ${nCards} carte${nCards > 1 ? 's' : ''} (${euro(total)} hors port, ${new Set(items.map((i) => i.seller)).size} vendeur(s)) au panier de ton compte Cardmarket ?` +
    `\n\nRien n'est acheté : tu vérifies et tu payes toi-même sur Cardmarket.`)) return;
  try { chrome.permissions.request({ origins: [ORIGIN + '/*'] }).catch(() => {}); } catch {}

  Object.assign(job, { active: true, queue: [], running: new Map(), done: 0, total: items.length, failed: [], pausedUntil: 0, strikes: 0,
    challenge: null, loggedOut: false, t0: Date.now(), durations: [], nextReq: 0, gap: baseGap(), workerTab: null, workerOpened: 0,
    lastErr: '', challenges: 0, probe: false, probeBusy: false, stopReason: '', pauseReason: '', kind: 'cart' });
  job.gap = CART_GAP; // ajout au panier : plus doux qu'un scan (1 article par seconde), sinon Cardmarket refuse en silence
  job.appTab = await chrome.tabs.getCurrent().catch(() => null);
  job.timer = setInterval(renderProgress, 500);
  showScanSite();
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
  // ---- Ajout « solide » : jamais de suppression dans ton panier. Une offre refusée (déjà vendue, plus assez en stock…)
  // est remplacée TOUT DE SUITE : on recharge la page de la carte (offres fraîches, à la seconde près), on prend la meilleure
  // autre offre (port en plus compris, en privilégiant les vendeurs déjà dans le panier) et on l'ajoute dans la foulée.
  const dead = new Set(); // offres refusées ou disparues : on ne les retente pas
  const blockedSellers = new Set(); // vendeurs qui limitent le nombre de copies par commande (déjà atteint)
  const sellerLimit = (m) => /vendeur vend|seller sells|verkäufer|vendedor vende|venditore vende|copies que|copies this/i.test(m || '');
  const replaced = []; // { name, from, to, extra }
  const country = {};
  for (const id of Object.keys(scans)) for (const o of scans[id].offers || []) if (o.country && !country[o.seller]) country[o.seller] = o.country;
  const plan = new Map(); // ce qui partira chez chaque vendeur (pour calculer le port en plus d'une offre de remplacement)
  const planAdd = (seller, n, value) => { const a = plan.get(seller) || { n: 0, value: 0 }; plan.set(seller, { n: a.n + n, value: Math.max(0, a.value + value) }); };
  items.forEach((it) => planAdd(it.seller, it.take, it.take * it.price));
  const S = { ...Optimizer.DEFAULTS, ...settings };
  const sendCost = (seller, n, value) => {
    if (n <= 0) return 0;
    const c = country[seller], sh = Optimizer.shipping(n, value, !!settings.alwaysTracked, S, shipTableFor(c)).cost;
    return sh + Optimizer.customs(value, sh, customsFor(c));
  };
  const tryAdd = async (it) => { // une demande d'ajout ; renvoie '' si c'est bon, sinon la raison du refus
    const [, lang, g] = new URL(ORIGIN + it.url).pathname.split('/');
    for (let tries = 0; ; tries++) {
      if (!token) token = await getToken(it);
      const res = await request(`${ORIGIN}/${lang}/${g}/AjaxAction/ShoppingCart_Add_AddArticlesFromProductPage`,
        { __cmtkn: token, [`idArticle[${it.aid}]`]: it.aid, [`amount[${it.aid}]`]: String(it.take) });
      if (res.login) throw new Error('connexion demandée');
      if (res.status !== 200) return `refusé (statut ${res.status})`;
      const ans = cartAnswer(res.text || '');
      if (ans.ok) return '';
      // « Time-out, merci de réessayer » = jeton périmé : on en reprend un et on réessaie une fois
      if (tries === 0 && /time-?out|refresh|réessayer|actualise/i.test(ans.msg)) { token = null; continue; }
      return ans.msg || 'refusé par Cardmarket';
    }
  };
  // page de la carte rechargée maintenant : offres fraîches (les disparues sont retirées du scan) + nouveau jeton
  const freshOffers = async (id) => {
    const card = list[id];
    if (!card) return [];
    const res = await request(scanUrl(card));
    const doc = docOf(res);
    const tk = doc.querySelector('input[name="__cmtkn"]')?.value; if (tk) token = tk;
    const fresh = [...doc.querySelectorAll('.article-row')].map(CMParse.parseRow).filter(Boolean);
    if (fresh.length && scans[id]) { // mise à jour du scan : les offres qui devraient être sur la page mais n'y sont plus sont parties
      const keys = new Set(fresh.map(artKey)), top = fresh.length >= 50 ? Math.max(...fresh.map((o) => o.price)) : Infinity;
      scans[id].offers = (scans[id].offers || []).filter((o) => keys.has(artKey(o)) || o.price > top).concat(fresh.filter((o) => !(scans[id].offers || []).some((x) => artKey(x) === artKey(o))));
      chrome.storage.local.set({ ['scan_' + id]: scans[id] }).catch(() => {});
    }
    fresh.forEach((o) => { if (o.country && !country[o.seller]) country[o.seller] = o.country; });
    return fresh;
  };
  // remplace une offre refusée : jusqu'à 3 essais, les offres fraîches d'abord, puis celles du scan
  const replace = async (it, why) => {
    dead.add(String(it.aid));
    planAdd(it.seller, -it.take, -it.take * it.price);
    if (sellerLimit(why)) blockedSellers.add(it.seller); // « montant maximum de copies que ce vendeur vend à la fois » : ce vendeur est exclu
    else if (/maximum|limite|limit/i.test(why)) return null; // (« valeur maximum » : souvent déjà dans ton panier — vérifié à la fin)
    let freshKeys = null;
    for (let k = 0; k < 3 && job.active; k++) {
      job.running.set(it.aid, { t0: Date.now(), rows: 0, label: TF('🔁 Offre partie, recherche d\'une autre : {c}', { c: it.name }) });
      renderProgress();
      if (!freshKeys) freshKeys = new Set((await freshOffers(it.id)).map((o) => String(o.aid)));
      const cand = filteredOffers(list[it.id] || { id: it.id }).filter((o) => o.aid && !dead.has(String(o.aid)) && !blockedSellers.has(o.seller) && (o.qty || 1) >= it.take);
      let best = null;
      for (const o of cand) {
        const a = plan.get(o.seller) || { n: 0, value: 0 }, add = o.price * it.take;
        const c = add + sendCost(o.seller, a.n + it.take, a.value + add) - sendCost(o.seller, a.n, a.value) + (freshKeys.has(String(o.aid)) ? 0 : 0.001); // à prix égal : l'offre vue à l'instant
        if (!best || c < best.c) best = { o, c };
      }
      if (!best) return null;
      const alt = { ...it, aid: best.o.aid, price: best.o.price, seller: best.o.seller };
      const err = await tryAdd(alt);
      if (!err) {
        planAdd(alt.seller, alt.take, alt.take * alt.price);
        const extra = Math.round((best.c - it.take * it.price) * 100) / 100;
        replaced.push({ name: it.name, from: it.seller, to: alt.seller, extra, item: alt });
        logAction(`Remplacée tout de suite : ${it.name} — ${it.seller} → ${alt.seller} (${euro(alt.price)}, écart ${extra >= 0 ? '+' : ''}${euro(extra)})`);
        return alt;
      }
      dead.add(String(alt.aid));
      if (sellerLimit(err)) blockedSellers.add(alt.seller);
      else if (/maximum|limite|limit/i.test(err)) return null;
    }
    return null;
  };
  const okItems = []; // articles bien ajoutés (avec leur offre finale)
  let already = [];
  const [, cartLang] = new URL(ORIGIN + items[0].url).pathname.split('/');
  try { // déjà dans ton panier (même vendeur, même carte) : on ne l'ajoute pas une 2e fois
    const idx0 = await cartIndex(cartLang, game);
    if (idx0) {
      const left = new Map(idx0); // quantité déjà là, consommée article par article
      const next = [];
      for (const it of items) {
        const k = cartKey(it.seller, it.url), have = left.get(k) || 0;
        if (have >= it.take) { already.push(it); left.set(k, have - it.take); }
        else if (have > 0) { next.push({ ...it, take: it.take - have }); left.set(k, 0); } // il en manque : on ajoute seulement la différence
        else next.push(it);
      }
      if (already.length || next.length !== items.length || next.some((x, i) => x.take !== items[i]?.take)) {
        items = next; job.total = job.cartItems = items.length;
        if (already.length) logAction(`${already.length} article(s) déjà dans ton panier (même vendeur, même carte) : pas ré-ajoutés`);
      }
    }
  } catch (e) { if (e.message === 'stop') job.active = false; }
  for (const it of items) {
    if (!job.active) break;
    job.running.set(it.aid, { t0: Date.now(), rows: 0, label: `${it.name} ×${it.take} — ${it.seller}` });
    renderProgress();
    try {
      const err = await tryAdd(it);
      if (!err) okItems.push(it);
      else {
        const alt = await replace(it, err);
        if (alt) okItems.push(alt);
        else { job.failed.push(`${it.name} chez ${it.seller} (${err})`); failedItems.push({ ...it, reason: err }); }
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
  // vérification : on regarde ce qui est VRAIMENT dans ton panier Cardmarket, par vendeur + carte (Cardmarket change souvent
  // le n° d'article quand on prend une partie d'un lot : le n° ne suffit pas). Une carte introuvable est seulement signalée :
  // rien n'est ajouté en plus sur cette base (sinon : doublons dans ton panier)
  try {
    const idx = await cartIndex(cartLang, game);
    if (idx && okItems.length && okItems.some((it) => idx.has(cartKey(it.seller, it.url)))) {
      for (const it of okItems) if (!idx.has(cartKey(it.seller, it.url))) {
        job.failed.push(`${it.name} chez ${it.seller} (pas trouvée dans le panier)`);
        failedItems.push({ ...it, reason: T('pas trouvée dans ton panier : vérifie sur Cardmarket'), check: true });
      }
    }
  } catch (e) { /* vérification impossible : on garde le résultat des réponses */ }
  job.running.clear();
  // ajout « re-scannées » ou « reprise » : on garde les refus précédents des autres cartes
  let failNext = mode ? [...lastCartFailed.filter((f) => !allItems.some((it) => it.aid === f.aid || (f.id && it.id === f.id))), ...failedItems] : failedItems;
  try { // vérité = ton panier : une carte qui y est en quantité suffisante (chez n'importe quel vendeur) n'est plus « pas ajoutée »
    const idxEnd = await cartIndex(cartLang, game);
    if (idxEnd) {
      const byPath = new Map();
      for (const [k, n] of idxEnd) { const pth = k.split('|')[1]; byPath.set(pth, (byPath.get(pth) || 0) + n); }
      lastCartQty = Object.fromEntries(byPath); chrome.storage.local.set({ cmCartQty: lastCartQty });
      failNext = failNext.filter((f) => { const it = list[f.id]; return !(it && (byPath.get(cartKey('', f.url).split('|')[1]) || 0) >= (+it.qty || 1)); });
      const seenCard = new Set(); failNext = failNext.filter((f) => !seenCard.has(f.id) && seenCard.add(f.id)); // une ligne par carte
    }
  } catch (e) { /* panier illisible : on garde la liste */ }
  setCartFailed(failNext);
  // écart de prix des remplacements (et des alternatives) : le « Total à payer » est mis à jour quand tout est dans le panier
  { const ex = replaced.reduce((t, x) => t + x.extra, 0) + (mode === 'alt' ? okItems.reduce((t, x) => t + (x.extra || 0), 0) : 0);
    if (lastResult) {
      const key = compareSig(lastResult.lines); // mêmes cartes / quantités / filtres (le calcul peut changer après le retrait des offres parties)
      if (!cartAdj || cartAdj.key !== key) cartAdj = { key, base: baseTotal, extra: 0 };
      cartAdj.extra = Math.round((cartAdj.extra + ex) * 100) / 100; chrome.storage.local.set({ cmCartAdj: cartAdj });
    } }
  // arrêté avec ⏹ : on garde ce qui reste à ajouter pour le bouton « Reprendre »
  setCartResume(!job.active ? items.slice(job.done) : []);
  // cartes bien ajoutées : plus besoin du bouton « ajouter les re-scannées » pour elles
  { const added = new Set(items.slice(0, job.done).filter((it) => !failedItems.some((f) => f.aid === it.aid)).map((it) => it.id));
    if (cartRetryIds.some((id) => added.has(id))) setCartRetry(cartRetryIds.filter((id) => !added.has(id))); }
  clearInterval(job.timer);
  const stopped = !job.active;
  showCartProg(false, stopped);
  job.active = false; job.kind = '';
  if (job.workerTab != null) { chrome.tabs.remove(job.workerTab).catch(() => {}); job.workerTab = null; }
  const ok = job.done - job.failed.length;
  logAction(`Ajout au panier ${stopped ? 'arrêté' : 'terminé'} : ${ok}/${job.total} article(s)` + (job.failed.length ? ` · pas ajoutés : ${job.failed.slice(0, 10).join(', ')}` : '') + (job.stopReason ? ` · ${job.stopReason}` : ''), job.failed.length || job.stopReason ? 'erreur' : 'info');
  $('progTitle').textContent = stopped ? 'Ajout arrêté' : 'Ajout au panier terminé';
  $('progCount').textContent = `${job.done}/${job.total}`;
  $('progText').textContent = `✔ ${ok} article${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''}` + (job.failed.length ? ` · ${job.failed.length} échec(s)` : '');
  $('progEta').textContent = ''; $('progList').innerHTML = ''; $('stopBtn').hidden = true; $('barFill').style.width = '100%';
  bannerHtml(`<b>🛒 ${ok} article${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''} à ton panier ${CM_LINK}.</b> ` +
    (cartPreNote ? `<br>${cartPreNote.replace(/ <a href=[\s\S]*$/, '')} ` : '') +
    (already.length ? `<br>✔ ${esc(TF('{n} article(s) déjà dans ton panier : pas ajoutés une 2e fois.', { n: already.length }))} ` : '') +
    (replaced.length ? `<br>🔁 ${esc(TF('{n} offre(s) partie(s) remplacée(s) tout de suite (écart {d}) :', { n: replaced.length, d: (replaced.reduce((t, x) => t + x.extra, 0) >= 0 ? '+' : '−') + euro(Math.abs(replaced.reduce((t, x) => t + x.extra, 0))) }))} ${esc(replaced.slice(0, 6).map((x) => `${x.name} (${x.from} → ${x.to})`).join(', ') + (replaced.length > 6 ? ` +${replaced.length - 6}` : ''))} ` : '') +
    `<a href="${ORIGIN}/fr/${encodeURIComponent(game)}/ShoppingCart" target="_blank">Ouvrir mon panier Cardmarket</a> pour vérifier et payer.` +
    (job.failed.length ? `<br>❌ ${job.failed.length} pas ajouté(s) au panier : la liste est à droite, dans « Pas ajoutés au panier ».` : '') +
    (job.stopReason ? `<br>⏹ ${esc(job.stopReason)}` : ''));
  cartPreNote = '';
  if (lastResult) renderBest(); // affiche la liste « Pas ajoutés au panier » à droite
}

// ---------- Comparateur : Shopping Wizard de Cardmarket (même liste, mêmes filtres) ----------
// 1 liste de souhaits par jeu « TCGPRICEHUNTER <JEU> » : créée si besoin, vidée, remplie avec tes cartes (quantité, langues, état),
// puis le Shopping Wizard « Réduire le prix » est lancé dans l'onglet Cardmarket, et on lit son total.
let cmCompare = null; // { sig, date, total, wanted, found, results: [{ game, url, total, value, ship, orders, wanted, found }] }
const compareSig = (lines) => JSON.stringify([lines.map((l) => [l.id, l.qty, cardCond(list[l.id] || {}), effLangs(list[l.id] || {})]).sort(), [...settings.sellerCountries].sort(), +settings.minRating || 0]);
const wantsListName = (game) => ('TCGPRICEHUNTER ' + String(game).toUpperCase().replace(/[^A-Z0-9]/g, '')).slice(0, 30);
const parseEuro = (s) => { const m = String(s || '').replace(/\s/g, '').match(/-?[\d.]*\d+(?:,\d+)?/); return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : NaN; };

// fait aller l'onglet Cardmarket à une adresse et attend qu'elle soit chargée (captcha compris)
async function workerGo(url) {
  const tabId = await workerTab();
  await new Promise((resolve) => {
    let seenLoading = false;
    const l = (id, info) => { if (id !== tabId) return; if (info.status === 'loading') seenLoading = true; if (info.status === 'complete' && seenLoading) { chrome.tabs.onUpdated.removeListener(l); clearTimeout(to); resolve(); } };
    chrome.tabs.onUpdated.addListener(l);
    const to = setTimeout(() => { chrome.tabs.onUpdated.removeListener(l); resolve(); }, 45000);
    chrome.tabs.update(tabId, { url }).catch(() => { chrome.tabs.onUpdated.removeListener(l); clearTimeout(to); resolve(); });
  });
  await sleep(800);
  for (let i = 0; i < 200; i++) { // captcha : on attend que tu coches la case
    const t = await chrome.tabs.get(tabId).catch(() => null);
    if (!t || !/Un instant|Just a moment|Attention Required|Vérification/i.test(t.title || '')) break;
    if (i === 0) banner(T('🛡️ Cardmarket demande une vérification anti-robot : coche la case dans l\'onglet Cardmarket ouvert, ça reprend tout seul.'), 'captcha-wait');
    await sleep(1500);
  }
  return tabId;
}
async function inWorker(func, args = []) {
  const tabId = await workerTab();
  const [res] = await withTimeout(chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func, args }), 30000);
  return res ? res.result : null;
}
const docOf = (res) => new DOMParser().parseFromString((res && res.text) || '', 'text/html');
const wantIds = (doc) => [...new Set([...doc.querySelectorAll('[data-id-want]')].map((e) => e.getAttribute('data-id-want')))];

async function runCompare(opts = {}) {
  logAction('Comparaison Cardmarket lancée');
  if (job.active) return banner(T('Un scan ou un ajout est déjà en cours, attends la fin.'));
  if (!lastResult) return;
  const lines = lastResult.lines;
  const byGame = {};
  lines.forEach((l) => { const it = list[l.id]; if (!it) return; const g = (it.url || '').split('/')[2] || l.game; (byGame[g] = byGame[g] || []).push(it); });
  const games = Object.keys(byGame);
  if (!opts.noConfirm && !confirm(TF('Comparer avec le Shopping Wizard de Cardmarket ?\n\nLa liste de souhaits « {l} » de ton compte Cardmarket sera vidée puis remplie avec tes {n} cartes, puis le Shopping Wizard sera lancé (rien n\'est acheté).', { l: games.map(wantsListName).join(' », « '), n: lines.length }))) return;
  try { chrome.permissions.request({ origins: [ORIGIN + '/*'] }).catch(() => {}); } catch {}
  Object.assign(job, { active: true, queue: [], running: new Map(), done: 0, total: lines.length + games.length * 3, failed: [], pausedUntil: 0, strikes: 0,
    challenge: null, loggedOut: false, t0: Date.now(), durations: [], nextReq: 0, gap: CART_GAP, workerTab: null, workerOpened: 0,
    lastErr: '', challenges: 0, probe: false, probeBusy: false, stopReason: '', pauseReason: '', kind: 'compare', cont: [] });
  job.appTab = await chrome.tabs.getCurrent().catch(() => null);
  job.timer = setInterval(renderProgress, 500);
  $('scanbox').hidden = false; $('stopBtn').hidden = false;
  showScanSite();
  const step = (label) => { job.running.clear(); job.running.set('cmp', { t0: Date.now(), rows: 0, label }); renderProgress(); };
  const results = [];
  let error = '';
  try {
    for (const game of games) {
      const its = byGame[game];
      const lang = (its[0].url || '').split('/')[1] || 'fr';
      const base = `${ORIGIN}/${lang}/${game}`;
      const name = wantsListName(game);
      // 1) la liste « TCGPRICEHUNTER <JEU> » : on la retrouve, ou on la crée
      step(TF('Liste de souhaits « {l} »', { l: name }));
      // toujours LA MÊME liste « TCGPRICEHUNTER <JEU> » : on la retrouve (peu importe la casse ou la langue du site), on la vide
      // et on la réutilise. On n'en crée une que si elle n'existe vraiment pas.
      const findList = (doc) => { for (const a of doc.querySelectorAll('a[href*="/Wants/"]')) { const m = a.getAttribute('href').match(/\/Wants\/(\d+)(?:[/?#]|$)/); const box = a.closest('.card, .col-12, .row'); if (m && box && box.textContent.replace(/\s+/g, ' ').toUpperCase().includes(name.toUpperCase())) return m[1]; } return null; };
      let ov = docOf(await request(`${base}/Wants`));
      const acct = (ov.getElementById('account-dropdown')?.textContent || '').replace(/\(.*$/s, '').trim(); // ton pseudo Cardmarket
      if (ov.querySelector('input[name="username"]')) throw new Error(T('tu n\'es pas connecté à Cardmarket'));
      let idList = findList(ov);
      if (!idList && settings.cmWants?.[game]) { // la liste retenue la dernière fois (si elle existe encore)
        const old = docOf(await request(`${base}/Wants/${settings.cmWants[game]}`));
        if ((old.title || '').toUpperCase().includes(name.toUpperCase())) idList = settings.cmWants[game];
      }
      if (!idList) {
        const f = [...ov.forms].find((x) => /CreateWantsList/.test(x.getAttribute('action') || ''));
        if (!f) throw new Error(T('impossible de créer la liste de souhaits'));
        await request(new URL(f.getAttribute('action'), ORIGIN).href, { __cmtkn: f.querySelector('[name=__cmtkn]').value, wlName: name });
        ov = docOf(await request(`${base}/Wants`));
        idList = findList(ov);
        if (!idList) throw new Error(T('impossible de créer la liste de souhaits'));
      }
      if (settings.cmWants?.[game] !== idList) { settings.cmWants = { ...(settings.cmWants || {}), [game]: idList }; saveSettings(); }
      job.done++;
      // 2) on la vide (comme « Tout cocher » puis « Supprimer la sélection » sur la page de la liste)
      let ld = docOf(await request(`${base}/Wants/${idList}`));
      if (wantIds(ld).length) {
        step(TF('On vide « {l} »', { l: name }));
        // comme « Supprimer la sélection » : le formulaire envoie la liste des ids en JSON (["id1","id2",…]).
        // On l'envoie directement (marche aussi sur Firefox, sans cliquer dans la page)
        const delTok = ld.querySelector('#DeleteForm input[name="__cmtkn"]')?.value || ld.querySelector('input[name="__cmtkn"]')?.value || '';
        await request(`${base}/PostGetAction/WantsList_MassDeleteWants`, { __cmtkn: delTok, idWants: JSON.stringify(wantIds(ld)), idWantsList: idList });
        ld = docOf(await request(`${base}/Wants/${idList}`));
        if (wantIds(ld).length) { // plan B : par la page, comme avant
          await workerGo(`${base}/Wants/${idList}`);
          await inWorker(() => { const ca = document.querySelector('[name=checkAll]'); if (!ca) return 'none'; ca.checked = true; ca.dispatchEvent(new Event('change', { bubbles: true })); document.querySelectorAll('[name="checkWantsRow[]"]').forEach((c) => { c.checked = true; }); setTimeout(() => document.getElementById('deleteSelected')?.click(), 300); return 'ok'; }).catch(() => null);
          const tabId = await workerTab();
          for (let i = 0; i < 40; i++) { await sleep(500); const t = await chrome.tabs.get(tabId).catch(() => null); if (t && t.status === 'complete' && i > 2) break; }
          ld = docOf(await request(`${base}/Wants/${idList}`));
        }
        if (wantIds(ld).length) throw new Error(T('impossible de vider la liste de souhaits'));
      }
      job.done++;
      // 3) on ajoute chaque carte (quantité, langues, état : pas de valeurs pré-remplies), 3 à la fois.
      // L'id de la carte dans ta liste EST son idProduct Cardmarket : pas besoin de recharger sa page.
      // le jeton de sécurité (__cmtkn) : une liste VIDE n'a aucun formulaire, donc pas de jeton. On le prend sur la page
      // « Ajouter une Deck List » de la liste (toujours là), sinon sur la page des listes. C'est le même pour toute la session.
      const freshToken = async () => { const d = docOf(await request(`${base}/Wants/${idList}/AddDeckList`)); return d.querySelector('input[name="__cmtkn"]')?.value || ov.querySelector('input[name="__cmtkn"]')?.value || ''; };
      let token = await freshToken();
      let refreshing = null;
      const missing = [];
      job.gap = 334; // 3 cartes par seconde
      const queue = [...its];
      const addOne = async (it) => {
        const idProduct = it.idProduct || it.id;
        const body = { __cmtkn: token, idProduct, idWantsList: idList, amount: String(it.qty || 1), minCondition: String(COND_RANK[cardCond(it)] || 7), 'extra[isFoil]': '0', wishPrice: '' };
        if (it.idMetacard) body.idMetacard = it.idMetacard;
        effLangs(it).map((l) => CM_LANG_ID[l]).filter(Boolean).forEach((n) => { body[`idLanguage[${n}]`] = String(n); });
        for (let tries = 0; ; tries++) {
          const res = await request(`${base}/AjaxAction/Wantslist_AddWantByProduct`, body);
          if (res.login) throw new Error(T('tu n\'es pas connecté à Cardmarket'));
          const ans = cartAnswer(res.text || '');
          if (ans.ok) return;
          if (tries === 0 && /time-?out|refresh|réessayer|actualise/i.test(ans.msg)) { // jeton périmé : un seul rafraîchissement pour les 3 en même temps
            const used = body.__cmtkn;
            if (token === used) { refreshing = refreshing || freshToken().then((t) => { if (t) token = t; refreshing = null; }); await refreshing; }
            body.__cmtkn = token; continue;
          }
          missing.push(`${it.name} (${ans.msg})`); return;
        }
      };
      const adder = async () => {
        while (queue.length) {
          if (!job.active) throw new Error('stop');
          const it = queue.shift();
          const key = 'add:' + it.id;
          job.running.set(key, { t0: Date.now(), rows: 0, label: TF('Ajout de {c} à la liste', { c: it.name }) });
          renderProgress();
          try { await addOne(it); } finally { job.running.delete(key); }
          job.done++;
        }
      };
      job.running.delete('cmp');
      await Promise.all([adder(), adder(), adder()]);
      // la liste ne doit pas être vide, sinon Cardmarket n'affiche pas le Shopping Wizard
      ld = docOf(await request(`${base}/Wants/${idList}`));
      if (!wantIds(ld).length) throw new Error(T('aucune carte n\'a pu être ajoutée à la liste de souhaits') + (missing.length ? ' : ' + missing.slice(0, 3).join(', ') : ''));
      // 4) le Shopping Wizard « Réduire le prix », avec tes pays de vendeurs et ta réputation minimale
      step(TF('Shopping Wizard Cardmarket ({g})', { g: game }));
      await workerGo(`${base}/Wants/ShoppingWizard?idWantsList=${idList}`);
      const rep = +settings.minRating || 0;
      const sc = settings.sellerCountries.length < COUNTRIES.length ? settings.sellerCountries.map(String) : [];
      // tout est SYNCHRONE dans la page (Firefox n'attend pas une fonction async injectée, surtout si la page change ensuite),
      // et le bouton est cliqué un peu après le retour, pour que la réponse arrive avant le changement de page
      const wizard = async () => inWorker((idL, countries, repu) => {
        if ([...document.querySelectorAll('.alert-danger')].some((a) => /Shopping Wizard/i.test(a.textContent) && /dépass|exceed|überschritt|supera|limit/i.test(a.textContent))) return 'limit';
        const f = document.getElementById('ShoppingWizardForm');
        if (!f) return 'noform';
        const wl = f.querySelector('[name=idWantsList]'); if (wl) wl.value = idL;
        // pays des vendeurs : la liste de Cardmarket est un menu maison (jQuery) au-dessus d'un <select> caché ;
        // il faut passer par le menu (ouvrir, survoler, cliquer), sinon les pays ne sont pas pris en compte
        const sel = f.querySelector('select[name="sellerCountry[]"]');
        const $ = window.jQuery;
        if (sel) {
          const wrap = sel.parentElement;
          if ($) {
            for (const t of [...wrap.querySelectorAll('.selected-item:not(.list-item-template)')]) $(t).trigger('click'); // on vide
            for (const v of countries) {
              const li = wrap.querySelector(`li[data-option-value="${v}"]`);
              if (!li || li.classList.contains('selected')) continue;
              $(wrap).trigger('click'); $(li).trigger('mouseover'); $(li).trigger('click');
            }
          }
          // filet de sécurité : le <select> caché doit avoir exactement ces pays
          [...sel.options].forEach((o) => { o.selected = countries.includes(o.value); });
          if ([...sel.selectedOptions].length !== countries.length) return 'countries';
        }
        f.querySelectorAll('input[name^="sellerType"]').forEach((c) => { c.checked = false; });
        const r = f.querySelector('[name=sellerReputation]'); if (r) { r.value = String(repu); r.dispatchEvent(new Event('change', { bubbles: true })); }
        const m = f.querySelector('[name=maxShippingTime]'); if (m) { m.value = '7'; m.dispatchEvent(new Event('change', { bubbles: true })); }
        const st = f.querySelector('input[name=strategy][value="4"]'); if (!st) return 'nostrategy';
        st.checked = true; st.dispatchEvent(new Event('change', { bubbles: true }));
        const b = f.querySelector('button[type=submit]'); if (!b) return 'nobutton';
        b.disabled = false; b.classList.remove('disabled');
        setTimeout(() => b.click(), 150);
        return 'ok';
      }, [idList, sc, rep >= 2 ? 6 - rep : 5]);
      const limitHit = () => { // « Vous avez dépassé le nombre d'utilisation du Shopping Wizard autorisé pour aujourd'hui. »
        const prev = settings.cmWizard && settings.cmWizard.day === dayKey() ? settings.cmWizard.used : 0;
        settings.cmWizard = { day: dayKey(), acct, used: Math.max(prev + 1, WIZARD_PER_DAY + 1) }; saveSettings();
        return new Error(TF('tu as dépassé les {n} utilisations du Shopping Wizard pour aujourd\'hui sur ce compte Cardmarket. Réessaie demain.', { n: WIZARD_PER_DAY }));
      };
      const pageLimit = async () => (await inWorker(() => [...document.querySelectorAll('.alert-danger')].some((a) => /Shopping Wizard/i.test(a.textContent) && /dépass|exceed|überschritt|supera|limit/i.test(a.textContent))).catch(() => false)) === true;
      let started = await wizard().catch(() => 'maybe'); // pas de réponse : la page a peut-être déjà changé (Firefox) → on regarde si les résultats arrivent
      if (started === 'maybe') started = 'ok';
      if (started === 'noform') { await sleep(1500); await workerGo(`${base}/Wants/ShoppingWizard?idWantsList=${idList}`); started = await wizard().catch(() => 'ok'); } // page pas encore prête : on réessaie une fois
      if (started === 'limit') throw limitHit();
      if (started !== 'ok') throw new Error(T('le Shopping Wizard de Cardmarket n\'a pas démarré') + ` (${started})`);
      const tabId = await workerTab();
      let resUrl = '';
      for (let i = 0; i < 240 && job.active; i++) {
        await sleep(1000);
        const t = await chrome.tabs.get(tabId).catch(() => null);
        if (t && /\/ShoppingWizard\/Results\//.test(t.url || '') && t.status === 'complete') { resUrl = t.url.split('?')[0]; break; }
        if (i % 2 === 1 && t && t.status === 'complete' && await pageLimit()) throw limitHit();
      }
      if (!resUrl) throw new Error(job.active ? T('le Shopping Wizard de Cardmarket ne répond pas') : 'stop');
      job.done++;
      // 5) on lit le résumé : articles recherchés, valeur, articles trouvés, frais de port, commandes, total
      const rd = docOf(await request(resUrl));
      const dd = [...(rd.querySelector('dl')?.querySelectorAll('dd') || [])].map((x) => x.textContent.trim());
      const nWiz = await importWizardOffers(rd);
      if (nWiz) logAction(`Offres du Shopping Wizard ajoutées au calcul : ${nWiz}`);
      if (dd.length < 6) throw new Error(T('résultats du Shopping Wizard illisibles'));
      // utilisations du jour : on compte les résultats d'aujourd'hui dans l'historique du Shopping Wizard (= ton compte)
      try {
        const hist = docOf(await request(`${base}/Wants/ShoppingWizard/Results`));
        const d = new Date(), today = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
        const n = [...hist.querySelectorAll('a[href*="/ShoppingWizard/Results/2"]')].filter((a) => a.textContent.includes(today)).length;
        const prev = settings.cmWizard && settings.cmWizard.day === dayKey() && settings.cmWizard.acct === acct ? settings.cmWizard.used : 0;
        settings.cmWizard = { day: dayKey(), acct, used: Math.max(n, prev + 1) };
      } catch { settings.cmWizard = { day: dayKey(), acct, used: (settings.cmWizard?.day === dayKey() ? settings.cmWizard.used : 0) + 1 }; }
      saveSettings();
      results.push({ game, url: resUrl, wanted: parseInt(dd[0], 10) || 0, value: parseEuro(dd[1]), found: parseInt(dd[2], 10) || 0, ship: parseEuro(dd[3]), orders: parseInt(dd[4], 10) || 0, total: parseEuro(dd[5]), missing,
        trackedExtra: await wizardTrackedExtra(rd) });
      logAction(`Shopping Wizard : ${euro(results.at(-1).total)}, en lettre suivie ${euro(results.at(-1).total + results.at(-1).trackedExtra)}`);
    }
  } catch (e) { error = e.message === 'stop' ? T('comparaison arrêtée') : e.message; }
  clearInterval(job.timer);
  job.active = false; job.kind = ''; job.running.clear();
  if (job.listDirty) { job.listDirty = false; saveList(); }
  if (job.workerTab != null) { chrome.tabs.remove(job.workerTab).catch(() => {}); job.workerTab = null; }
  $('stopBtn').hidden = true; $('scanbox').hidden = true;
  backToApp();
  if (results.length === games.length && !error) {
    cmCompare = { sig: compareSig(lines), date: Date.now(), results,
      total: results.reduce((a, x) => a + x.total, 0), wanted: results.reduce((a, x) => a + x.wanted, 0), found: results.reduce((a, x) => a + x.found, 0) };
    chrome.storage.local.set({ cmCompare });
    logAction(`Comparaison Cardmarket terminée : ${cmCompare.found}/${cmCompare.wanted} articles, total ${euro(cmCompare.total)}`);
    banner(null);
  } else { logAction('Comparaison Cardmarket impossible : ' + (error || '?'), 'erreur'); banner('⚖ ' + T('Comparaison Cardmarket impossible :') + ' ' + (error || '?') + ` [${BUILD}]`); }
  if (!opts.chain) await refreshBest(); // les offres du Shopping Wizard sont dans le calcul : on recalcule
  const missW = !error && lastResult && wizardMissing(lastResult.r, lastResult.lines);
  if (missW && !opts.chain) bannerHtml(`⚠ ${esc(TF('Le Shopping Wizard n\'a pas toutes tes cartes ({a} article(s) sur {b}) : sa comparaison est faussée (détails dans la tuile « Tu économises »).', { a: missW.found, b: missW.expected }))}`);
}

// « Vérifier chez les vendeurs » : le scan ne voit que les offres les moins chères de chaque carte (sur une carte à 0,02 €,
// des dizaines de vendeurs ont le même prix et beaucoup n'apparaissent pas). Pour chaque vendeur du meilleur panier
// (et ceux du Shopping Wizard), on regarde dans SON stock les autres cartes de ta liste : regrouper chez un vendeur
// déjà choisi évite un envoi. Puis on recalcule ; on recommence si de nouveaux vendeurs apparaissent (3 tours max).
// Barème de « Vérifier chez les vendeurs » : de 1 (juste le Shopping Wizard) à 5 (le plus complet, le plus long)
const STOCK_LEVELS = [null,
  ['Cardmarket seul', 'Ajoute juste les vendeurs du Shopping Wizard, sans fouiller de stock.'],
  ['Ton panier', 'Fouille le stock des vendeurs de ton meilleur panier.'],
  ['Panier + Cardmarket', 'Les vendeurs de ton panier et ceux du Shopping Wizard.'],
  ['Plus large', 'En plus, les 30 vendeurs qui ont déjà plusieurs de tes cartes.'],
  ['Complet', 'En plus, les 3 moins chers de chaque carte, et un tour de plus (le plus long).'],
];
const stockLevel = () => Math.min(5, Math.max(1, +settings.stockLevel || 4));
const stockRounds = (lv) => (lv <= 1 ? 0 : lv >= 5 ? 3 : 2);
function stockSellerInfo() { // pays, note… de chaque vendeur, d'après ses offres déjà vues
  const info = {};
  for (const id of Object.keys(scans)) for (const o of [...(scans[id].offers || []), ...(scans[id].wiz?.offers || [])]) if (!info[o.seller] && o.country) info[o.seller] = o;
  return info;
}
// vendeurs à vérifier, par ordre d'intérêt : ceux du panier, ceux du Shopping Wizard, puis les « potentiels » du scan :
// ceux qui ont déjà le plus de tes cartes (ils peuvent tout regrouper) et les 3 moins chers de chaque carte
function stockSellers(lv, round) {
  const sellers = new Set();
  if (lv < 2) return sellers;
  lastResult.r.orders.forEach((o) => sellers.add(o.seller));
  if (lv >= 3) for (const id of Object.keys(scans)) (scans[id].wiz?.offers || []).forEach((o) => sellers.add(o.seller));
  if (round === 0 && lv >= 4) {
    const cover = new Map();
    for (const l of lastResult.lines) new Set(l.offers.map((o) => o.seller)).forEach((x) => cover.set(x, (cover.get(x) || 0) + 1));
    [...cover.entries()].filter(([, n]) => n >= 2).sort((x, y) => y[1] - x[1]).slice(0, 30).forEach(([x]) => sellers.add(x));
  }
  if (round === 0 && lv >= 5) for (const l of lastResult.lines) [...new Map(l.offers.slice().sort((x, y) => x.price - y.price).map((o) => [o.seller, o])).keys()].slice(0, 3).forEach((x) => sellers.add(x));
  return sellers;
}
// cartes à chercher chez chaque vendeur (pas celles dont le scan a déjà vu TOUTES les offres : rien de caché)
function stockQueue(sellers, done, info) {
  const bySeller = new Map();
  for (const S of sellers) {
    if (!info[S]) continue;
    for (const l of lastResult.lines) {
      const it = list[l.id];
      if (!it || done.has(S + '|' + l.id)) continue;
      done.add(S + '|' + l.id);
      if (scans[l.id] && scans[l.id].partial === false) continue;
      const has = [...(scans[l.id]?.offers || []), ...(scans[l.id]?.wiz?.offers || []), ...(scans[l.id]?.stock?.offers || [])].some((o) => o.seller === S);
      if (!has) (bySeller.get(S) || bySeller.set(S, []).get(S)).push(it);
    }
  }
  return bySeller;
}
// temps d'attente estimé pour un barème (au plus : les pages d'extension le raccourcissent souvent)
function stockEstimate(lv) {
  const n0 = lastResult.lines.length;
  let n = 0;
  if (lv >= 2) {
    for (const its of stockQueue(stockSellers(lv, 0), new Set(), stockSellerInfo()).values()) n += its.length;
    if (lv >= 3 && !wizardFresh()) n += 15 * n0; // vendeurs du Shopping Wizard, pas encore connus
    n *= stockRounds(lv) >= 3 ? 1.15 : 1.05; // tours suivants (nouveaux vendeurs du panier)
  }
  return (wizardFresh() ? 0 : n0 * CART_GAP / 1000 + 15) + n / (maxPerMin() * 0.9 * Math.min(1, rateFactor())) * 60 + (lv >= 2 ? 15 : 5);
}
const wizardFresh = () => !!(lastResult && cmCompare && cmCompare.sig === compareSig(lastResult.lines) && Date.now() - cmCompare.date < 24 * 3600e3);
// Fenêtre d'explication avant « Vérifier chez les vendeurs » : la comparaison avec Cardmarket est obligatoire
function stockIntro() {
  return new Promise((resolve) => {
    let back = $('stockIntro');
    if (!back) { back = document.createElement('div'); back.id = 'stockIntro'; back.className = 'wn-back'; document.body.appendChild(back); }
    const games = [...new Set(lastResult.lines.map((l) => ((list[l.id]?.url || '').split('/')[2] || l.game)))];
    back.innerHTML = `<div class="wn panel si" role="dialog" aria-modal="true" aria-labelledby="siTitle">
      <button class="wn-x" data-si="0" title="${esc(T('Fermer'))}">✕</button>
      <h2 id="siTitle">🔎 ${esc(T('Vérifier chez les vendeurs'))}</h2>
      <p>${esc(T('Trouve un panier encore moins cher que le scan, en 3 étapes :'))}</p>
      <ol>
        ${wizardFresh() ? `<li><b>✓ ${esc(T('Comparer avec Cardmarket : déjà fait'))}</b><span>${esc(TF('Le Shopping Wizard a déjà été lancé pour cette liste il y a {t} : il n\'est pas relancé, la fouille commence directement.', { t: fmtDur((Date.now() - cmCompare.date) / 1000) }))}</span></li>` : `<li><b>${esc(T('Comparer avec Cardmarket (obligatoire)'))}</b><span>${esc(TF('Ta liste de souhaits « {l} » est vidée puis remplie avec tes {n} cartes, et le Shopping Wizard de Cardmarket est lancé. Il voit tout le site et ajoute ses vendeurs au calcul.', { l: games.map(wantsListName).join(' », « '), n: lastResult.lines.length }))}</span></li>`}
        <li data-sistep="2"><b>${esc(T('Fouille des stocks'))}</b><span>${esc(T('L\'extension cherche tes autres cartes chez les vendeurs du panier, ceux du Shopping Wizard et les plus intéressants du scan, pour regrouper les commandes et payer moins de port.'))}</span></li>
        <li><b>${esc(T('Nouveau meilleur panier'))}</b><span>${esc(T('Tout est recalculé avec les offres trouvées. Tu vois l\'ancien et le nouveau total.'))}</span></li>
      </ol>
      <div class="si-lv"><div class="si-lv-head"><b>${esc(T('Barème'))}</b><span class="si-eta"></span></div>
        <div class="si-lv-btns">${[1, 2, 3, 4, 5].map((n) => `<button class="btn ghost sm" data-silv="${n}">${n}</button>`).join('')}</div>
        <div class="si-lv-txt"></div></div>
      <p class="si-note">${esc(T('Rien n\'est acheté. Tu peux arrêter quand tu veux : le calcul se fait avec ce qui a déjà été vérifié.'))}</p>
      <div class="wn-foot"><button class="btn ghost" data-si="0">${esc(T('Annuler'))}</button><button class="btn primary" data-si="1">${esc(T('Lancer'))}</button></div></div>`;
    let lv = stockLevel();
    const showLv = () => {
      back.querySelectorAll('[data-silv]').forEach((b) => b.classList.toggle('on', +b.dataset.silv === lv));
      back.querySelector('[data-sistep="2"]')?.classList.toggle('off', lv <= 1);
      back.querySelector('.si-lv-txt').innerHTML = `<b>${lv} · ${esc(T(STOCK_LEVELS[lv][0]))}</b> — ${esc(T(STOCK_LEVELS[lv][1]))}`;
      back.querySelector('.si-eta').textContent = '⏱ ' + TF('≈ {t} d\'attente', { t: fmtDur(Math.round(stockEstimate(lv))) });
    };
    const done = (ok) => { back.hidden = true; document.removeEventListener('keydown', key); if (ok) { settings.stockLevel = lv; saveSettings(); } resolve(ok); };
    const key = (e) => { if (e.key === 'Escape') done(false); };
    back.onclick = (e) => { const l = e.target.closest('[data-silv]'); if (l) { lv = +l.dataset.silv; return showLv(); } const b = e.target.closest('[data-si]'); if (b) done(b.dataset.si === '1'); else if (e.target === back) done(false); };
    showLv();
    document.addEventListener('keydown', key);
    back.hidden = false;
    back.querySelector('[data-si="1"]').focus();
  });
}
async function checkSellerStocks() {
  if (job.active) return banner(T('Un scan ou un ajout est déjà en cours, attends la fin.'));
  if (!lastResult) return;
  if (!(await stockIntro())) return;
  $('stockTip')?.remove(); settings.stockTipAt = Date.now(); saveSettings(); // tu sais déjà à quoi il sert : l'astuce attend une semaine
  const before = { total: lastResult.r.total, sellers: new Set(lastResult.r.orders.map((o) => o.seller)) };
  // 1) Shopping Wizard de Cardmarket (obligatoire) : il voit tout le site et ajoute des vendeurs que le scan n'a pas vus
  if (!wizardFresh()) { // déjà lancé pour cette liste (mêmes cartes, mêmes filtres) depuis moins de 24 h : on ne le refait pas
    const t0 = Date.now();
    await runCompare({ chain: true, noConfirm: true });
    if (job.active) return;
    if (!cmCompare || cmCompare.date < t0) return banner(T('La comparaison avec Cardmarket n\'a pas abouti : la vérification des stocks a besoin d\'elle pour fonctionner. Réessaie.'));
    await refreshBest(); // calcul avec ses vendeurs, en partant de son panier
    if (!lastResult) return;
  }
  // 2) puis le stock de chaque vendeur retenu (selon le barème), et 3) le meilleur panier final
  const lv = stockLevel(), sellerInfo = stockSellerInfo();
  Object.assign(job, { active: true, queue: [], running: new Map(), done: 0, total: 0, failed: [], pausedUntil: 0, strikes: 0,
    challenge: null, loggedOut: false, t0: Date.now(), durations: [], nextReq: 0, gap: baseGap(), workerTab: null, workerOpened: 0,
    lastErr: '', challenges: 0, probe: false, probeBusy: false, stopReason: '', pauseReason: '', kind: 'stock', cont: [], hit1015: false });
  job.appTab = await chrome.tabs.getCurrent().catch(() => null);
  logAction(`Vérification des stocks des vendeurs lancée (barème ${lv})`);
  const done = new Set(), checked = new Set(); let added = 0, error = '';
  // écran d'attente : barre, temps restant (le temps passé en pause captcha / frein ne compte pas) et bouton « Arrêter »
  let pausedMs = 0, lastTick = Date.now(), stopReq = false, calcing = false;
  const paint = () => {
    const now = Date.now(), paused = !!job.challenge || job.pausedUntil > now;
    if (paused) pausedMs += now - lastTick;
    lastTick = now;
    if (calcing) return;
    if (stopReq) return busy(true, T('Arrêt… calcul du meilleur panier avec ce qui a déjà été vérifié'));
    const spent = now - job.t0 - pausedMs, eta = job.done >= 6 && spent > 0 ? (job.total - job.done) * spent / job.done / 1000 : null;
    const sub = job.challenge ? T('⏸ En pause : valide le captcha dans l\'onglet ouvert')
      : job.pausedUntil > now ? `⏸ ${T('Cardmarket freine')} : ${fmtDur((job.pausedUntil - now) / 1000)}…`
      : eta != null ? TF('≈ {t} restantes', { t: fmtDur(Math.max(1, eta)) }) : T('Estimation du temps restant…');
    busy(true, TF('Vérification des stocks des vendeurs : {a} / {b}', { a: job.done, b: job.total }),
      { pct: job.total ? job.done / job.total : 0, sub, paused, onStop: () => { stopReq = true; paint(); } });
  };
  const ticker = setInterval(paint, 500);
  const calc = async () => { calcing = true; busy(true, T('Calcul du meilleur panier (recherche approfondie, quelques secondes)…')); await nextPaint(); await ensureShipTables(); compute(true); calcing = false; };
  try {
    for (let round = 0; round < stockRounds(lv) && job.active && !stopReq; round++) {
      const queue = [...stockQueue(stockSellers(lv, round), done, sellerInfo).entries()];
      if (!queue.length) break;
      job.total += queue.reduce((a, [, its]) => a + its.length, 0); // au pire 1 recherche par carte ; moins avec les pages d'extension
      paint();
      const found = {};
      const norm = (u) => String(u || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/[a-z]{2}\//, '/').split('?')[0];
      const flat = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
      // lit les offres d'une page de stock et garde celles des cartes cherchées ; renvoie les cartes trouvées
      const readRows = (doc, S, want) => {
        const got = new Set(), info = sellerInfo[S];
        for (const r of doc.querySelectorAll('.article-row')) {
          const it = want.get(norm(r.querySelector('a[href*="/Products/"]')?.getAttribute('href')));
          if (!it) continue;
          const tips = [...r.querySelectorAll('[aria-label], [data-bs-original-title]')].map((e) => e.getAttribute('aria-label') || e.getAttribute('data-bs-original-title') || '');
          const price = parseEuro(r.querySelector('.price-container')?.textContent || '');
          if (!isFinite(price)) continue;
          (found[it.id] = found[it.id] || []).push({ seller: S, aid: (r.id.match(/(\d+)/) || [])[1] || '', price, qty: parseInt(r.querySelector('.item-count')?.textContent, 10) || 1,
            country: info.country, cond: r.querySelector('.article-condition .badge')?.textContent.trim() || '', lang: tips.find((t) => LANG_CODE[t] || EN_TO_FR[t]) || '',
            extra: tips.filter((t) => /^(Foil|Signed|Signé|Altered|Altéré)$/i.test(t)).join(', '), rating: info.rating, sales: info.sales || 0, tracked: info.tracked || 0, restricted: 0, stock: 1 });
          got.add(it.id);
        }
        return got;
      };
      const get = async (url) => { const res = await request(url); if (res.login) throw new Error(T('tu n\'es pas connecté à Cardmarket')); return docOf(res); };
      const pageOf = (doc) => { // nombre de pages et nom du paramètre (site= ou page=)
        for (const k of ['site', 'page']) {
          const n = [...doc.querySelectorAll(`a[href*="${k}="]`)].map((a) => +((a.getAttribute('href') || '').match(new RegExp(`[?&]${k}=(\\d+)`)) || [])[1] || 0);
          if (n.some((x) => x > 1)) return { pages: Math.max(...n), key: k };
        }
        return { pages: 1, key: 'site' };
      };
      const diag = { exp: 0, noFilter: 0, tooBig: 0, saved: 0, selects: '' };
      // Un vendeur, toutes ses cartes : quand plusieurs cartes viennent de la même extension, on lit son stock de cette
      // extension page par page (si c'est moins de pages que de cartes à chercher) au lieu d'une recherche par carte
      const worker = async () => {
        while (queue.length && job.active && !stopReq) {
          const [S, its] = queue.shift();
          const groups = new Map(); // jeu + extension -> cartes
          for (const it of its) { const p = norm(it.url).split('/'); const k = (p[1] || it.game || 'Riftbound') + '|' + (p[4] || ''); (groups.get(k) || groups.set(k, []).get(k)).push(it); }
          const lang = (its[0].url || '').split('/')[1] || 'fr';
          let expIds = null; // extensions proposées par le filtre de la page du vendeur : nom -> id
          for (const [k, group] of groups) {
            if (!job.active || stopReq) break;
            const [game, expSlug] = k.split('|');
            const base = `${ORIGIN}/${lang}/${game}/Users/${encodeURIComponent(S)}/Offers/Singles`;
            const left = new Map(group.map((it) => [norm(it.url), it]));
            const byName = async (it) => { readRows(await get(`${base}?name=${encodeURIComponent(String(it.name || '').replace(/\s*\([^)]*\)\s*$/, ''))}`), S, new Map([[norm(it.url), it]])); left.delete(norm(it.url)); job.done++; };
            if (left.size >= 3 && !expIds) { // 1re recherche normale : sa page donne aussi la liste des extensions du filtre
              const it = group[0];
              const doc = await get(`${base}?name=${encodeURIComponent(String(it.name || '').replace(/\s*\([^)]*\)\s*$/, ''))}`);
              readRows(doc, S, new Map([[norm(it.url), it]])); left.delete(norm(it.url)); job.done++;
              expIds = new Map();
              for (const sel of doc.querySelectorAll('select[name]')) for (const o of sel.options) { const t = flat(o.textContent.replace(/\([^)]*\)|\[[^\]]*\]/g, '')); if (o.value && o.value !== '0' && t && !expIds.has(t)) expIds.set(t, [sel.name, o.value]); }
              if (!diag.selects) diag.selects = [...doc.querySelectorAll('select[name]')].map((x) => x.name + '(' + x.options.length + ')').join(', ') || 'aucun menu';
            }
            const idExp = expIds && expIds.get(flat(expSlug));
            if (expIds && !idExp && left.size >= 3) diag.noFilter++;
            if (idExp && left.size >= 3) {
              const n0 = left.size, url = `${base}?${encodeURIComponent(idExp[0])}=${encodeURIComponent(idExp[1])}`;
              const doc = await get(url);
              readRows(doc, S, left).forEach((id) => { for (const [h, it] of left) if (it.id === id) left.delete(h); });
              const { pages, key } = pageOf(doc), rows = doc.querySelectorAll('.article-row').length;
              diag.exp++;
              // (1 seule page sans pagination : on n'y croit que si elle est courte, sinon on finit carte par carte)
              if (rows && (pages > 1 || rows < 20) && pages - 1 < left.size) { // lire les pages suivantes coûte moins que chercher les cartes restantes
                const want = new Map(left);
                for (let p = 2; p <= pages && job.active && !stopReq; p++) readRows(await get(`${url}&${key}=${p}`), S, want).forEach((id) => { for (const [h, it] of left) if (it.id === id) left.delete(h); });
                job.done += pages; job.total -= n0 - pages; diag.saved += n0 - pages; // n0 cartes vérifiées en « pages » requêtes
                left.clear();
              } else { job.done += 1 + n0 - left.size; job.total += 1; diag.tooBig++; } // (requête en plus ; les cartes trouvées sur cette page sont faites)
            }
            for (const it of [...left.values()]) { if (!job.active || stopReq) break; await byName(it); }
          }
          checked.add(S);
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker).map((p) => p.catch((e) => { if (!error) error = e.message === 'stop' ? (job.stopReason || T('arrêté')) : e.message; job.active = false; })));
      logAction(`Stocks, tour ${round + 1} : ${queue.length ? 'arrêté' : 'fini'} · pages d'extension ${diag.exp} (trop longues ${diag.tooBig}, ${diag.saved} recherche(s) évitée(s)) · extension absente du filtre ${diag.noFilter} · menus de la page vendeur : ${diag.selects || '—'}`);
      for (const [id, offers] of Object.entries(found)) {
        const s = scans[id], prev = s.stock && Date.now() - s.stock.date < 24 * 3600e3 ? s.stock.offers : [];
        const keys = new Set(offers.map(artKey));
        s.stock = { date: Date.now(), offers: prev.filter((o) => !keys.has(artKey(o))).concat(offers) };
        added += offers.length;
        await chrome.storage.local.set({ ['scan_' + id]: s });
      }
      if (job.active) await calc(); // (aussi après « Arrêter » : calcul avec ce qui a déjà été vérifié)
    }
  } catch (e) { error = e.message; }
  clearInterval(ticker);
  const stopped = stopReq && !error, a = job.done, b = job.total;
  job.active = false; job.kind = ''; job.running.clear();
  $('scanbox').hidden = true; $('stopBtn').hidden = true;
  if (job.workerTab != null) { chrome.tabs.remove(job.workerTab).catch(() => {}); job.workerTab = null; }
  busy(false);
  backToApp();
  logAction(`Vérification des stocks terminée : ${a} recherche(s), ${added} offre(s) ajoutée(s)` + (stopped ? ' · arrêtée' : '') + (error ? ' · ' + error : ''), error ? 'erreur' : 'info');
  await refreshBest();
  const main = error ? '⚠ ' + error
    : lv <= 1 ? T('Vendeurs du Shopping Wizard ajoutés au calcul (barème 1 : sans fouille des stocks).')
    : (stopped ? TF('Arrêté à {a} / {b}.', { a, b }) + ' ' : '') + TF('Stocks vérifiés chez {n} vendeur(s) : {a} offre(s) en plus prises en compte.', { n: checked.size, a: added });
  let gain = '';
  if (lastResult && isFinite(before.total)) {
    const r = lastResult.r, d = Math.round((before.total - r.total) * 100) / 100;
    const fresh = [...new Set(r.orders.map((o) => o.seller))].filter((x) => !before.sellers.has(x));
    const names = fresh.slice(0, 4).join(', ') + (fresh.length > 4 ? ` +${fresh.length - 4}` : '');
    gain = `<div class="banner-gain${d > 0.004 ? '' : ' same'}">💶 ${esc(euro(before.total))} → <b>${esc(euro(r.total))}</b>`
      + (d > 0.004 ? ` (−${esc(euro(d))})` : ` · ${esc(T('déjà le meilleur panier'))}`)
      + (fresh.length ? ` · ${esc(T('Nouveaux vendeurs :'))} ${esc(names)}` : '') + '</div>';
  }
  const missW = lastResult && wizardMissing(lastResult.r, lastResult.lines);
  const warn = missW ? `<div class="banner-warn">⚠ ${esc(TF('Le Shopping Wizard n\'a pas toutes tes cartes ({a} article(s) sur {b}) : sa comparaison est faussée (détails dans la tuile « Tu économises »).', { a: missW.found, b: missW.expected }))}</div>` : '';
  bannerHtml(esc(main).replace(/\bCardmarket\b/g, CM_LINK) + gain + warn);
}

// Les vendeurs choisis par le Shopping Wizard (Cardmarket voit TOUS les stocks, le scan seulement les offres les moins chères)
// sont ajoutés aux offres de chaque carte : le meilleur panier les prend en compte et ne peut pas être plus cher que le
// sien (à filtres égaux). Rangés à part (s.wiz) : un nouveau scan les garde 24 h.
async function importWizardOffers(rd) {
  const byProduct = {};
  items().forEach((it) => { byProduct[String(it.idProduct || it.id)] = it.id; });
  const add = {};
  for (const card of rd.querySelectorAll('.detailed-result-card')) {
    const seller = card.querySelector('.seller-name a[href*="/Users/"]')?.textContent.trim();
    if (!seller) continue;
    const tips = [...card.querySelectorAll('[aria-label], [data-bs-original-title]')].map((e) => e.getAttribute('aria-label') || e.getAttribute('data-bs-original-title') || '');
    const locEl = card.querySelector('.seller-name [aria-label*=":"], .seller-name [data-bs-original-title*=":"]');
    const country = ((locEl && (locEl.getAttribute('aria-label') || locEl.getAttribute('data-bs-original-title'))) || '').split(':').pop().trim();
    const rating = ((card.querySelector('[class*="fonticon-seller-rating-"]')?.className || '').match(/fonticon-seller-rating-([a-z-]+)/) || [])[1] || '';
    const tracked = tips.some((t) => /suivi est obligatoire|tracked shipping is (required|mandatory)|versand.*pflicht|seguimiento.*obligatori|tracciat.*obbligator/i.test(t)) ? 1 : 0;
    for (const tr of card.querySelectorAll('table tbody tr')) {
      const td = tr.querySelectorAll('td');
      const pid = ((tr.querySelector('.thumbnail-icon')?.getAttribute('data-bs-title') || '').match(/\/(\d+)\/\d+\.(?:jpg|png|webp)/i) || [])[1];
      const id = pid && byProduct[pid];
      if (!id || !scans[id]) continue;
      const rowTips = [...tr.querySelectorAll('[aria-label], [data-bs-original-title]')].map((e) => e.getAttribute('aria-label') || e.getAttribute('data-bs-original-title') || '');
      const lang = rowTips.find((t) => LANG_CODE[t] || EN_TO_FR[t]) || '';
      const extra = rowTips.filter((t) => /^(Foil|Signed|Signé|Altered|Altéré|Playset)$/i.test(t)).join(', ');
      const price = parseEuro(td[td.length - 1]?.textContent || '');
      if (!isFinite(price)) continue;
      (add[id] = add[id] || []).push({ seller, aid: tr.querySelector('[data-id-article]')?.getAttribute('data-id-article') || '', price, qty: parseInt(td[2]?.textContent, 10) || 1,
        country, cond: tr.querySelector('.article-condition .badge')?.textContent.trim() || '', lang, extra, rating, sales: 0, tracked, restricted: 0, wiz: 1 });
    }
  }
  let n = 0;
  for (const [id, offers] of Object.entries(add)) {
    const s = scans[id];
    s.wiz = { date: Date.now(), offers };
    n += offers.length;
    await chrome.storage.local.set({ ['scan_' + id]: s });
  }
  return n;
}

// Le Shopping Wizard n'a pas d'option « envoi suivi » : il compte toujours l'envoi le moins cher.
// Pour comparer à règles égales quand « Toujours en lettre suivie » est coché, on regarde chaque commande qu'il propose
// (pays du vendeur, nombre de cartes, valeur) et on calcule ce que coûterait le passage en envoi suivi.
// Les vendeurs « envoi suivi obligatoire » sont déjà comptés en suivi par Cardmarket : rien à ajouter.
async function wizardTrackedExtra(rd) {
  // 1) la page des résultats (onglet de travail) affiche « Total en lettre suivie » (calculé par wizard.js) : on relit la valeur
  for (let i = 0; i < 24; i++) {
    const v = await inWorker(() => { const e = document.getElementById('tcgph-tracked'); return e ? { t: +e.dataset.total, w: +e.dataset.wizTotal } : null; }).catch(() => null);
    if (v && isFinite(v.t) && isFinite(v.w)) return Math.max(0, Math.round((v.t - v.w) * 100) / 100);
    await sleep(500);
  }
  // 2) sinon, même calcul ici sur la page téléchargée
  try {
    const r = await CMWizard.compute(rd, (c) => loadShipTable(c, settings.myCountry));
    if (r.orders.length) return Math.max(0, Math.round((r.tTotal - r.total) * 100) / 100);
  } catch {}
  return 0;
}
// total du Shopping Wizard tel qu'on le compare : + passage en suivi si « Toujours en lettre suivie » est coché
const cmTotal = () => cmCompare.results.reduce((a, x) => a + x.total + (settings.alwaysTracked ? x.trackedExtra || 0 : 0), 0);
const cmTrackedExtra = () => (settings.alwaysTracked ? cmCompare.results.reduce((a, x) => a + (x.trackedExtra || 0), 0) : 0);

// compteur : Cardmarket limite le Shopping Wizard à 10 utilisations par jour et par compte.
// On peut toujours cliquer ; au-delà, le compteur passe en négatif (-1, -2…).
const WIZARD_PER_DAY = 10;
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const wizardLeft = () => { const w = settings.cmWizard; return WIZARD_PER_DAY - (w && w.day === dayKey() ? w.used : 0); };
function wizardHint() {
  const left = wizardLeft();
  return `<div class="k cmphint">${esc(TF('{n} utilisations par jour sur ce compte', { n: WIZARD_PER_DAY }))} · ${esc(T('reste aujourd\'hui :'))} <b class="${left < 0 ? 'danger' : left <= 2 ? 'warn' : ''}">${left}</b></div>`;
}

// tuile « Tu économises (vs comparateur de prix du site) »
// le Shopping Wizard reste moins cher : pourquoi ? (ses vendeurs que tes filtres excluent)
// Cartes qui manquent au Shopping Wizard (pas ajoutées à la liste de souhaits, ou introuvables pour lui) :
// son total ne les compte pas, la comparaison serait faussée -> on prévient et on compare à cartes égales
function wizardMissing(r, lines) {
  if (!cmCompare) return null;
  const expected = lines.reduce((a, l) => a + (+l.qty || 1), 0);
  const fresh = (id) => { const w = scans[id]?.wiz; return w && w.date >= cmCompare.date - 30 * 60e3 && w.offers.length; };
  const anyWiz = lines.some((l) => fresh(l.id));
  const names = anyWiz ? lines.filter((l) => !fresh(l.id)).map((l) => l.name || list[l.id]?.name || l.id) : [];
  const ids = new Set(anyWiz ? lines.filter((l) => !fresh(l.id)).map((l) => l.id) : []);
  const notAdded = cmCompare.results.flatMap((x) => x.missing || []);
  const short = Math.max(expected - cmCompare.found, 0);
  if (!short && !names.length && !notAdded.length) return null;
  let cost = 0; // ce que ces cartes coûtent dans ton panier (sans le port)
  for (const o of r.orders) for (const x of o.lines) if (ids.has(x.line.id)) cost += x.opt.cost;
  return { expected, found: cmCompare.found, names, notAdded, cost };
}
function wizardMissingHtml(r, lines) {
  const m = wizardMissing(r, lines);
  if (!m) return '';
  const list5 = (a) => esc(a.slice(0, 5).join(', ') + (a.length > 5 ? ` +${a.length - 5}` : ''));
  const fair = m.cost > 0.005 ? cmTotal() - (r.total - m.cost) : null;
  return `<div class="k danger cmp-miss">⚠ ${esc(TF('Le Shopping Wizard n\'a pas toutes tes cartes ({a} article(s) sur {b}) : son total ne les compte pas, la comparaison est faussée.', { a: m.found, b: m.expected }))}
    ${m.names.length ? `<br>${esc(T('Absentes chez lui :'))} ${list5(m.names)}` : ''}
    ${m.notAdded.length ? `<br>${esc(T('Pas ajoutées à la liste de souhaits :'))} ${list5(m.notAdded)}` : ''}
    ${fair != null ? `<br><b>${esc(fair >= 0 ? TF('À cartes égales : environ {d} d\'économie', { d: euro(fair) }) : TF('À cartes égales : environ {d} de plus que Cardmarket', { d: euro(-fair) }))}</b>` : ''}</div>`;
}
function wizardWhy(lines) {
  const why = { note: new Set(), pays: new Set(), langue: new Set(), etat: new Set(), bloque: new Set() };
  for (const l of lines) {
    const it = list[l.id], w = scans[l.id]?.wiz;
    if (!it || !w) continue;
    const langs = effLangs(it), minC = cardCond(it);
    for (const o of w.offers) {
      if ((RATING_RANK[o.rating] || 0) < (+settings.minRating || 0)) why.note.add(o.seller);
      else if (!inScope(o)) why.pays.add(o.seller);
      else if (langs.length && !langs.includes(langOf(o))) why.langue.add(o.seller);
      else if (minC && (COND_RANK[o.cond] || 9) > COND_RANK[minC]) why.etat.add(o.seller);
      else if (blocked[o.seller]) why.bloque.add(o.seller);
    }
  }
  const parts = [];
  if (why.note.size) parts.push(TF('{n} vendeur(s) sous ta note minimale', { n: why.note.size }));
  if (why.pays.size) parts.push(TF('{n} vendeur(s) hors de tes pays', { n: why.pays.size }));
  if (why.langue.size) parts.push(TF('{n} vendeur(s) dans une autre langue', { n: why.langue.size }));
  if (why.etat.size) parts.push(TF('{n} vendeur(s) sous ton état minimum', { n: why.etat.size }));
  if (why.bloque.size) parts.push(TF('{n} vendeur(s) que tu as bloqué(s)', { n: why.bloque.size }));
  if (parts.length) return TF('Le Shopping Wizard reste moins cher car il utilise des vendeurs que tes filtres excluent : {l}. Assouplis ces filtres dans Réglages pour avoir les mêmes.', { l: parts.join(', ') });
  return T('Le Shopping Wizard reste moins cher : relance « Comparer avec Cardmarket » après ton dernier scan, puis « 🔎 Vérifier chez les vendeurs ». S\'il reste un écart, ce sont les frais de port estimés (Cardmarket précise qu\'ils peuvent varier selon l\'envoi choisi).');
}

// total après l'ajout au panier : + l'écart des offres remplacées, quand tout est dans ton panier (plus de « Pas ajoutés »)
const cartAdjOk = () => !!(cartAdj && lastResult && cartAdj.key === compareSig(lastResult.lines) && cartAdj.extra && !lastCartFailed.length);
const shownTotal = (r) => (cartAdjOk() ? Math.round((cartAdj.base + cartAdj.extra) * 100) / 100 : r.total);
function compareTile(r, lines) {
  const ok = cmCompare && cmCompare.sig === compareSig(lines);
  if (!ok) return `<div class="tile cmp"><div class="k">${esc(T('Tu économises (vs comparateur de prix du site)'))}</div>
    <button class="btn sm" data-cmcompare>⚖ ${esc(T('Comparer avec Cardmarket'))}</button>
    ${wizardHint()}</div>`;
  const cmT = cmTotal(), extra = cmTrackedExtra();
  const diff = cmT - shownTotal(r);
  const links = cmCompare.results.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(cmCompare.results.length > 1 ? x.game : T('Voir les résultats Cardmarket'))} ↗</a>`).join(' · ');
  const missHtml = wizardMissingHtml(r, lines);
  return `<div class="tile cmp"><div class="k">${esc(T('Tu économises (vs comparateur de prix du site)'))}</div>
    <div class="v" style="color:${diff > 0.005 ? 'var(--ok)' : diff < -0.005 ? '#f87171' : 'var(--mut)'}">${diff > 0.005 ? euro(diff) : diff < -0.005 ? '− ' + euro(-diff) : '0 €'}</div>
    <div class="k" style="margin-top:4px">${esc(TF('Shopping Wizard Cardmarket : {a}', { a: euro(cmT) }))} · ${links}</div>
    ${extra > 0.005 ? `<div class="k" style="margin-top:2px">${esc(TF('dont {a} pour passer ses envois en lettre suivie, comme ton panier', { a: euro(extra) }))}</div>` : ''}
    ${missHtml}
    ${diff < -0.005 && !missHtml ? `<div class="k cmp-why">⚠ ${esc(wizardWhy(lines))}</div>` : ''}
    ${wizardHint()}
    <button class="btn ghost xs" data-cmcompare title="${esc(T('Relancer la comparaison'))}">↻</button></div>`;
}

// ---------- Mode de scan (clic sur « ⏱ ≈ … ») ----------
let scanEstimateCount = 0;
const SCAN_MODE_TXT = {
  fast: ['⚡ Rapide', '50 offres par carte : les moins chères.', '⚡ Rapide'],
  medium: ['🎯 Moyen', '150 à 350 offres par carte : plus de pages quand les prix sont serrés et que ça peut faire baisser ton panier.', '🎯 Moyen'],
  long: ['🔍 Long (par défaut, recommandé)', '250 à 750 offres par carte : ton pays découpé (particuliers, pros, langues), les gros pays un par un, et les petits pays regroupés (redécoupés s\'ils ont beaucoup d\'offres).', '🔍 Long'],
};
function renderScanMode() {
  const el = $('scanEstimate'); if (!el) return;
  const n = scanEstimateCount, m = scanMode();
  const open = el.classList.contains('open');
  el.innerHTML = `<button type="button" class="sm-btn" data-smopen title="${esc(T('Choisir le mode de scan'))}">${n ? esc(TF('⏱ ≈ {a} pour {n} carte(s)', { a: fmtDur(estimateSec(n)), n })) + ' · ' : ''}${esc(T(SCAN_MODE_TXT[m][2]))} ▾</button>
    <div class="sm-menu" ${open ? '' : 'hidden'}>${Object.keys(SCAN_MODES).map((k) => `<div class="sm-opt ${k === m ? 'on' : ''}" data-smode="${k}">
      <b>${esc(T(SCAN_MODE_TXT[k][0]))}</b><span>${esc(T(SCAN_MODE_TXT[k][1]))}</span>
      <i>${n ? esc(TF('≈ {a} pour {n} carte(s)', { a: fmtDur(estimateSec(n, false, k)), n })) : esc(TF('≈ {a} pour {n} carte(s)', { a: fmtDur(estimateSec(32, false, k)), n: 32 }))}</i></div>`).join('')}</div>`;
}
$('scanEstimate').addEventListener('click', (e) => {
  const el = $('scanEstimate');
  e.stopPropagation();
  if (e.target.closest('[data-smopen]')) { el.classList.toggle('open'); return renderScanMode(); }
  const o = e.target.closest('[data-smode]'); if (!o) return;
  settings.scanMode = o.dataset.smode; saveSettings();
  el.classList.remove('open'); renderScanMode();
});
document.addEventListener('click', (e) => { const el = $('scanEstimate'); if (el && el.classList.contains('open') && !el.contains(e.target)) { el.classList.remove('open'); renderScanMode(); } });

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
  renderCondPick();
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
// Foil (Magic) : certaines cartes n'existent pas en foil -> le choix n'apparaît que si le scan a vu des offres foil
const isFoilOffer = (o) => /\bfoil\b/i.test(o.extra || '');
const isMagic = (it) => /\/Magic\//.test(it.url || '') || it.game === 'Magic';
function foilSelect(it, offersAll) {
  if (!isMagic(it)) return '';
  const nf = (offersAll || []).filter(isFoilOffer).length;
  if (!nf && !it.foil) return '';
  return `<select data-foil title="${esc(T('Foil : avec ou sans version foil'))}">
    <option value="" ${!it.foil ? 'selected' : ''}>${esc(T('Foil ou non'))}</option>
    <option value="N" ${it.foil === 'N' ? 'selected' : ''}>${esc(T('Sans foil'))}</option>
    <option value="Y" ${it.foil === 'Y' ? 'selected' : ''}>${esc(TF('Foil seulement ({n})', { n: nf }))}</option></select>`;
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
  { const nf = 0 && cartFailedIds().length; $('scanFailed').hidden = true; $('scanFailed').textContent = `${T('🔁 Re-scanner les pas ajoutées au panier')} (${nf})`; }
  scanEstimateCount = nChecked;
  renderScanMode();
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
  $('scanRows').innerHTML = `<div class="colhead" id="scanHead"><span><input type="checkbox" class="chk" id="headChk" title="${esc(T('Cocher / décocher toutes les cartes affichées'))}"></span><span></span><span>Carte · langue · état</span><span class="num">Qté</span><span class="num">Offres</span><span class="num">Dès</span><span class="num">Vendeurs</span><span class="num">Scan</span></div>` +
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
        if (s.offers.length && s.offers[0].rating === undefined && +settings.minRating) tags.push('<span class="tag warn">re-scanne pour filtrer les vendeurs</span>');
      }
      return `<div class="row ser ${missingLang(it) ? 'missing' : ''} ${it.checked ? '' : 'off'}" data-id="${esc(it.id)}" style="--ser:${serColor[seriesKey(it)]}">
        <input type="checkbox" data-chk ${it.checked ? 'checked' : ''} title="Sélection (scan + calcul)">
        <a href="${esc(ORIGIN + it.url)}" target="_blank" title="Voir la carte sur Cardmarket"><img loading="lazy" src="${esc(imgUrl(it.img))}" alt=""></a>
        <div class="cardcol"><div class="nm">${esc(it.name)}</div><div class="sub">${esc(it.sub)}${it.cat && cats.includes(it.cat) ? ` · <span class="catname">📁 ${esc(it.cat)}</span>` : ''}</div>
          ${s ? langChips(it, s.offers) : ''}
          <div class="tags">${condSelect(it)}${foilSelect(it, s ? s.offers : [])}<select data-cat title="Catégorie">${catOptions(it.cat)}</select>${tags.join('')}</div></div>
        <div class="num"><input type="number" min="1" max="99" value="${it.qty}" data-qty title="Quantité"></div>
        <div class="num"><b>${s ? offers.length : '—'}</b><span>${s && s.offers.length !== offers.length ? 'sur ' + s.offers.length : ''}</span></div>
        <div class="num"><b>${prices.length ? euro(Math.min(...prices)) : '—'}</b></div>
        <div class="num"><b>${s ? sellers.size : '—'}</b></div>
        <div class="num"><span>${s ? ago(s.date) : ''}</span> <button class="icon" data-rescan title="Scanner cette carte">↻</button> <button class="icon rm" data-rm title="Retirer">✕</button></div>
      </div>`;
    }).join('');
  { const hc = $('headChk'); if (hc) { const n = rows.filter((it) => it.checked).length; hc.checked = rows.length > 0 && n === rows.length; hc.indeterminate = n > 0 && n < rows.length; } }
}

// ---------- Frais de port officiels (API publique de l'aide Cardmarket) ----------
// https://help.cardmarket.com/api/shippingCosts?fromCountry=<vendeur>&toCountry=<toi>
let shipTables = {}; // "from_to" -> [{name, tracked, maxValue, maxWeight, price, virtual}]
const SHIP_MAX_AGE = 14 * 24 * 3600 * 1000; // les tarifs changent rarement : 14 jours
async function loadShipTable(from, to) {
  const key = `${from}_${to}`;
  if (Array.isArray(shipTables[key])) return shipTables[key];
  const cached = (await chrome.storage.local.get('ship_' + key))['ship_' + key];
  // (le stockage transforme Infinity en null : « pas de valeur max » redevient Infinity)
  if (cached && Date.now() - cached.date < SHIP_MAX_AGE) return (shipTables[key] = cached.methods.map((m) => ({ ...m, maxValue: m.maxValue == null ? Infinity : m.maxValue })));
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
// pays sans douane depuis ton pays de livraison (UE -> les 27 ; Suisse -> Suisse + Liechtenstein ; sinon ton pays)
const noCustomsIds = () => COUNTRIES.map(([id]) => id).filter((id) => customsZone(id) === customsZone(+settings.myCountry));
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
// ---------- Europe « frais réduits » : les pays d'Europe dont le port + la douane vers toi restent proches des moins chers ----------
// (ex. Italie -> France : 4,88 € la lettre, contre ~2 € depuis la plupart des pays -> exclue ; Royaume-Uni -> UE : douane -> exclu)
const EUROPE_IDS = COUNTRIES.map(([id]) => id).filter((id) => ![33, 36, 29].includes(id)); // sans Canada, Japon, Singapour
const FEE_REF = [[4, 5, 3], [17, 20, 1]]; // commandes types : petite lettre (compte 3 fois) et lettre moyenne
// frais d'un vendeur de ce pays vers toi (port + douane) pour chaque commande type, et leur moyenne pondérée ; null si tarifs inconnus
function feeInfo(from) {
  const t = shipTables[`${from}_${settings.myCountry}`];
  if (!Array.isArray(t) || !t.length) return null;
  const S = { ...Optimizer.DEFAULTS, ...settings, alwaysTracked: false };
  const R = settings.customs ? customsRule(from, +settings.myCountry) : null;
  const parts = FEE_REF.map(([n, v]) => { const port = Optimizer.shipping(n, v, false, S, t).cost; return port + Optimizer.customs(v, port, R); });
  if (!parts.every(isFinite)) return null;
  const w = FEE_REF.reduce((a, r) => a + r[2], 0);
  return { parts, score: parts.reduce((a, x, i) => a + x * FEE_REF[i][2], 0) / w };
}
const feeScore = (from) => feeInfo(from)?.score ?? null;
// « Sans frais de douane » : tous les pays de ta zone douanière, sans limite de prix (UE -> les 27, Suisse -> CH + LI, R.-U. -> R.-U.…)
const europeIds = () => noCustomsIds();
// charge les tarifs de tous les pays d'Europe vers toi (gardés 14 jours), 6 à la fois
let europeLoading = null;
function loadEuropeTables() {
  const me = +settings.myCountry;
  if (europeLoading && europeLoading.me === me) return europeLoading.p;
  const ids = [...new Set([...COUNTRIES.map(([id]) => id), me])]; // tous les pays : prix affichés sur chaque pays
  const p = (async () => { for (let i = 0; i < ids.length; i += 6) await Promise.all(ids.slice(i, i + 6).map((id) => loadShipTable(id, me))); })();
  europeLoading = { me, p };
  return p;
}
// une fois les tarifs chargés : recalcule « Europe (frais réduits) » si c'est le choix actuel
async function refreshEurope() {
  await loadEuropeTables();
  if (!['auto', 'europe'].includes(settings.sellerPreset)) { if (!$('v-settings').hidden) renderSettings(); return; }
  const before = [...settings.sellerCountries];
  setSellerPreset(settings.sellerPreset);
  if (!sameSet(before, settings.sellerCountries)) { saveSettings(); renderScanned(); }
  renderSettings();
}
// choix rapide des pays de vendeurs : 'all' | 'europe' | 'mine' | 'custom' ('auto' = europe, réglage par défaut) ; ils suivent ton pays de livraison
function setSellerPreset(p) {
  if (p === 'nocustoms') p = 'europe';
  settings.sellerPreset = p;
  if (p === 'all') settings.sellerCountries = [];
  else if (p === 'mine') settings.sellerCountries = [+settings.myCountry];
  else if (p === 'europe' || p === 'auto') settings.sellerCountries = europeIds();
}
const followCountry = () => { if (['mine', 'europe', 'nocustoms', 'auto'].includes(settings.sellerPreset)) setSellerPreset(settings.sellerPreset); else if (settings.sellerCountries.length === 1 && settings.sellerPreset !== 'custom') settings.sellerCountries = [+settings.myCountry]; refreshEurope(); };
// drapeau d'un pays (emoji ; une police de drapeaux est incluse pour Windows)
const flagOf = (id) => { const iso = id === 13 ? 'GB' : ID_ISO[id]; return iso && /^[A-Z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso].map((c) => 0x1f1a5 + c.charCodeAt(0))) : ''; };
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
// « empreinte » de tout ce qui change le meilleur panier : cartes cochées, quantités, offres (filtrées), réglages, tarifs.
// Même empreinte qu'au dernier calcul = même résultat : pas besoin de recalculer en ouvrant « Meilleur panier ».
function bestLines() {
  return items()
    .filter((it) => it.checked && scans[it.id])
    .map((it) => ({ id: it.id, name: it.name, sub: it.sub, game: it.game, url: it.url, qty: it.qty, offers: filteredOffers(it, effLangs(it)) }));
}
function bestSig(lines) {
  const st = Object.keys(settings).filter((k) => !/avg|time|seen|tuto|cmWants|log|uiLang|view|zoom|width|banner|v1\d\d/i.test(k)).sort().map((k) => k + '=' + JSON.stringify(settings[k])).join(';');
  const sh = Object.keys(shipTables).sort().map((k) => k + ':' + (Array.isArray(shipTables[k]) ? shipTables[k].length : '')).join(',');
  const ln = lines.map((l) => l.id + 'x' + l.qty + ':' + l.offers.map((o) => artKey(o) + '@' + o.price + '/' + o.qty).join(',')).join('|');
  let h = 5381; const str = st + '#' + sh + '#' + ln;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h + ':' + str.length;
}
function compute(force) {
  const lines = bestLines();
  const sig = bestSig(lines);
  if (!force && lastResult && lastResult.sig === sig) return false; // rien n'a changé : on garde le résultat
  // le panier précédent sert aussi de départ : avec plus d'offres (Wizard, stocks vérifiés), le total ne peut que baisser ou rester pareil
  let prevSeed = null;
  if (lastResult) { prevSeed = {}; lastResult.r.orders.forEach((o) => o.lines.forEach(({ line }) => { if (!prevSeed[line.id]) prevSeed[line.id] = o.seller; })); }
  // le panier du Shopping Wizard (s'il a été lancé) sert de point de départ : on ne peut faire que mieux ou pareil
  const seed = {};
  lines.forEach((l) => { const w = scans[l.id]?.wiz; if (w && Date.now() - w.date < 24 * 3600e3 && w.offers[0]) seed[l.id] = w.offers[0].seller; });
  lastResult = lines.length ? { r: Optimizer.optimize(lines, { ...settings, shipTableFor, customsFor, deep: true, searchMs: 12000, seeds: [Object.keys(seed).length ? seed : null, prevSeed] }), lines, date: Date.now(), sig } : null;
  // on garde le plan pour entourer en vert les bons vendeurs sur les pages Cardmarket
  if (lastResult) {
    const cards = {};
    lastResult.r.orders.forEach((o) => o.lines.forEach(({ line, opt }) => { cards[line.id] = { seller: o.seller, price: opt.picked[0] ? opt.picked[0].price : opt.cost }; }));
    chrome.storage.local.set({ cmPlan: { date: Date.now(), cards, sellers: lastResult.r.orders.map((o) => o.seller) } });
  }
  return true;
}

function sellerUrl(seller, game) {
  return `${ORIGIN}/fr/${encodeURIComponent(game || 'Riftbound')}/Users/${encodeURIComponent(seller)}`;
}

// choix de la langue dans « Meilleur panier » : seulement parmi les langues déjà présentes dans les scans
function bestLangBar() {
  const its = items().filter((it) => it.checked && scans[it.id]);
  if (!its.length) return '';
  const nCards = {};
  its.forEach((it) => { new Set(scans[it.id].offers.filter(inScope).map(langOf).filter(Boolean)).forEach((l) => { nCards[l] = (nCards[l] || 0) + 1; }); });
  const chosen = Array.isArray(settings.bestLangs) ? settings.bestLangs : [];
  const names = LANGS.map(([n]) => n).filter((n) => nCards[n] || chosen.includes(n));
  if (!names.length) return '';
  return `<div class="panel blang"><div class="blang-row"><b>${esc(T('Langue des cartes'))}</b>
    <div class="chips">${names.map((n) => `<span class="chip ${chosen.includes(n) ? 'on' : ''}" data-blang="${esc(n)}" title="${esc(TF('{a} carte(s) sur {b} ont des offres dans cette langue', { a: nCards[n] || 0, b: its.length }))}">${esc(LANG_CODE[n] || n)} <i>${nCards[n] || 0}/${its.length}</i></span>`).join('')}
    <span class="chip ${chosen.length ? '' : 'on'}" data-blang="" title="${esc(T('Utilise la langue choisie pour chaque carte dans ta liste'))}">${esc(T('Comme dans ma liste'))}</span></div></div>
    <p class="hint">${esc(T('Change la langue sans tout re-scanner : si une carte a pu manquer des offres dans cette langue, seules ces cartes sont re-scannées dans cette langue (quelques secondes), pour avoir vraiment le meilleur prix.'))}</p></div>`;
}

// bulle dorée (1 fois par semaine) à côté de « Vérifier chez les vendeurs »
function stockTip() {
  const b = $('stockBtn');
  if (!b || !lastResult || $('v-best').hidden || document.getElementById('stockTip')) return;
  if (settings.stockTipAt && Date.now() - settings.stockTipAt < 7 * 24 * 3600e3) return;
  settings.stockTipAt = Date.now(); saveSettings();
  const tip = document.createElement('div');
  tip.id = 'stockTip'; tip.className = 'gold-tip';
  tip.innerHTML = `<button class="gt-x" title="${esc(T('Fermer'))}">✕</button><b>🔎 ${esc(T('Astuce : Vérifier chez les vendeurs'))}</b>
    <p>${esc(T('À faire après ton scan : il ajoute les vendeurs de Cardmarket, fouille leurs stocks et ceux des vendeurs déjà enregistrés pour trouver des liaisons que le scan n\'a pas vues, puis un panier encore moins cher.'))}</p>`;
  document.body.appendChild(tip);
  // à droite du bouton ; s'il n'y a pas la place, juste en dessous
  const place = () => {
    const r = b.getBoundingClientRect(), w = tip.offsetWidth;
    const right = r.right + 12 + w <= window.innerWidth - 8;
    tip.classList.toggle('below', !right);
    tip.style.left = (right ? r.right + 12 : Math.max(8, r.right - w)) + window.scrollX + 'px';
    tip.style.top = (right ? r.top - 4 : r.bottom + 10) + window.scrollY + 'px';
  };
  place(); window.addEventListener('resize', place);
  const close = () => { tip.remove(); window.removeEventListener('resize', place); };
  tip.querySelector('.gt-x').onclick = close;
  document.querySelectorAll('.nav').forEach((n) => n.addEventListener('click', close, { once: true }));
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

  h += bestLangBar();

  // avertissements
  const warns = [];
  if (r.short.length) warns.push(`<b>${esc(T('Quantité incomplète'))}</b> ${esc(T('(pas assez d\'exemplaires, même en prenant chez plusieurs vendeurs)'))} : ${r.short.map((l) => `${esc(l.name)} ×${l.qty} (${esc(TF('il en manque {n}', { n: l.missing }))})`).join(', ')}.`);
  if (r.split && r.split.length) warns.push(`ℹ ${esc(T('Réparti chez plusieurs vendeurs (moins cher, ou personne n\'en a assez seul) :'))} ${r.split.map((l) => `${esc(l.name)} ×${l.qty}`).join(', ')}.`);
  if (lines.some((l) => scans[l.id]?.loggedOut)) warns.push("Certaines cartes ont été scannées sans être connecté (50 offres max) : re-scanne-les une fois connecté.");
  if (warns.length) h += `<div class="warnbox">${warns.join('<br>')}</div>`;

  // tuiles
  const saving = r.naive.total - r.total;
  h += `<div class="tiles">
    <div class="tile main"><div class="k">Total à payer</div><div class="v">${euro(shownTotal(r))}</div>${cartAdjOk() ? `<div class="k was">${esc(TF('avant les remplacements : {a}', { a: euro(cartAdj.base) }))}</div>` : ''}</div>
    <div class="tile"><div class="k">Cartes</div><div class="v">${euro(r.items)}</div><div class="k" style="margin-top:4px">${(() => { const nb = r.orders.reduce((a, o) => a + o.n, 0), nu = r.unavailable.length; return esc(TP(`${nb} carte${nb > 1 ? 's' : ''} dans le panier`, '{n} carte(s) dans le panier', { n: nb })) + (nu ? ' · ' + esc(TP(`${nu} introuvable${nu > 1 ? 's' : ''}`, '{n} introuvable(s)', { n: nu })) : ''); })()}</div></div>
    <div class="tile"><div class="k">${TP(`Frais de port · ${r.orders.length} commande${r.orders.length > 1 ? 's' : ''}`, 'Frais de port · {n} commande(s)', { n: r.orders.length })}</div><div class="v">${euro(r.ship)}</div>${r.duty > 0.004 ? `<div class="k" style="margin-top:4px">${esc(TF('+ douane / TVA ≈ {a}', { a: euro(r.duty) }))}</div>` : ''}</div>
    ${compareTile(r, lines)}
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
      ? row(`${esc(T('Tout chez un seul vendeur :'))} <a href="${esc(sellerUrl(r.single.seller, game))}" target="_blank">${esc(r.single.seller)}</a>`, euro(r.single.items), euro(r.single.ship), euro(r.single.total), false, r.single.duty)
      : row(`${esc(T('Tout chez un seul vendeur :'))} <span class="muted">${esc(TF("personne n'a tout (le meilleur en a {a}/{b})", { a: r.top[0] ? r.top[0].covered : 0, b: nAvail }))}</span>`, '—', '—', '—', false, null)}
  </table></div>`;

  // commandes
  const nArt = r.orders.reduce((a, o) => a + o.n, 0);
  const retrySet = new Set(cartRetryIds);
  const nRetry = r.orders.reduce((a, o) => a + o.lines.filter(({ line }) => retrySet.has(line.id)).reduce((b, { opt }) => b + opt.units, 0), 0);
  const nResume = cartResume.reduce((a, it) => a + it.take, 0);
  h += `<div class="cartbar"><button class="btn primary" data-cart="all">${TP(`🛒 Tout ajouter à mon panier Cardmarket (${nArt} carte${nArt > 1 ? 's' : ''})`, '🛒 Tout ajouter à mon panier Cardmarket ({n} carte(s))', { n: nArt })}</button>
    <button class="btn sm ghost" data-cartempty title="${esc(T('Clique le bouton « Vider le panier » de Cardmarket : tous les articles de ton panier sont retirés'))}">${esc(T('🗑 Vider mon panier Cardmarket'))}</button>
    ${nResume ? `<button class="btn sm warnbtn" data-cart="resume">${esc(TF("▶ Reprendre l'ajout ({n} carte(s) restante(s))", { n: nResume }))}</button>` : ''}
    <span class="shipwarn">⚠ Les modes de livraison ne sont pas sélectionnés : tu dois les choisir toi-même dans ton panier Cardmarket avant de payer.</span> <span class="danger">Ne ferme pas cette page pendant l'ajout au panier.</span></div>`;
  h += `<h2 class="sectionTitle">🛒 Les commandes à passer</h2>`;
  h += r.orders.map((o, k) => `<div class="order ${k > 2 ? 'closed' : ''}">
      <div class="oh" data-toggle>
        <span class="chev">▾</span>
        <div><div class="who">${(() => { const c = countryId(o.lines[0]?.opt.picked[0]?.country || ''); return c ? `<span class="flag" title="${esc(cLabel(c, countryName(c)))}">${flagOf(c)}</span> ` : ''; })()}<a href="${esc(sellerUrl(o.seller, game))}" target="_blank">${esc(o.seller)}</a></div>
          <div class="tags"><span class="tag">${TP(`${o.n} carte${o.n > 1 ? 's' : ''}`, '{n} carte(s)', { n: o.n })}</span><span class="tag ok">${esc(o.shipName)} ${euro(o.ship)}</span>${o.tracked ? '<span class="tag warn">envoi suivi seulement</span>' : ''}${o.duty > 0.004 ? `<span class="tag warn" title="${esc(T('Vendeur hors de ta zone douanière : TVA à l\'import + droit de douane / frais de dédouanement (estimation)'))}">${esc(TF('douane ≈ {a}', { a: euro(o.duty) }))}</span>` : ''}</div></div>
        <div class="tot"><b>${euro(o.total)}</b><span>${euro(o.items)} + port ${euro(o.ship)}${o.duty > 0.004 ? ` + ${esc(T('douane'))} ${euro(o.duty)}` : ''}</span></div>
        <button class="btn ghost sm" data-cart="${esc(o.seller)}" title="Ajouter seulement cette commande au panier Cardmarket">🛒 Ajouter</button>
      </div>
      <div class="ob"><table class="t fixed"><colgroup><col style="width:52%"><col style="width:20%"><col style="width:14%"><col style="width:14%"></colgroup>
        <tr><th>Carte</th><th>État / langue</th><th class="r">Prix</th><th class="r">Sous-total</th></tr>
        ${o.lines.map(({ line, opt, missing, part }) => `<tr>
          <td><a href="${esc(ORIGIN + line.url)}" target="_blank">${esc(line.name)}</a> ${part ? `<span class="muted" title="${esc(T('Carte répartie chez plusieurs vendeurs (moins cher, ou personne n\'en a assez seul)'))}">×${opt.units} ${esc(TF('sur {n}', { n: line.qty }))}</span>` : line.qty > 1 ? `<span class="muted">×${line.qty}</span>` : ''}${missing ? ` <span class="tag bad">manque ${missing}</span>` : ''}</td>
          <td class="muted">${esc([...new Set(opt.picked.map((p) => [p.cond, p.lang].filter(Boolean).join(' ')))].join(' · '))}</td>
          <td class="r">${opt.picked.map((p) => euro(p.price) + (p.take > 1 ? ` ×${p.take}` : '')).join(' + ')}</td>
          <td class="r"><b>${euro(opt.cost)}</b></td></tr>`).join('')}
      </table>${o.mergeNote && o.mergeNote.extra < 10 ? `<div class="mergenote">ℹ ${esc(TF('Tout regrouper chez {s} : {n} cartes → {m} {c}, soit {x} de plus. Ce panier est déjà le moins cher.', { s: o.mergeNote.into, n: o.mergeNote.n, m: o.mergeNote.shipName, c: euro(o.mergeNote.ship), x: euro(o.mergeNote.extra) }))}</div>` : ''}</div>
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
  const alts = cartAlternatives();
  const sgn = (d) => (d >= 0 ? '+' : '−') + euro(Math.abs(d));
  const sideCart = lastCartFailed.length ? `<aside class="unavail cartfail"><h3>🛒 ${esc(T('Pas ajoutés au panier'))} <span>${lastCartFailed.length}</span></h3>
    <p class="muted">${esc(T('(souvent : déjà vendus entre-temps) — autre offre déjà trouvée par le scan, sans re-scanner :'))}</p>
    ${alts.n ? `<button class="btn sm warnbtn" data-cartalt>${esc(TF('🔁 Ajouter les alternatives ({n} carte(s), {d})', { n: alts.n, d: sgn(alts.extra) }))}</button>` : ''}
    <ul>${alts.list.map(({ f, alt, extra }) => `<li><a href="${esc(ORIGIN + f.url)}" target="_blank">${esc(f.name)}</a>${f.take > 1 ? ` ×${f.take}` : ''}<div class="muted">${esc(f.seller)} · ${esc(f.reason)}</div>
      <div class="alt">${alt ? `→ ${esc(alt.seller)} · ${euro(alt.price)} <b class="${extra > 0.005 ? 'up' : 'down'}">${sgn(extra)}</b>` : f.check ? '' : `<span class="muted">${esc(T('aucune autre offre dans le scan'))}</span>`}</div></li>`).join('')}</ul>
    ${alts.n ? `<p class="muted small">${esc(T('Écart = prix de l\'alternative + port en plus, comparé à l\'offre refusée.'))}</p>` : ''}</aside>` : '';
  const side = sideUnavail || sideCart ? `<div class="sidecol">${sideUnavail}${sideCart}</div>` : '';
  $('best').innerHTML = `<div class="bestMain">${h}</div>${side}`;
  $('best').classList.toggle('withSide', !!side);
  const cl = (id) => cLabel(+id, countryName(id));
  const scope = !settings.sellerCountries.length ? T('vendeurs de tous les pays') : settings.sellerCountries.length === 1 ? TF('vendeurs : {c}', { c: cl(settings.sellerCountries[0]) }) : TF('{n} pays de vendeurs', { n: settings.sellerCountries.length });
  $('bestSub').textContent = `${TP(`${n} carte${n > 1 ? 's' : ''}`, '{n} carte(s)', { n })} · ${scope} · ${TF('livré en {c}', { c: cl(settings.myCountry) })} · ${T('frais de port officiels Cardmarket')}${settings.alwaysTracked ? ' · ' + T('toujours en suivi') : ''}${settings.customs ? ' · ' + T('douane comptée (estimation)') : ''}`;
}

// ---------- Vue : Réglages ----------
function renderSettings() {
  const w15 = $('warn1015'); if (w15) { w15.hidden = freq1015() < 1; w15.textContent = warn1015Text(); }
  document.querySelectorAll('[data-s]').forEach((el) => {
    const v = settings[el.dataset.s];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
  });
  const own = shipTables[`${settings.myCountry}_${settings.myCountry}`];
  $('letterInfo').innerHTML = Array.isArray(own) && own.length
    ? `<b>${esc(TF('Tarifs officiels {a} → {b}', { a: cLabel(+settings.myCountry, countryName(settings.myCountry)), b: cLabel(+settings.myCountry, countryName(settings.myCountry)) }))}</b> ${esc(T('(mis à jour tout seuls) :'))}<br>` +
      [[4, 5], [17, 20], [40, 30], [80, 60]].map(([n, v]) => { const x = Optimizer.shipping(n, v, false, settings, own); return `${esc(TF('{n} cartes ({v}) :', { n, v: euro(v) }))} ${esc(x.name)} ${euro(x.cost)}`; }).join('<br>') +
      `<br><span class="muted">${esc(T('Lettre 20 g = 4 cartes, 50 g = 17, 100 g = 40. Suivi obligatoire au-dessus de 25 €. Chaque vendeur a les tarifs de SON pays vers le tien.'))}</span>`
    : esc(T('Tarifs officiels pas encore chargés (ils se chargent au calcul du panier). En attendant, les tarifs manuels ci-dessous sont utilisés.'));
  $('defLangs').innerHTML = LANGS.map(([n, c]) => `<span class="chip ${settings.defaultLangs.includes(n) ? 'on' : ''}" data-deflang="${esc(n)}" title="${esc(n)}">${c}</span>`).join('');
  $('defCond').innerHTML = `<option value="">Tous états</option>` + CONDS.slice(0, 6).map(([k, l]) => `<option value="${k}" ${settings.defaultCond === k ? 'selected' : ''}>${TF('{c} et mieux', { c: `${k} (${l})` })}</option>`).join('');
  // pays
  const opts = COUNTRIES.map(([id, n]) => `<option value="${id}" ${+settings.myCountry === id ? 'selected' : ''}>${esc(cLabel(id, n))}</option>`).join('');
  document.querySelectorAll('select[data-s="myCountry"]').forEach((el) => { el.innerHTML = opts; el.value = String(settings.myCountry); el.disabled = false; });
  $('uiLang').innerHTML = I18N.LANGS.map(([c, n, f]) => `<option value="${c}" ${settings.uiLang === c ? 'selected' : ''}>${f} ${n}</option>`).join('');
  const sc = settings.sellerCountries, allIds = COUNTRIES.map(([id]) => id);
  const isAll = !sc.length || sameSet(sc, allIds);
  // « tous les pays » = toutes les cases cochées pour de vrai
  // pays triés du moins cher au plus cher vers toi (frais moyens d'une commande, douane comprise)
  const fees = Object.fromEntries(COUNTRIES.map(([id]) => [id, feeInfo(id)]));
  const sorted = [...COUNTRIES].sort((a, b) => (fees[a[0]]?.score ?? Infinity) - (fees[b[0]]?.score ?? Infinity) || cLabel(a[0], a[1]).localeCompare(cLabel(b[0], b[1])));
  $('sellerChips').innerHTML = sorted.map(([id, n]) => {
    const f = fees[id];
    const tip = f ? TF("Jusqu'à 4 cartes : {a} · jusqu'à 17 cartes : {b} (port + douane)", { a: euro(f.parts[0]), b: euro(f.parts[1]) }) : '';
    return `<span class="chip ${isAll || sc.includes(id) ? 'on' : ''}" data-sellerc="${id}"${tip ? ` title="${esc(tip)}"` : ''}><span class="flag">${flagOf(id)}</span> ${esc(cLabel(id, n))}${f ? ` <small class="fee">${euro(f.score)}</small>` : ''}</span>`;
  }).join('');
  $('europeHint').textContent = TF("Sans frais de douane = tous les pays d'où tu ne paies ni douane ni TVA à l'import vers {c}. Prix sur chaque pays : frais moyens d'une commande. Les pays sont triés du moins cher au plus cher.", { c: cLabel(+settings.myCountry, countryName(settings.myCountry)) });
  const scope = isAll ? 'all' : sameSet(sc, [+settings.myCountry]) ? 'mine' : sameSet(sc, europeIds()) ? 'europe' : 'custom';
  $('sellerScope').value = scope;
  $('sellerScope').querySelector('[value=custom]').textContent = scope === 'custom' ? TF('Choisis ({n} pays)…', { n: sc.length }) : T('Choisir des pays…');
  [['myCountryOnly', 'mine'], ['europeOnly', 'europe'], ['allCountries', 'all']].forEach(([k, v]) => $(k).classList.toggle('on', v === scope));
  const bl = Object.keys(blocked).sort();
  $('nBlocked').textContent = bl.length ? `(${bl.length})` : '';
  $('blockedList').innerHTML = bl.length ? bl.map((s) => `<span class="chip on" data-unblock="${esc(s)}" title="${esc(T('Débloquer'))}">${esc(s)} ✕</span>`).join('') : `<span class="muted">${esc(T('Aucun. Bloque un vendeur avec 🚫 sur une page Cardmarket.'))}</span>`;
  $('nIgnored').textContent = TF('{n} offre(s)', { n: Object.keys(ignored).length });
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
// écran « calcul en cours » : le calcul bloque la page quelques secondes, on le montre (et on évite les clics partout)
let busyStop = null;
function busy(on, txt, prog) { // prog = { pct, sub, paused, onStop } : barre de progression, temps restant et bouton « Arrêter »
  let el = $('busyOverlay');
  if (!el) {
    el = document.createElement('div'); el.id = 'busyOverlay';
    el.innerHTML = '<div class="busy-box"><div class="busy-row"><span class="spinner"></span><b></b></div><div class="busy-prog" hidden><div class="busy-bar"><i></i></div><div class="busy-sub"><small></small><button class="btn ghost sm busy-stop"></button></div></div></div>';
    el.querySelector('.busy-stop').addEventListener('click', () => busyStop && busyStop());
    document.body.appendChild(el);
  }
  el.querySelector('b').textContent = txt || '';
  const p = el.querySelector('.busy-prog');
  p.hidden = !prog;
  busyStop = prog?.onStop || null;
  if (prog) {
    p.querySelector('.busy-bar i').style.width = Math.round(Math.min(1, prog.pct || 0) * 1000) / 10 + '%';
    p.querySelector('small').textContent = prog.sub || '';
    const btn = p.querySelector('.busy-stop');
    btn.hidden = !prog.onStop; btn.textContent = T('⏹ Arrêter et calculer');
    btn.title = T('Arrête la vérification et calcule le meilleur panier avec ce qui a déjà été vérifié');
  }
  el.classList.toggle('paused', !!prog?.paused);
  el.hidden = !on;
}
// clic sur une image de carte (.zoomable) : on l'affiche en grand pour lire son texte ; clic ou Échap pour fermer
document.addEventListener('click', (e) => {
  const im = e.target.closest('img.zoomable');
  let z = $('zoomOverlay');
  if (im) {
    e.stopPropagation();
    if (!z) { z = document.createElement('div'); z.id = 'zoomOverlay'; z.innerHTML = '<img alt="">'; z.addEventListener('click', () => (z.hidden = true)); document.body.appendChild(z); }
    z.querySelector('img').src = im.src; z.querySelector('img').alt = im.alt || '';
    z.hidden = false;
  }
}, true);
document.addEventListener('keydown', (e) => { const z = $('zoomOverlay'); if (e.key === 'Escape' && z && !z.hidden) { z.hidden = true; e.stopPropagation(); } }, true);
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0))));
let bestBusy = false, bestAgain = false, bestForce = false;
async function refreshBest(force) {
  if (force === true) bestForce = true;
  if (bestBusy) { bestAgain = true; return; } // un calcul est déjà en cours : on refera juste après
  bestBusy = true;
  try {
    do {
      bestAgain = false;
      await ensureShipTables();
      const f = bestForce; bestForce = false;
      // rien n'a changé depuis le dernier calcul : on affiche directement le résultat (pas de chargement)
      if (!f && lastResult && lastResult.sig === bestSig(bestLines())) { renderBest(); stockTip(); continue; }
      busy(true, T('Calcul du meilleur panier (recherche approfondie, quelques secondes)…'));
      await nextPaint(); // laisse le temps d'afficher le chargement avant de calculer
      compute(f); renderBest(); renderSettings(); stockTip();
    } while (bestAgain);
  } finally { busy(false); bestBusy = false; }
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
// Firefox ne donne pas toujours l'accès à cardmarket.com à l'installation (ou après une mise à jour) :
// sans lui, la barre « Ajouter » n'apparaît pas sur les pages de cartes. On le vérifie et on propose un bouton.
const HOST_ORIGINS = [ORIGIN + '/*', 'https://product-images.s3.cardmarket.com/*', 'https://help.cardmarket.com/*'];
async function checkHostAccess() {
  let ok = true;
  try { ok = await chrome.permissions.contains({ origins: HOST_ORIGINS }); } catch {}
  if (ok) { if (bannerKey === 'hostaccess') showBanner(null); return; }
  bannerHtml(`🔒 ${esc(T('TCG Price Hunter n\'a pas encore le droit d\'accéder à Cardmarket : la barre « Ajouter » ne peut pas s\'afficher sur les pages de cartes.'))}
    <button class="btn primary sm" id="grantHost" style="margin-left:8px">${esc(T('Autoriser l\'accès à Cardmarket'))}</button>`, 'hostaccess');
  $('grantHost')?.addEventListener('click', async () => {
    try { await chrome.permissions.request({ origins: HOST_ORIGINS }); } catch {}
    checkHostAccess();
  });
}
try { chrome.permissions.onAdded?.addListener(() => checkHostAccess()); chrome.permissions.onRemoved?.addListener(() => checkHostAccess()); } catch {}

function banner(t, key) { showBanner(t ? esc(t).replace(/\bCardmarket\b/g, CM_LINK).replace(/\n/g, '<br>') : null, key); }
function bannerHtml(h, key) { showBanner(h, key); } // (texte écrit par l'extension seulement)
$('bannerClose').addEventListener('click', () => { closedKey = bannerKey; $('banner').hidden = true; });

// ---------- Événements ----------
document.querySelectorAll('.nav').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
$('qScan').addEventListener('input', renderScanned);
$('calcBtn').addEventListener('click', () => switchView('best'));
$('recalcBtn').addEventListener('click', () => refreshBest(true));
$('stockBtn').addEventListener('click', checkSellerStocks);
// (tout cocher / décocher agit sur les cartes affichées : catégorie + recherche)
// case dans l'en-tête : coche / décoche toutes les cartes affichées (catégorie + recherche)
document.addEventListener('change', (e) => {
  if (e.target.id !== 'headChk') return;
  const on = e.target.checked;
  visibleItems().forEach((it) => (it.checked = on)); saveList(); renderScanned();
});
$('allOn').addEventListener('click', () => { visibleItems().forEach((it) => (it.checked = true)); saveList(); renderScanned(); });
$('allOff').addEventListener('click', () => { visibleItems().forEach((it) => (it.checked = false)); saveList(); renderScanned(); });
$('bulkCat').addEventListener('change', (e) => {
  let v = e.target.value;
  if (v === '__label') return;
  if (v === '__new') v = newCategory();
  if (v === null) return renderScanned();
  const checked = items().filter((it) => it.checked);
  if (!checked.length) { banner('Coche d\'abord les cartes à ranger.'); return renderScanned(); }
  const ok = v === '__clear' ? confirm(TF('Retirer {n} carte(s) cochée(s) de leur catégorie (sans catégorie) ?', { n: checked.length }))
    : confirm(TF('Ranger {n} carte(s) cochée(s) dans la catégorie « {c} » ?', { n: checked.length, c: v }));
  if (!ok) return renderScanned();
  const before = catCounts();
  checked.forEach((it) => (it.cat = v === '__clear' ? '' : v));
  dropEmptiedCats(before);
  saveList(); renderScanned();
});
// état minimum : un seul choix pour toutes les cartes (et les prochaines). EX = EX, NM et MT acceptés.
const condBadge = (k) => `<span class="cbadge c-${k}">${k}</span>`;
const condBetter = (k) => CONDS.slice(0, CONDS.findIndex(([c]) => c === k) + 1).map(([c]) => c);
function renderCondPick() {
  const el = $('condPick'); if (!el) return;
  const cur = settings.defaultCond || '';
  const open = el.classList.contains('open');
  el.innerHTML = `<button type="button" class="cp-btn" data-cpopen title="${esc(T('État minimum de toutes tes cartes (et des prochaines) : un état choisi accepte aussi les meilleurs.'))}">🛡 ${cur ? condBetter(cur).reverse().map(condBadge).join('') : `<span class="cp-all">${esc(T('Tous états'))}</span>`}<i>▾</i></button>
    <div class="cp-menu" ${open ? '' : 'hidden'}>
      <div class="cp-opt ${cur ? '' : 'on'}" data-cp=""><span class="cp-all">${esc(T('Tous états'))}</span></div>
      ${CONDS.slice(0, 6).map(([k, l]) => `<div class="cp-opt ${cur === k ? 'on' : ''}" data-cp="${k}">${condBadge(k)}<span>${esc(TF('{c} et mieux', { c: T(l) }))}</span></div>`).join('')}
    </div>`;
}
$('condPick').addEventListener('click', (e) => {
  const el = $('condPick');
  e.stopPropagation(); // sinon le clic « dehors » le referme tout de suite (le bouton vient d'être redessiné)
  if (e.target.closest('[data-cpopen]')) { el.classList.toggle('open'); return renderCondPick(); }
  const o = e.target.closest('[data-cp]'); if (!o) return;
  settings.defaultCond = o.dataset.cp;
  items().forEach((it) => { it.cond = settings.defaultCond; });
  el.classList.remove('open');
  saveSettings(); saveList(); renderScanned(); renderSettings();
});
document.addEventListener('click', (e) => { const el = $('condPick'); if (el && el.classList.contains('open') && !el.contains(e.target)) { el.classList.remove('open'); renderCondPick(); } });
// supprimer les cartes cochées
$('delSel').addEventListener('click', () => {
  const checked = items().filter((it) => it.checked);
  if (!checked.length) return banner(T('Coche d\'abord les cartes à supprimer.'));
  if (!confirm(TF('Supprimer {n} carte(s) cochée(s) de ta liste ?', { n: checked.length }))) return;
  const before = catCounts();
  checked.forEach((it) => { delete list[it.id]; delete scans[it.id]; chrome.storage.local.remove('scan_' + it.id); });
  dropEmptiedCats(before);
  saveList(); renderAll();
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
const rescanCartFailed = () => { const ids = cartFailedIds(); if (ids.length) { setCartRetry(ids); startScan(ids); } }; // (seulement les cartes de CE re-scan)
$('scanFailed').addEventListener('click', rescanCartFailed);
document.addEventListener('click', (e) => { if (e.target.closest('[data-cartempty]')) emptyCartButton(); });
document.addEventListener('click', (e) => { // alternatives déjà scannées pour les cartes refusées (pas de re-scan)
  if (!e.target.closest('[data-cartalt]')) return;
  const items = cartAlternatives().list.filter((x) => x.alt).map(({ f, alt, extra }) => ({ id: f.id, aid: alt.aid, take: f.take, price: alt.price, name: f.name, seller: alt.seller, url: f.url, extra: extra || 0 }));
  if (items.length) addToCart(null, items, 'alt');
});
document.addEventListener('click', (e) => { if (e.target.closest('[data-cmcompare]')) runCompare(); });
$('stopBtn').addEventListener('click', () => { job.queue = []; job.active = false; renderProgress(); $('progText').textContent = 'Arrêt…'; });
$('clearAll').addEventListener('click', () => {
  if (!confirm('Effacer toutes les cartes et leurs scans ?')) return;
  chrome.storage.local.remove([...Object.keys(scans).map((id) => 'scan_' + id), 'cmPlan']);
  const before = catCounts();
  list = {}; scans = {};
  dropEmptiedCats(before);
  saveList(); renderAll();
});

$('scanRows').addEventListener('change', (e) => {
  const row = e.target.closest('.row'); if (!row) return;
  const it = list[row.dataset.id];
  if (e.target.matches('[data-chk]')) { it.checked = e.target.checked; e.target.closest('.row')?.classList.toggle('off', !it.checked); }
  if (e.target.matches('[data-qty]')) it.qty = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1));
  if (e.target.matches('[data-cond]')) it.cond = e.target.value;
  if (e.target.matches('[data-foil]')) it.foil = e.target.value;
  if (e.target.matches('[data-cat]')) {
    const v = e.target.value === '__new' ? newCategory() : e.target.value;
    if (v !== null) { const before = catCounts(); it.cat = v; dropEmptiedCats(before); }
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
    const before = catCounts();
    delete list[id]; delete scans[id];
    chrome.storage.local.remove('scan_' + id);
    dropEmptiedCats(before);
    saveList(); renderAll();
  }
});

$('best').addEventListener('click', (e) => {
  const bl = e.target.closest('[data-blang]');
  if (bl) {
    const l = bl.dataset.blang, cur = Array.isArray(settings.bestLangs) ? settings.bestLangs : [];
    settings.bestLangs = !l ? [] : cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l];
    saveSettings(); logAction('Langue du meilleur panier : ' + (settings.bestLangs.join(', ') || 'comme dans la liste'));
    // pour être sûr d'avoir le meilleur prix : les cartes dont le scan a pu rater des offres dans cette langue
    // sont re-scannées seulement pour cette langue (quelques secondes), puis le panier est recalculé
    const L = settings.bestLangs;
    const todo = L.length ? items().filter((it) => it.checked && needsLangTopUp(it, L)).map((it) => it.id) : [];
    if (todo.length && !job.active) {
      scanLangOverride = [...L];
      topUpPrevMode = settings.scanMode; settings.scanMode = 'fast'; // complément : une page par carte dans cette langue suffit (quelques secondes)
      logAction(`Scan complémentaire en ${L.join(', ')} : ${todo.length} carte(s)`);
      startScan(todo);
      return banner(TF('Recherche des offres en {l} pour {n} carte(s), pour être sûr du meilleur prix…', { l: L.map((x) => LANG_CODE[x] || x).join('/'), n: todo.length }));
    }
    return refreshBest();
  }
  const c = e.target.closest('[data-cart]');
  if (c && lastResult) {
    e.stopPropagation();
    if (c.dataset.cart === 'resume') return addToCart(null, cartResume, 'resume');
    if (c.dataset.cart === 'all') { // « Tout ajouter » : on nettoie d'abord le panier (ce qui n'est pas dans ce meilleur panier), puis on le remplit
      return (async () => { cartPreNote = ''; await cleanCart(true).catch(() => {}); return addToCart(lastResult.r.orders); })();
    }
    const orders = lastResult.r.orders.filter((o) => o.seller === c.dataset.cart);
    return addToCart(orders);
  }
  const t = e.target.closest('[data-toggle]');
  if (t && !e.target.closest('a')) t.parentElement.classList.toggle('closed');
});

// réglages (y compris les copies dans "Cartes scannées" et "Meilleur panier")
document.addEventListener('change', (e) => {
  const k = e.target.dataset.s; if (!k) return;
  settings[k] = e.target.type === 'checkbox' ? e.target.checked : (k === 'defaultCond' ? e.target.value : parseFloat(e.target.value) || 0);
  if (k === 'pagesPerMin') { // vitesse réglée : bornée, et appliquée tout de suite au scan en cours
    settings.pagesPerMin = maxPerMin();
    if (job.active && !job.hit1015) job.gap = job.kind === 'deck' ? baseGap() * 2 : baseGap();
  }
  if (k === 'myCountry') { // nouveau pays de livraison : "mon pays" suit, et on charge ses tarifs
    followCountry();
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
  if (v === 'all' || v === 'mine' || v === 'europe') setSellerPreset(v);
  else { switchView('settings'); $('sellerChips').scrollIntoView({ block: 'center' }); return; }
  saveSettings(); renderSettings(); renderScanned();
});
$('sellerChips').addEventListener('click', (e) => {
  const c = e.target.closest('[data-sellerc]'); if (!c) return;
  const allIds = COUNTRIES.map(([x]) => x), id = +c.dataset.sellerc;
  const cur = settings.sellerCountries.length ? settings.sellerCountries : allIds; // « tous » = toutes cochées
  let next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  if (!next.length) next = [+settings.myCountry]; // jamais aucun pays
  settings.sellerPreset = 'custom'; // toucher une case = « personnalisé »
  settings.sellerCountries = sameSet(next, allIds) ? [] : next;
  saveSettings(); renderSettings(); renderScanned();
});
$('allCountries').addEventListener('click', () => { setSellerPreset('all'); saveSettings(); renderSettings(); renderScanned(); });
$('myCountryOnly').addEventListener('click', () => { setSellerPreset('mine'); saveSettings(); renderSettings(); renderScanned(); });
$('europeOnly').addEventListener('click', () => { setSellerPreset('europe'); saveSettings(); renderSettings(); renderScanned(); });
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
  settings.uiLang = e.target.value; // la langue ne change plus ton pays de livraison
  saveSettings();
  location.reload(); // tout se réaffiche dans la nouvelle langue
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

chrome.storage.local.get('cmReqLog').then((d) => { reqLog = d.cmReqLog || []; const n0 = reqLog.length; pruneLog(); if (reqLog.length !== n0) chrome.storage.local.set({ cmReqLog: reqLog }); const n = $('nReqLog'); if (n) n.textContent = reqLog.length; });
$('exportReqLog').addEventListener('click', exportReqLog);
$('cpStop').addEventListener('click', () => $('stopBtn').click());
$('clearReqLog').addEventListener('click', () => { reqLog = []; chrome.storage.local.set({ cmReqLog: [] }); $('nReqLog').textContent = 0; });

loadAll().then(() => { applyTheme(); startI18n(); renderAll(); decorateBg(); refreshEurope(); checkHostAccess(); const vt = $('verTag'); if (vt) { vt.title = T('Voir les nouveautés') + ' · ' + BUILD; vt.classList.toggle('new', settings.seenVersion !== appVersion); } if (!settings.tutoDone && typeof showTuto === 'function') setTimeout(() => showTuto(0), 400); });

// numéro de version affiché sous le logo (BETA tant que la version n'est pas validée)
// ---------- Choix du site (pour l'instant : Cardmarket ; d'autres sites viendront) ----------
const SITES = [
  { id: 'cardmarket', name: 'Cardmarket', url: 'https://www.cardmarket.com', mark: 'CM',
    games: ['Pokémon', 'Magic', 'Riftbound', 'One Piece', 'Yu-Gi-Oh!', 'Lorcana', 'Dragon Ball Super', 'Digimon', 'Flesh and Blood', 'Star Wars Unlimited', 'Cyberpunk', 'Gundam'] },
];
const siteOf = (id) => SITES.find((x) => x.id === id) || SITES[0];
function toggleSiteMenu(force) {
  let m = $('siteMenu');
  const btn = $('sitePick');
  if (!m) {
    m = document.createElement('div');
    m.id = 'siteMenu'; m.className = 'sitemenu'; m.hidden = true;
    document.body.appendChild(m);
    document.addEventListener('click', (e) => { if (!m.hidden && !m.contains(e.target) && e.target !== btn) toggleSiteMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !m.hidden) toggleSiteMenu(false); });
  }
  const open = force ?? m.hidden;
  if (open) {
    const cur = settings.site || 'cardmarket';
    m.innerHTML = `<div class="sm-title">${esc(T('Choix du site'))}</div>` + SITES.map((x) => `<div class="sm-site ${x.id === cur ? 'on' : ''}">
        <span class="sm-mark">${esc(x.mark)}</span>
        <div><b>${esc(x.name)}</b> ${x.id === cur ? '✓' : ''}<small>${esc(T('Jeux compatibles :'))} ${esc(x.games.join(', '))}… ${esc(T('et tous les jeux du site'))}</small>
        <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(TF('Ouvrir {s}', { s: x.name }))} ↗</a></div></div>`).join('')
      + `<p class="sm-hint">${esc(T('D\'autres sites à proposer ? Passe sur le Discord et mets un message dans le salon suggestions.'))} <a href="https://discord.gg/Vm8vfqznh2" target="_blank" rel="noopener">Discord ↗</a></p>`;
    const r = btn.getBoundingClientRect();
    m.style.left = Math.round(r.left) + 'px'; m.style.top = Math.round(r.bottom + 6) + 'px';
  }
  m.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
}
$('sitePick').addEventListener('click', (e) => { e.stopPropagation(); toggleSiteMenu(); });

// ---------- Version : clic sur « v1.2 » = les nouveautés (point jaune tant que tu ne les as pas vues) ----------
const WN_13 = [
  ['📥 Importer un deck', "Colle le lien d'un deck Riftbound (Piltover Archive ou Riftdecks) : les cartes sont trouvées sur Cardmarket et rangées dans une catégorie au nom du deck. Choisis « deck identique » ou « le moins cher possible » (avant → après, avec l'économie carte par carte)."],
  ['⚖ Comparaison avec Cardmarket', "Nouvelle tuile « Tu économises (vs comparateur de prix du site) » : l'extension lance le Shopping Wizard de Cardmarket avec les mêmes cartes et filtres (liste de souhaits « TCGPRICEHUNTER »), puis compare le total."],
  ['🛃 Sans frais de douane', "Remplace « Europe » : tous les pays d'où tu ne paies pas de douane vers chez toi, sans limite de prix. C'est le choix par défaut."],
  ['Plus d\'offres par carte', "Sans « Montrer plus » (qui faisait bloquer Cardmarket, erreur 1015). Quand les prix sont serrés, l'extension charge plus de pages : ton pays de livraison découpé (particuliers, puis pros et power sellers, puis par langue), puis les autres pays. Si les offres suivantes ne peuvent plus faire baisser ton panier (plus chères que la moins chère + un envoi), elle s'arrête à 1 page : le scan reste rapide."],
  ['Meilleur panier encore plus malin', "L'optimiseur essaie aussi de regrouper des commandes entières et d'échanger des cartes entre vendeurs, et explique quand tout prendre chez un seul vendeur coûterait plus cher."],
  ['État minimum en un clic', "Menu avec les pastilles de couleur de Cardmarket : l'état choisi (et les meilleurs) s'applique à toutes tes cartes et aux prochaines. Nouveau bouton « Supprimer la sélection » en bas de la liste."],
  ['Choix du site et nouveau logo', "Le bouton du site montre les jeux compatibles (Cardmarket pour l'instant), le site est affiché pendant le scan, et l'extension a un nouveau logo."],
];
// Historique complet : toutes les nouveautés, version par version (la plus récente en haut)
const CHANGELOG = [
  ['1.41', [
    ['✨ Foil (Magic)', "Pour les cartes Magic qui existent en foil : choisis « foil ou non », « sans foil » ou « foil seulement ». Le filtre foil actif sur la page Cardmarket est repris quand tu ajoutes la carte."],
    ['🃏 Bonne édition Magic', "Import MTGGoldfish : l'édition de chaque carte (par ex. Invasion ou The List) est reprise en mode « deck identique »."],
    ['🛒 Tout ajouter = panier propre', "« Tout ajouter » retire d'abord de ton panier Cardmarket ce qui n'est pas dans le meilleur panier (liste affichée, tu confirmes), garde ce qui y est déjà et ajoute seulement ce qui manque."],
    ['💶 Total mis à jour', "Une fois tout dans ton panier, le « Total à payer » (et ce que tu économises) tient compte des offres remplacées, avec l'ancien total en dessous."],
    ['🛒 Ajout solide', "Si une offre est partie au moment de l'ajout, l'extension recharge la page de la carte et ajoute tout de suite la meilleure autre offre (port compris), sans jamais rien supprimer de ton panier. L'écart de prix est affiché à la fin."],
    ['🔁 Alternatives sans re-scan', "Pour les cartes pas ajoutées au panier, l'extension propose la meilleure autre offre déjà trouvée par le scan, avec l'écart de prix (port compris), et l'ajoute en un clic."],
  ]],
  ['1.40', [
    ['🔎 Vérifier chez les vendeurs', "Lance la comparaison avec Cardmarket, ajoute ses vendeurs, fouille leurs stocks pour regrouper tes cartes et recalcule un panier encore moins cher. Barre de progression, temps restant, bouton « Arrêter » et ancien → nouveau total à la fin."],
    ['📥 Decks Yu-Gi-Oh!, Pokémon et Magic', "Importe aussi les decks de YGOPRODeck, Limitless TCG et MTGGoldfish, en plus de Piltover Archive et Riftdecks."],
    ['⚡ Moins de recalculs', "Le meilleur panier n'est recalculé que si quelque chose a changé (carte supprimée, nouveau scan, réglage…)."],
    ['⚡ Scan Long plus rapide', "Les petits pays sont regroupés sur une seule page (redécoupés seulement s'ils ont beaucoup d'offres) et 5 cartes sont scannées en même temps au lieu de 3."],
    ['🔍 Long par défaut', "Le scan Long est maintenant le mode par défaut, et son temps estimé tient compte de ce scan plus rapide."],
    ['🎚 Barème de 1 à 5', "Choisis jusqu'où fouiller chez les vendeurs, avec le temps d'attente estimé avant de lancer."],
    ['⏱ Pages par minute réglables', "Dans les Réglages : baisse-les si Cardmarket te bloque (erreur 1015), avec un avertissement dès la première erreur."],
    ['⚠ Cartes manquantes chez Cardmarket', "Si le Shopping Wizard n'a pas toutes tes cartes, tu es prévenu et la comparaison se fait à cartes égales."],
    ['📜 Historique des versions', "Ici : toutes les nouveautés, version par version."],
  ]],
  ['1.35', [
    ['🏆 Meilleur panier plus poussé', "Recherche plus profonde : exacte sur les petites listes, quelques secondes de plus sur les grosses, jamais un moins bon résultat."],
    ['🌐 Rescan de la langue choisie', "Quand tu choisis une langue, seules les cartes dont le scan a pu rater des offres dans cette langue sont rescannées, pour cette langue."],
  ]],
  ['1.34', [
    ['📥 Import de deck à la carte', "En mode « le moins cher », coche « Garder l'original » sur une carte, change le nombre d'exemplaires ou supprime une carte avant d'ajouter le deck."],
    ['🌐 Langue dans le meilleur panier', "Change la langue des cartes sans refaire de scan (parmi les langues déjà scannées)."],
  ]],
  ['1.33', [
    ['✉ Lettre suivie sur le Shopping Wizard', "Sur la page de résultats du Shopping Wizard de Cardmarket, l'extension ajoute « Frais de port en lettre suivie » et « Total en lettre suivie » (pays et prix de chaque vendeur vérifiés avec les tarifs officiels), et la comparaison lit ce total."],
  ]],
  ['1.32', [
    ['⚖ Comparaison à règles égales', "Avec « Toujours en lettre suivie », la comparaison avec Cardmarket compte aussi le port suivi : les deux paniers suivent les mêmes règles."],
    ['Réglages', "Filtre « Ventes min. » retiré ; sur Firefox, un bouton pour autoriser l'accès à Cardmarket s'il manque."],
  ]],
  ['1.31', [
    ['Tutoriel', "Une ✕ pour passer tout le tutoriel d'un coup."],
  ]],
  ['1.3', WN_13],
  ['1.2', [
    ['🇪🇺 Europe (frais réduits)', "Ne garde que les pays d'Europe dont le port + la douane vers chez toi restent bas (3,50 € maximum en moyenne). C'est le choix par défaut."],
    ['Pays triés par frais', "Dans les Réglages, chaque pays affiche ce que coûte une commande depuis chez lui (port + douane), du moins cher au plus cher."],
    ['Filtres appliqués avant de chercher', "Les pays des vendeurs (tous d'un coup), la réputation, la langue et l'état sont envoyés directement à Cardmarket : les offres reçues sont toutes utiles."],
    ['Ton pays trouvé tout seul', "Le pays de livraison est deviné grâce au fuseau horaire et à la langue du navigateur, et tu peux le changer quand tu veux : il ne dépend plus de la langue de l'extension."],
    ['Corrections', 'Frais de port des grosses commandes parfois faux après quelques jours, et derniers textes traduits dans toutes les langues.'],
  ]],
  ['1.1', [
    ['🎉 Première version', "Scan des vendeurs de Cardmarket pour tes cartes, meilleur panier port compris, plusieurs pays de vendeurs et ajout au panier de ton compte en un clic."],
  ]],
];
let appVersion = '';
function showWhatsNew() {
  let back = $('whatsNew');
  if (!back) {
    back = document.createElement('div');
    back.id = 'whatsNew'; back.className = 'wn-back';
    back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-wnclose]')) back.hidden = true; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !back.hidden) back.hidden = true; });
    document.body.appendChild(back);
  }
  back.innerHTML = `<div class="wn panel" role="dialog" aria-modal="true" aria-labelledby="wnTitle">
    <button class="wn-x" data-wnclose title="${esc(T('Fermer'))}">✕</button>
    <h2 id="wnTitle">${esc(T('Nouveautés'))}</h2>
    <p class="wn-sub">${esc(T('Toutes les modifications, version par version.'))}</p>
    ${CHANGELOG.map(([v, list]) => `<h3 class="wn-ver">v${esc(v)}${v === appVersion ? ` <em>${esc(T('actuelle'))}</em>` : ''}</h3>
    <ul>${list.map(([t, d]) => `<li><b>${esc(T(t))}</b><span>${esc(T(d))}</span></li>`).join('')}</ul>`).join('')}
    <div class="wn-foot"><a href="https://github.com/Anastasiophrenelia/TCG-Price-Hunter/releases" target="_blank" rel="noopener">${esc(T('Toutes les versions sur GitHub'))} ↗</a>
    <button class="btn primary" data-wnclose>${esc(T('Fermer'))}</button></div></div>`;
  back.hidden = false;
  back.querySelector('.wn .btn').focus(); back.querySelector('.wn').scrollTop = 0;
  if (settings.seenVersion !== appVersion) { settings.seenVersion = appVersion; saveSettings(); }
  $('verTag').classList.remove('new');
}
const BUILD = 'b2711-0141'; // numéro de version interne : visible dans les erreurs, pour savoir quelle copie tourne
try {
  const m = (globalThis.browser || globalThis.chrome).runtime.getManifest();
  appVersion = m.version;
  const vt = document.getElementById('verTag');
  if (vt) {
    vt.textContent = 'v' + m.version + (BETA ? ' BETA' : '');
    vt.dataset.build = BUILD; vt.setAttribute('aria-label', 'v' + m.version + ' (' + BUILD + ')');
    vt.setAttribute('role', 'button'); vt.tabIndex = 0;
    vt.addEventListener('click', showWhatsNew);
    vt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showWhatsNew(); } });
  }
} catch (e) {}
