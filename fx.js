/*!
 * TCG Price Hunter — © 2026 Nicoco (Anastasiophrenelia). Tous droits réservés.
 * https://github.com/Anastasiophrenelia/TCG-Price-Hunter
 * Toute copie, modification ou redistribution sans autorisation écrite de l'auteur est interdite (voir LICENSE).
 */
// Décor animé du thème sombre : braises qui montent (canvas). Tout le reste est en CSS.
// S'arrête quand le thème est clair, quand l'onglet est caché ou si "réduire les animations" est activé.
(() => {
  const cv = document.getElementById('fxEmbers');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  let w = 0, h = 0, parts = [], running = false;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth; h = window.innerHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(46, (w * h) / 38000));
    parts = Array.from({ length: n }, () => newPart(true));
  }
  function newPart(anywhere) {
    return {
      x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10,
      r: 0.8 + Math.random() * 2, vy: 0.18 + Math.random() * 0.5, vx: (Math.random() - 0.5) * 0.3,
      a: 0.18 + Math.random() * 0.5, amber: Math.random() > 0.35, t: Math.random() * 6.28,
    };
  }
  const active = () => document.documentElement.dataset.theme === 'dark' && !document.hidden && !calm.matches;

  function tick() {
    if (!active()) { running = false; ctx.clearRect(0, 0, w, h); return; }
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.t += 0.02; p.y -= p.vy; p.x += p.vx + Math.sin(p.t) * 0.15;
      if (p.y < -10) Object.assign(p, newPart(false));
      const flick = p.a * (0.75 + 0.25 * Math.sin(p.t * 3));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.amber ? `rgba(251,191,36,${flick})` : `rgba(96,165,250,${flick})`;
      ctx.shadowColor = p.amber ? 'rgba(245,158,11,.8)' : 'rgba(59,130,246,.8)';
      ctx.shadowBlur = 6;
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  function start() { if (!running && active()) { running = true; requestAnimationFrame(tick); } }

  resize();
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', start);
  calm.addEventListener('change', start);
  new MutationObserver(start).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  start();
})();
