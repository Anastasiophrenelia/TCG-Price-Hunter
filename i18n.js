/*!
 * TCG Price Hunter — © 2026 Nicoco (Anastasiophrenelia). Tous droits réservés.
 * https://github.com/Anastasiophrenelia/TCG-Price-Hunter
 * Toute copie, modification ou redistribution sans autorisation écrite de l'auteur est interdite (voir LICENSE).
 */
// TCG Price Hunter — traductions (français = texte d'origine ; en / de / es / it)
// T('texte') traduit un texte fixe ; TF('texte {n}', {n: 3}) traduit un texte avec des valeurs.
// Les textes de la page sont traduits automatiquement (translateTree), le reste via T/TF.
(function (root) {
  // [français, english, deutsch, español, italiano]
  const D = [
    // --- navigation / en-têtes ---
    ['TCG Price Hunter', 'TCG Price Hunter', 'TCG Price Hunter', 'TCG Price Hunter', 'TCG Price Hunter'],
    ['Offre-moi un café ❤', 'Buy me a coffee ❤', 'Spendier mir einen Kaffee ❤', 'Invítame a un café ❤', 'Offrimi un caffè ❤'],
    ['Soutenir TCG Price Hunter', 'Support TCG Price Hunter', 'TCG Price Hunter unterstützen', 'Apoyar TCG Price Hunter', 'Sostieni TCG Price Hunter'],
    ['Voir le projet sur GitHub', 'See the project on GitHub', 'Projekt auf GitHub ansehen', 'Ver el proyecto en GitHub', 'Vedi il progetto su GitHub'],
    ['Aller sur Cardmarket', 'Go to Cardmarket', 'Zu Cardmarket', 'Ir a Cardmarket', 'Vai su Cardmarket'],
    ['Cartes scannées', 'Scanned cards', 'Gescannte Karten', 'Cartas escaneadas', 'Carte scansionate'],
    ['Meilleur panier', 'Best basket', 'Bester Warenkorb', 'Mejor cesta', 'Carrello migliore'],
    ['Frais de port', 'Shipping costs', 'Versandkosten', 'Gastos de envío', 'Spese di spedizione'],
    ['Réglages', 'Settings', 'Einstellungen', 'Ajustes', 'Impostazioni'],
    ['Scan en cours', 'Scanning', 'Scan läuft', 'Escaneando', 'Scansione in corso'],
    ['Scan terminé', 'Scan finished', 'Scan beendet', 'Escaneo terminado', 'Scansione terminata'],
    ['Scan arrêté', 'Scan stopped', 'Scan gestoppt', 'Escaneo detenido', 'Scansione fermata'],
    ['⏹ Arrêter le scan', '⏹ Stop scan', '⏹ Scan stoppen', '⏹ Detener escaneo', '⏹ Ferma scansione'],
    ["Frais de port officiels Cardmarket · rien n'est acheté sans toi", 'Official Cardmarket shipping costs · nothing is bought without you', 'Offizielle Cardmarket-Versandkosten · nichts wird ohne dich gekauft', 'Gastos de envío oficiales de Cardmarket · no se compra nada sin ti', 'Spese di spedizione ufficiali Cardmarket · nulla viene acquistato senza di te'],
    ['Fermer ce message', 'Close this message', 'Nachricht schließen', 'Cerrar este mensaje', 'Chiudi questo messaggio'],
    ['Thème clair / sombre', 'Light / dark theme', 'Helles / dunkles Design', 'Tema claro / oscuro', 'Tema chiaro / scuro'],
    ['Thème clair', 'Light theme', 'Helles Design', 'Tema claro', 'Tema chiaro'],
    ['Thème sombre', 'Dark theme', 'Dunkles Design', 'Tema oscuro', 'Tema scuro'],
    ["Tu n'es pas connecté à Cardmarket : scan arrêté.", 'You are not logged in to Cardmarket: scan stopped.', 'Du bist nicht bei Cardmarket eingeloggt: Scan gestoppt.', 'No has iniciado sesión en Cardmarket: escaneo detenido.', 'Non sei connesso a Cardmarket: scansione fermata.'],
    ['Connecte-toi sur', 'Log in on', 'Melde dich an auf', 'Inicia sesión en', 'Accedi su'],
    ['puis relance le scan.', 'then start the scan again.', 'und starte den Scan neu.', 'y vuelve a lanzar el escaneo.', 'poi rilancia la scansione.'],
    ['Introuvable avec tes filtres', 'Not found with your filters', 'Mit deinen Filtern nicht gefunden', 'No encontrada con tus filtros', 'Non trovata con i tuoi filtri'],
    ['(pays des vendeurs, langue, état…)', '(seller countries, language, condition…)', '(Verkäuferländer, Sprache, Zustand…)', '(países de vendedores, idioma, estado…)', '(paesi dei venditori, lingua, condizione…)'],
    ['🛒 Ajout à ton panier Cardmarket…', '🛒 Adding to your Cardmarket cart…', '🛒 Wird zu deinem Cardmarket-Warenkorb hinzugefügt…', '🛒 Añadiendo a tu cesta de Cardmarket…', '🛒 Aggiunta al tuo carrello Cardmarket…'],
    ['✔ Ajout terminé', '✔ Done', '✔ Fertig', '✔ Terminado', '✔ Fatto'],
    ['Ajout arrêté', 'Adding stopped', 'Hinzufügen gestoppt', 'Añadido detenido', 'Aggiunta fermata'],
    ['{ok} article(s) ajouté(s)', '{ok} item(s) added', '{ok} Artikel hinzugefügt', '{ok} artículo(s) añadido(s)', '{ok} articolo/i aggiunto/i'],
    ['reste environ {a}', 'about {a} left', 'noch ca. {a}', 'quedan unos {a}', 'restano circa {a}'],
    ['Cardmarket freine', 'Cardmarket is throttling', 'Cardmarket bremst', 'Cardmarket frena', 'Cardmarket rallenta'],
    ['⏹ Arrêter', '⏹ Stop', '⏹ Stoppen', '⏹ Detener', '⏹ Ferma'],
    ['⬇ Exporter', '⬇ Export', '⬇ Exportieren', '⬇ Exportar', '⬇ Esporta'],
    ['⬆ Importer', '⬆ Import', '⬆ Importieren', '⬆ Importar', '⬆ Importa'],
    ['Sauvegarder tes cartes, catégories et réglages dans un fichier', 'Save your cards, categories and settings to a file', 'Karten, Kategorien und Einstellungen in einer Datei sichern', 'Guardar tus cartas, categorías y ajustes en un archivo', 'Salva carte, categorie e impostazioni in un file'],
    ['Récupérer une sauvegarde (les cartes reviennent non scannées)', 'Restore a backup (cards come back not scanned)', 'Sicherung laden (Karten kommen ungescannt zurück)', 'Recuperar una copia (las cartas vuelven sin escanear)', 'Ripristina un backup (le carte tornano non scansionate)'],
    ['Sauvegarde exportée : {n} carte(s), catégories et réglages (sans les scans).', 'Backup exported: {n} card(s), categories and settings (without scans).', 'Sicherung exportiert: {n} Karte(n), Kategorien und Einstellungen (ohne Scans).', 'Copia exportada: {n} carta(s), categorías y ajustes (sin escaneos).', 'Backup esportato: {n} carta/e, categorie e impostazioni (senza scansioni).'],
    ["Fichier illisible : ce n'est pas une sauvegarde TCG Price Hunter.", 'Unreadable file: this is not a TCG Price Hunter backup.', 'Datei unlesbar: keine TCG-Price-Hunter-Sicherung.', 'Archivo ilegible: no es una copia de TCG Price Hunter.', 'File illeggibile: non è un backup di TCG Price Hunter.'],
    ['Importer cette sauvegarde ({n} carte(s)) ?\n\nTa liste, tes catégories et tes réglages actuels seront remplacés. Les cartes reviennent « pas encore scannées ».', 'Import this backup ({n} card(s))?\n\nYour current list, categories and settings will be replaced. Cards come back "not scanned yet".', 'Diese Sicherung importieren ({n} Karte(n))?\n\nDeine Liste, Kategorien und Einstellungen werden ersetzt. Die Karten sind wieder „noch nicht gescannt“.', '¿Importar esta copia ({n} carta(s))?\n\nTu lista, categorías y ajustes actuales se reemplazarán. Las cartas vuelven « sin escanear ».', 'Importare questo backup ({n} carta/e)?\n\nLista, categorie e impostazioni attuali saranno sostituite. Le carte tornano « non scansionate ».'],
    ['Langue de l\'extension', 'Extension language', 'Sprache der Erweiterung', 'Idioma de la extensión', 'Lingua dell\'estensione'],

    // --- cartes scannées ---
    ['Ajoute des cartes depuis Cardmarket (barre sous le titre), coche-les et scanne-les ici.', 'Add cards from Cardmarket (bar under the title), tick them and scan them here.', 'Füge Karten auf Cardmarket hinzu (Leiste unter dem Titel), hake sie an und scanne sie hier.', 'Añade cartas desde Cardmarket (barra bajo el título), márcalas y escanéalas aquí.', 'Aggiungi carte da Cardmarket (barra sotto il titolo), selezionale e scansionale qui.'],
    ['🏆 Calculer le meilleur panier', '🏆 Calculate the best basket', '🏆 Besten Warenkorb berechnen', '🏆 Calcular la mejor cesta', '🏆 Calcola il carrello migliore'],
    ['🌐 Langue voulue :', '🌐 Wanted language:', '🌐 Gewünschte Sprache:', '🌐 Idioma deseado:', '🌐 Lingua voluta:'],
    ['Rechercher…', 'Search…', 'Suchen…', 'Buscar…', 'Cerca…'],
    ['Tout cocher', 'Tick all', 'Alle anhaken', 'Marcar todo', 'Seleziona tutto'],
    ['Tout décocher', 'Untick all', 'Alle abwählen', 'Desmarcar todo', 'Deseleziona tutto'],
    ['Ranger les cartes cochées dans une catégorie', 'Put the ticked cards in a category', 'Angehakte Karten in eine Kategorie legen', 'Poner las cartas marcadas en una categoría', 'Metti le carte selezionate in una categoria'],
    ['🔍 Scanner la sélection', '🔍 Scan selection', '🔍 Auswahl scannen', '🔍 Escanear selección', '🔍 Scansiona selezione'],
    ['Tout scanner', 'Scan all', 'Alle scannen', 'Escanear todo', 'Scansiona tutto'],
    ['Vendeurs :', 'Sellers:', 'Verkäufer:', 'Vendedores:', 'Venditori:'],
    ['Note min', 'Min rating', 'Min. Bewertung', 'Valoración mín.', 'Valutazione min.'],
    ['Toutes', 'All', 'Alle', 'Todas', 'Tutte'],
    ['Moyen et +', 'Average +', 'Durchschnitt +', 'Normal +', 'Medio +'],
    ['Bon et +', 'Good +', 'Gut +', 'Bueno +', 'Buono +'],
    ['Très bon et +', 'Very good +', 'Sehr gut +', 'Muy bueno +', 'Molto buono +'],
    ['Extraordinaire', 'Outstanding', 'Hervorragend', 'Excelente', 'Eccezionale'],
    ['Ventes min', 'Min sales', 'Min. Verkäufe', 'Ventas mín.', 'Vendite min.'],
    ['📦 Livré en', '📦 Delivered to', '📦 Lieferung nach', '📦 Envío a', '📦 Consegna in'],
    ['Vendeurs', 'Sellers', 'Verkäufer', 'Vendedores', 'Venditori'],
    ['de tous les pays', 'from all countries', 'aus allen Ländern', 'de todos los países', 'da tutti i paesi'],
    ['de mon pays', 'from my country', 'aus meinem Land', 'de mi país', 'dal mio paese'],
    ['Choisir des pays…', 'Choose countries…', 'Länder wählen…', 'Elegir países…', 'Scegli paesi…'],
    ['Toujours en lettre suivie', 'Always tracked letter', 'Immer Brief mit Sendungsverfolgung', 'Siempre carta certificada', 'Sempre lettera tracciata'],
    ['Coché : tu prends toujours une lettre suivie (2,52 €), donc les vendeurs « envoi suivi obligatoire » ne sont plus désavantagés', 'Ticked: you always take a tracked letter, so "tracked shipping only" sellers are no longer disadvantaged', 'Angehakt: du nimmst immer einen verfolgten Brief, „nur versichert“-Verkäufer sind nicht mehr benachteiligt', 'Marcado: siempre eliges carta certificada, los vendedores « solo envío certificado » ya no salen perjudicados', 'Selezionato: prendi sempre una lettera tracciata, i venditori « solo spedizione tracciata » non sono più svantaggiati'],
    ['Coché : tu prends toujours une lettre suivie, les vendeurs « envoi suivi obligatoire » ne sont plus désavantagés', 'Ticked: you always take a tracked letter, "tracked shipping only" sellers are no longer disadvantaged', 'Angehakt: du nimmst immer einen verfolgten Brief, „nur versichert“-Verkäufer sind nicht mehr benachteiligt', 'Marcado: siempre eliges carta certificada, los vendedores « solo envío certificado » ya no salen perjudicados', 'Selezionato: prendi sempre una lettera tracciata, i venditori « solo spedizione tracciata » non sono più svantaggiati'],
    ['États des cartes ?', 'Card conditions?', 'Kartenzustände?', '¿Estados de las cartas?', 'Condizioni delle carte?'],
    ['Tout effacer', 'Delete all', 'Alles löschen', 'Borrar todo', 'Cancella tutto'],
    ['📁 Catégories :', '📁 Categories:', '📁 Kategorien:', '📁 Categorías:', '📁 Categorie:'],
    ['➕ Catégorie', '➕ Category', '➕ Kategorie', '➕ Categoría', '➕ Categoria'],
    ['✎ Renommer', '✎ Rename', '✎ Umbenennen', '✎ Renombrar', '✎ Rinomina'],
    ['🗑 Supprimer', '🗑 Delete', '🗑 Löschen', '🗑 Eliminar', '🗑 Elimina'],
    ['Sans catégorie', 'No category', 'Ohne Kategorie', 'Sin categoría', 'Senza categoria'],
    ['➕ Nouvelle catégorie…', '➕ New category…', '➕ Neue Kategorie…', '➕ Nueva categoría…', '➕ Nuova categoria…'],
    ['📁 Ranger la sélection dans…', '📁 Put selection in…', '📁 Auswahl ablegen in…', '📁 Poner selección en…', '📁 Metti selezione in…'],
    ['Carte · langue · état', 'Card · language · condition', 'Karte · Sprache · Zustand', 'Carta · idioma · estado', 'Carta · lingua · condizione'],
    ['Qté', 'Qty', 'Anz.', 'Cant.', 'Qtà'],
    ['Offres', 'Offers', 'Angebote', 'Ofertas', 'Offerte'],
    ['Dès', 'From', 'Ab', 'Desde', 'Da'],
    ['Scan', 'Scan', 'Scan', 'Escaneo', 'Scansione'],
    ['Tous états', 'Any condition', 'Jeder Zustand', 'Cualquier estado', 'Qualsiasi condizione'],
    ['toutes', 'all', 'alle', 'todas', 'tutte'],
    ['toutes langues', 'all languages', 'alle Sprachen', 'todos los idiomas', 'tutte le lingue'],
    ['scan en cours…', 'scanning…', 'wird gescannt…', 'escaneando…', 'scansione…'],
    ['en attente', 'waiting', 'wartet', 'en espera', 'in attesa'],
    ['pas encore scannée', 'not scanned yet', 'noch nicht gescannt', 'aún no escaneada', 'non ancora scansionata'],
    ['aucune offre avec ces filtres', 'no offer with these filters', 'kein Angebot mit diesen Filtern', 'ninguna oferta con estos filtros', 'nessuna offerta con questi filtri'],
    ["limite d'offres atteinte", 'offer limit reached', 'Angebotslimit erreicht', 'límite de ofertas alcanzado', 'limite di offerte raggiunto'],
    ['non connecté (50 max)', 'not logged in (50 max)', 'nicht eingeloggt (max. 50)', 'sin sesión (máx. 50)', 'non connesso (max 50)'],
    ['re-scanne pour filtrer les vendeurs', 'rescan to filter sellers', 'neu scannen, um Verkäufer zu filtern', 'vuelve a escanear para filtrar vendedores', 'riscansiona per filtrare i venditori'],
    ['Quantité', 'Quantity', 'Menge', 'Cantidad', 'Quantità'],
    ['Scanner cette carte', 'Scan this card', 'Diese Karte scannen', 'Escanear esta carta', 'Scansiona questa carta'],
    ['Retirer', 'Remove', 'Entfernen', 'Quitar', 'Rimuovi'],
    ['Voir la carte sur Cardmarket', 'See the card on Cardmarket', 'Karte auf Cardmarket ansehen', 'Ver la carta en Cardmarket', 'Vedi la carta su Cardmarket'],
    ['Sélection (scan + calcul)', 'Selection (scan + calculation)', 'Auswahl (Scan + Berechnung)', 'Selección (escaneo + cálculo)', 'Selezione (scansione + calcolo)'],
    ['État minimum', 'Minimum condition', 'Mindestzustand', 'Estado mínimo', 'Condizione minima'],
    ['Catégorie', 'Category', 'Kategorie', 'Categoría', 'Categoria'],
    ['À quoi correspondent les états ?', 'What do the conditions mean?', 'Was bedeuten die Zustände?', '¿Qué significan los estados?', 'Cosa significano le condizioni?'],
    ['Toutes les langues', 'All languages', 'Alle Sprachen', 'Todos los idiomas', 'Tutte le lingue'],

    // --- meilleur panier ---
    ['Cartes + frais de port, en une ou plusieurs commandes.', 'Cards + shipping, in one or more orders.', 'Karten + Versand, in einer oder mehreren Bestellungen.', 'Cartas + envío, en uno o varios pedidos.', 'Carte + spedizione, in uno o più ordini.'],
    ['↻ Recalculer', '↻ Recalculate', '↻ Neu berechnen', '↻ Recalcular', '↻ Ricalcola'],
    ['Total à payer', 'Total to pay', 'Gesamtbetrag', 'Total a pagar', 'Totale da pagare'],
    ['Cartes', 'Cards', 'Karten', 'Cartas', 'Carte'],
    ['Tu économises (vs chaque carte au moins cher)', 'You save (vs each card at the cheapest)', 'Du sparst (ggü. jede Karte zum günstigsten Preis)', 'Ahorras (vs cada carta al más barato)', 'Risparmi (vs ogni carta al più economico)'],
    ['Comparaison', 'Comparison', 'Vergleich', 'Comparación', 'Confronto'],
    ['Stratégie', 'Strategy', 'Strategie', 'Estrategia', 'Strategia'],
    ['Port', 'Shipping', 'Versand', 'Envío', 'Spedizione'],
    ['Total', 'Total', 'Gesamt', 'Total', 'Totale'],
    ['Chaque carte chez le moins cher (sans regarder le port)', 'Each card at the cheapest seller (ignoring shipping)', 'Jede Karte beim günstigsten Verkäufer (ohne Versand)', 'Cada carta en el vendedor más barato (sin mirar el envío)', 'Ogni carta dal venditore più economico (senza spedizione)'],
    ['🛒 Les commandes à passer', '🛒 Orders to place', '🛒 Aufzugebende Bestellungen', '🛒 Pedidos a realizar', '🛒 Ordini da fare'],
    ["Rien n'est acheté : ça remplit ton panier Cardmarket, tu vérifies et tu payes toi-même.", 'Nothing is bought: it fills your Cardmarket cart, you check and pay yourself.', 'Nichts wird gekauft: es füllt deinen Cardmarket-Warenkorb, du prüfst und zahlst selbst.', 'No se compra nada: llena tu cesta de Cardmarket, tú revisas y pagas.', 'Nulla viene acquistato: riempie il tuo carrello Cardmarket, controlli e paghi tu.'],
    ['Carte', 'Card', 'Karte', 'Carta', 'Carta'],
    ['État / langue', 'Condition / language', 'Zustand / Sprache', 'Estado / idioma', 'Condizione / lingua'],
    ['Prix', 'Price', 'Preis', 'Precio', 'Prezzo'],
    ['Sous-total', 'Subtotal', 'Zwischensumme', 'Subtotal', 'Subtotale'],
    ['Vendeur', 'Seller', 'Verkäufer', 'Vendedor', 'Venditore'],
    ['Prix cartes', 'Cards price', 'Kartenpreis', 'Precio cartas', 'Prezzo carte'],
    ['€ / carte', '€ / card', '€ / Karte', '€ / carta', '€ / carta'],
    ['envoi suivi seulement', 'tracked shipping only', 'nur versicherter Versand', 'solo envío certificado', 'solo spedizione tracciata'],
    ['suivi', 'tracked', 'versichert', 'certificado', 'tracciata'],
    ['🛒 Ajouter', '🛒 Add', '🛒 Hinzufügen', '🛒 Añadir', '🛒 Aggiungi'],
    ['Ajouter seulement cette commande au panier Cardmarket', 'Add only this order to the Cardmarket cart', 'Nur diese Bestellung zum Cardmarket-Warenkorb hinzufügen', 'Añadir solo este pedido a la cesta de Cardmarket', 'Aggiungi solo questo ordine al carrello Cardmarket'],
    ['Chargement des frais de port officiels…', 'Loading official shipping costs…', 'Offizielle Versandkosten werden geladen…', 'Cargando gastos de envío oficiales…', 'Caricamento spese di spedizione ufficiali…'],

    // --- frais de port (page) ---
    ['Tarifs officiels Cardmarket pour tous les pays (source :', 'Official Cardmarket rates for all countries (source:', 'Offizielle Cardmarket-Tarife für alle Länder (Quelle:', 'Tarifas oficiales de Cardmarket para todos los países (fuente:', 'Tariffe ufficiali Cardmarket per tutti i paesi (fonte:'],
    ['aide Cardmarket', 'Cardmarket help', 'Cardmarket-Hilfe', 'ayuda de Cardmarket', 'aiuto Cardmarket'],
    ['). Le calcul du panier utilise automatiquement le bon tarif pour chaque vendeur : pays du vendeur → ton pays.', '). The basket calculation automatically uses the right rate for each seller: seller country → your country.', '). Die Berechnung nutzt automatisch den richtigen Tarif für jeden Verkäufer: Land des Verkäufers → dein Land.', '). El cálculo usa automáticamente la tarifa correcta para cada vendedor: país del vendedor → tu país.', '). Il calcolo usa automaticamente la tariffa giusta per ogni venditore: paese del venditore → il tuo paese.'],
    ['⬇ Télécharger tous les tarifs', '⬇ Download all rates', '⬇ Alle Tarife herunterladen', '⬇ Descargar todas las tarifas', '⬇ Scarica tutte le tariffe'],
    ["🔎 N'importe quel pays → n'importe quel pays", '🔎 Any country → any country', '🔎 Jedes Land → jedes Land', '🔎 Cualquier país → cualquier país', '🔎 Qualsiasi paese → qualsiasi paese'],
    ['Origine (vendeur)', 'Origin (seller)', 'Herkunft (Verkäufer)', 'Origen (vendedor)', 'Origine (venditore)'],
    ['Destination', 'Destination', 'Ziel', 'Destino', 'Destinazione'],
    ['Inverser', 'Swap', 'Tauschen', 'Invertir', 'Inverti'],
    ['Tous les pays → ton pays', 'All countries → your country', 'Alle Länder → dein Land', 'Todos los países → tu país', 'Tutti i paesi → il tuo paese'],
    ['Ton pays → tous les pays', 'Your country → all countries', 'Dein Land → alle Länder', 'Tu país → todos los países', 'Il tuo paese → tutti i paesi'],
    ["Mode d'envoi", 'Shipping method', 'Versandart', 'Método de envío', 'Metodo di spedizione'],
    ['Suivi', 'Tracked', 'Versichert', 'Certificado', 'Tracciato'],
    ['Valeur max', 'Max value', 'Max. Wert', 'Valor máx.', 'Valore max'],
    ['Poids max', 'Max weight', 'Max. Gewicht', 'Peso máx.', 'Peso max'],
    ['Cartes max', 'Max cards', 'Max. Karten', 'Cartas máx.', 'Carte max'],
    ['Pays', 'Country', 'Land', 'País', 'Paese'],
    ['Lettre 4 cartes · suivie · 40 cartes', 'Letter 4 cards · tracked · 40 cards', 'Brief 4 Karten · versichert · 40 Karten', 'Carta 4 cartas · certificada · 40 cartas', 'Lettera 4 carte · tracciata · 40 carte'],
    ["pas d'envoi", 'no shipping', 'kein Versand', 'sin envío', 'nessuna spedizione'],
    ["Cardmarket n'envoie pas entre ces deux pays.", 'Cardmarket does not ship between these two countries.', 'Cardmarket versendet nicht zwischen diesen beiden Ländern.', 'Cardmarket no envía entre estos dos países.', 'Cardmarket non spedisce tra questi due paesi.'],

    // --- réglages ---
    ['Ton pays, les pays des vendeurs, les frais de port, le scan et les filtres par défaut.', 'Your country, seller countries, shipping, scan and default filters.', 'Dein Land, Verkäuferländer, Versand, Scan und Standardfilter.', 'Tu país, países de vendedores, envío, escaneo y filtros por defecto.', 'Il tuo paese, paesi dei venditori, spedizione, scansione e filtri predefiniti.'],
    ['🌍 Pays', '🌍 Country', '🌍 Land', '🌍 País', '🌍 Paese'],
    ['Je me fais livrer en', 'I get delivered to', 'Lieferung nach', 'Me envían a', 'Consegna in'],
    ['Même pays que la langue de l\'extension', 'Same country as the extension language', 'Gleiches Land wie die Sprache der Erweiterung', 'Mismo país que el idioma de la extensión', 'Stesso paese della lingua dell\'estensione'],
    ['Pays des vendeurs acceptés', 'Accepted seller countries', 'Akzeptierte Verkäuferländer', 'Países de vendedores aceptados', 'Paesi dei venditori accettati'],
    ['aucun choisi = tous les pays', 'none chosen = all countries', 'keins gewählt = alle Länder', 'ninguno = todos los países', 'nessuno = tutti i paesi'],
    ['Seulement mon pays', 'Only my country', 'Nur mein Land', 'Solo mi país', 'Solo il mio paese'],
    ['Tous les pays', 'All countries', 'Alle Länder', 'Todos los países', 'Tutti i paesi'],
    ['📦 Frais de port', '📦 Shipping', '📦 Versand', '📦 Envío', '📦 Spedizione'],
    ['Toujours en envoi suivi', 'Always tracked shipping', 'Immer versicherter Versand', 'Siempre envío certificado', 'Sempre spedizione tracciata'],
    ["(sinon : le moins cher, et suivi seulement quand c'est obligatoire)", '(otherwise: the cheapest, tracked only when required)', '(sonst: am günstigsten, versichert nur wenn nötig)', '(si no: lo más barato, certificado solo si es obligatorio)', '(altrimenti: il più economico, tracciato solo se obbligatorio)'],
    ["Voir les frais de port sur l'aide Cardmarket", 'See shipping costs on the Cardmarket help', 'Versandkosten in der Cardmarket-Hilfe ansehen', 'Ver gastos de envío en la ayuda de Cardmarket', 'Vedi le spese di spedizione nell\'aiuto Cardmarket'],
    ['Tarifs manuels (seulement si les tarifs officiels ne se chargent pas)', 'Manual rates (only if official rates fail to load)', 'Manuelle Tarife (nur wenn die offiziellen nicht laden)', 'Tarifas manuales (solo si las oficiales no cargan)', 'Tariffe manuali (solo se quelle ufficiali non si caricano)'],
    ['Lettre (€)', 'Letter (€)', 'Brief (€)', 'Carta (€)', 'Lettera (€)'],
    ['Lettre : poids max (g)', 'Letter: max weight (g)', 'Brief: max. Gewicht (g)', 'Carta: peso máx. (g)', 'Lettera: peso max (g)'],
    ['Lettre : valeur max (€)', 'Letter: max value (€)', 'Brief: max. Wert (€)', 'Carta: valor máx. (€)', 'Lettera: valore max (€)'],
    ['0 = pas de limite', '0 = no limit', '0 = keine Grenze', '0 = sin límite', '0 = nessun limite'],
    ['Lettre suivie (€)', 'Tracked letter (€)', 'Versicherter Brief (€)', 'Carta certificada (€)', 'Lettera tracciata (€)'],
    ['Colis suivi (€)', 'Tracked parcel (€)', 'Versichertes Paket (€)', 'Paquete certificado (€)', 'Pacco tracciato (€)'],
    ['Colis : poids max (g)', 'Parcel: max weight (g)', 'Paket: max. Gewicht (g)', 'Paquete: peso máx. (g)', 'Pacco: peso max (g)'],
    ["Poids d'une carte (g)", 'Weight of a card (g)', 'Gewicht einer Karte (g)', 'Peso de una carta (g)', 'Peso di una carta (g)'],
    ['Emballage (g)', 'Packaging (g)', 'Verpackung (g)', 'Embalaje (g)', 'Imballaggio (g)'],
    ['🔍 Scan', '🔍 Scan', '🔍 Scan', '🔍 Escaneo', '🔍 Scansione'],
    ['Cartes scannées en même temps', 'Cards scanned at the same time', 'Gleichzeitig gescannte Karten', 'Cartas escaneadas a la vez', 'Carte scansionate insieme'],
    ["sans ouvrir d'onglets, marche aussi en plein écran", 'without opening tabs, also works in full screen', 'ohne Tabs zu öffnen, geht auch im Vollbild', 'sin abrir pestañas, también en pantalla completa', 'senza aprire schede, funziona anche a schermo intero'],
    ['filtres changés : re-scanne', 'filters changed: rescan', 'Filter geändert: neu scannen', 'filtros cambiados: vuelve a escanear', 'filtri cambiati: riscansiona'],
    ['les moins chères', 'cheapest ones', 'die günstigsten', 'las más baratas', 'le più economiche'],
    ['Déjà à jour : {n} carte(s) scannée(s) il y a moins de {h} h avec les mêmes filtres (↻ sur une carte pour forcer).', 'Already up to date: {n} card(s) scanned less than {h} h ago with the same filters (↻ on a card to force).', 'Schon aktuell: {n} Karte(n) vor weniger als {h} Std. mit denselben Filtern gescannt (↻ an einer Karte erzwingt es).', 'Ya al día: {n} carta(s) escaneada(s) hace menos de {h} h con los mismos filtros (↻ en una carta para forzar).', 'Già aggiornate: {n} carta/e scansionata/e meno di {h} h fa con gli stessi filtri (↻ su una carta per forzare).'],
    ['{n} carte(s) déjà à jour pas re-scannée(s) (moins de {h} h) — 0 requête pour elles.', '{n} up-to-date card(s) not rescanned (less than {h} h) — 0 requests for them.', '{n} aktuelle Karte(n) nicht neu gescannt (weniger als {h} Std.) — 0 Anfragen dafür.', '{n} carta(s) al día no reescaneada(s) (menos de {h} h) — 0 peticiones.', '{n} carta/e aggiornata/e non riscansionata/e (meno di {h} h) — 0 richieste.'],
    ['50 = 1 seule requête : Cardmarket filtre déjà langue, état et pays, et trie par prix', '50 = 1 single request: Cardmarket already filters language, condition and country, and sorts by price', '50 = 1 einzige Anfrage: Cardmarket filtert Sprache, Zustand und Land und sortiert nach Preis', '50 = 1 sola petición: Cardmarket ya filtra idioma, estado y país, y ordena por precio', '50 = 1 sola richiesta: Cardmarket filtra già lingua, condizione e paese, e ordina per prezzo'],
    ['Ne pas re-scanner une carte scannée il y a moins de', 'Do not rescan a card scanned less than', 'Karte nicht neu scannen, wenn gescannt vor weniger als', 'No volver a escanear una carta escaneada hace menos de', 'Non riscansionare una carta scansionata meno di'],
    ['avec les mêmes filtres · ↻ sur une carte force le scan', 'with the same filters · ↻ on a card forces the scan', 'mit denselben Filtern · ↻ an einer Karte erzwingt den Scan', 'con los mismos filtros · ↻ en una carta fuerza el escaneo', 'con gli stessi filtri · ↻ su una carta forza la scansione'],
    ['jamais (toujours re-scanner)', 'never (always rescan)', 'nie (immer neu scannen)', 'nunca (siempre reescanear)', 'mai (riscansiona sempre)'],
    ['3 jours', '3 days', '3 Tage', '3 días', '3 giorni'],
    ['📋 Journal des requêtes', '📋 Request log', '📋 Anfrageprotokoll', '📋 Registro de peticiones', '📋 Registro richieste'],
    ['chaque requête envoyée à Cardmarket : heure, type, réponse, blocages', 'every request sent to Cardmarket: time, type, response, blocks', 'jede Anfrage an Cardmarket: Uhrzeit, Typ, Antwort, Sperren', 'cada petición enviada a Cardmarket: hora, tipo, respuesta, bloqueos', 'ogni richiesta inviata a Cardmarket: ora, tipo, risposta, blocchi'],
    ['⬇ Exporter', '⬇ Export', '⬇ Exportieren', '⬇ Exportar', '⬇ Esporta'],
    ['Vider', 'Clear', 'Leeren', 'Vaciar', 'Svuota'],
    ['Offres max chargées par carte', 'Max offers loaded per card', 'Max. geladene Angebote pro Karte', 'Ofertas máx. cargadas por carta', 'Offerte max caricate per carta'],
    ["⚠ Cardmarket peut bloquer ton IP s'il reçoit trop de requêtes (la limite n'est pas publique). Si ça arrive, le scan se met en pause tout seul (1, 2, 4 puis 8 min) et reprend. Les requêtes partent à 1 toutes les 1,2 secondes (50 cartes par minute) et ralentissent toutes seules si Cardmarket freine. Le scan commence par 1 carte pour vérifier que tu es connecté. Si Cardmarket bloque pour trop de requêtes (erreur 1015), le scan fait une pause de 10 min puis reprend.", '⚠ Cardmarket may block your IP if it receives too many requests (the limit is not public). If that happens, the scan pauses by itself (1, 2, 4 then 8 min) and resumes. Requests go out at 1 every 1.2 seconds (50 cards per minute) and slow down by themselves if Cardmarket throttles. The scan starts with 1 card to check you are logged in. If Cardmarket blocks for too many requests (error 1015), the scan pauses 10 min then resumes.', '⚠ Cardmarket kann deine IP sperren, wenn zu viele Anfragen kommen (das Limit ist nicht öffentlich). Dann pausiert der Scan von selbst (1, 2, 4, dann 8 Min.) und macht weiter. Anfragen gehen alle 1,2 Sekunden raus (50 Karten pro Minute) und werden von selbst langsamer. Der Scan prüft mit der 1. Karte, ob du eingeloggt bist. Bei einer Sperre wegen zu vieler Anfragen (Fehler 1015) pausiert der Scan 10 Min.', '⚠ Cardmarket puede bloquear tu IP si recibe demasiadas peticiones (el límite no es público). Si pasa, el escaneo se pausa solo (1, 2, 4 y luego 8 min) y continúa. Las peticiones salen 1 cada 1,2 segundos (50 cartas por minuto) y se ralentizan solas. El escaneo empieza con 1 carta para comprobar que has iniciado sesión. Si Cardmarket bloquea por demasiadas peticiones (error 1015), el escaneo se pausa 10 min.', '⚠ Cardmarket può bloccare il tuo IP se riceve troppe richieste (il limite non è pubblico). Se succede, la scansione si mette in pausa da sola (1, 2, 4 poi 8 min) e riprende. Le richieste partono 1 ogni 1,2 secondi (50 carte al minuto) e rallentano da sole. La scansione inizia con 1 carta per verificare che tu sia connesso. Se Cardmarket blocca per troppe richieste (errore 1015), la scansione si ferma 10 min.'],
    ['🌐 Par défaut pour les cartes', '🌐 Default for cards', '🌐 Standard für Karten', '🌐 Por defecto para las cartas', '🌐 Predefinito per le carte'],
    ['Langues voulues', 'Wanted languages', 'Gewünschte Sprachen', 'Idiomas deseados', 'Lingue volute'],
    ['aucune cochée = toutes', 'none ticked = all', 'keine angehakt = alle', 'ninguno = todos', 'nessuna = tutte'],
    ['Appliquer à toutes les cartes', 'Apply to all cards', 'Auf alle Karten anwenden', 'Aplicar a todas las cartas', 'Applica a tutte le carte'],
    ['🚫 Vendeurs bloqués', '🚫 Blocked sellers', '🚫 Gesperrte Verkäufer', '🚫 Vendedores bloqueados', '🚫 Venditori bloccati'],
    ['Offres ignorées', 'Ignored offers', 'Ignorierte Angebote', 'Ofertas ignoradas', 'Offerte ignorate'],
    ['Tout réafficher', 'Show all again', 'Alle wieder anzeigen', 'Mostrar todo de nuevo', 'Mostra di nuovo tutto'],
    ['Débloquer', 'Unblock', 'Entsperren', 'Desbloquear', 'Sblocca'],

    // --- textes avec valeurs (TF) ---
    ['{n} en cours · {q} en attente', '{n} running · {q} waiting', '{n} laufen · {q} warten', '{n} en curso · {q} en espera', '{n} in corso · {q} in attesa'],
    ['{n} échec(s)', '{n} failed', '{n} fehlgeschlagen', '{n} fallida(s)', '{n} fallita/e'],
    ['⏱ Écoulé {a} · reste environ {b}', '⏱ Elapsed {a} · about {b} left', '⏱ Vergangen {a} · noch ca. {b}', '⏱ Transcurrido {a} · quedan unos {b}', '⏱ Trascorso {a} · restano circa {b}'],
    ['⏱ Durée totale : {a}', '⏱ Total time: {a}', '⏱ Gesamtdauer: {a}', '⏱ Duración total: {a}', '⏱ Durata totale: {a}'],
    ['⏱ ≈ {a} pour {n} carte(s)', '⏱ ≈ {a} for {n} card(s)', '⏱ ≈ {a} für {n} Karte(n)', '⏱ ≈ {a} para {n} carta(s)', '⏱ ≈ {a} per {n} carta/e'],
    ['✔ {n} carte(s) scannée(s)', '✔ {n} card(s) scanned', '✔ {n} Karte(n) gescannt', '✔ {n} carta(s) escaneada(s)', '✔ {n} carta/e scansionata/e'],
    ['Frais de port · {n} commande(s)', 'Shipping · {n} order(s)', 'Versand · {n} Bestellung(en)', 'Envío · {n} pedido(s)', 'Spedizione · {n} ordine/i'],
    ['🏆 Meilleur panier — {n} commande(s)', '🏆 Best basket — {n} order(s)', '🏆 Bester Warenkorb — {n} Bestellung(en)', '🏆 Mejor cesta — {n} pedido(s)', '🏆 Carrello migliore — {n} ordine/i'],
    ['🛒 Tout ajouter à mon panier Cardmarket ({n} carte(s))', '🛒 Add all to my Cardmarket cart ({n} card(s))', '🛒 Alles in meinen Cardmarket-Warenkorb ({n} Karte(n))', '🛒 Añadir todo a mi cesta de Cardmarket ({n} carta(s))', '🛒 Aggiungi tutto al mio carrello Cardmarket ({n} carta/e)'],
    ['{n} carte(s)', '{n} card(s)', '{n} Karte(n)', '{n} carta(s)', '{n} carta/e'],
    ["pas d'offre en {l}", 'no offer in {l}', 'kein Angebot auf {l}', 'ninguna oferta en {l}', 'nessuna offerta in {l}'],
    ['{c} et mieux', '{c} or better', '{c} oder besser', '{c} o mejor', '{c} o meglio'],
    ['⚠ {n} carte(s) sans offre dans cette langue (en rouge)', '⚠ {n} card(s) without any offer in this language (in red)', '⚠ {n} Karte(n) ohne Angebot in dieser Sprache (rot)', '⚠ {n} carta(s) sin oferta en este idioma (en rojo)', '⚠ {n} carta/e senza offerte in questa lingua (in rosso)'],
    ["à l'instant", 'just now', 'gerade eben', 'ahora mismo', 'adesso'],
    ['il y a {n} min', '{n} min ago', 'vor {n} Min.', 'hace {n} min', '{n} min fa'],
    ['il y a {n} h', '{n} h ago', 'vor {n} Std.', 'hace {n} h', '{n} h fa'],
    ['il y a {n} j', '{n} d ago', 'vor {n} T.', 'hace {n} d', '{n} g fa'],
    ['Tout chez un seul vendeur : {s}', 'Everything at one seller: {s}', 'Alles bei einem Verkäufer: {s}', 'Todo en un solo vendedor: {s}', 'Tutto da un solo venditore: {s}'],
    ["personne n'a tout (le meilleur en a {a}/{b})", 'nobody has everything (the best has {a}/{b})', 'niemand hat alles (der beste hat {a}/{b})', 'nadie lo tiene todo (el mejor tiene {a}/{b})', 'nessuno ha tutto (il migliore ne ha {a}/{b})'],
    ['📊 Top vendeurs', '📊 Top sellers', '📊 Top-Verkäufer', '📊 Mejores vendedores', '📊 Migliori venditori'],
    ["— une seule commande chez eux pour ce qu'ils ont", '— one single order with them for what they have', '— eine Bestellung bei ihnen für das, was sie haben', '— un solo pedido con ellos por lo que tienen', '— un solo ordine da loro per ciò che hanno'],
    ['Ajout au panier Cardmarket', 'Adding to Cardmarket cart', 'Zum Cardmarket-Warenkorb hinzufügen', 'Añadiendo a la cesta de Cardmarket', 'Aggiunta al carrello Cardmarket'],

    // --- barre sur les pages Cardmarket (content.js) ---
    ['🎯 TCG Price Hunter', '🎯 TCG Price Hunter', '🎯 TCG Price Hunter', '🎯 TCG Price Hunter', '🎯 TCG Price Hunter'],
    ['⏹ Arrêter ({n} offres)', '⏹ Stop ({n} offers)', '⏹ Stoppen ({n} Angebote)', '⏹ Detener ({n} ofertas)', '⏹ Ferma ({n} offerte)'],
    ['🔍 Scanner cette page', '🔍 Scan this page', '🔍 Diese Seite scannen', '🔍 Escanear esta página', '🔍 Scansiona questa pagina'],
    ['🔍 Re-scanner cette page', '🔍 Rescan this page', '🔍 Seite neu scannen', '🔍 Volver a escanear', '🔍 Riscansiona questa pagina'],
    ['✔ Dans ma liste — retirer', '✔ In my list — remove', '✔ In meiner Liste — entfernen', '✔ En mi lista — quitar', '✔ Nella mia lista — rimuovi'],
    ['➕ Ajouter (offres de la page)', '➕ Add (offers on this page)', '➕ Hinzufügen (Angebote dieser Seite)', '➕ Añadir (ofertas de la página)', '➕ Aggiungi (offerte della pagina)'],
    ['➕ Ajouter sans scanner', '➕ Add without scanning', '➕ Ohne Scan hinzufügen', '➕ Añadir sin escanear', '➕ Aggiungi senza scansione'],
    ['Déjà scannée : {n} offres', 'Already scanned: {n} offers', 'Bereits gescannt: {n} Angebote', 'Ya escaneada: {n} ofertas', 'Già scansionata: {n} offerte'],
    ['Chargement… {n} offres', 'Loading… {n} offers', 'Lädt… {n} Angebote', 'Cargando… {n} ofertas', 'Caricamento… {n} offerte'],
    ['✔ {n} offres scannées', '✔ {n} offers scanned', '✔ {n} Angebote gescannt', '✔ {n} ofertas escaneadas', '✔ {n} offerte scansionate'],
    ['Meilleur panier : acheter chez {s} ({p}) — entouré en vert ci-dessous', 'Best basket: buy from {s} ({p}) — circled in green below', 'Bester Warenkorb: bei {s} kaufen ({p}) — unten grün markiert', 'Mejor cesta: comprar a {s} ({p}) — rodeado en verde abajo', 'Carrello migliore: compra da {s} ({p}) — evidenziato in verde sotto'],
    ['{n} carte(s) dans ta liste', '{n} card(s) in your list', '{n} Karte(n) in deiner Liste', '{n} carta(s) en tu lista', '{n} carta/e nella tua lista'],
    ['Ouvrir mon panier →', 'Open my basket →', 'Meinen Warenkorb öffnen →', 'Abrir mi cesta →', 'Apri il mio carrello →'],
    ['🛒 À acheter ici', '🛒 Buy here', '🛒 Hier kaufen', '🛒 Comprar aquí', '🛒 Compra qui'],
    ['🛒 Dans ton panier', '🛒 In your basket', '🛒 In deinem Warenkorb', '🛒 En tu cesta', '🛒 Nel tuo carrello'],
    ['Ignorer cette offre', 'Ignore this offer', 'Dieses Angebot ignorieren', 'Ignorar esta oferta', 'Ignora questa offerta'],
    ['Bloquer ce vendeur (toutes ses offres)', 'Block this seller (all offers)', 'Diesen Verkäufer sperren (alle Angebote)', 'Bloquear este vendedor (todas sus ofertas)', 'Blocca questo venditore (tutte le offerte)'],
  ];

  const LANGS = [['fr', 'Français', '🇫🇷'], ['en', 'English', '🇬🇧'], ['de', 'Deutsch', '🇩🇪'], ['es', 'Español', '🇪🇸'], ['it', 'Italiano', '🇮🇹']];
  const IDX = { fr: 0, en: 1, de: 2, es: 3, it: 4 };
  const MAP = {};
  for (const row of D) MAP[row[0]] = row;
  let lang = 'fr';

  // langue du navigateur au premier lancement (pas l'adresse IP : un VPN ne la change pas)
  function detect() {
    let loc = 'fr-FR';
    try { loc = (root.chrome && chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || navigator.language || loc; } catch {}
    const [l, r] = loc.replace('_', '-').split('-');
    const code = (l || '').toLowerCase();
    return { lang: IDX[code] != null ? code : 'en', region: (r || '').toUpperCase() };
  }

  const T = (s) => { const row = MAP[s]; return row && row[IDX[lang]] ? row[IDX[lang]] : s; };
  const TF = (s, v = {}) => T(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ''));

  // traduit tous les textes / placeholders / titres d'un morceau de page (textes fixes uniquement)
  function translateTree(rootEl) {
    if (lang === 'fr' || !rootEl) return;
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const raw = n.nodeValue, key = raw.replace(/\s+/g, ' ').trim();
      if (!key || !MAP[key]) continue;
      const tr = T(key);
      if (tr !== key) n.nodeValue = raw.replace(raw.trim(), tr);
    }
    rootEl.querySelectorAll && rootEl.querySelectorAll('[placeholder],[title]').forEach((el) => {
      for (const a of ['placeholder', 'title']) {
        const v = el.getAttribute(a);
        if (v && MAP[v.trim()]) el.setAttribute(a, T(v.trim()));
      }
    });
  }

  root.I18N = { LANGS, detect, T, TF, translateTree, setLang: (l) => { lang = IDX[l] != null ? l : 'fr'; }, getLang: () => lang };
})(typeof self !== 'undefined' ? self : globalThis);
