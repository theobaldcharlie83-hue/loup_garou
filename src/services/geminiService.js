/**
 * geminiService.js
 * Couche d'accès à l'API Google Gemini 2.0 Flash pour l'interrogatoire des peluches.
 *
 * Chaque peluche a un rôle secret (connu du MJ / de l'app).
 * Le System Prompt lui demande de jouer son rôle sans jamais le révéler.
 */


const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

/* ─── Vote Intelligent par Peluche (Phase de Jour) ───────────── */

/**
 * Helper rationnel pour le vote : choisit la cible avec le score le plus bas (plus suspecte)
 * dans la matrice des croyances.
 */
function getRationalVote(plushId, allPlayers, qaScoringData) {
  const matrix = qaScoringData[plushId] || {};
  const aliveOthers = allPlayers.filter(p => p.id !== plushId && p.isAlive);
  
  if (aliveOthers.length === 0) return null;

  // Extraire les scores pour les joueurs vivants
  const candidates = aliveOthers.map(p => ({
    id: p.id,
    score: matrix[p.id]?.score ?? 0
  }));

  // Trouver le score minimum (le plus suspect)
  const minScore = Math.min(...candidates.map(c => c.score));
  
  // Filtrer les candidats qui ont ce score minimum
  const bestTargets = candidates.filter(c => c.score === minScore);
  
  // Choix aléatoire parmi les meilleurs cibles (ceux avec le score le plus bas)
  const finalTarget = bestTargets[Math.floor(Math.random() * bestTargets.length)];
  return finalTarget?.id;
}

export async function generatePlushiesVotes({ plushiesToVote, allPlayers, qaScoringData }) {
  // Délai asynchrone court pour préserver l'effet UX de réflexion
  await new Promise(r => setTimeout(r, 1000));

  // Vote rationnel calculé sans API, en se basant sur la matrice locale
  return plushiesToVote.map(p => {
     const targetId = getRationalVote(p.id, allPlayers, qaScoringData);
     return { 
       plushId: p.id, 
       voteForId: targetId, 
       reason: "Ce vote est le résultat de mon analyse de confiance." 
     };
  });
}


