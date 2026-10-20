import { ROLE_BY_ID } from '../../../store/useGameStore'
import RoleToken from '../../../components/RoleToken/RoleToken'

/* Jeton illustrant chaque camp vainqueur */
const VICTORY_TOKEN = {
  village: 'villageois', loups: 'loup-simple', 'joueur-flute': 'joueur-flute',
  'loup-blanc': 'loup-blanc', amoureux: 'cupidon',
}

const VICTORY_TITLE = {
  village: 'Victoire du Village !',
  loups: 'Les Loups-Garous triomphent !',
  'joueur-flute': 'Le Joueur de Flûte a envoûté tout le village !',
  'loup-blanc': 'Le Loup-Garou Blanc reste seul survivant !',
  amoureux: "L'amour est plus fort que tout !",
  aucun: 'Plus personne… Thiercelieux est désert.',
}

/** Écran de fin de partie : annonce le camp vainqueur et liste les survivants. */
export default function VictoryOverlay({ winner, players, wildChildModelId, chienLoupSide, onReset }) {
  if (!winner) return null

  const survivors = players.filter(p => p.isAlive)
  const model = players.find(x => x.id === wildChildModelId)

  return (
    <div className="victory-overlay">
      <div className="victory-card parchment-panel" role="dialog" aria-modal="true" aria-labelledby="victory-title">
        <div className="victory-token">
          {VICTORY_TOKEN[winner] ? <RoleToken roleId={VICTORY_TOKEN[winner]} alt="" /> : <span className="victory-icon">💀</span>}
        </div>
        <h1 id="victory-title" className="victory-title">{VICTORY_TITLE[winner]}</h1>
        <p className="victory-subtitle">La partie est terminée</p>

        <div className="victory-survivors">
          <h3>Survivants</h3>
          <ul>
            {survivors.map(p => {
              const isMutated = p.roleId === 'enfant-sauvage' && model && !model.isAlive
              const isDogWolfLoup = p.roleId === 'chien-loup' && chienLoupSide === 'loup'
              const suffix = p.isInfected ? ' · infecté' : (isMutated ? ' · muté' : (isDogWolfLoup ? ' · camp loup' : ''))
              return (
                <li key={p.id}>
                  <span className="victory-survivor-token"><RoleToken roleId={p.roleId} variant="medallion" alt="" /></span>
                  <span><strong>{p.name}</strong> — {ROLE_BY_ID[p.roleId]?.name}{suffix}</span>
                </li>
              )
            })}
            {survivors.length === 0 && <li>Aucun survivant…</li>}
          </ul>
        </div>

        <button className="btn-ink victory-cta" onClick={onReset}>
          Nouvelle partie
        </button>
      </div>
    </div>
  )
}
