/*!
 * TCG Price Hunter — © 2026 Anastasiophrenelia. Tous droits réservés.
 * https://github.com/Anastasiophrenelia/TCG-Price-Hunter
 * Toute copie, modification ou redistribution sans autorisation écrite de l'auteur est interdite (voir LICENSE).
 */
// ===== TCG Price Hunter — calcul du panier le moins cher (cartes + frais de port) =====
// Utilisable dans la page (window.Optimizer) et dans Node (tests).
(function (root) {
  const DEFAULTS = {
    cardW: 4,             // poids d'une carte (g) — seulement si les tarifs officiels ne sont pas dispo
    packW: 4,             // emballage (g)
    letterMaxW: 20,       // lettre : 20 g max
    letterPrice: 1.82,    // Lettre
    letterMaxValue: 25,   // valeur max d'une lettre simple (€), 0 = pas de limite
    trackedLetterPrice: 2.52, // Lettre suivie (Tracked Letter)
    parcelMaxW: 250,      // colis : 250 g max
    parcelPrice: 6.49,    // Colis suivi (Tracked Parcel)
    franceOnly: true,     // seulement des vendeurs qui expédient depuis la France
    alwaysTracked: false, // true = tu veux toujours une lettre suivie (les vendeurs "suivi obligatoire" ne sont plus pénalisés)
  };

  // poids d'un envoi selon le nombre de cartes (barème Cardmarket : lettre 20 g = 4 cartes, 50 g = 17, 100 g = 40)
  function weightFor(n) {
    if (n <= 4) return 20;
    if (n <= 17) return 50;
    if (n <= 40) return 100;
    return Math.ceil(n * 2.5) + 30;
  }

  // table = modes d'envoi officiels Cardmarket pour (pays du vendeur -> ton pays) :
  // [{name, tracked, maxValue, maxWeight, price, virtual}]
  function shipping(n, value, tracked, S, table) {
    if (n <= 0) return { cost: 0, name: '' };
    tracked = tracked || !!S.alwaysTracked;
    if (table && table.length) {
      const w = weightFor(n);
      const ok = table.filter((m) => !m.virtual && m.maxWeight >= w && value <= m.maxValue && (!tracked || m.tracked));
      if (ok.length) {
        const b = ok.reduce((a, c) => (c.price < a.price ? c : a));
        return { cost: b.price, name: b.name, tracked: b.tracked };
      }
      // trop lourd / trop cher pour un seul envoi : plusieurs envois du plus gros mode possible
      const cand = table.filter((m) => !m.virtual && (!tracked || m.tracked));
      if (cand.length) {
        const big = cand.reduce((a, c) => (c.maxWeight > a.maxWeight || (c.maxWeight === a.maxWeight && c.price < a.price) ? c : a));
        const k = Math.max(Math.ceil(w / big.maxWeight), isFinite(big.maxValue) ? Math.ceil(value / big.maxValue) : 1);
        return { cost: k * big.price, name: `${k} × ${big.name}`, tracked: big.tracked };
      }
      return { cost: 999, name: "pas d'envoi possible" };
    }
    const w = S.packW + n * S.cardW;
    if (w <= S.letterMaxW) {
      if (!tracked && (!S.letterMaxValue || value <= S.letterMaxValue)) return { cost: S.letterPrice, name: 'Lettre' };
      return { cost: S.trackedLetterPrice, name: 'Lettre suivie' };
    }
    const k = Math.ceil(w / S.parcelMaxW);
    return { cost: k * S.parcelPrice, name: k > 1 ? `${k} colis suivis` : 'Colis suivi' };
  }

  const maxLetterCards = (S) => Math.max(0, Math.floor((S.letterMaxW - S.packW) / S.cardW));

  // lines: [{id, name, qty, offers:[{seller,price,qty,cond,lang,country,tracked}]}]
  function buildProblem(lines, S) {
    const sellerTracked = new Map();
    const sellerTable = new Map(); // vendeur -> tarifs officiels de son pays vers le tien (ou null)
    const L = lines.map((line) => {
      const offers = (line.offers || []).filter((o) => o.price != null);
      const bySeller = new Map();
      for (const o of offers) {
        const k = o.seller;
        if (!bySeller.has(k)) bySeller.set(k, []);
        bySeller.get(k).push(o);
        if (o.tracked) sellerTracked.set(k, true);
        if (!sellerTable.has(k)) sellerTable.set(k, S.shipTableFor ? S.shipTableFor(o.country) : null);
      }
      const options = [];
      for (const [seller, list] of bySeller) {
        list.sort((a, b) => a.price - b.price);
        let need = line.qty, cost = 0, units = 0;
        const picked = [];
        for (const o of list) {
          if (need <= 0) break;
          const take = Math.min(need, o.qty);
          cost += take * o.price; need -= take; units += take;
          picked.push({ ...o, take });
        }
        options.push({ seller, cost, units, enough: need <= 0, picked });
      }
      const full = options.filter((o) => o.enough).sort((a, b) => a.cost - b.cost);
      // personne n'a la quantité : on prend celui qui en a le plus (puis le moins cher)
      const fallback = full.length ? null
        : options.slice().sort((a, b) => b.units - a.units || a.cost - b.cost)[0] || null;
      return { ...line, options: full, fallback, nOffers: offers.length };
    });
    return { L, sellerTracked, sellerTable };
  }

  function makeState(P, S) {
    const agg = new Map(); // seller -> {n, value}
    const add = (seller, units, cost, sign) => {
      const a = agg.get(seller) || { n: 0, value: 0 };
      a.n += sign * units; a.value += sign * cost;
      if (a.n <= 0) agg.delete(seller); else agg.set(seller, a);
    };
    const ship = (seller, n, value) => shipping(n, value, !!P.sellerTracked.get(seller), S, P.sellerTable.get(seller)).cost;
    const shipOf = (seller) => { const a = agg.get(seller); return a ? ship(seller, a.n, a.value) : 0; };
    return { agg, add, ship, shipOf };
  }

  function evaluate(P, assign, S) {
    const st = makeState(P, S);
    let items = 0;
    P.L.forEach((l, i) => {
      const o = assign[i];
      if (!o) return;
      items += o.cost;
      st.add(o.seller, o.units, o.cost, 1);
    });
    let ship = 0;
    for (const s of st.agg.keys()) ship += st.shipOf(s);
    return { items, ship, total: items + ship };
  }

  // Recherche locale : déplacer une carte chez un autre vendeur, ou fermer une commande entière
  function improve(P, assign, S) {
    const st = makeState(P, S);
    P.L.forEach((l, i) => { const o = assign[i]; if (o) st.add(o.seller, o.units, o.cost, 1); });
    const movable = P.L.map((l) => l.options.length > 1);

    const moveDelta = (i, to) => {
      const from = assign[i];
      if (from.seller === to.seller) return 0;
      const a = st.agg.get(from.seller), b = st.agg.get(to.seller) || { n: 0, value: 0 };
      const aBefore = st.ship(from.seller, a.n, a.value);
      const aAfter = a.n - from.units > 0 ? st.ship(from.seller, a.n - from.units, a.value - from.cost) : 0;
      const bBefore = b.n > 0 ? st.ship(to.seller, b.n, b.value) : 0;
      const bAfter = st.ship(to.seller, b.n + to.units, b.value + to.cost);
      return to.cost - from.cost + (aAfter - aBefore) + (bAfter - bBefore);
    };
    const apply = (i, to) => {
      const from = assign[i];
      st.add(from.seller, from.units, from.cost, -1);
      st.add(to.seller, to.units, to.cost, 1);
      assign[i] = to;
    };

    for (let iter = 0, improved = true; improved && iter < 60; iter++) {
      improved = false;
      // 1) déplacements simples
      P.L.forEach((l, i) => {
        if (!movable[i] || !assign[i]) return;
        let best = null, bestD = -1e-9;
        for (const opt of l.options) {
          if (opt.seller === assign[i].seller) continue;
          const d = moveDelta(i, opt);
          if (d < bestD) { bestD = d; best = opt; }
        }
        if (best) { apply(i, best); improved = true; }
      });
      // 2) fermer une commande : répartir ses cartes chez les autres
      for (const seller of [...st.agg.keys()]) {
        if (!st.agg.has(seller)) continue;
        const idx = P.L.map((l, i) => i).filter((i) => assign[i] && assign[i].seller === seller);
        if (!idx.length || idx.some((i) => !movable[i])) continue;
        const saved = idx.map((i) => assign[i]);
        let delta = 0, ok = true;
        for (const i of idx) {
          let best = null, bestD = Infinity;
          for (const opt of P.L[i].options) {
            if (opt.seller === seller) continue;
            const d = moveDelta(i, opt);
            if (d < bestD) { bestD = d; best = opt; }
          }
          if (!best) { ok = false; break; }
          delta += bestD; apply(i, best);
        }
        if (ok && delta < -1e-9) improved = true;
        else idx.forEach((i, k) => { if (assign[i] !== saved[k]) apply(i, saved[k]); });
      }
    }
    return assign;
  }

  function optimize(lines, settings) {
    const S = { ...DEFAULTS, ...(settings || {}) };
    const P = buildProblem(lines, S);
    const base = P.L.map((l) => l.options[0] || l.fallback || null);

    // Départ 1 : chaque carte au moins cher (sans regarder le port)
    const naive = evaluate(P, base, S);

    // Départs suivants : on part des vendeurs qui ont le plus de cartes
    const coverage = new Map();
    P.L.forEach((l) => l.options.forEach((o) => coverage.set(o.seller, (coverage.get(o.seller) || 0) + 1)));
    const topSellers = [...coverage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map((e) => e[0]);

    const starts = [base.slice()];
    for (const s of topSellers) starts.push(P.L.map((l, i) => l.options.find((o) => o.seller === s) || base[i]));

    let best = null;
    for (const st of starts) {
      const a = improve(P, st, S);
      const ev = evaluate(P, a, S);
      if (!best || ev.total < best.ev.total - 1e-9) best = { assign: a.slice(), ev };
    }

    // Construction des commandes
    const orders = new Map();
    P.L.forEach((l, i) => {
      const o = best.assign[i];
      if (!o) return;
      if (!orders.has(o.seller)) orders.set(o.seller, { seller: o.seller, lines: [], items: 0, n: 0 });
      const ord = orders.get(o.seller);
      ord.lines.push({ line: l, opt: o, missing: o.enough ? 0 : l.qty - o.units });
      ord.items += o.cost; ord.n += o.units;
    });
    const orderList = [...orders.values()].map((o) => {
      const tracked = !!P.sellerTracked.get(o.seller);
      const sh = shipping(o.n, o.items, tracked, S, P.sellerTable.get(o.seller));
      return { ...o, tracked, ship: sh.cost, shipName: sh.name, total: o.items + sh.cost };
    }).sort((a, b) => b.lines.length - a.lines.length || a.total - b.total);

    // Top vendeurs (une seule commande chez eux pour ce qu'ils ont)
    const top = topSellersTable(P, S);

    return {
      settings: S,
      total: best.ev.total, items: best.ev.items, ship: best.ev.ship,
      orders: orderList,
      naive,
      single: top.find((t) => t.covered === P.L.filter((l) => l.options.length).length && t.covered > 0) || null,
      top,
      unavailable: P.L.filter((l) => !l.options.length && !l.fallback),
      short: P.L.filter((l) => !l.options.length && l.fallback),
      nLines: P.L.length,
    };
  }

  function topSellersTable(P, S) {
    const map = new Map();
    P.L.forEach((l) => l.options.forEach((o) => {
      if (!map.has(o.seller)) map.set(o.seller, { seller: o.seller, covered: 0, items: 0, n: 0 });
      const t = map.get(o.seller);
      t.covered++; t.items += o.cost; t.n += o.units;
    }));
    return [...map.values()].map((t) => {
      const sh = shipping(t.n, t.items, !!P.sellerTracked.get(t.seller), S, P.sellerTable.get(t.seller));
      return { ...t, ship: sh.cost, shipName: sh.name, total: t.items + sh.cost, tracked: !!P.sellerTracked.get(t.seller) };
    }).sort((a, b) => b.covered - a.covered || a.total - b.total).slice(0, 30);
  }

  const api = { DEFAULTS, shipping, optimize, maxLetterCards, weightFor };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Optimizer = api;
})(typeof window !== 'undefined' ? window : globalThis);
