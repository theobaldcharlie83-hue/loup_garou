import { useGameStore, ROLE_BY_ID } from '../../../store/useGameStore'

/** Modale de tir du Chasseur — se déclenche automatiquement à sa mort (hunterPendingId). */
export default function HunterModal({ hunterPendingId, alive, eliminatePlayer, resolveHunterPending }) {
  if (!hunterPendingId) return null

  return (
    <div className="qa-modal-overlay">
      <div className="qa-modal-content" style={{ textAlign: 'center', padding: '30px 40px' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔫</div>
        <h2 style={{ marginBottom: 8 }}>Le Chasseur tire !</h2>
        <p style={{ marginBottom: 20, opacity: 0.8 }}>Avant de tomber, le Chasseur doit désigner sa cible...</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '40vh', overflowY: 'auto', marginBottom: 20 }}>
          {alive.map(p => (
            <button
              key={p.id}
              className="header-btn"
              style={{ justifyContent: 'flex-start', gap: 12 }}
              onClick={() => {
                useGameStore.getState().saveHistory();
                eliminatePlayer(p.id, 'hunter');
                useGameStore.getState().pushToJournal(`🔫 Le Chasseur tire et emporte ${p.name} dans la mort !`, 'death');
                resolveHunterPending();
              }}>
              {ROLE_BY_ID[p.roleId]?.icon} {p.name}
            </button>
          ))}
        </div>
        <button className="header-btn" style={{ alignSelf: 'center', opacity: 0.6 }} onClick={() => resolveHunterPending()}>
          (Passer — le Chasseur rate sa cible)
        </button>
      </div>
    </div>
  )
}
