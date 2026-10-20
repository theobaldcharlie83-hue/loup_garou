# AI Context - Loups-Garous (Grimoire du Village)

Ce fichier consigne l'architecture, le système d'état, les règles métiers et le flux de travail de l'application Loups-Garous.

---

## 1. Description du Projet
Le **Grimoire du Village** est une application web d'aide à la maîtrise du jeu des Loups-Garous de Thiercelieux. Il permet à un Meneur de Jeu (MJ) de gérer les joueurs physiques ainsi que des peluches (joueurs IA) avec des calculs automatiques de scores et de choix via un moteur d'IA local.

---

## 2. Architecture Technique
Le projet est bâti sur une stack moderne et légère :
- **Framework :** React 19 (avec Vite et support PWA)
- **Gestion d'état :** Zustand
- **Routage :** React Router v7 (utilisation minimale)
- **Styles :** CSS pur. Direction artistique tirée du livret « Best Of » : nuit bleu-ardoise, parchemin, rouille, ocre, silhouette du village ; titres en *IM Fell English SC*. Tokens dans `src/index.css` (`--color-parchment`, `--color-ink`, `--color-rust`…), surcharge du Dashboard dans `DashboardTheme.css`.

### Structure des Dossiers
- `/src`
  - `/store`
    - `useGameStore.js` : Magasin central Zustand gérant tout l'état global du jeu (joueurs, rôles, journal de chronique, sauvegardes dans le localStorage).
  - `/screens`
    - `/SetupScreen` : Configuration initiale de la partie (nombre de joueurs, attribution des rôles, gestion des sauvegardes).
    - `/DashboardScreen` : Écran principal du MJ. Affiche le cercle des joueurs, la carte de l'étape nocturne en cours, les boutons d'actions et le journal (Chronique du Village).
  - `/components`
    - `/RulesModal` : Grimoire des règles interactif.
    - `/ErrorBoundary` : Catch des erreurs de rendu, avec reprise sans perte de partie.
    - `/RoleToken` : jeton illustré d'un rôle (`token` complet ou `medallion` rogné en cercle).
    - `/RoleReveal` : carte d'un joueur en plein écran (le MJ tourne la tablette vers le joueur réveillé).
    - `/RenameDialog` : renommage d'un joueur en cours de partie (unique point d'entrée).
  - `/data/roleArt.js` : correspondance rôle → illustration (`src/assets/roles/*.webp`, extraites du livret de règles).
  - `/assets/decor` : texture parchemin et silhouette du village (utilisée comme masque CSS).
  - `/services`
    - `scoringEngine.js` : Calcul des décisions IA (plushies).
  - `index.css` : Styles globaux et variables de thème.

---

## 3. Règles Métier & Spécificités

### Noms des Peluches
- Les 13 premières peluches utilisent les noms par défaut définis dans `DEFAULT_PLUSH_NAMES`.
- À partir de la 14ème peluche (index 13+), le nom est généré dynamiquement au format `"Peluche numéro X"` (où X est le numéro ordinal 1-based, ex: `Peluche numéro 14`).

### Bandeau de Guidage & Chronique
- Le bandeau de guidage (`.guidance-banner`, en haut du cercle de jeu) affiche des indications au MJ.
- Dans la Chronique, ces consignes archivées sont **masquées par défaut** (bouton 💡 pour les afficher).
- **Persistance :** Le bandeau reste affiché jusqu'à ce que le MJ clique dessus pour le fermer.
- **Logique d'Archivage :** 
  - Lorsque le bandeau est fermé ou que l'étape change, le texte du bandeau est inséré dans le journal de la Chronique sous le type `'guidance'`.
  - Un style doré avec une ampoule `💡` est appliqué à ces entrées pour les différencier visuellement des événements du jeu.
  - *Note technique :* Pour éviter que le bandeau ne réapparaisse directement à la fermeture, le clic de fermeture met à jour `showGuidanceBanner` à `false` mais maintient `activeGuidanceText` égal au texte actuel, ce qui évite de redéclencher le `useEffect` d'apparition.

### Règle de l'Infect Père des Loups
- L'Infect Père des Loups ne peut pas infecter :
  1. Un membre de la meute de loups (joueurs déjà loups).
  2. La victime choisie par les loups au cours de cette même nuit (`nightActions.wolvesVictim`).
### Stabilité de l'Écran Central (Layout)
- La zone centrale du cercle des joueurs (`.player-circle-zone`) utilise un `ResizeObserver` pour calculer dynamiquement les coordonnées de l'ellipse.
- Pour éviter un effet de boucle de rétroaction (feedback loop) où le positionnement des avatars distend la hauteur de la zone et relance le calcul, `.player-circle-zone` doit conserver des contraintes strictes : `height: 100%` et `min-height: 0` afin de s'aligner sur la grille sans s'étendre en fonction de son contenu absolute.

---

### Saisie sur tablette (règles impératives)
- Tout champ de saisie (`input`, `select`) doit avoir une police **≥ 16px** : en dessous, iOS zoome sur le champ et, l'app étant en `overflow: hidden`, l'interface reste décalée.
- Hauteurs d'écran en `100dvh` (avec repli `100vh`) ; viewport `interactive-widget=resizes-content`.
- Le focus d'un champ doit être posé **pendant le geste de l'utilisateur** (synchrone, `useLayoutEffect`), jamais dans un `setTimeout` : sinon le clavier ne s'ouvre pas sur iPad.
- Pas de lookbehind `(?<!…)` dans les regex : non supporté par Safari < 16.4 (voir `replaceNameInJournal`).
- Cibles tactiles ≥ 44px.

### Révélation des cartes
- Bouton « 🃏 Montrer la carte » dans le panneau du joueur sélectionné (hors préparation).
- Étape Voyante : désigner un joueur ouvre directement sa carte en plein écran ; un bouton permet de la remontrer.

### Noms des joueurs
- Les doublons (insensibles à la casse) sont refusés : bloquants à la configuration, refusés au renommage (store + UI).

## 4. Commandes Utiles
- **Lancer en local :** `npm run dev` (s'ouvre par défaut sur `http://localhost:5173/loup_garou/`)
- **Analyser le code (Linter) :** `npm run lint`
- **Compiler pour la production :** `npm run build`
- **Déployer sur GitHub Pages :** `npm run deploy`
