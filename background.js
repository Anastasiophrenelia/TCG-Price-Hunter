/*!
 * TCG Price Hunter — © 2026 Nicoco (Anastasiophrenelia). Tous droits réservés.
 * https://github.com/Anastasiophrenelia/TCG-Price-Hunter
 * Toute copie, modification ou redistribution sans autorisation écrite de l'auteur est interdite (voir LICENSE).
 */
// Ouvre (ou ramène au premier plan) la page "TCG Price Hunter"
async function openApp() {
  const url = chrome.runtime.getURL('app.html');
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => (t.url || '').startsWith(url));
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId != null) chrome.windows.update(existing.windowId, { focused: true }).catch(() => {});
  } else {
    await chrome.tabs.create({ url });
  }
}

chrome.action.onClicked.addListener(openApp);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'openApp') openApp();
});
