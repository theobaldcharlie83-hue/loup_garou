import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore, replaceNameInJournal } from './useGameStore'

const entry = (text) => ({ id: text, timestamp: new Date(), text, type: 'event' })

describe('replaceNameInJournal', () => {
  it('remplace les occurrences en mot entier uniquement', () => {
    const out = replaceNameInJournal(
      [entry('Lise a voté contre Lisette.'), entry('Cupidon : Lise & Papa')],
      'Lise', 'Zoé'
    )
    expect(out[0].text).toBe('Zoé a voté contre Lisette.')
    expect(out[1].text).toBe('Cupidon : Zoé & Papa')
  })

  it('gère les noms accentués, composés et les caractères spéciaux de regex', () => {
    const out = replaceNameInJournal(
      [entry('Léonie (Sorcière) et Marie-Léonie'), entry('Le chef (c) a parlé')],
      'Léonie', 'Léa'
    )
    expect(out[0].text).toBe('Léa (Sorcière) et Marie-Léonie')
    expect(replaceNameInJournal([entry('Le chef (c) a parlé')], 'chef (c)', 'Bob')[0].text).toBe('Le Bob a parlé')
  })

  it("n'interprète pas les motifs $ du nouveau nom", () => {
    expect(replaceNameInJournal([entry('Papa dort')], 'Papa', '$1 Max')[0].text).toBe('$1 Max dort')
  })
})

describe('renamePlayer', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame()
    useGameStore.setState({
      humanNames: ['Lise', 'Papa'],
      players: [
        { id: 'h-0', name: 'Lise', isAlive: true, roleId: 'villageois' },
        { id: 'h-1', name: 'Papa', isAlive: true, roleId: 'voyante' },
      ],
      journal: [entry('La Voyante a espionné Lise.')],
    })
  })

  it('renomme le joueur, le nom de configuration et le journal', () => {
    useGameStore.getState().renamePlayer('h-0', '  Zoé ')
    const s = useGameStore.getState()
    expect(s.players[0].name).toBe('Zoé')
    expect(s.humanNames[0]).toBe('Zoé')
    expect(s.journal[0].text).toBe('La Voyante a espionné Zoé.')
  })

  it('refuse un nom vide ou déjà porté (insensible à la casse)', () => {
    useGameStore.getState().renamePlayer('h-0', '   ')
    useGameStore.getState().renamePlayer('h-0', 'papa')
    expect(useGameStore.getState().players[0].name).toBe('Lise')
  })
})
