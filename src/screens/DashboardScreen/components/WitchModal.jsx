import { ROLE_BY_ID } from '../../../store/useGameStore'

/** Modale dédiée au tour de la Sorcière (potions de vie/mort + suggestion IA). */
export default function WitchModal({
  show, players, nightActions, witchPotions,
  witchUseLife, setWitchUseLife, witchDeathTarget, setWitchDeathTarget,
  witchIaUsedForThisStep, onWitchIaSelect, onValidate, undoAction, pastStates,
}) {
  if (!show) return null

  return (
    <div className="grimoire-modal-overlay">
      <div className="grimoire-modal" onClick={e => e.stopPropagation()}>
        <div className="grimoire-modal-icon">🧙‍♀️</div>
        <h2>Tour de la Sorcière</h2>
        <p className="grimoire-modal-desc" style={{ color: 'var(--text-body-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Étape dédiée pour préparer les potions de vie et de mort.
        </p>

        <div className="witch-modal-body">
          {/* SECTION POTION DE VIE */}
          <div className={`witch-potion-section${!witchPotions.life ? ' disabled' : ''}`}>
            <div className="witch-potion-header">
              <span className="witch-potion-title">💖 Potion de Vie</span>
              {witchPotions.life ? (
                <label className="switch-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={witchUseLife}
                    onChange={(e) => {
                      if (!nightActions.wolvesVictim) return;
                      setWitchUseLife(e.target.checked);
                    }}
                    disabled={!nightActions.wolvesVictim}
                  />
                  <span>Sauver la victime</span>
                </label>
              ) : (
                <span style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>Déjà utilisée</span>
              )}
            </div>
            <div className="witch-potion-detail" style={{ fontSize: '0.9rem', color: 'var(--color-on-surface-variant)' }}>
              {nightActions.wolvesVictim ? (
                <span>
                  Victime des Loups : <strong>{players.find(p => p.id === nightActions.wolvesVictim)?.name}</strong>
                </span>
              ) : (
                <span>Aucune victime des loups ce soir.</span>
              )}
            </div>
          </div>

          {/* SECTION POTION DE MORT */}
          <div className={`witch-potion-section${!witchPotions.death ? ' disabled' : ''}`}>
            <div className="witch-potion-header">
              <span className="witch-potion-title">☠️ Potion de Mort</span>
              {!witchPotions.death && <span style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>Déjà utilisée</span>}
            </div>
            {witchPotions.death && (
              <select
                className="witch-select"
                value={witchDeathTarget}
                onChange={(e) => setWitchDeathTarget(e.target.value)}
              >
                <option value="">-- Ne tuer personne --</option>
                {players
                  .filter(p => p.isAlive && p.roleId !== 'sorciere')
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({ROLE_BY_ID[p.roleId]?.name})
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>

        <div className="grimoire-modal-actions">
          {/* Bouton Suggestion IA */}
          {players.some(p => p.roleId === 'sorciere' && p.isAlive) && (witchPotions.life || witchPotions.death) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <button
                className="grimoire-modal-btn"
                style={{
                  background: witchIaUsedForThisStep ? 'rgba(255, 255, 255, 0.05)' : 'rgba(167, 139, 250, 0.1)',
                  border: witchIaUsedForThisStep ? '1px solid rgba(255, 255, 255, 0.15)' : '1px dashed var(--color-accent-ai)',
                  color: witchIaUsedForThisStep ? 'var(--color-muted)' : 'var(--color-accent-ai)',
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  alignSelf: 'center',
                  cursor: witchIaUsedForThisStep ? 'not-allowed' : 'pointer',
                  borderRadius: '8px',
                  width: 'auto'
                }}
                onClick={onWitchIaSelect}
                disabled={witchIaUsedForThisStep}
              >
                🎲 Suggestion Sorcière IA
              </button>
              {witchIaUsedForThisStep && (
                <div style={{ color: 'var(--color-accent-ai)', fontSize: '0.85rem', textAlign: 'center', marginTop: '4px' }}>
                  🤖 Suggestion IA appliquée. (Vous pouvez modifier manuellement)
                </div>
              )}
            </div>
          )}

          <button
            className="grimoire-modal-btn confirm"
            onClick={onValidate}
          >
            🧙‍♀️ Valider les choix et continuer
          </button>

          {pastStates?.length > 0 && (
            <button
              className="grimoire-modal-btn cancel"
              onClick={undoAction}
            >
              ↩ Annuler l'action précédente
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
