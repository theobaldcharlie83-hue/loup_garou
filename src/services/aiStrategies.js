import { ROLE_BY_ID } from '../store/useGameStore'
import { calculatePlushieVoteScores } from './scoringEngine'
import { witchPotionProbability } from './aiConfig'

/**
 * Décision IA de la Sorcière (peluche) pour un tour de nuit.
 * Logique unique partagée par le bouton « Suggestion » et l'application directe.
 *
 * @param {{
 *   witch: object,            // la peluche-Sorcière
 *   players: object[],        // roster complet
 *   alive: object[],          // joueurs vivants (pour le scoring)
 *   storeState: object,       // état du store (scoring)
 *   dayNumber: number,
 *   witchPotions: {life:boolean, death:boolean},
 *   nightActions: object,     // { wolvesVictim, witchKilled, ... }
 *   rng?: () => number,       // injectable pour les tests
 * }} ctx
 * @returns {{ useLife: boolean, deathTargetId: string|null }}
 */
export function decideWitchAction({
  witch, players, alive, storeState, dayNumber, witchPotions, nightActions, rng = Math.random,
}) {
  const prob = witchPotionProbability(dayNumber)
  let useLife = false
  let deathTargetId = null

  // 1. Potion de Vie : se sauver soi-même toujours, sinon sauver un villageois (probabiliste).
  if (witchPotions.life && nightActions.wolvesVictim) {
    const victim = players.find(p => p.id === nightActions.wolvesVictim)
    const isSelf = victim?.id === witch.id
    const isVillageois = ROLE_BY_ID[victim?.roleId]?.team === 'village'
    if (isSelf) useLife = true
    else if (isVillageois && rng() < prob) useLife = true
  }

  // 2. Potion de Mort : viser le joueur au score de confiance minimal (hors soi & victime des loups).
  if (witchPotions.death && !nightActions.witchKilled && rng() < prob) {
    const scores = calculatePlushieVoteScores(witch, alive, storeState)
    let minScore = Infinity
    let candidates = []
    Object.entries(scores).forEach(([pid, info]) => {
      if (pid === witch.id) return
      if (pid === nightActions.wolvesVictim) return
      if (info.score < minScore) { minScore = info.score; candidates = [pid] }
      else if (info.score === minScore) candidates.push(pid)
    })
    if (candidates.length > 0) {
      deathTargetId = candidates[Math.floor(rng() * candidates.length)]
    }
  }

  return { useLife, deathTargetId }
}
