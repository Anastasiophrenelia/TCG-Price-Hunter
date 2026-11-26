/*!
 * TCG Price Hunter — © 2026 Anastasiophrenelia. Tous droits réservés.
 * https://github.com/Anastasiophrenelia/TCG-Price-Hunter
 * Toute copie, modification ou redistribution sans autorisation écrite de l'auteur est interdite (voir LICENSE).
 */
// ===== Résultats du Shopping Wizard : combien ça coûterait tout en lettre suivie =====
// Le Shopping Wizard de Cardmarket compte toujours l'envoi le moins cher (souvent une lettre non suivie).
// Pour chaque commande proposée : pays du vendeur + nombre de cartes + valeur -> prix de l'envoi suivi le moins cher
// (tarifs officiels Cardmarket). Si le vendeur paie déjà au moins ce prix, c'est déjà un envoi suivi : on garde son prix.
// Utilisé par la page des résultats (wizard.js) et par la comparaison de l'extension (app.js).
(function (root) {
  const NAMES = {
    12: ['France', 'Frankreich', 'Francia', 'França', 'Frankrijk', 'Francja'],
    7: ['Allemagne', 'Germany', 'Deutschland', 'Alemania', 'Germania', 'Alemanha', 'Duitsland', 'Niemcy'],
    1: ['Autriche', 'Austria', 'Österreich', 'Áustria', 'Oostenrijk'],
    2: ['Belgique', 'Belgium', 'Belgien', 'Bélgica', 'Belgio', 'België', 'Belgia'],
    3: ['Bulgarie', 'Bulgaria', 'Bulgarien', 'Bulgária', 'Bulgarije'],
    33: ['Canada', 'Kanada', 'Canadá'],
    5: ['Chypre', 'Cyprus', 'Zypern', 'Chipre', 'Cipro', 'Cypr'],
    35: ['Croatie', 'Croatia', 'Kroatien', 'Croacia', 'Croazia', 'Croácia', 'Kroatië', 'Chorwacja'],
    8: ['Danemark', 'Denmark', 'Dänemark', 'Dinamarca', 'Danimarca', 'Denemarken', 'Dania'],
    10: ['Espagne', 'Spain', 'Spanien', 'España', 'Spagna', 'Espanha', 'Spanje', 'Hiszpania'],
    9: ['Estonie', 'Estonia', 'Estland', 'Estónia'],
    11: ['Finlande', 'Finland', 'Finnland', 'Finlandia', 'Finlândia'],
    14: ['Grèce', 'Greece', 'Griechenland', 'Grecia', 'Grécia', 'Griekenland', 'Grecja'],
    15: ['Hongrie', 'Hungary', 'Ungarn', 'Hungría', 'Ungheria', 'Hungria', 'Hongarije', 'Węgry'],
    16: ['Irlande', 'Ireland', 'Irland', 'Irlanda', 'Ierland', 'Irlandia'],
    37: ['Islande', 'Iceland', 'Island', 'Islandia', 'Islanda', 'Islândia', 'IJsland'],
    17: ['Italie', 'Italy', 'Italien', 'Italia', 'Itália', 'Italië', 'Włochy'],
    36: ['Japon', 'Japan', 'Japón', 'Giappone', 'Japão', 'Japonia'],
    21: ['Lettonie', 'Latvia', 'Lettland', 'Letonia', 'Lettonia', 'Letónia', 'Letland', 'Łotwa'],
    18: ['Liechtenstein'],
    19: ['Lituanie', 'Lithuania', 'Litauen', 'Lituania', 'Lituânia', 'Litouwen', 'Litwa'],
    20: ['Luxembourg', 'Luxemburg', 'Luxemburgo', 'Lussemburgo', 'Luksemburg'],
    22: ['Malte', 'Malta'],
    24: ['Norvège', 'Norway', 'Norwegen', 'Noruega', 'Norvegia', 'Noorwegen', 'Norwegia'],
    23: ['Pays-Bas', 'Netherlands', 'Niederlande', 'Países Bajos', 'Paesi Bassi', 'Países Baixos', 'Nederland', 'Holandia'],
    25: ['Pologne', 'Poland', 'Polen', 'Polonia', 'Polónia', 'Polska'],
    26: ['Portugal', 'Portogallo', 'Portugalia'],
    27: ['Roumanie', 'Romania', 'Rumänien', 'Rumanía', 'Roménia', 'Roemenië', 'Rumunia'],
    13: ['Royaume-Uni', 'United Kingdom', 'Vereinigtes Königreich', 'Reino Unido', 'Regno Unito', 'Verenigd Koninkrijk', 'Wielka Brytania', 'UK'],
    6: ['Rép. Tchèque', 'République tchèque', 'Czech Republic', 'Czechia', 'Tschechien', 'República Checa', 'Repubblica Ceca', 'Chéquia', 'Tsjechië', 'Czechy'],
    29: ['Singapour', 'Singapore', 'Singapur', 'Singapura'],
    31: ['Slovaquie', 'Slovakia', 'Slowakei', 'Eslovaquia', 'Slovacchia', 'Eslováquia', 'Slowakije', 'Słowacja'],
    30: ['Slovénie', 'Slovenia', 'Slowenien', 'Eslovenia', 'Eslovénia', 'Slovenië', 'Słowenia'],
    4: ['Suisse', 'Switzerland', 'Schweiz', 'Suiza', 'Svizzera', 'Suíça', 'Zwitserland', 'Szwajcaria'],
    28: ['Suède', 'Sweden', 'Schweden', 'Suecia', 'Svezia', 'Suécia', 'Zweden', 'Szwecja'],
  };
  const key = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const BY_KEY = {};
  for (const [id, list] of Object.entries(NAMES)) for (const n of list) BY_KEY[key(n)] = +id;
  const tipsOf = (el) => [...el.querySelectorAll('[aria-label], [data-bs-original-title], [title]')].map((e) => e.getAttribute('aria-label') || e.getAttribute('data-bs-original-title') || e.getAttribute('title') || '');
  const num = (s) => { const m = String(s || '').replace(/\s/g, '').match(/-?[\d.]*\d+(?:,\d+)?/); return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : 0; };

  // « Localisation de l'article: France » (le libellé change avec la langue du site, le pays aussi)
  function countryOf(card) {
    for (const t of tipsOf(card.querySelector('.seller-name') || card)) {
      if (!t.includes(':')) continue;
      const id = BY_KEY[key(t.split(':').pop())];
      if (id) return id;
    }
    return 0;
  }
  // icône « Un envoi suivi est obligatoire pour ce vendeur »
  const mandatory = (card) => tipsOf(card).some((t) => /suivi est obligatoire|tracked shipping is (required|mandatory)|versand.*(pflicht|erforderlich)|seguimiento.*obligatorio|tracciat.*obbligatori|rastre.*obrigat|verplicht/i.test(t));

  // prix en envoi suivi d'une commande : au moins l'envoi suivi officiel le moins cher pour ce poids / cette valeur
  function trackedShip(n, value, ship, table) {
    const O = root.Optimizer;
    const t = O.shipping(n, value, true, { ...O.DEFAULTS, alwaysTracked: false }, table && table.length ? table : null).cost;
    if (!(t < 900)) return ship; // pas de tarif trouvé
    return Math.max(ship, t);
  }

  // doc = page des résultats ; getTable(idPays) -> tarifs officiels (pays -> pays de livraison) ou null
  async function compute(doc, getTable) {
    const orders = [];
    for (const card of doc.querySelectorAll('.detailed-result-card')) {
      const dds = [...card.querySelectorAll('dl dd')].map((x) => x.textContent.trim());
      const value = num(dds[1]), ship = num(dds[2]);
      const n = [...card.querySelectorAll('table tbody tr')].reduce((a, tr) => a + (parseInt(tr.children[2]?.textContent, 10) || 1), 0) || num(dds[0]) || 1;
      const cid = countryOf(card);
      let tShip = ship;
      if (!mandatory(card)) {
        let table = null;
        try { table = cid ? await getTable(cid) : null; } catch {}
        tShip = trackedShip(n, value, ship, table);
      }
      orders.push({ card, cid, n, value, ship, tShip: Math.round(tShip * 100) / 100 });
    }
    const sum = (f) => Math.round(orders.reduce((a, o) => a + f(o), 0) * 100) / 100;
    return { orders, value: sum((o) => o.value), ship: sum((o) => o.ship), total: sum((o) => o.value + o.ship), tShip: sum((o) => o.tShip), tTotal: sum((o) => o.value + o.tShip) };
  }

  const api = { compute, countryOf, trackedShip };
  if (typeof module !== 'undefined') module.exports = api;
  else root.CMWizard = api;
})(typeof window !== 'undefined' ? window : globalThis);
