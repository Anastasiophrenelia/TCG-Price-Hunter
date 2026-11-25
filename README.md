<p align="center"><img src="icons/256.png" width="130" alt="TCG Price Hunter"></p>

<h1 align="center">TCG Price Hunter</h1>

<p align="center"><b>Get your TCG cards at the best price on Cardmarket, shipping included.</b></p>

<p align="center">
  <a href="https://addons.mozilla.org/firefox/addon/tcg-price-hunter-cardmarket/"><img src="https://img.shields.io/badge/Firefox-available-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white" alt="Firefox: available"></a>
  <img src="https://img.shields.io/badge/Edge-available-0078D7?style=for-the-badge&logo=microsoftedge&logoColor=white" alt="Edge: available">
  <a href="../../releases/latest"><img src="https://img.shields.io/badge/Chrome-via%20GitHub-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome: via GitHub"></a>
</p>

<p align="center">
  <a href="https://discord.gg/Vm8vfqznh2"><img src="https://img.shields.io/badge/Discord-join-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://ko-fi.com/anastasiophrenelia"><img src="https://img.shields.io/badge/Ko--fi-support%20the%20project-FF5E5B?style=flat-square&logo=kofi&logoColor=white" alt="Ko-fi"></a>
  <img src="https://img.shields.io/badge/version-1.2-1b63e0?style=flat-square" alt="Version 1.2">
  <img src="https://img.shields.io/badge/license-all%20rights%20reserved-555?style=flat-square" alt="License">
</p>

---

## 🌐 Availability

| Browser | Status | Where to get it |
|---|---|---|
| 🦊 **Firefox** | ✅ Available | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tcg-price-hunter-cardmarket/) |
| 🌊 **Edge** | ✅ Available | Edge Add-ons *(link coming soon)* |
| 🟡 **Chrome** | ⏳ Not on the Chrome Web Store yet | Here on GitHub: [latest release](../../releases/latest) |

## ✨ What it does

- **Add your cards** from their Cardmarket page (the "TCG Price Hunter" bar under the title).
- **Scans the offers** for each card: price, condition, language, seller country, rating, number of sales.
- **Finds the best basket**: the cheapest combination of sellers using Cardmarket's real shipping rates (letter, tracked letter, parcel), for every country.
- **Customs & import VAT included** (estimate) when a seller is outside your customs area (e.g. United Kingdom ↔ EU), so the best basket stays the real cheapest one.
- **Fills your Cardmarket cart** in one click and lists what Cardmarket refused, with a button to rescan those cards. Nothing is bought, and shipping methods are not selected: you choose them and pay yourself.
- Filters by **language**, **minimum condition**, **seller countries**, **rating** and **number of sales**; blocked sellers, ignored offers, categories.
- **Fast and careful**: 3 scan modes (Fast, Medium, Long), 3 cards at a time, filtered Cardmarket pages instead of "Show more results"; captchas pause the scan and it resumes on its own.
- **Deck import** from Piltover Archive and Riftdecks, and a **comparison with Cardmarket's Shopping Wizard**.
- Interface in **English, French, German, Spanish, Italian, Portuguese, Dutch and Polish**.
- **Export / import** your cards and settings.

Works with every card sold on Cardmarket: Riftbound, Pokémon, Magic, One Piece, Lorcana, Yu-Gi-Oh!, Dragon Ball…

## 🆕 What's new in 1.3

- **📥 Deck import**: paste up to 5 deck links (Piltover Archive, Riftdecks). Keep the exact printings, or take the cheapest version of each card (before → after view with your savings). Each deck gets its own category.
- **⚖ Compare with Cardmarket**: runs Cardmarket's Shopping Wizard on the same cards and shows how much you save. Cardmarket allows 10 uses per day per account: a counter shows what's left.
- **3 scan modes**: ⚡ Fast (50 offers per card), 🎯 Medium (default) and 🔍 Long (the most sellers, best right before buying). "Show more results" is no longer clicked: filtered pages are used instead (your country first, then the others), for fewer 1015 errors.
- **Smarter best basket**: one card can be split across several sellers when it's cheaper or when nobody has enough copies — taken into account in the calculation itself.
- **Minimum condition for all cards** with coloured badges (EX also accepts NM and MT), a select-all checkbox, a "Delete selection" button, and categories removed automatically once emptied.
- **Loading screen** while the basket is calculated, and **click a card image** to zoom in.
- **Activity log** in Settings (each line kept 7 days) to attach to a bug report on Discord.
- **Interactive tutorial** on first launch (replay it from Settings).
- Default sellers: countries with **no customs fees** to you.

### 1.2

- **🇪🇺 Europe (low fees)**: keeps only the European countries whose shipping + customs to you stay low (€3.50 maximum on average), based on Cardmarket's official rates for *your* country. It's the default choice.
- **Countries sorted by fees**: in Settings, each country shows what an order from there costs you (shipping + customs), from cheapest to most expensive.
- **Filters applied before searching**: seller countries (all at once), reputation, language and condition are sent straight to Cardmarket, so every offer received is useful.
- **Your country found automatically**: the delivery country is guessed from your time zone and browser language, and you can change it anytime. It no longer depends on the extension's language.
- **What's new window**: click the version number at the bottom of the sidebar.
- **Fixes**: shipping for large orders could be wrong after a few days; remaining texts translated in every language.

### 1.1

- Much faster scans (3 cards at a time, live cards-per-minute average, even with 1000+ cards in your list).
- Captchas no longer stop the scan: tick the box, wait a few seconds, it resumes and brings you back to the extension.
- Add to cart: Cardmarket's answers are now really checked, expired tokens are renewed, and refused articles are listed (with a "rescan" button).
- Customs and import VAT estimate between customs areas, explained in the Shipping costs tab.
- Cards grouped by set with a colour bar, unticked cards greyed out, cleaner columns.
- Offers restricted by the seller ("you can't buy this item") are skipped by the best basket.
- Seller countries: one-click presets, automatic by default from your delivery country; seller flags in the orders.
- 3 new interface languages: Portuguese, Dutch and Polish.

## 📦 Install on Chrome (from GitHub)

1. Download the `.zip` file from the [latest release](../../releases/latest) and unzip it into a folder.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped folder.
4. Open a card page on Cardmarket: the TCG Price Hunter bar appears under the title.

> Keep the folder: if you delete it, the extension disappears from Chrome.

## 🔒 Privacy

The extension collects nothing and sends nothing to anyone. Your cards and settings stay in your browser. It only talks to Cardmarket (card pages, cart, public shipping rates), just like when you browse yourself.

## ⚖️ License

© 2026 [Anastasiophrenelia](https://github.com/Anastasiophrenelia) — **all rights reserved**.
The code is visible here but **is not open source**: you may not copy it, modify it to republish it, redistribute it or publish it on an extension store without my written permission. Details in [LICENSE](LICENSE).

Independent project, not affiliated with or endorsed by Cardmarket.

---

<p align="center">
  <b>Links</b><br>
  <a href="https://ko-fi.com/anastasiophrenelia">☕ Support the project on Ko-fi</a> ·
  <a href="https://discord.gg/Vm8vfqznh2">💬 Discord (support, ideas, card trading)</a> ·
  <a href="../../issues">🐞 Report a bug</a>
</p>
