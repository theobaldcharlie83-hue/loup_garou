import { describe, it, expect } from 'vitest'
import { calculatePlushieVoteScores } from './scoringEngine'

const P = (id, roleId, extra = {}) => ({
  id, name: id, roleId, isAlive: true, isInfected: false, isPlush: true, ...extra,
})

const baseState = (players, over = {}) => ({
  players,
  lovers: [],
  seenBySeer: [],
  charmedIds: [],
  wildChildModelId: null,
  chienLoupSide: null,
  witchSavedPlayerIds: [],
  foxHistory: [],
  corbeauTargetId: null,
  chevalierRevengeData: null,
  ...over,
})

describe('scoringEngine — camps via getPlayerTeam (T3.2)', () => {
  it('un Loup attribue un score max à un autre membre de la meute', () => {
    const players = [P('w1', 'loup-simple'), P('w2', 'loup-simple'), P('v', 'villageois')]
    const state = baseState(players)
    const matrix = calculatePlushieVoteScores(players[0], players, state)
    expect(matrix['w2'].score).toBe(1000) // membre de la meute
    expect(matrix['v'].score).toBeLessThan(0) // suspicion vers le village
  })

  it('une Voyante qui a vu un Loup le marque comme cible certaine', () => {
    const players = [P('voy', 'voyante'), P('w', 'loup-simple'), P('v', 'villageois')]
    const state = baseState(players, { seenBySeer: ['w'] })
    const matrix = calculatePlushieVoteScores(players[0], players, state)
    expect(matrix['w'].score).toBe(-1000) // « je SAIS que c'est un Loup »
  })

  it('un joueur infecté est traité comme un Loup', () => {
    const players = [P('w', 'loup-simple'), P('x', 'villageois', { isInfected: true }), P('v', 'villageois')]
    const state = baseState(players)
    // Le Loup 'w' considère l'infecté 'x' comme un allié de meute.
    const matrix = calculatePlushieVoteScores(players[0], players, state)
    expect(matrix['x'].score).toBe(1000)
  })
})
