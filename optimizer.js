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

  // douane / TVA à l'import (estimation) quand le vendeur est hors de ta zone douanière
  // rule = { rate, limit, flat, over } : TVA sur (cartes + port) + droit fixe si ≤ limit, sinon frais de dédouanement
  function customs(value, ship, rule) {
    if (!rule || value <= 0) return 0;
    const base = value + ship;
    return Math.round((base * rule.rate + (base <= rule.limit ? rule.flat : rule.over)) * 100) / 100;
  }

  const maxLetterCards = (S) => Math.max(0, Math.floor((S.letterMaxW - S.packW) / S.cardW));

  // lines: [{id, name, qty, offers:[{seller,price,qty,cond,lang,country,tracked}]}]
  // Une « option » pour une carte = une façon de l'acheter : chez UN vendeur, ou répartie chez 2-3 vendeurs
  // (ex. 4 chez A + 3 chez B). Toutes les options sont dans le même calcul : le meilleur panier choisit parmi tout.
  // option = { seller (1er vendeur), sellers:[…], parts:[{seller, units, cost, picked}], cost, units, enough, picked }
  const mkOpt = (parts, qty) => {
    const cost = parts.reduce((t, p) => t + p.cost, 0), units = parts.reduce((t, p) => t + p.units, 0);
    return { seller: parts[0].seller, sellers: parts.map((p) => p.seller), parts, cost, units, enough: units >= qty, picked: parts.flatMap((p) => p.picked), multi: parts.length > 1 };
  };
  // les exemplaires les moins chers parmi plusieurs vendeurs, en utilisant chacun d'eux au moins une fois
  function comboOpt(copiesBySeller, sellers, qty) {
    const pool = [];
    sellers.forEach((s) => copiesBySeller.get(s).forEach((c) => pool.push(c)));
    pool.sort((x, y) => x.price - y.price);
    const take = new Map(sellers.map((s) => [s, []]));
    // d'abord 1 exemplaire (le moins cher) de chaque vendeur, puis les moins chers du reste
    sellers.forEach((s) => take.get(s).push(copiesBySeller.get(s)[0]));
    let n = sellers.length;
    if (n > qty) return null;
    const used = new Set(sellers.map((s) => copiesBySeller.get(s)[0]));
    for (const c of pool) { if (n >= qty) break; if (used.has(c)) continue; take.get(c.seller).push(c); used.add(c); n++; }
    if (n < qty) return null;
    const parts = sellers.map((s) => {
      const cs = take.get(s), byOffer = new Map();
      cs.forEach((c) => { const k = c.o; byOffer.set(k, (byOffer.get(k) || 0) + 1); });
      const picked = [...byOffer].map(([o, t]) => ({ ...o, take: t }));
      return { seller: s, units: cs.length, cost: cs.reduce((t, c) => t + c.price, 0), picked };
    });
    return mkOpt(parts, qty);
  }

  function buildProblem(lines, S) {
    const sellerTracked = new Map();
    const sellerTable = new Map(); // vendeur -> tarifs officiels de son pays vers le tien (ou null)
    const sellerCustoms = new Map(); // vendeur -> règle de douane (ou null si même zone douanière)
    // vendeurs qui ont le plus de cartes de ta liste (probablement dans le panier) : on les essaie en priorité dans les répartitions
    const cover = new Map();
    lines.forEach((l) => new Set((l.offers || []).map((o) => o.seller)).forEach((s) => cover.set(s, (cover.get(s) || 0) + 1)));
    const topCover = [...cover].sort((x, y) => y[1] - x[1]).slice(0, 8).map((e) => e[0]);
    const L = lines.map((line) => {
      const offers = (line.offers || []).filter((o) => o.price != null && o.qty > 0);
      const bySeller = new Map();
      for (const o of offers) {
        const k = o.seller;
        if (!bySeller.has(k)) bySeller.set(k, []);
        bySeller.get(k).push(o);
        if (o.tracked) sellerTracked.set(k, true);
        if (!sellerTable.has(k)) sellerTable.set(k, S.shipTableFor ? S.shipTableFor(o.country) : null);
        if (!sellerCustoms.has(k)) sellerCustoms.set(k, S.customsFor ? S.customsFor(o.country) : null);
      }
      // exemplaires de chaque vendeur (au plus la quantité voulue), du moins cher au plus cher
      const copies = new Map();
      for (const [seller, list] of bySeller) {
        list.sort((a, b) => a.price - b.price);
        const cs = [];
        for (const o of list) for (let k = 0; k < o.qty && cs.length < line.qty; k++) cs.push({ seller, price: o.price, o });
        copies.set(seller, cs);
      }
      const singles = [];
      for (const [seller, cs] of copies) {
        const byOffer = new Map(); cs.forEach((c) => byOffer.set(c.o, (byOffer.get(c.o) || 0) + 1));
        singles.push(mkOpt([{ seller, units: cs.length, cost: cs.reduce((t, c) => t + c.price, 0), picked: [...byOffer].map(([o, t]) => ({ ...o, take: t })) }], line.qty));
      }
      const full = singles.filter((o) => o.enough).sort((a, b) => a.cost - b.cost);
      // répartitions chez 2 (ou 3 si personne n'en a assez) vendeurs, parmi les moins chers + ceux qui ont beaucoup de tes cartes
      let combos = [];
      if (line.qty >= 2 && copies.size >= 2) {
        const short = !full.length;
        const unit = (s) => copies.get(s)[0].price;
        const cheap = [...copies.keys()].sort((x, y) => unit(x) - unit(y)).slice(0, short ? 12 : 8);
        const cand = [...new Set([...cheap, ...topCover.filter((s) => copies.has(s))])];
        const seen = new Set();
        const add = (ss) => { const k = ss.slice().sort().join('|'); if (seen.has(k)) return; seen.add(k); const o = comboOpt(copies, ss, line.qty); if (o) combos.push(o); };
        for (let x = 0; x < cand.length; x++) for (let y = x + 1; y < cand.length; y++) add([cand[x], cand[y]]);
        if (short) for (let x = 0; x < cand.length; x++) for (let y = x + 1; y < cand.length; y++) for (let z = y + 1; z < cand.length; z++) add([cand[x], cand[y], cand[z]]);
        // une répartition plus chère (en cartes) que la meilleure option chez un seul vendeur + 2 envois ne peut pas gagner
        const bestSingle = full.length ? full[0].cost : Infinity;
        combos = combos.filter((o) => o.cost < bestSingle + 12).sort((p, q) => p.cost - q.cost).slice(0, 60);
      }
      const options = full.concat(combos).sort((a, b) => a.cost - b.cost);
      // vraiment pas assez d'exemplaires, même en répartissant : on prend tout ce qui existe (le plus d'exemplaires)
      let fallback = null;
      if (!options.length && copies.size) {
        const all = [...copies.keys()].sort((x, y) => copies.get(y).length - copies.get(x).length);
        const o = all.length > 1 ? comboOpt(copies, all.slice(0, 3), Math.min(line.qty, all.slice(0, 3).reduce((t, s) => t + copies.get(s).length, 0))) : null;
        fallback = o && o.units > (singles.sort((p, q) => q.units - p.units)[0]?.units || 0) ? { ...o, enough: false } : singles.sort((p, q) => q.units - p.units || p.cost - q.cost)[0] || null;
      }
      return { ...line, options, fallback, nOffers: offers.length };
    });
    return { L, sellerTracked, sellerTable, sellerCustoms };
  }

  function makeState(P, S) {
    const agg = new Map(); // seller -> {n, value}
    const add = (seller, units, cost, sign) => {
      const a = agg.get(seller) || { n: 0, value: 0 };
      a.n += sign * units; a.value += sign * cost;
      if (a.n <= 0) agg.delete(seller); else agg.set(seller, a);
    };
    const addOpt = (o, sign) => o.parts.forEach((p) => add(p.seller, p.units, p.cost, sign));
    const shipOnly = (seller, n, value) => shipping(n, value, !!P.sellerTracked.get(seller), S, P.sellerTable.get(seller)).cost;
    // coût d'une commande en plus des cartes = port + douane éventuelle
    const ship = (seller, n, value) => { const c = shipOnly(seller, n, value); return c + customs(value, c, P.sellerCustoms.get(seller)); };
    const shipOf = (seller) => { const a = agg.get(seller); return a ? ship(seller, a.n, a.value) : 0; };
    const split = (seller) => { const a = agg.get(seller); if (!a) return { ship: 0, duty: 0 }; const c = shipOnly(seller, a.n, a.value); return { ship: c, duty: customs(a.value, c, P.sellerCustoms.get(seller)) }; };
    return { agg, add, addOpt, ship, shipOf, split };
  }

  function evaluate(P, assign, S) {
    const st = makeState(P, S);
    let items = 0;
    P.L.forEach((l, i) => { const o = assign[i]; if (!o) return; items += o.cost; st.addOpt(o, 1); });
    let ship = 0, duty = 0;
    for (const s of st.agg.keys()) { const x = st.split(s); ship += x.ship; duty += x.duty; }
    return { items, ship, duty, total: items + ship + duty };
  }

  // Recherche locale : changer l'option d'une carte (vendeur ou répartition), fermer une commande, regrouper, échanger
  function improve(P, assign, S, swaps) {
    const st = makeState(P, S);
    P.L.forEach((l, i) => { const o = assign[i]; if (o) st.addOpt(o, 1); });
    const movable = P.L.map((l) => l.options.length > 1);
    // différence de coût total si la carte i passe de son option actuelle à « to » (port de tous les vendeurs touchés)
    const moveDelta = (i, to) => {
      const from = assign[i];
      if (from === to) return 0;
      const ch = new Map();
      from.parts.forEach((p) => { const c = ch.get(p.seller) || { n: 0, v: 0 }; c.n -= p.units; c.v -= p.cost; ch.set(p.seller, c); });
      to.parts.forEach((p) => { const c = ch.get(p.seller) || { n: 0, v: 0 }; c.n += p.units; c.v += p.cost; ch.set(p.seller, c); });
      let d = to.cost - from.cost;
      for (const [s, c] of ch) {
        if (!c.n && Math.abs(c.v) < 1e-9) continue;
        const a = st.agg.get(s) || { n: 0, value: 0 };
        const before = a.n > 0 ? st.ship(s, a.n, a.value) : 0;
        const n2 = a.n + c.n, v2 = a.value + c.v;
        d += (n2 > 0 ? st.ship(s, n2, v2) : 0) - before;
      }
      return d;
    };
    const apply = (i, to) => { st.addOpt(assign[i], -1); st.addOpt(to, 1); assign[i] = to; };
    const t0 = Date.now();

    for (let iter = 0, improved = true; improved && iter < 60 && Date.now() - t0 < 2500; iter++) {
      improved = false;
      // 1) changer l'option d'une carte (autre vendeur, ou répartie entre plusieurs)
      P.L.forEach((l, i) => {
        if (!movable[i] || !assign[i]) return;
        let best = null, bestD = -1e-9;
        for (const opt of l.options) {
          if (opt === assign[i]) continue;
          const d = moveDelta(i, opt);
          if (d < bestD) { bestD = d; best = opt; }
        }
        if (best) { apply(i, best); improved = true; }
      });
      // 2) fermer une commande : répartir ses cartes chez les autres
      for (const seller of [...st.agg.keys()]) {
        if (!st.agg.has(seller)) continue;
        const idx = P.L.map((l, i) => i).filter((i) => assign[i] && assign[i].sellers.includes(seller));
        if (!idx.length || idx.some((i) => !movable[i])) continue;
        const saved = idx.map((i) => assign[i]);
        let delta = 0, ok = true;
        for (const i of idx) {
          let best = null, bestD = Infinity;
          for (const opt of P.L[i].options) {
            if (opt.sellers.includes(seller)) continue;
            const d = moveDelta(i, opt);
            if (d < bestD) { bestD = d; best = opt; }
          }
          if (!best) { ok = false; break; }
          delta += bestD; apply(i, best);
        }
        if (ok && delta < -1e-9) improved = true;
        else idx.forEach((i, k) => { if (assign[i] !== saved[k]) apply(i, saved[k]); });
      }
      // 2b) regrouper toute une commande chez UN autre vendeur du panier (tout ou rien)
      if (!improved) {
        const sellers = [...st.agg.keys()];
        for (const sa of sellers) {
          if (!st.agg.has(sa)) continue;
          const idx = P.L.map((l, i) => i).filter((i) => assign[i] && assign[i].sellers.includes(sa));
          if (!idx.length || idx.some((i) => !movable[i])) continue;
          for (const sb of sellers) {
            if (sb === sa || !st.agg.has(sb)) continue;
            const opts = idx.map((i) => P.L[i].options.find((o) => !o.multi && o.seller === sb));
            if (opts.some((o) => !o)) continue;
            const touched = new Set([sa, sb]); idx.forEach((i) => assign[i].sellers.forEach((s) => touched.add(s)));
            const cost = () => [...touched].reduce((t, s) => t + st.shipOf(s), 0) + idx.reduce((t, i) => t + assign[i].cost, 0);
            const saved = idx.map((i) => assign[i]);
            const before = cost();
            idx.forEach((i, k) => apply(i, opts[k]));
            if (cost() < before - 1e-9) { improved = true; break; }
            idx.forEach((i, k) => apply(i, saved[k]));
          }
        }
      }
      // 3) échanges : la carte i part chez le vendeur de j et j part chez celui de i (utile quand les lettres sont pleines)
      if (!improved && swaps) {
        const ts = Date.now();
        const act = P.L.map((l, i) => i).filter((i) => movable[i] && assign[i] && !assign[i].multi);
        outer: for (let x = 0; x < act.length; x++) {
          const i = act[x], si = assign[i].seller;
          for (let y = x + 1; y < act.length; y++) {
            if (Date.now() - ts > 400) break outer;
            const j = act[y], sj = assign[j].seller;
            if (si === sj) continue;
            const oi = P.L[i].options.find((o) => !o.multi && o.seller === sj), oj = P.L[j].options.find((o) => !o.multi && o.seller === si);
            if (!oi || !oj) continue;
            const before = st.shipOf(si) + st.shipOf(sj) + assign[i].cost + assign[j].cost;
            const fi = assign[i], fj = assign[j];
            apply(i, oi); apply(j, oj);
            const after = st.shipOf(si) + st.shipOf(sj) + oi.cost + oj.cost;
            if (after < before - 1e-9) { improved = true; break outer; }
            apply(j, fj); apply(i, fi);
          }
        }
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
    P.L.forEach((l) => l.options.forEach((o) => { if (!o.multi) coverage.set(o.seller, (coverage.get(o.seller) || 0) + 1); }));
    const deep = !!S.deep; // recherche approfondie : plus lente (quelques secondes de plus) mais trouve encore mieux
    const budget = deep ? (+S.searchMs || 12000) : 6000;
    const topSellers = [...coverage.entries()].sort((a, b) => b[1] - a[1]).slice(0, deep ? 60 : 25).map((e) => e[0]);
    const pref = (l, i, s) => l.options.find((o) => !o.multi && o.seller === s) || l.options.find((o) => o.sellers.includes(s)) || base[i];

    const starts = [base.slice()];
    // départ imposé (ex. le panier du Shopping Wizard) : testé en premier, donc le résultat ne peut pas être plus cher que lui
    for (const seed of (S.seeds || []).concat(S.seed ? [S.seed] : [])) if (seed) starts.unshift(P.L.map((l, i) => { const sl = seed[l.id]; return sl ? (l.options.find((o) => !o.multi && o.seller === sl) || l.options.find((o) => o.sellers.includes(sl)) || base[i]) : base[i]; }));
    for (const s of topSellers) starts.push(P.L.map((l, i) => pref(l, i, s)));

    let best = null;
    const tStart = Date.now();
    for (const st of starts) {
      if (best && Date.now() - tStart > (deep ? budget / 2 : 6000)) break; // garde-fou : jamais plus de quelques secondes
      const a = improve(P, st, S);
      const ev = evaluate(P, a, S);
      if (!best || ev.total < best.ev.total - 1e-9) best = { assign: a.slice(), ev };
    }
    // dernier passage sur la meilleure solution, avec les échanges entre commandes
    { const a = improve(P, best.assign.slice(), S, true); const ev = evaluate(P, a, S); if (ev.total < best.ev.total - 1e-9) best = { assign: a.slice(), ev }; }

    if (deep) {
      // petite liste : on essaie TOUTES les combinaisons (résultat exact)
      const sizes = P.L.map((l) => Math.max(1, l.options.length));
      const combos = sizes.reduce((t, n) => (t > 1e7 ? t : t * n), 1);
      if (combos <= 60000) {
        const a = base.slice(), idx = P.L.map(() => 0);
        for (let k = 0; k < combos; k++) {
          P.L.forEach((l, i) => { a[i] = l.options.length ? l.options[idx[i]] : base[i]; });
          const ev = evaluate(P, a, S);
          if (ev.total < best.ev.total - 1e-9) best = { assign: a.slice(), ev };
          for (let i = 0; i < idx.length; i++) { if (++idx[i] < sizes[i]) break; idx[i] = 0; }
        }
      } else {
        // grande liste : on secoue la meilleure solution (quelques cartes changent de vendeur) puis on l'améliore,
        // tant que ça trouve mieux. Hasard reproductible : le même calcul donne toujours le même panier.
        let seed = 1234567;
        const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const mov = P.L.map((l, i) => i).filter((i) => P.L[i].options.length > 1);
        let stale = 0;
        while (mov.length && Date.now() - tStart < budget && stale < 400) {
          const a = best.assign.slice();
          if (rnd() < 0.35) { // ferme une commande au hasard : toutes ses cartes partent ailleurs
            const sellers = [...new Set(a.filter(Boolean).flatMap((o) => o.sellers))];
            const s0 = sellers[Math.floor(rnd() * sellers.length)];
            P.L.forEach((l, i) => { if (a[i] && a[i].sellers.includes(s0)) { const alt = l.options.filter((o) => !o.sellers.includes(s0)); if (alt.length) a[i] = alt[Math.floor(rnd() * Math.min(alt.length, 6))]; } });
          } else {
            const k = 1 + Math.floor(rnd() * Math.max(2, Math.ceil(mov.length * 0.2)));
            for (let j = 0; j < k; j++) { const i = mov[Math.floor(rnd() * mov.length)]; const o = P.L[i].options; a[i] = o[Math.floor(rnd() * Math.min(o.length, 8))]; }
          }
          const b2 = improve(P, a, S, true), ev = evaluate(P, b2, S);
          if (ev.total < best.ev.total - 1e-9) { best = { assign: b2.slice(), ev }; stale = 0; } else stale++;
        }
      }
    }

    // Construction des commandes (une carte répartie apparaît chez chacun de ses vendeurs)
    const orders = new Map();
    P.L.forEach((l, i) => {
      const o = best.assign[i];
      if (!o) return;
      o.parts.forEach((p) => {
        if (!orders.has(p.seller)) orders.set(p.seller, { seller: p.seller, lines: [], items: 0, n: 0 });
        const ord = orders.get(p.seller);
        const opt = { seller: p.seller, cost: p.cost, units: p.units, picked: p.picked, enough: o.enough };
        ord.lines.push({ line: l, opt, missing: o.enough || o.parts.length > 1 ? 0 : l.qty - o.units, part: o.parts.length > 1 });
        ord.items += p.cost; ord.n += p.units;
      });
    });
    const orderList = [...orders.values()].map((o) => {
      const tracked = !!P.sellerTracked.get(o.seller);
      const sh = shipping(o.n, o.items, tracked, S, P.sellerTable.get(o.seller));
      const duty = customs(o.items, sh.cost, P.sellerCustoms.get(o.seller));
      return { ...o, tracked, ship: sh.cost, shipName: sh.name, duty, total: o.items + sh.cost + duty };
    }).sort((a, b) => b.lines.length - a.lines.length || a.total - b.total);

    // Regroupements vérifiés : pour chaque commande, peut-on tout envoyer chez un autre vendeur du panier ? (et pourquoi c'est plus cher)
    const orderCost = (seller, n, value) => { const sh = shipping(n, value, !!P.sellerTracked.get(seller), S, P.sellerTable.get(seller)); return { sh, duty: customs(value, sh.cost, P.sellerCustoms.get(seller)) }; };
    for (const a of orderList) {
      if (a.lines.some((x) => x.part)) continue;
      let note = null;
      for (const b of orderList) {
        if (a === b) continue;
        const opts = a.lines.map((x) => x.line.options.find((o) => !o.multi && o.seller === b.seller));
        if (opts.some((o) => !o)) continue;
        const addItems = opts.reduce((t, o) => t + o.cost, 0), addN = opts.reduce((t, o) => t + o.units, 0);
        const m = orderCost(b.seller, b.n + addN, b.items + addItems);
        const merged = b.items + addItems + m.sh.cost + m.duty;
        const extra = merged - (a.total + b.total);
        if (extra > -1e-9 && (!note || extra < note.extra)) note = { into: b.seller, extra, n: b.n + addN, shipName: m.sh.name, ship: m.sh.cost };
      }
      if (note) a.mergeNote = note;
    }

    // Top vendeurs (une seule commande chez eux pour ce qu'ils ont)
    const top = topSellersTable(P, S);
    const sum = (k) => orderList.reduce((t, o) => t + o[k], 0);
    return {
      settings: S,
      total: sum('total'), items: sum('items'), ship: sum('ship'), duty: sum('duty'),
      orders: orderList,
      naive,
      single: top.find((t) => t.covered === P.L.filter((l) => l.options.length).length && t.covered > 0) || null,
      top,
      unavailable: P.L.filter((l) => !l.options.length && !l.fallback),
      short: P.L.filter((l) => !l.options.length && l.fallback).map((l) => ({ ...l, missing: l.qty - l.fallback.units })),
      split: P.L.filter((l, i) => best.assign[i] && best.assign[i].multi), // cartes prises chez plusieurs vendeurs
      nLines: P.L.length,
    };
  }

  function topSellersTable(P, S) {
    const map = new Map();
    P.L.forEach((l) => l.options.forEach((o) => {
      if (o.multi) return;
      if (!map.has(o.seller)) map.set(o.seller, { seller: o.seller, covered: 0, items: 0, n: 0 });
      const t = map.get(o.seller);
      t.covered++; t.items += o.cost; t.n += o.units;
    }));
    return [...map.values()].map((t) => {
      const sh = shipping(t.n, t.items, !!P.sellerTracked.get(t.seller), S, P.sellerTable.get(t.seller));
      const duty = customs(t.items, sh.cost, P.sellerCustoms.get(t.seller));
      return { ...t, ship: sh.cost, shipName: sh.name, duty, total: t.items + sh.cost + duty, tracked: !!P.sellerTracked.get(t.seller) };
    }).sort((a, b) => b.covered - a.covered || a.total - b.total).slice(0, 30);
  }

  const api = { DEFAULTS, shipping, customs, optimize, maxLetterCards, weightFor };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Optimizer = api;
})(typeof window !== 'undefined' ? window : globalThis);
