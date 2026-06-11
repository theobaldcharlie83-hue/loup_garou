import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore, ROLE_CATALOG } from './useGameStore'

/* ─── Helpers ──────────────────────────────────────────────── */
const makePlayer = (id, roleId, overrides = {}) => ({
  id,
  name: id,
  isPlush: false,
  roleId,
  isAlive: true,
  isInfected: false,
  isCaptain: false,
  couplePartnerId: null,
  isBearSuspected: false,
  ...overrides,
})

/** Réinitialise le store puis applique un scénario. */
const setupScenario = (patch) => {
  useGameStore.getState().resetGame()
  useGameStore.setState(patch)
}

const winnerOf = (patch) => {
  setupScenario(patch)
  useGameStore.getState().checkGameOver()
  return useGameStore.getState().winner
}

beforeEach(() => {
  useGameStore.getState().resetGame()
})

/* ─── Smoke ────────────────────────────────────────────────── */
describe('catalogue', () => {
  it('contient les rôles clés (Best Of maison)', () => {
    const ids = ROLE_CATALOG.map((r) => r.id)
    expect(ids).toContain('loup-simple')
    expect(ids).toContain('villageois')
    expect(ids).toContain('corbeau') // ajout maison assumé
    expect(ids).not.toContain('ange') // retiré volontairement
  })
})

/* ─── Conditions de victoire ───────────────────────────────── */
describe('checkGameOver — conditions de victoire', () => {
  it('Village gagne quand tous les loups sont morts', () => {
    expect(
      winnerOf({
        players: [
          makePlayer('v1', 'villageois'),
          makePlayer('w1', 'loup-simple', { isAlive: false }),
        ],
      })
    ).toBe('village')
  })

  it('Loups gagnent quand tous les villageois sont morts', () => {
    expect(
      winnerOf({
        players: [
          makePlayer('w1', 'loup-simple'),
          makePlayer('v1', 'villageois', { isAlive: false }),
        ],
      })
    ).toBe('loups')
  })

  it('Joueur de Flûte gagne quand tous les autres sont charmés', () => {
    expect(
      winnerOf({
        players: [
          makePlayer('f1', 'joueur-flute'),
          makePlayer('v1', 'villageois'),
        ],
        charmedIds: ['v1'],
      })
    ).toBe('joueur-flute')
  })

  it('Loup Blanc gagne seul survivant', () => {
    expect(
      winnerOf({
        players: [
          makePlayer('lb', 'loup-blanc'),
          makePlayer('v1', 'villageois', { isAlive: false }),
        ],
      })
    ).toBe('loup-blanc')
  })

  it('Amoureux gagnent comme deux derniers survivants', () => {
    expect(
      winnerOf({
        players: [
          makePlayer('a', 'villageois'),
          makePlayer('b', 'loup-simple'),
        ],
        lovers: ['a', 'b'],
      })
    ).toBe('amoureux')
  })

  it('Match nul (aucun) quand tout le monde est mort', () => {
    expect(
      winnerOf({
        players: [
          makePlayer('v1', 'villageois', { isAlive: false }),
          makePlayer('w1', 'loup-simple', { isAlive: false }),
        ],
      })
    ).toBe('aucun')
  })

  it('partie en cours : aucun camp gagnant', () => {
    expect(
      winnerOf({
        players: [
          makePlayer('v1', 'villageois'),
          makePlayer('w1', 'loup-simple'),
        ],
      })
    ).toBeNull()
  })

  /* T1.4 — cas « ambigu » : actuellement BUGGÉ (déclare une victoire des Loups
     alors qu'un Enfant Sauvage non muté, aligné Village, est encore en vie). */
  it("ne déclare PAS la victoire des Loups si un Enfant Sauvage non muté est vivant", () => {
    expect(
      winnerOf({
        players: [
          makePlayer('w1', 'loup-simple'),
          makePlayer('es', 'enfant-sauvage'),
        ],
        wildChildModelId: null, // modèle non désigné → reste villageois
      })
    ).toBeNull()
  })
})
