/*!
 * TCG Price Hunter — © 2026 Anastasiophrenelia. Tous droits réservés.
 * https://github.com/Anastasiophrenelia/TCG-Price-Hunter
 * Toute copie, modification ou redistribution sans autorisation écrite de l'auteur est interdite (voir LICENSE).
 */
// TCG Price Hunter — lecture des pages Cardmarket (partagé entre la page Cardmarket et le site de l'extension)
(function (root) {
  const TRACKED_RE = /envoi suivi|tracked|versichert|einschreiben/i;
  const LANGS = ['Français', 'Anglais', 'Allemand', 'Espagnol', 'Italien', 'Chinois-S', 'Chinois-T', 'Japonais', 'Portugais', 'Russe', 'Coréen',
    'French', 'English', 'German', 'Spanish', 'Italian', 'S-Chinese', 'T-Chinese', 'Japanese', 'Portuguese', 'Russian', 'Korean'];

  const tip = (el) =>
    (el ? el.getAttribute('aria-label') || el.getAttribute('data-bs-original-title') || el.getAttribute('title') || '' : '')
      .replace(/<[^>]+>/g, '').replace(/ /g, ' '); // infobulles avec du HTML et des espaces insécables
  const sellerOf = (r) => r.querySelector('.seller-name a')?.textContent.trim() || '';

  function parsePrice(s) {
    const m = (s || '').replace(/\s/g, '').match(/[\d.,]+/);
    if (!m) return null;
    let x = m[0];
    if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.');
    const v = parseFloat(x);
    return isNaN(v) ? null : v;
  }

  // nombre de ventes : l'infobulle a le vrai chiffre ("3462 Ventes | 2970 Articles"), le badge affiche "3K"
  function parseSales(r) {
    const b = r.querySelector('.sell-count') || r.querySelector('.seller-info .badge');
    if (!b) return 0;
    const t = tip(b).match(/(\d[\d\s.]*)/);
    if (t) return parseInt(t[1].replace(/[\s.]/g, ''), 10) || 0;
    const txt = b.textContent.trim().toUpperCase();
    const n = parseFloat(txt.replace(',', '.')) || 0;
    return /K/.test(txt) ? Math.round(n * 1000) : n;
  }

  function parseRow(r) {
    const seller = sellerOf(r);
    if (!seller) return null;
    // prix : 1er ".color-primary" qui contient un chiffre (l'icône ✓ "envoi suivi" a la même classe, mais pas de texte)
    const priceEl = [...r.querySelectorAll('.price-container .color-primary, .price-container, .color-primary')].find((e) => /\d/.test(e.textContent));
    const sellerTips = [...r.querySelectorAll('.seller-info [aria-label], .seller-info [data-bs-original-title], .seller-info [title]')].map(tip);
    // "Localisation de l'article: France" (attention : il y a aussi "Délai de livraison estimé pour X : 6 jours")
    const locTip = sellerTips.find((t) => /localisation|item location|artikelstandort|ubicaci|posizione/i.test(t)) ||
      sellerTips.find((t) => t.includes(':') && !/d[ée]lai|livraison|delivery|jours|days/i.test(t)) || '';
    const attrs = [...r.querySelectorAll('.product-attributes [aria-label], .product-attributes [data-bs-original-title], .product-attributes [title]')]
      .filter((el) => !el.closest('.article-condition'))
      .map(tip).filter(Boolean);
    const lang = attrs.find((a) => LANGS.includes(a)) || '';
    const allTips = [...r.querySelectorAll('[aria-label], [data-bs-original-title], [title]')]
      .filter((el) => !el.closest('.product-comments') && !el.closest('.cmpm-ctl'))
      .map(tip);
    const ratingEl = r.querySelector('[class*="fonticon-seller-rating-"]');
    // n° d'article (ligne "articleRow2192404224" / bouton panier data-id-amount) : sert à "Ajouter au panier"
    const aid = (r.id || '').match(/articleRow(\d+)/)?.[1] || r.querySelector('[data-id-amount]')?.getAttribute('data-id-amount') || '';
    // offre restreinte par le vendeur : bouton panier gris « Le vendeur a restreint cette offre. Tu ne peux pas acheter cet article. »
    const cartBtn = r.querySelector('.fonticon-cart')?.closest('a, button');
    const restricted = !!cartBtn && !cartBtn.hasAttribute('data-id-amount') &&
      (cartBtn.classList.contains('btn-grey') || /restrei|restrict|eingeschr|restring|limitat|ne peux pas acheter|cannot (buy|purchase)|kannst .* nicht kaufen|no puedes comprar|non puoi acquistare/i.test(tip(cartBtn)));
    return {
      seller,
      aid,
      price: parsePrice(priceEl && priceEl.textContent),
      qty: parseInt(r.querySelector('.amount-container .item-count')?.textContent, 10) || 1,
      country: locTip ? locTip.split(':').pop().trim() : '',
      cond: r.querySelector('.article-condition .badge')?.textContent.trim() || '',
      lang,                                                  // Français, Anglais, Chinois-S…
      extra: attrs.filter((a) => a !== lang).join(', '),     // Foil, etc.
      rating: ratingEl ? (ratingEl.className.match(/fonticon-seller-rating-([a-z-]+)/) || [])[1] || '' : '',
      sales: parseSales(r),
      tracked: allTips.some((t) => TRACKED_RE.test(t)) ? 1 : 0, // "Seulement en envoi suivi vers France"
      restricted: restricted ? 1 : 0,                         // le vendeur ne vend pas cet article à ton compte
    };
  }

  // infos de la carte. doc = la page (document, ou page téléchargée), path = son adresse (pathname + search)
  function productInfo(doc, path) {
    const id = doc.querySelector('input[name="idProduct"]')?.value;
    if (!id) return null;
    // <h1>Contre-sort<span class="h4 text-muted …"> Origines - Defy - Cartes</span></h1>
    const h1 = doc.querySelector('.flex-fill > h1') || doc.querySelector('h1');
    const span = h1 && h1.querySelector('span');
    const lines = !h1 ? [doc.title || '']
      : span ? [h1.textContent.replace(span.textContent, '').trim(), span.textContent.trim()]
      : (h1.innerText || h1.textContent).split('\n').map((s) => s.trim()).filter(Boolean);
    // le carrousel montre aussi les cartes voisines -> on prend l'image qui porte l'id de la carte
    const img = doc.querySelector(`.card-image img[src*="/${id}/"]`) || doc.querySelector(`img[src*="/${id}/${id}"]`) ||
      doc.querySelector(`img[src*="/${id}/"]`) || doc.querySelector('.card-image img.is-front');
    let src = img ? img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src') || '' : '';
    if (src.startsWith('//')) src = 'https:' + src;
    return {
      id: String(id),
      name: lines[0],
      sub: (lines[1] || '').replace(/\s*-\s*(Cartes|Singles)\s*$/i, ''),
      game: (path || '').split('/')[2] || '',
      url: path || '',
      img: /^https?:/.test(src) ? src : '',
      metacard: doc.querySelector('#AddWantsForm input[name="idMetacard"], input[name="idMetacard"]')?.value || '', // pour la liste de souhaits
    };
  }

  // ce qu'il faut pour demander la suite ("Montrer plus de résultats") sans cliquer
  function loadMoreParams(doc) {
    const f = doc.querySelector('#loadMore form') || doc.querySelector('form[data-ajax-action="Product_LoadMoreArticles"]');
    if (!f) return null;
    const v = (n) => f.querySelector(`input[name="${n}"]`)?.value;
    return { __cmtkn: v('__cmtkn'), page: v('page') || '1', filterSettings: v('filterSettings') || '[]', idProduct: v('idProduct') };
  }

  // réponse XML de Product_LoadMoreArticles : <rows>(HTML en base64)</rows><newPage>2</newPage><maxPaginatedResultsReached>0</…>
  function parseLoadMore(xmlText) {
    const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
    const rowsEl = xml.querySelector('rows');
    if (!rowsEl) return null;
    let html = '';
    try {
      const bytes = Uint8Array.from(atob(rowsEl.textContent.trim()), (c) => c.charCodeAt(0));
      html = new TextDecoder().decode(bytes);
    } catch { html = rowsEl.textContent; }
    const d = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
    return {
      offers: [...d.querySelectorAll('.article-row')].map(parseRow).filter(Boolean),
      newPage: xml.querySelector('newPage')?.textContent || '',
      maxReached: xml.querySelector('maxPaginatedResultsReached')?.textContent === '1',
    };
  }

  root.CMParse = { tip, sellerOf, parsePrice, parseSales, parseRow, productInfo, loadMoreParams, parseLoadMore, TRACKED_RE };
})(typeof self !== 'undefined' ? self : globalThis);
