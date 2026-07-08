import { ROLE_BY_ID } from '../../../store/useGameStore'

/** Modale : le Capitaine mort doit désigner son successeur avant de s'éteindre. */
export default function SuccessionModal({ successionPendingForId, players, transferCaptaincy }) {
  if (!successionPendingForId) return null

  const alive = players.filter(p => p.isAlive)

  return (
    <div className="succession-overlay">
      <div className="succession-modal">
        <h2>🎖️ Le Dernier Souffle</h2>
        <p>Le Capitaine <strong>{players.find(p => p.id === successionPendingForId)?.name}</strong> a été éliminé.</p>
        <p>Il doit désigner son successeur avant de partir...</p>

        <div className="succession-grid">
          {alive.map(p => (
            <button key={p.id} className="succession-item" onClick={() => transferCaptaincy(p.id)}>
              <span className="avatar-mini">{ROLE_BY_ID[p.roleId]?.icon}</span>
              <span className="name">{p.name} {p.isPlush ? '(🧸)' : '(👤)'}</span>
            </button>
          ))}

          {/* Option Aléatoire pour PNJ ou MJ pressé */}
          <button className="succession-item random" onClick={() => {
            if (alive.length > 0) {
              const randomIdx = Math.floor(Math.random() * alive.length);
              transferCaptaincy(alive[randomIdx].id);
            }
          }}>
            🎲 Choix Aléatoire
          </button>
        </div>
      </div>
    </div>
  )
}
