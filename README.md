# 🐺 Le Grimoire du Village

Application web d'aide à la maîtrise du jeu **Les Loups-Garous de Thiercelieux**
(édition *Best Of*). Elle assiste le Meneur de Jeu (MJ) pour gérer une partie,
suivre les rôles, dérouler l'ordre des appels de nuit, et gérer des **peluches**
jouées comme PNJ grâce à un moteur de décision local.

> Pensée pour un usage sur ordinateur, **tablette** (orientation paysage) et
> dépannage sur smartphone. Installable en PWA.

## Fonctionnalités

- Configuration de la partie : joueurs humains + peluches, distribution aléatoire des rôles.
- Cercle des joueurs interactif (placement, capitaine, badges d'état).
- Ordre officiel des appels de nuit (Best Of) avec guidage pas à pas.
- Gestion des pouvoirs : Voyante, Sorcière, Cupidon, Chasseur, Ancien, Chevalier,
  Montreur d'Ours, Renard, Infect Père, Grand-Méchant-Loup, Loup Blanc, Joueur de Flûte,
  Enfant Sauvage, Chien-Loup, Sœurs, Corbeau…
- **Peluches IA** : vote au tribunal et actions de nuit calculés par un moteur de score local
  (`src/services/`), avec audit visuel du raisonnement.
- Chronique (journal), sauvegardes multiples (localStorage), annulation (undo), Wake Lock.

> Variante maison assumée : règles **Petite Fille** et **Ange** non incluses, **Corbeau** ajouté ;
> l'Infect Père ne peut pas infecter la victime des loups de la nuit.

## Stack technique

- **React 19** + **Vite** (+ PWA)
- **Zustand** (état global, `src/store/useGameStore.js`)
- **React Router 7**
- CSS pur (thème sombre immersif)
- **Vitest** (tests unitaires du moteur de jeu)

## Démarrage

```bash
npm install --legacy-peer-deps   # conflit de peer-deps connu (vite ↔ vite-plugin-pwa)
npm run dev                      # http://localhost:5173/loup_garou/
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (`dist/`) |
| `npm run test` | Tests unitaires (Vitest) |
| `npm run lint` | Analyse statique (ESLint) |
| `npm run deploy` | Déploiement GitHub Pages |

## Structure

```
src/
  store/useGameStore.js     état central + règles métier
  screens/SetupScreen       configuration de la partie
  screens/DashboardScreen   écran principal du MJ
  services/scoringEngine.js décisions IA (scoring des peluches)
  services/voteTally.js     décompte des voix du tribunal
  services/aiStrategies.js  stratégies IA (Sorcière…)
  services/aiConfig.js      constantes de réglage IA
  components/               RulesModal, ErrorBoundary
```

Voir `AI_CONTEXT.md` pour les détails d'architecture et de règles métier.
