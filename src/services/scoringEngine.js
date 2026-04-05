import { ROLE_BY_ID } from '../store/useGameStore';

/**
 * Moteur décisionnel matriciel (Scoring System) des Peluches PNJ
 * Retourne une configuration d'audit complète pour le MJ.
 */

// Math helpers
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

export function calculatePlushieVoteScores(plushie, allPlayers, storeState) {
  const { 
    lovers = [], 
    seenBySeer = [], 
    nightActions = {}, 
    dayNumber = 1,
    // BUG-09 fix: le store utilise 'wildChildModelId', pas 'wildChildModel'
    charmedIds: fluteCharmed = [],
    wildChildModelId: wildChildModel = null, // alias correct
    chienLoupSide = null
  } = storeState;

  const getTeam = (p) => {
     if (p.isInfected) return 'loup';
     if (p.roleId === 'chien-loup' && chienLoupSide) return chienLoupSide;
     if (p.roleId === 'enfant-sauvage' && wildChildModel) {
        const model = allPlayers.find(x => x.id === wildChildModel);
        if (model && !model.isAlive) return 'loup';
     }
     return ROLE_BY_ID[p.roleId]?.team || 'village';
  };

  const myTeam = getTeam(plushie);
  const matrix = {};

  // Init
  const aliveOthers = allPlayers.filter(p => p.id !== plushie.id && p.isAlive);
  aliveOthers.forEach(p => {
     matrix[p.id] = { score: 0, breakdown: [] };
  });

  const addScore = (targetId, points, reason) => {
     if (!matrix[targetId]) return;
     matrix[targetId].score += points;
     matrix[targetId].breakdown.push({ points, reason });
  };

  aliveOthers.forEach(target => {
     const targetTeam = getTeam(target);

     // --- REGLE GLOBALE ABSOLUE (CUPIDON) ---
     if (lovers.includes(plushie.id) && lovers.includes(target.id)) {
        addScore(target.id, 1000, "Partenaire amoureux (Symbiose)");
        return; // +1000 override (we can still add other things, but love is absolute, so let's continue to add scores usually, the UI will clamp it)
     }

     // --- CATEGORIE 1 : LA MEUTE ---
     if (myTeam === 'loup') {
         if (targetTeam === 'loup') {
             // Loup Blanc exception
             if (plushie.roleId === 'loup-blanc') {
                addScore(target.id, -50, "C'est un loup. Le loup blanc le trahit (-50)");
             } else {
                addScore(target.id, 1000, "Membre de la Meute (+1000)");
             }
         } else {
             // Suspicion vers le village (sauf pour Loup Blanc qui peut focus davantage)
             addScore(target.id, -10, "Ne fait pas partie des loups (-10)");
         }
     }

     // --- CATEGORIE 2 & AUTRES (ROLE SPECIFIC) ---
     if (plushie.roleId === 'voyante') {
         if (seenBySeer.includes(target.id)) {
             if (targetTeam === 'loup') {
                addScore(target.id, -1000, "Je SAIS que c'est un Loup ! (-1000)");
             } else {
                addScore(target.id, 1000, "Je SAIS que c'est un Innocent ! (+1000)");
             }
         }
     }

     if (plushie.roleId === 'soeurs' && target.roleId === 'soeurs') {
         addScore(target.id, 1000, "C'est ma Soeur chérie (+1000)");
     }

     if (plushie.roleId === 'sorciere') {
         if (nightActions.witchHealed && nightActions.wolvesVictim === target.id) {
             addScore(target.id, 1000, "Je l'ai sauvé, il est ciblé par les loups (+1000)");
         }
     }

     if (plushie.roleId === 'montreur-ours') {
        const myIndex = allPlayers.findIndex(x => x.id === plushie.id);
        if (myIndex !== -1) {
            const left = allPlayers[(myIndex - 1 + allPlayers.length) % allPlayers.length];
            const right = allPlayers[(myIndex + 1) % allPlayers.length];
            
            // On vérifie si l'un des voisins VIVANTS est un loup
            const isLeftWolf = left.isAlive && getTeam(left) === 'loup';
            const isRightWolf = right.isAlive && getTeam(right) === 'loup';
            const hasGrowled = isLeftWolf || isRightWolf;

            if (hasGrowled) {
                // Si l'un des deux voisins est un loup, on suspecte les deux (s'ils sont vivants)
                if (target.id === left.id || target.id === right.id) {
                    addScore(target.id, -500, "L'Ours a grogné ce matin ! C'est un voisin physique ! (-500)");
                }
            } else {
                // Si l'ours n'a pas grogné, les voisins vivants sont cleans
                if ((target.id === left.id || target.id === right.id) && target.isAlive) {
                    addScore(target.id, 1000, "Mon Ours n'a pas grogné, mes voisins physiques sont cleans (+1000)");
                }
            }
        }
     }

     if (plushie.roleId === 'enfant-sauvage' && target.id === wildChildModel && myTeam !== 'loup') {
         addScore(target.id, 1000, "C'est mon Modèle, je dois le protéger (+1000)");
     }

     if (plushie.roleId === 'joueur-flute' && myTeam !== 'loup') {
         if (!fluteCharmed.includes(target.id)) {
            addScore(target.id, -100, "Il n'est pas encore sous mon charme (-100)");
         }
     }

     if (plushie.roleId === 'ange' && dayNumber === 1) {
        // Envie de mourir, cible un peu au pif pour forcer l'attention
        if (targetTeam !== 'loup') { // ne risque pas d'attaquer les loups qui pourraient l'aider
             Math.random() > 0.5 && addScore(target.id, -100, "Discours absurde pour m'attirer les foudres (Jour 1)");
        }
     }
  });

  // Clamp finals and return
  Object.keys(matrix).forEach(uid => {
      matrix[uid].score = clamp(matrix[uid].score, -1000, 1000);
      if (matrix[uid].breakdown.length === 0) {
          matrix[uid].breakdown.push({ points: 0, reason: "Score de base (Neutre)" });
      }
  });

  return matrix;
}
