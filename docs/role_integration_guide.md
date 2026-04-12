# Guide Technique : Intégration de Nouveaux Rôles

Ce document décrit la procédure standard (SOP) pour ajouter un rôle dans le **Grimoire du Village**. L'ajout d'un rôle nécessite une coordination entre le store (Zustand), la logique de nuit et l'interface utilisateur.

---

## 1. Catalogue et Métadonnées
Tous les rôles doivent être déclarés dans `src/store/useGameStore.js` au sein de `ROLE_CATALOG`.

- **id** : Identifiant unique (snake-case).
- **name** : Nom affiché.
- **team** : `loup`, `village`, `ambigu` ou `solitaire`.
- **maxQty** : Nombre maximum de ce rôle dans une partie.
- **icon** : Émoji représentatif.

```javascript
// Exemple :
{ id: 'mon-role', name: 'Mon Nouveau Rôle', team: 'village', maxQty: 1, icon: '✨' }
```

---

## 2. Ordre d'Appel Nocturne
Le séquençage est défini dans `src/screens/DashboardScreen/DashboardScreen.jsx` via la constante `NIGHT_ORDER`.

- **id** : Correspond à l'ID dans `ROLE_CATALOG`.
- **label** : Titre affiché au MJ.
- **instruction** : Consignes pour le MJ.
- **isNight1Only** (optionnel) : Si le rôle ne se réveille qu'au début.
- **defaultGroup** (optionnel) : Pour les actions collectives (ex: Loups).

```javascript
{ id: 'mon-role', label: 'Appeler Mon Rôle', instruction: 'Il désigne un joueur...' }
```

---

## 3. État et Actions (Store)
Ajoutez les variables nécessaires dans `initialState` et les méthodes de mise à jour dans `useGameStore.js`.

### État Persistant
Si le rôle a un pouvoir unique ou une cible :
```javascript
monRoleUsed: false,
monRoleTargetId: null,
```

### Méthode Commit
Créez une fonction pour enregistrer l'action saisie par le MJ :
```javascript
commitMonRole: (targetId) => set({ monRoleTargetId: targetId, monRoleUsed: true }),
```

---

## 4. Résolution Nocturne
La fonction `wakeUpVillage` dans `useGameStore.js` gère les conséquences des actions de nuit.

- Ajoutez la logique de résolution en fonction des cibles stockées.
- **Attention** : Gérez les immunités (ex: l'Ancien) et les interactions (ex: Sorcière).
- **Journal** : Utilisez `get().pushToJournal("Texte", "type")` pour informer le MJ.

---

## 5. Interface du Maître du Jeu
Dans `src/screens/DashboardScreen/DashboardScreen.jsx`, gérez le rendu spécifique à l'étape du rôle.

### Bouton d'Action Manuel
Utilisez `currentNightStepId` pour afficher les contrôles correspondants.

### Bouton IA (Audit PNJ)
Si un PNJ possède ce rôle, implémentez une logique IA :
```javascript
{currentStepInfo.id === 'mon-role' && target.isPlush && (
  <button className="ia-btn" onClick={handleMonRoleIA}>IA Mon Rôle</button>
)}
```

### Badges Visuels
Ajoutez un badge sur l'avatar du joueur si son état change (ex: infection, charme).
```javascript
{player.isMonRoleStatus && <div className="av-badge">✨</div>}
```

---

## 6. Moteur d'Audit IA
Pour que les PNJ "peluches" puissent voter intelligemment, mettez à jour `src/services/scoringEngine.js`.

- **Camp Réel** : Modifiez `getTeam(p)` si le rôle change de camp (ex: Enfant Sauvage).
- **Suspicion** : Ajoutez une condition dans `calculatePlushieVoteScores` pour que le PNJ ajuste son score de suspicion en fonction des informations révélées par son rôle.

```javascript
if (plushie.roleId === 'mon-role') {
    // Logique de suspicion ici...
}
```

---

## Checklist de Vérification
- [ ] Le rôle est sélectionnable dans l'écran de création.
- [ ] Le MJ est appelé à la bonne étape durant la nuit.
- [ ] L'action du rôle est persistée dans le store.
- [ ] Les conséquences sont visibles au réveil (mort, infection, etc.).
- [ ] Le MJ voit des badges ou infos claires sur l'état du joueur.
- [ ] L'IA ne plante pas si une peluche a ce rôle.
