# Plan d'implémentation — Le Grimoire du Village

> Feuille de route issue de l'audit robustesse / cohérence / UI-UX du 07/07/2026.
> Objectif : fiabiliser le moteur de jeu, éliminer les impasses, et alléger l'interface
> sans dénaturer l'esthétique « Living Chronicle » existante.

## Principes directeurs

1. **Ne rien casser de ce qui marche.** Le flux Setup, les transitions jour/nuit, l'audit
   de scoring et la Chronique sont des points forts : on les préserve.
2. **Une correction = un commit atomique**, testable et réversible.
3. **Centraliser avant d'embellir.** On règle d'abord l'état (source des bugs), puis l'UI.
4. **Le tactile est la cible.** PWA paysage sur tablette : tout ce qui dépend du survol
   souris (`title`, `opacity:0` au hover) doit avoir un équivalent tactile.

---

## PHASE 0 — Sécuriser la partie (P0, bloquants)

> Ces 4 chantiers éliminent les deux seuls risques de « partie perdue / bloquée ».
> À faire en premier, ils sont indépendants les uns des autres.

### 0.1 — Journée sans exécution (vote blanc) au Tribunal

**Problème.** « Endormir le Village » est désactivé tant que `tribunalLocked === false`
(`DashboardScreen.jsx:855`). Le seul chemin vers `tribunalLocked = true` passe par le bouton
« Exécuter ». Si le village s'abstient (`max === 0`) ou en cas d'égalité non tranchée,
aucun bouton n'apparaît → **partie bloquée**.

**Solution.**
- Ajouter dans le panneau tribunal un bouton **« ⚖️ Aucune exécution (village indécis) »**
  toujours disponible une fois que tout le monde a voté, qui :
  - `saveHistory()`
  - `pushToJournal("Le village n'a pas réussi à s'accorder. Personne n'est exécuté.", 'phase')`
  - `setIsVoting(false)` + `setTribunalLocked(true)`
- Étendre le cas `max === 0` (actuellement `return null`) pour proposer explicitement ce bouton.
- Dupliquer ce bouton dans l'état « égalité sans capitaine » (aujourd'hui cul-de-sac
  textuel `DashboardScreen.jsx:1789`).

**Fichiers.** `DashboardScreen.jsx` (bloc tribunal ~1631-1799).

**Validation.** Ouvrir le tribunal, mettre tout le monde en abstention → le bouton
« Aucune exécution » apparaît → clic → on peut endormir le village.

---

### 0.2 — Sauvegarde automatique (persistance de l'état)

**Problème.** L'état Zustand est en mémoire volatile. Un refresh / une mise en veille
prolongée / un crash navigateur sur tablette = partie perdue (sauf sauvegarde manuelle).

**Solution.** Middleware `persist` de Zustand sur `localStorage`, clé dédiée
`loup_garou_autosave`, distincte des sauvegardes nommées manuelles.
- Envelopper le store : `create(persist((set, get) => ({...}), { name, partialize }))`.
- `partialize` : ne persister que l'état sérialisable (exclure les fonctions — automatique —
  et `pastStates` pour ne pas gonfler le stockage : ~20 snapshots complets = lourd).
- `onRehydrateStorage` : re-convertir les `timestamp` du journal en objets `Date`
  (comme le fait déjà `loadGameFromLocalStorage`).
- Au démarrage sur `/` : si un autosave existe avec `phase !== 'setup'`, le bouton
  « Retourner à la partie en cours » (déjà présent, `SetupScreen.jsx:261`) le reprend.

**Fichiers.** `useGameStore.js` (wrapper du store), vérifier `SetupScreen.jsx` (détection).

**Validation.** Démarrer une partie, avancer à la Nuit 2, F5 → l'état est restauré à
l'identique (joueurs, phase, journal, potions).

**Risque.** Migration des sauvegardes existantes : voir 0.4 (versionnage).

---

### 0.3 — Fallback SPA sur GitHub Pages (refresh 404)

**Problème.** Prod = `BrowserRouter` + GitHub Pages. Un refresh sur
`/loup_garou/dashboard` renvoie une **404** (pas de routeur serveur, pas de `404.html`).

**Solution — au choix (recommandation : A).**
- **A. `HashRouter`** (`main.jsx`). Les routes deviennent `/#/dashboard`, immunisées au
  refresh, zéro fichier annexe. Simple, robuste, adapté à une app 2 écrans.
- **B. Hack SPA `404.html`** : copier `index.html` → `public/404.html` + script de
  redirection `sessionStorage`. Plus « propre » niveau URL mais plus fragile.

**Fichiers.** `main.jsx` (option A) ou `public/404.html` + `index.html` (option B).

**Validation.** `npm run build && npm run preview`, naviguer vers le dashboard, F5 →
l'app se recharge sans 404.

---

### 0.4 — Compléter `initialState` + reset intégral + versionnage sauvegardes

**Problème.**
- `dayVotes` et `foxHistory` sont absents de `initialState` (`useGameStore.js:80`).
  Comme `set()` **fusionne**, après « Reconfigurer » ces champs gardent la valeur de la
  partie précédente → contamination du scoring IA et de l'undo.
- `startGame` ne réinitialise ni `qaScoringData` ni `pastStates` → « Annuler » peut
  restaurer un état de la partie d'avant.
- `foxHistory` manquant d'une vieille sauvegarde → `commitFoxAction` fait `[...undefined]` → crash.
- `loadGameFromLocalStorage` fait un `set(parsed)` brut, sans validation de schéma.

**Solution.**
1. Ajouter à `initialState` : `dayVotes: {}`, `foxHistory: []`, `qaScoringData: {}`
   (déjà présent), `activeNightSteps: []` (déjà présent). Vérifier l'exhaustivité champ par champ.
2. `startGame` et `resetGame` : repartir de `{ ...initialState, <overrides> }` plutôt que
   d'énumérer manuellement les resets (source d'oublis).
3. Introduire une constante `SAVE_SCHEMA_VERSION = 1`. L'écrire dans chaque sauvegarde.
   Au chargement : si `version` absente ou inférieure, appliquer une migration légère
   (`{ ...initialState, ...parsed }` garantit que tout champ manquant reçoit sa valeur par
   défaut) et logguer un avertissement.

**Fichiers.** `useGameStore.js` (`initialState`, `startGame`, `resetGame`,
`saveGameToLocalStorage`, `loadGameFromLocalStorage`).

**Validation.** Jouer une partie avec un Renard, reconfigurer, relancer une partie sans
Renard → le scoring IA n'affiche plus d'entrées « flair » fantômes. Charger une sauvegarde
tronquée artificiellement → pas de crash.

---

## PHASE 1 — Fiabiliser le moteur de règles (P1)

### 1.1 — `checkGameOver` : prendre en compte le camp « ambigu »

**Problème.** Victoire des loups déclarée dès `aliveVillagers === 0 && aliveSolitaires === 0`
(`useGameStore.js:473`). Un joueur `team: 'ambigu'` (Enfant Sauvage non muté, Chien-Loup
villageois/indécis) n'est compté dans aucun camp → les loups gagnent alors qu'un joueur du
bon camp est vivant.

**Solution.** Résoudre le camp effectif de chaque ambigu via `getPlayerTeam` (qui gère déjà
mutation et choix), puis vérifier les conditions de victoire sur les camps **résolus** :
- Un ambigu résolu « village » compte comme villageois pour la survie du village.
- Un ambigu non résolu (Chien-Loup pas encore décidé) bloque toute victoire tant qu'il est
  vivant (partie pas terminée).

**Fichiers.** `useGameStore.js:426` (`checkGameOver`).

**Validation.** Scénario : 1 loup + 1 Enfant Sauvage vivant (modèle vivant, donc village).
Le loup ne doit **pas** être déclaré vainqueur.

---

### 1.2 — Centraliser les morts en cascade

**Problème.** `eliminatePlayer` applique les morts induites (amoureux par chagrin, lien des
Sœurs) par patch direct du tableau, sans repasser par la logique complète. Conséquence : si
la victime en cascade est Capitaine / Sœur / Ancien / Chasseur, ses propres effets ne se
déclenchent pas. Seul le Chasseur est rattrapé, et via un `useEffect` d'UI
(`DashboardScreen.jsx:300`) — logique métier hébergée dans la vue.

**Solution.** Refactor de `eliminatePlayer` en fonction **récursive** :
- Séparer « marquer mort + causes directes » d'une file `pendingDeaths`.
- Pour chaque mort, calculer les morts induites (amoureux, sœurs) et les **réinjecter dans
  la même logique** (récursion contrôlée avec garde anti-boucle : ne traiter un id qu'une fois).
- Les déclencheurs (succession capitaine, malédiction ancien, vengeance chevalier, tir
  chasseur) doivent être évalués pour **toute** mort, cascade comprise.
- Déplacer la détection « chasseur mort → tir en attente » du `useEffect` vers un état piloté
  par le store (`hunterPendingId`) pour cohérence.

**Fichiers.** `useGameStore.js:517` (`eliminatePlayer`), `DashboardScreen.jsx:300` (retrait
du `useEffect` de détection, remplacé par lecture du store).

**Validation.** Cupidon lie le Capitaine à un autre joueur. Tuer le partenaire → l'amoureux
Capitaine meurt de chagrin → la fenêtre de succession s'ouvre bien.

**Note.** Chantier le plus délicat de la Phase 1 : le faire seul, avec des scénarios de test
manuels écrits avant (amoureux-capitaine, sœur-ancien, chasseur tué par chagrin).

---

### 1.3 — Éliminer les mutations d'état directes

**Problème.**
- `swapRoleSwap` (`useGameStore.js:487`) mute les objets joueurs en place
  (`p[sIdx].roleId = ...`). Les snapshots `pastStates` partagent ces références → **« Annuler »
  ne restaure pas un échange de rôle**.
- `wakeUpVillage` (`useGameStore.js:726`) mute l'objet renvoyé par `get()` hors de `set()`
  (`updatedState.journal.push(...)`, `updatedState.players = ...`). Fonctionne par accident,
  casse silencieusement snapshots et réactivité.

**Solution.** Immutabilité stricte : `swapRoleSwap` recrée les objets modifiés
(`p.map(x => x.id === ... ? { ...x, roleId } : x)`). `wakeUpVillage` accumule journal et
joueurs dans des variables locales **neuves** puis un unique `set(...)` final.

**Fichiers.** `useGameStore.js` (`swapRoleSwap`, `wakeUpVillage`).

**Validation.** En préparation, échanger deux rôles, cliquer « Annuler » → l'échange est
bien défait.

---

### 1.4 — Décision produit : écarts avec les règles officielles

> **Ne pas coder sans arbitrage.** Ce sont des choix de game design, à valider par le
> propriétaire (certains sont déjà des règles maison assumées).

| Écart | État actuel | Officiel | Action |
|---|---|---|---|
| Infect Père ne peut pas infecter la victime des loups | Règle maison **documentée** (`AI_CONTEXT.md §3`) | L'infection cible justement la victime dévorée | **Conserver** (assumé). Aucune action code. |
| Les deux Sœurs meurent ensemble (lien de sang) | Implémenté | N'existe pas officiellement | **À trancher** : garder comme variante maison ou retirer. |
| Corbeau classé « Solitaires » (commentaire) mais `team: 'village'` | Incohérence de commentaire | Corbeau = village | Corriger le **commentaire** du catalogue (`useGameStore.js:30`). |

**Fichiers.** `useGameStore.js` (catalogue) selon arbitrage.

---

## PHASE 2 — Alléger et clarifier l'UI/UX (P2)

> Le Dashboard fait 2 319 lignes avec ~100 styles inline. On refactore par extraction
> progressive, sans big-bang. Chaque composant extrait est un commit isolé, iso-rendu.

### 2.1 — Découper `DashboardScreen` en composants

**Cible d'extraction (dans `src/screens/DashboardScreen/components/`) :**
- `NightStepCard.jsx` — la carte d'étape de nuit + tous les boutons IA contextuels (~1209-1576).
- `TribunalPanel.jsx` — vote humain, vote IA, dépouillement, égalité capitaine (~1631-1799).
- `PlayerActionPanel.jsx` — panneau contextuel du joueur sélectionné (~1802-1933).
- `PlayerCircle.jsx` — l'ellipse + les avatars et leurs badges (~1046-1176).
- `modals/` — `HunterModal`, `ScoringAuditModal`, `BearGrowlModal`, `CaptainModal`,
  `WitchModal`, `SaveModal`, `SuccessionModal`, `VictoryOverlay`.

**Méthode.** Extraire un composant à la fois, lui passer les props/handlers nécessaires,
vérifier l'iso-rendu, committer. Le `DashboardScreen` devient un orchestrateur < 400 lignes.

**Bénéfice.** Lisibilité, testabilité, et surtout : rend possibles les optimisations 2.2-2.4.

---

### 2.2 — Migrer les styles inline vers les tokens du design system

**Problème.** `#a78bfa`, `#ffd700`, `#ff4d4d`, `#aaa`, `fontSize:'0.65rem'`… hardcodés
partout, alors que `index.css` définit `--color-primary`, l'échelle typo, l'espacement 8dp.
Source directe de l'incohérence visuelle « pas fini ».

**Solution.** Remplacer les couleurs/tailles inline par des classes CSS et variables :
- Créer des classes utilitaires manquantes (`.text-gold`, `.panel-danger`, etc.) mappées
  sur les tokens.
- Ajouter les tokens absents s'il en manque (ex. un `--color-danger: #ff4d4d`, un
  `--color-gold` aligné sur `--color-tertiary`).
- Objectif : **zéro couleur hexadécimale inline** dans le JSX à la fin.

**Fichiers.** `DashboardScreen.css`, `index.css`, composants extraits en 2.1.

---

### 2.3 — Réduire la surcharge des avatars (badges)

**Problème.** Jusqu'à ~10 badges emoji superposés par avatar (☣️🎖️💞🎶👁️🐦🐻💀⚔️🌿).
Source n°1 du « trop chargé », surtout à 16 joueurs.

**Solution.**
- **2 badges visibles maximum** par avatar : (1) statut vital / cible de la nuit,
  (2) le badge contextuellement le plus important selon la phase.
- Les autres marqueurs (amoureux, charmé, vu par voyante, cible corbeau, modèle enfant
  sauvage…) → déplacés dans le **panneau d'action** au clic (qui existe déjà) et/ou
  résumés par un unique badge « ⋯ » cliquable.
- Prioriser par phase : la nuit on montre les cibles ; le jour on montre suspicion/statut.

**Fichiers.** `PlayerCircle.jsx` (extrait en 2.1), `DashboardScreen.css`.

**Validation.** Cercle de 16 joueurs en milieu de partie → lisibilité nette, aucun
chevauchement de badges.

---

### 2.4 — Composant `<AIButton>` unifié

**Problème.** 12 boutons IA aux libellés et styles divergents (« 🎲 Cupidon IA », « ✨ IA :
Le Chien-Loup… », « 🤖 IA : Faire Voter les Doudous »…), chacun dupliquant 15-30 lignes.

**Solution.** Un composant unique :
```
<AIButton role="cupidon" disabled={...} onClick={...} />
```
- Libellé normalisé : `🎲 IA — {NomDuRôle}` + sous-texte optionnel (stratégie).
- Style unique dérivé des tokens.
- La logique de sélection reste dans les handlers (ou extraite dans un
  `services/aiActions.js` si on veut aussi dédupliquer le métier — optionnel).

**Fichiers.** nouveau `components/AIButton.jsx`, `NightStepCard.jsx`, `TribunalPanel.jsx`.

---

### 2.5 — Alléger l'écran en phase de nuit

**Problème.** 5 zones concurrentes (bandeau guidage + carte étape + panneau joueur +
2 sidebars). La nuit, le MJ n'a besoin que de l'étape courante et du cercle.

**Solution.**
- Replier automatiquement les deux sidebars en phase de nuit (le mécanisme `leftCollapsed`/
  `rightCollapsed` existe déjà — le piloter par `useEffect` sur `phase`), réouvrables à la main.
- Fusionner le bandeau de guidage **dans** la carte d'étape quand les deux sont présents
  (ils répètent souvent la même consigne).

**Fichiers.** `DashboardScreen.jsx` (effet de collapse), `NightStepCard.jsx`.

---

### 2.6 — Renommage découvrable au tactile

**Problème.** Renommer = double-clic sur le nom (double-tap = zoom sur tablette !) ou crayon
en `opacity:0` révélé au survol → **invisible et inutilisable au tactile**, la cible.

**Solution.**
- Crayon ✏️ **toujours visible** (opacité réduite mais > 0) à côté du nom dans la sidebar.
- Ajouter une entrée explicite « ✏️ Renommer » dans le `PlayerActionPanel` (accessible au clic
  sur l'avatar, chemin déjà tactile).
- Retirer la dépendance au double-clic comme **seul** moyen sur l'avatar.

**Fichiers.** `PlayerActionPanel.jsx`, sidebar rôles (`DashboardScreen.jsx:979`).

---

### 2.7 — États désactivés explicités (tactile)

**Problème.** « Endormir le Village » grisé avec un `title` (tooltip souris uniquement).
Sur tablette, le MJ ne comprend pas le blocage.

**Solution.** Afficher la raison **en texte visible** sous/à côté du bouton désactivé
(« Le village doit d'abord voter au tribunal »), pas seulement en `title`. Appliquer le même
principe aux autres boutons désactivés conditionnels.

**Fichiers.** `DashboardScreen.jsx` (header + boutons d'étape).

---

## PHASE 3 — Finitions (P3)

### 3.1 — Supprimer le code mort
- Bouton « Sorcière IA » inatteignable dans la carte de nuit (`DashboardScreen.jsx:1423`) :
  la carte ne s'affiche que si l'étape ≠ sorcière. À retirer (la modale dédiée le porte déjà).
- Vainqueur `'ange'` affiché (`DashboardScreen.jsx:2066`) sans rôle Ange existant : retirer
  ou implémenter le rôle.
- Branche Loup Blanc dupliquée dans `advanceNightPhase` (lignes 716 et 740) : fusionner.

### 3.2 — IDs de journal uniques
`Date.now()` (+1/+2/+3 ponctuels) → collisions de clés React possibles. Remplacer par
`crypto.randomUUID()` partout (un helper `newId()` dans le store).

### 3.3 — Feedback d'échec de sauvegarde
La modale « Partie Sauvegardée ! » s'affiche même si `localStorage` a jeté (quota plein).
`saveGameToLocalStorage` doit renvoyer un booléen ; la modale affiche succès **ou** erreur.

### 3.4 — Cache offline des polices
Material Symbols + Google Fonts non mises en cache par la PWA → hors-ligne, les boutons Setup
affichent littéralement `play_arrow` / `auto_stories`. Ajouter `runtimeCaching`
(Workbox `CacheFirst` sur `fonts.googleapis.com` / `fonts.gstatic.com`) dans la config
`VitePWA`, ou auto-héberger les polices. Alternative simple : remplacer les 2 Material Symbols
du Setup par des emoji (cohérent avec le reste de l'app, supprime la dépendance).

### 3.5 — Accessibilité des modales
- Focus-trap + fermeture par `Échap` sur toutes les modales (overlay).
- Corriger les contrastes faibles (`#aaa`, textes `0.65rem`) sous les seuils WCAG AA.
- Remplacer la largeur inline `500px` du panneau tribunal par une largeur responsive
  (`min(500px, 92vw)`).

### 3.6 — Nettoyer les avertissements ESLint
2 `useEffect` avec dépendances manquantes (`DashboardScreen.jsx:352` et `:416`). Corriger
proprement (inclure les deps ou justifier/mémoïser), ne pas masquer par commentaire.

---

## Ordre d'exécution conseillé

```
Phase 0  (bloquants)      → 0.1, 0.2, 0.3, 0.4   [indépendants, ~1 session]
Phase 1  (moteur)         → 1.3, 1.1, 1.2, 1.4   [1.2 seul, avec tests écrits d'abord]
Phase 2  (UI, itératif)   → 2.1 d'abord (débloque le reste), puis 2.2→2.7
Phase 3  (finitions)      → au fil de l'eau, en parallèle des tests
```

## Ce qu'on ne touche pas (points forts à préserver)
- Flux Setup : compteurs, « Choix rapide », contrainte Sœurs 0/2, résumé live.
- Transitions jour/nuit, modale Sorcière dédiée, audit de scoring 📊, Chronique auto-scroll.
- Design system `index.css` (on l'**étend**, on ne le remplace pas).
- Wake Lock, ErrorBoundary.

## Suivi de test (à maintenir manuellement)
Aucun harnais de test n'existe. À court terme, tenir une checklist de scénarios manuels
(partie complète avec : amoureux-capitaine, sœurs, ancien, chasseur en cascade, vote blanc,
refresh mid-game, reconfiguration). À moyen terme, envisager Vitest sur le store et
`scoringEngine` (logique pure, facile à couvrir).
