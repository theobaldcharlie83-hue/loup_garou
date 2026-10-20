import RoleToken from '../../../components/RoleToken/RoleToken'

/**
 * Modale dédiée au tour de la Sorcière (potions de vie/mort + suggestion IA).
 * Affiche en tête QUI est la Sorcière (le MJ doit savoir qui réveiller),
 * puis des choix tactiles (pas de <select> : peu pratique sur tablette).
 */
export default function WitchModal({
  show, players, nightActions, witchPotions,
  witchUseLife, setWitchUseLife, witchDeathTarget, setWitchDeathTarget,
  witchIaUsedForThisStep, onWitchIaSelect, onValidate, undoAction, pastStates,
}) {
  if (!show) return null

  const witch = players.find(p => p.roleId === 'sorciere')
  const victim = players.find(p => p.id === nightActions.wolvesVictim)
  const deathCandidates = players.filter(p => p.isAlive && p.roleId !== 'sorciere')
  const canSave = witchPotions.life && !!victim
  const hasAnyPotion = witchPotions.life || witchPotions.death

  return (
    <div className="grimoire-modal-overlay">
      <div className="grimoire-modal witch-modal" role="dialog" aria-modal="true" aria-labelledby="witch-title" onClick={e => e.stopPropagation()}>
        <header className="witch-header">
          <span className="witch-header__token"><RoleToken roleId="sorciere" alt="" /></span>
          <div>
            <h2 id="witch-title">Tour de la Sorcière</h2>
            <div className="witch-header__who">
              Réveillez <strong>{witch?.name ?? '—'}</strong>{witch?.isPlush ? ' 🧸' : ''}
              {witch && !witch.isAlive && <em> (éliminée cette nuit)</em>}
            </div>
          </div>
        </header>

        <div className="witch-modal-body">
          {/* POTION DE VIE */}
          <section className={`witch-potion-section${!witchPotions.life ? ' disabled' : ''}`}>
            <div className="witch-potion-header">
              <span className="witch-potion-title">💖 Potion de Vie</span>
              {!witchPotions.life && <span className="witch-used">Déjà utilisée</span>}
            </div>
            <p className="witch-potion-detail">
              {victim
                ? <>Victime des Loups : <strong>{victim.name}</strong></>
                : 'Aucune victime des Loups cette nuit.'}
            </p>
            {canSave && (
              <button
                type="button"
                className={`witch-toggle${witchUseLife ? ' on' : ''}`}
                aria-pressed={witchUseLife}
                onClick={() => setWitchUseLife(!witchUseLife)}
              >
                {witchUseLife ? `✓ ${victim.name} sera sauvé(e)` : `Sauver ${victim.name}`}
              </button>
            )}
          </section>

          {/* POTION DE MORT */}
          <section className={`witch-potion-section${!witchPotions.death ? ' disabled' : ''}`}>
            <div className="witch-potion-header">
              <span className="witch-potion-title">☠️ Potion de Mort</span>
              {!witchPotions.death
                ? <span className="witch-used">Déjà utilisée</span>
                : <span className="witch-hint">{witchDeathTarget ? 'Touchez à nouveau pour annuler' : 'Facultatif'}</span>}
            </div>
            {witchPotions.death && (
              <div className="witch-targets" role="group" aria-label="Cible de la potion de mort">
                {deathCandidates.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`witch-target${witchDeathTarget === p.id ? ' on' : ''}`}
                    aria-pressed={witchDeathTarget === p.id}
                    onClick={() => setWitchDeathTarget(witchDeathTarget === p.id ? '' : p.id)}
                  >
                    <span className="witch-target__token"><RoleToken roleId={p.roleId} variant="medallion" alt="" /></span>
                    <span className="witch-target__name">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grimoire-modal-actions">
          {witch?.isPlush && witch.isAlive && hasAnyPotion && (
            <button className="grimoire-modal-btn ai" onClick={onWitchIaSelect} disabled={witchIaUsedForThisStep}>
              {witchIaUsedForThisStep ? '🤖 Suggestion IA appliquée (modifiable)' : '🎲 Suggestion Sorcière IA'}
            </button>
          )}

          <button className="grimoire-modal-btn confirm" onClick={onValidate}>
            Valider et continuer
          </button>

          {pastStates?.length > 0 && (
            <button className="grimoire-modal-btn cancel" onClick={undoAction}>
              ↩ Annuler l'action précédente
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
