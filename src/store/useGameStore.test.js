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

/* ─── T1.1 — Pipeline unique des morts en chaîne ───────────── */
describe('eliminatePlayer — morts en chaîne (T1.1)', () => {
  const alive = (id) => useGameStore.getState().players.find((p) => p.id === id)?.isAlive

  it("le partenaire amoureux meurt de chagrin", () => {
    setupScenario({
      players: [
        makePlayer('a', 'villageois'),
        makePlayer('b', 'villageois'),
        makePlayer('w', 'loup-simple'),
      ],
      lovers: ['a', 'b'],
    })
    useGameStore.getState().eliminatePlayer('a', 'wolves')
    expect(alive('a')).toBe(false)
    expect(alive('b')).toBe(false) // mort par chagrin via le pipeline
  })

  it("la mort en chaîne d'un Capitaine déclenche bien la succession", () => {
    setupScenario({
      players: [
        makePlayer('cap', 'villageois', { isCaptain: true }),
        makePlayer('b', 'villageois'),
        makePlayer('c', 'villageois'),
        makePlayer('w', 'loup-simple'),
      ],
      lovers: ['cap', 'b'],
      captainId: 'cap',
    })
    // On tue l'amoureux 'b' : le Capitaine 'cap' meurt de chagrin et doit ouvrir une succession
    useGameStore.getState().eliminatePlayer('b', 'wolves')
    expect(alive('cap')).toBe(false)
    const queue = useGameStore.getState().pendingInteractions
    expect(queue.some((i) => i.type === 'succession' && i.playerId === 'cap')).toBe(true)
  })

  it("la mort d'une Sœur entraîne l'autre", () => {
    setupScenario({
      players: [
        makePlayer('s1', 'soeurs'),
        makePlayer('s2', 'soeurs'),
        makePlayer('w', 'loup-simple'),
      ],
    })
    useGameStore.getState().eliminatePlayer('s1', 'vote')
    expect(alive('s1')).toBe(false)
    expect(alive('s2')).toBe(false)
  })

  /* T1.6c — Non-régression du bug réel signalé :
     Capitaine dévoré la nuit + Chasseur (amoureux du Capitaine) mort de chagrin,
     puis le Chasseur abat le nouveau Capitaine → une 2ᵉ succession doit pouvoir
     se faire. Auparavant l'enchaînement se bloquait. */
  it("enchaîne succession → tir du Chasseur → nouvelle succession sans blocage", () => {
    const store = () => useGameStore.getState()
    setupScenario({
      players: [
        makePlayer('cap', 'villageois', { isCaptain: true }),
        makePlayer('hunter', 'chasseur'),
        makePlayer('x', 'villageois'),
        makePlayer('y', 'villageois'),
        makePlayer('w', 'loup-simple'),
      ],
      lovers: ['cap', 'hunter'],
      captainId: 'cap',
    })

    // Nuit : les loups dévorent le Capitaine → le Chasseur (amoureux) meurt de chagrin.
    store().eliminatePlayer('cap', 'wolves')

    let queue = store().pendingInteractions
    expect(queue.map((i) => i.type)).toEqual(['succession', 'hunter'])
    expect(store().winner).toBeNull() // pas de victoire tant que la file n'est pas vidée

    // 1) Succession du Capitaine défunt → 'x' devient Capitaine.
    store().transferCaptaincy('x')
    expect(store().captainId).toBe('x')
    expect(store().pendingInteractions.map((i) => i.type)).toEqual(['hunter'])

    // 2) Le Chasseur tire sur le nouveau Capitaine 'x' → ouvre une 2ᵉ succession.
    store().resolveHunterShot('x')
    expect(alive('x')).toBe(false)
    expect(store().pendingInteractions.map((i) => i.type)).toEqual(['succession'])

    // 3) La 2ᵉ succession aboutit → 'y' devient Capitaine, la file est vide.
    store().transferCaptaincy('y')
    expect(store().captainId).toBe('y')
    expect(store().pendingInteractions).toHaveLength(0)
  })

  it("un Ancien mort par chagrin ne déclenche PAS la malédiction (les pouvoirs sont conservés)", () => {
    setupScenario({
      players: [
        makePlayer('anc', 'ancien'),
        makePlayer('luv', 'villageois'),
        makePlayer('voy', 'voyante'),
        makePlayer('w', 'loup-simple'),
      ],
      lovers: ['anc', 'luv'],
      ancienLives: 2,
    })
    // 'luv' tué par vote → 'anc' (Ancien) meurt de chagrin → pas de malédiction
    useGameStore.getState().eliminatePlayer('luv', 'vote')
    expect(alive('anc')).toBe(false)
    expect(useGameStore.getState().players.find((p) => p.id === 'voy')?.roleId).toBe('voyante')
  })
})

/* ─── T2.2 — Ancien soigné par la Sorcière ─────────────────── */
describe('commitWitchLife — Ancien (T2.2)', () => {
  const alive = (id) => useGameStore.getState().players.find((p) => p.id === id)?.isAlive

  it("l'Ancien soigné ne récupère qu'une seule vie", () => {
    setupScenario({
      players: [makePlayer('anc', 'ancien'), makePlayer('w', 'loup-simple')],
      ancienLives: 2,
    })
    useGameStore.getState().commitWitchLife('anc')
    expect(useGameStore.getState().ancienLives).toBe(1)
  })

  it("après avoir été soigné, l'Ancien meurt à la prochaine attaque des loups", () => {
    setupScenario({
      players: [
        makePlayer('anc', 'ancien'),
        makePlayer('v', 'villageois'),
        makePlayer('w', 'loup-simple'),
      ],
      ancienLives: 2,
    })
    useGameStore.getState().commitWitchLife('anc') // ancienLives → 1
    useGameStore.getState().eliminatePlayer('anc', 'wolves')
    expect(alive('anc')).toBe(false) // plus de résistance spéciale
  })
})
