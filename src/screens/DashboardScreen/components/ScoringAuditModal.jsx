import { useGameStore } from '../../../store/useGameStore'
import useEscapeToClose from '../../../hooks/useEscapeToClose'

/** Modale d'audit du score de vote IA (matrice de confiance) d'une peluche. */
export default function ScoringAuditModal({ qaModalPlushId, players, onClose }) {
  useEscapeToClose(!!qaModalPlushId, onClose)
  if (!qaModalPlushId) return null

  return (
    <div className="qa-modal-overlay" onClick={onClose}>
      <div className="qa-modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 10 }}>
          <h3>Audit Scoring : {players.find(p => p.id === qaModalPlushId)?.name}</h3>
          <button onClick={onClose} className="pap-btn close-btn" style={{ position: 'static', fontSize: '1rem' }}>✖</button>
        </div>
        <div style={{ marginTop: 15, maxHeight: '60vh', overflowY: 'auto' }}>
          {Object.entries(useGameStore.getState().qaScoringData[qaModalPlushId] || {}).map(([targetId, info]) => {
            const t = players.find(p => p.id === targetId);
            if (!t) return null;
            return (
              <div key={targetId} style={{ marginBottom: 10, background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <strong>{t.name}</strong>
                  <span style={{ fontWeight: 'bold', color: info.score > 0 ? 'var(--color-success)' : info.score < 0 ? 'var(--color-danger)' : '#fff' }}>{info.score > 0 ? '+' : ''}{info.score}</span>
                </div>
                <div className="qa-progress-container">
                  <div className="qa-bar-center" />
                  {info.score < 0 && <div className="qa-progress-bar-negative" style={{ width: `${(Math.abs(info.score) / 1000) * 50}%` }} />}
                  {info.score > 0 && <div className="qa-progress-bar-positive" style={{ left: '50%', width: `${(info.score / 1000) * 50}%` }} />}
                </div>
                {info.breakdown.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: 6 }}>
                    {info.breakdown.map((bk, i) => <div key={i}>• {bk.reason}</div>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
