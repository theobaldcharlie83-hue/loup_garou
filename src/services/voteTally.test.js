import { describe, it, expect } from 'vitest'
import { computeVoteTally } from './voteTally'

describe('computeVoteTally (T2.1)', () => {
  it('compte une voix par votant normal', () => {
    const { tally, max, victims } = computeVoteTally(
      { a: 'x', b: 'x', c: 'y' },
      {}
    )
    expect(tally).toEqual({ x: 2, y: 1 })
    expect(max).toBe(2)
    expect(victims).toEqual(['x'])
  })

  it('le Capitaine compte pour 2 voix', () => {
    // Sans la règle, ce serait une égalité x:1 / y:1.
    // Le Capitaine 'cap' vote y → y l'emporte avec 2 voix.
    const { tally, victims } = computeVoteTally(
      { a: 'x', cap: 'y' },
      { captainId: 'cap' }
    )
    expect(tally).toEqual({ x: 1, y: 2 })
    expect(victims).toEqual(['y'])
  })

  it('la voix double du Capitaine peut créer une égalité', () => {
    // a,b votent x (2 voix) ; le Capitaine vote y (2 voix) → égalité.
    const { victims, max } = computeVoteTally(
      { a: 'x', b: 'x', cap: 'y' },
      { captainId: 'cap' }
    )
    expect(max).toBe(2)
    expect(victims.sort()).toEqual(['x', 'y'])
  })

  it('le Corbeau ajoute 2 voix sur sa cible', () => {
    const { tally, victims } = computeVoteTally(
      { a: 'y' },
      { corbeauTargetId: 'x' }
    )
    expect(tally).toEqual({ x: 2, y: 1 })
    expect(victims).toEqual(['x'])
  })

  it('ignore les abstentions (cible vide)', () => {
    const { tally } = computeVoteTally({ a: '', b: 'x' }, {})
    expect(tally).toEqual({ x: 1 })
  })

  it('égalité simple entre deux cibles', () => {
    const { victims, max } = computeVoteTally({ a: 'x', b: 'y' }, {})
    expect(max).toBe(1)
    expect(victims.sort()).toEqual(['x', 'y'])
  })
})
