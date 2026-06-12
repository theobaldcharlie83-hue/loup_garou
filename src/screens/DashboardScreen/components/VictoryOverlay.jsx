import { ROLE_BY_ID } from '../../../store/useGameStore'

const ICONS = {
  village: '🏘️', loups: '🐺', 'joueur-flute': '🎶', 'loup-blanc': '⚪', amoureux: '💖', aucun: '💀',
}
const TITLES = {
  village: 'Victoire du Village !',
  loups: 'Les Loups-Garous triomphent !',
  'joueur-flute': 'Le Joueur de Flûte a envouté tout le monde !',
  'loup-blanc': 'Le Loup Blanc est le seul survivant !',
  amoureux: "L'Amour est plus fort que tout !",
  aucun: 'Tout le monde est mort... Match nul !',
}

/** Écran de fin de partie (présentational). */
export default function VictoryOverlay({ winner, players, wildChildModelId, chienLoupSide, onReset }) {
  if (!winner) return null
  const survivors = players.filter(p => p.isAlive)
  const model = players.find(x => x.id === wildChildModelId)

  return (
    <div className="victory-overlay">
      <div className="victory-card">
        <div className="victory-icon">{ICONS[winner]}</div>
        <h1 className="victory-title">{TITLES[winner]}</h1>
        <p className="victory-subtitle">La partie est terminée.</p>

        <div className="victory-survivors">
          <h3>Survivants :</h3>
          <ul>
            {survivors.map(p => {
              const isMutated = p.roleId === 'enfant-sauvage' && model && !model.isAlive
              const isDogWolfLoup = p.roleId === 'chien-loup' && chienLoupSide === 'loup'
              const suffix = p.isInfected ? ' - INFECTÉ 🐺' : (isMutated ? ' - MUTÉ 🐺' : (isDogWolfLoup ? ' - CAMP LOUP 🐺' : ''))
              return (
                <li key={p.id}>
                  {ROLE_BY_ID[p.roleId]?.icon} {p.name} ({ROLE_BY_ID[p.roleId]?.name}{suffix})
                </li>
              )
            })}
            {survivors.length === 0 && <li>Aucun survivant...</li>}
          </ul>
        </div>

        <button className="header-btn primary-action" onClick={onReset} style={{ marginTop: 30, padding: '12px 30px', fontSize: '1.2rem' }}>
          🔄 Nouvelle Partie
        </button>
      </div>
    </div>
  )
}
