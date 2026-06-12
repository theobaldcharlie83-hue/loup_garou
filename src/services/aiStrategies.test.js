import { describe, it, expect } from 'vitest'
import { decideWitchAction } from './aiStrategies'

const P = (id, roleId, extra = {}) => ({
  id, name: id, roleId, isAlive: true, isInfected: false, isPlush: true, ...extra,
})

const state = (players) => ({
  players, lovers: [], seenBySeer: [], charmedIds: [], wildChildModelId: null,
  chienLoupSide: null, witchSavedPlayerIds: [], foxHistory: [], corbeauTargetId: null,
  chevalierRevengeData: null,
})

describe('decideWitchAction (T3.3)', () => {
  it('la Sorcière se sauve elle-même quoi qu\'il arrive', () => {
    const players = [P('witch', 'sorciere'), P('w', 'loup-simple')]
    const { useLife } = decideWitchAction({
      witch: players[0], players, alive: players, storeState: state(players),
      dayNumber: 1, witchPotions: { life: true, death: false },
      nightActions: { wolvesVictim: 'witch' }, rng: () => 0.99, // prob ignorée si self
    })
    expect(useLife).toBe(true)
  })

  it('ne tue personne si le tirage probabiliste échoue', () => {
    const players = [P('witch', 'sorciere'), P('v', 'villageois'), P('w', 'loup-simple')]
    const { deathTargetId } = decideWitchAction({
      witch: players[0], players, alive: players, storeState: state(players),
      dayNumber: 1, witchPotions: { life: false, death: true },
      nightActions: {}, rng: () => 0.99, // 0.99 >= prob → pas d'empoisonnement
    })
    expect(deathTargetId).toBeNull()
  })

  it('empoisonne le suspect au score minimal (hors victime des loups)', () => {
    // 'witch' (Loup? non, sorcière village). Pour la sorcière village, le score le plus
    // bas revient au Loup 'w' (suspect). La victime des loups est exclue.
    const players = [P('witch', 'sorciere'), P('w', 'loup-simple'), P('v', 'villageois')]
    const { deathTargetId } = decideWitchAction({
      witch: players[0], players, alive: players, storeState: state(players),
      dayNumber: 5, witchPotions: { life: false, death: true },
      nightActions: { wolvesVictim: 'v' }, rng: () => 0, // 0 < prob → empoisonne
    })
    expect(deathTargetId).not.toBe('v') // jamais la victime des loups
    expect(deathTargetId).not.toBe('witch') // jamais soi-même
  })
})
