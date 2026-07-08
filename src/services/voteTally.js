/**
 * Décompte des voix du Tribunal du Village (logique pure, testable).
 *
 * Règles appliquées :
 *  - Le Capitaine compte pour 2 voix (règle officielle p.21).
 *  - Le Corbeau ajoute 2 voix de pénalité sur sa cible désignée.
 *  - En cas d'égalité après décompte, le Capitaine *désigne* la victime parmi les
 *    ex-æquo : cette désignation est un acte manuel géré par l'UI (et non un
 *    bris d'égalité automatique), pour ne pas cumuler deux fois son influence.
 *
 * @param {Record<string,string>} dayVotes  { [voterId]: targetId | '' }
 * @param {{captainId?: string|null, corbeauTargetId?: string|null}} opts
 * @returns {{ tally: Record<string,number>, max: number, victims: string[] }}
 */
export function computeVoteTally(dayVotes, { captainId = null, corbeauTargetId = null } = {}) {
  const tally = {}

  // Voix de pénalité du Corbeau
  if (corbeauTargetId) {
    tally[corbeauTargetId] = (tally[corbeauTargetId] || 0) + 2
  }

  Object.entries(dayVotes).forEach(([voterId, targetId]) => {
    if (!targetId) return
    const weight = voterId === captainId ? 2 : 1
    tally[targetId] = (tally[targetId] || 0) + weight
  })

  let max = 0
  let victims = []
  Object.entries(tally).forEach(([id, count]) => {
    if (count > max) {
      max = count
      victims = [id]
    } else if (count === max) {
      victims.push(id)
    }
  })

  return { tally, max, victims }
}
