import { useLayoutEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import './RenameDialog.css'

export const MAX_NAME_LENGTH = 20

/**
 * Boîte de dialogue de renommage pensée pour la tablette :
 *  - champ en 18px (évite le zoom automatique d'iOS sous 16px),
 *  - focus posé pendant le geste de l'utilisateur (synchrone au montage) pour
 *    que le clavier virtuel s'ouvre bien sur iPad,
 *  - placée en haut d'écran pour ne jamais être masquée par le clavier,
 *  - validation : nom vide refusé, doublon signalé.
 */
export default function RenameDialog({ player, otherNames = [], onConfirm, onCancel }) {
  const [value, setValue] = useState(player?.name ?? '')
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  useFocusTrap(dialogRef, !!player, onCancel)

  // Focus + sélection complète au montage (synchrone, donc encore dans le geste
  // de l'utilisateur : le clavier s'ouvre sur iPad et taper remplace le nom).
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [])

  if (!player) return null

  const clean = value.trim()
  const isDuplicate = clean !== '' && clean !== player.name &&
    otherNames.some(n => n.trim().toLocaleLowerCase('fr') === clean.toLocaleLowerCase('fr'))
  const canSave = clean !== '' && !isDuplicate

  const submit = (e) => {
    e?.preventDefault()
    if (!canSave) return
    onConfirm(clean)
  }

  return (
    <div className="rename-overlay" onClick={onCancel}>
      <form
        ref={dialogRef}
        className="rename-dialog parchment-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2 id="rename-title">Renommer {player.isPlush ? 'la peluche' : 'le joueur'}</h2>
        <div className="rename-field">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={e => e.target.select()}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="done"
            aria-label="Nouveau nom"
            aria-invalid={!canSave}
          />
          {value && (
            <button type="button" className="rename-clear" onClick={() => setValue('')} aria-label="Effacer">✕</button>
          )}
        </div>
        <p className={`rename-hint${isDuplicate ? ' error' : ''}`} role="status">
          {isDuplicate ? 'Ce nom est déjà utilisé par un autre joueur.'
            : clean === '' ? 'Le nom ne peut pas être vide.'
            : `${clean.length} / ${MAX_NAME_LENGTH} caractères`}
        </p>
        <div className="rename-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>Annuler</button>
          <button type="submit" className="btn-ink" disabled={!canSave}>Valider</button>
        </div>
      </form>
    </div>
  )
}
