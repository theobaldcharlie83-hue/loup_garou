import { ROLE_BY_ID, getPlayerTeam } from '../store/useGameStore';

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
    charmedIds: fluteCharmed = [],
    wildChildModelId: wildChildModel = null,
    witchSavedPlayerIds = []
  } = storeState;

  // Source unique de vérité pour les camps : on réutilise getPlayerTeam du store
  // (basé sur le roster complet pour détecter correctement un Enfant Sauvage muté).
  const rosterForTeams = storeState.players || allPlayers;
  const getTeam = (p) => getPlayerTeam(p, rosterForTeams, storeState);

  const myTeam = lovers.includes(plushie.id) ? 'amoureux' : getTeam(plushie);
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
     if (myTeam === 'amoureux') {
         if (lovers.includes(target.id)) {
            addScore(target.id, 1000, "Partenaire amoureux (Symbiose)");
         } else {
            addScore(target.id, -1000, "Objectif Amoureux : seul mon partenaire doit survivre (-1000)");
         }
         return; // Un amoureux n'a que faire des autres règles de camp
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
         if (witchSavedPlayerIds.includes(target.id)) {
             addScore(target.id, 500, "Je l'ai sauvé, je sais qu'il est innocent (+500)");
         }
     }

     // 5. Montreur d'Ours (Voisins Historiques)
     // BUG FIX: On utilise storeState.players pour trouver le montreur même s'il est mort (révélé)
     const growlingMontreurs = storeState.players.filter(p => p.roleId === 'montreur-ours' && p.hasBearGrowled);
     
     growlingMontreurs.forEach(m => {
         const isEvaluatorTheMontreur = plushie.id === m.id;
         const suspicionIsPublic = !m.isAlive;

         // Pour le village (public), on suspecte les marqués si le montreur est mort.
         // Pour le montreur lui-même (privé), on suspecte s'il est vivant (et toujours du côté village).
         if ((isEvaluatorTheMontreur && m.isAlive && myTeam !== 'loup') || (suspicionIsPublic && myTeam !== 'loup' && !isEvaluatorTheMontreur)) {
             if (target.isBearSuspected) {
                 const penalty = isEvaluatorTheMontreur ? -500 : -200;
                 const reason = isEvaluatorTheMontreur 
                     ? "Mon Ours a grogné ! Ce voisin est suspect historique (-500)"
                     : `Le Montreur (${m.name}) est mort ! Ce joueur est un de ses suspects historiques (-200)`;
                 addScore(target.id, penalty, reason);
             }
         }
     });

     // --- Déduction entre suspects ---
     // BUG FIX: Cette déduction massive n'a lieu que si le montreur est MORT (révélé)
     if (plushie.isBearSuspected && myTeam !== 'loup') {
         // On cherche l'autre suspect
         const otherSuspects = allPlayers.filter(p => p.isBearSuspected && p.id !== plushie.id && p.isAlive);
         if (otherSuspects.some(s => s.id === target.id)) {
             // On vérifie qu'un montreur historique est bien mort
             const aMontreurIsDead = growlingMontreurs.some(m => !m.isAlive);
             if (aMontreurIsDead) {
                 addScore(target.id, -1000, "Le Montreur est mort et l'ours a grogné... je suis innocent, donc lui est forcément LOUP ! (-1000)");
             }
         }
     }

     // Bonus voisins physiques cleans (SEULEMENT si le montreur est vivant, non infecté, et qu'aucun grognement n'a eu lieu aujourd'hui)
     if (plushie.roleId === 'montreur-ours' && !plushie.isGroaning && plushie.isAlive && myTeam !== 'loup') {
        const alivePlayers = allPlayers.filter(p => p.isAlive);
        const myIndex = alivePlayers.findIndex(x => x.id === plushie.id);
        if (myIndex !== -1) {
            const left = alivePlayers[(myIndex - 1 + alivePlayers.length) % alivePlayers.length];
            const right = alivePlayers[(myIndex + 1) % alivePlayers.length];
            if ((target.id === left.id || target.id === right.id) && target.isAlive) {
                addScore(target.id, 1000, "Mon Ours n'a pas grogné ce matin, mes voisins actuels sont cleans (+1000)");
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

     if (plushie.roleId === 'renard') {
         (storeState.foxHistory || []).forEach(entry => {
             if (entry.groupIds.includes(target.id)) {
                 if (entry.hasWolf) {
                     addScore(target.id, -200, "Présence de loup détectée par mon flair (-200)");
                 } else {
                     addScore(target.id, 1000, "Innocenté par mon flair (+1000)");
                 }
             }
         });
     }

      // --- DEDUCTION LOGIQUE : CHEVALIER À L'ÉPÉE ROUILLÉE ---
     if (storeState.chevalierRevengeData) {
       const { chevalierId, wolfId } = storeState.chevalierRevengeData;
       
       const isEvalCupidon = plushie.roleId === 'cupidon';
       const isEvalWolf = ROLE_BY_ID[plushie.roleId]?.team === 'loup' || plushie.roleId === 'loup-blanc' || plushie.isInfected;

       if (!isEvalWolf && !isEvalCupidon) {
         const fullPlayers = storeState.players;
         const chevIdx = fullPlayers.findIndex(p => p.id === chevalierId);
         const wolfIdx = fullPlayers.findIndex(p => p.id === wolfId);
         
         if (chevIdx !== -1 && wolfIdx !== -1) {
           let isBetween = false;
           let currentIdx = (chevIdx + 1) % fullPlayers.length; // Parcours horaire
           while (currentIdx !== wolfIdx) {
             if (fullPlayers[currentIdx].id === target.id) {
               isBetween = true;
               break;
             }
             currentIdx = (currentIdx + 1) % fullPlayers.length;
           }

           if (isBetween) {
             // Bonus mutuel : s'applique à la cible pour TOUS les autres (même ceux du segment)
             addScore(target.id, 500, "Innocenté par la vengeance du Chevalier (Définitif +500)");
           }
         }
       }
     }

     // --- CORBEAU : SUSPICION ACCRUE ---
     if (storeState.corbeauTargetId === target.id) {
        addScore(target.id, -100, "Cible du Corbeau (Suspicion accrue -100)");
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
