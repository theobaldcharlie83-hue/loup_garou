import { useRef } from 'react'
import { MAX_NAME_LENGTH } from '../../components/RenameDialog/RenameDialog'

/**
 * Champ de saisie d'un nom de joueur, optimisé pour tablette :
 *  - police ≥ 16px (sinon iOS zoome et l'écran reste décalé, overflow:hidden),
 *  - au toucher, le nom par défaut est entièrement sélectionné : il suffit de
 *    taper pour le remplacer,
 *  - « Suivant » du clavier passe au champ suivant (enterKeyHint="next"),
 *  - le champ est ramené dans la zone visible au-dessus du clavier virtuel,
 *  - pas d'autocorrection / majuscule forcée sur les prénoms.
 */
export default function NameField({ id, nextId, label, value, placeholder, onChange, isDuplicate, variant }) {
  const inputRef = useRef(null)

  const handleFocus = (e) => {
    const el = e.target
    el.select()
    // iOS ignore parfois select() appelé directement dans onFocus : on le refait une frame plus tard.
    requestAnimationFrame(() => {
      try { el.setSelectionRange(0, el.value.length) } catch { /* champ démonté */ }
    })
    // Laisser le clavier s'ouvrir puis recentrer le champ dans la zone visible.
    setTimeout(() => {
      if (document.activeElement === el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 350)
  }

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const next = nextId ? document.getElementById(nextId) : null
    if (next) next.focus()
    else e.currentTarget.blur()
  }

  const clear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className="name-input-row">
      <label className="name-input-label" htmlFor={id}>{label}</label>
      <div className="input-with-clear">
        <input
          ref={inputRef}
          id={id}
          className={`name-input${variant ? ` ${variant}` : ''}${isDuplicate ? ' duplicate' : ''}`}
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint={nextId ? 'next' : 'done'}
          aria-invalid={isDuplicate || undefined}
          aria-describedby={isDuplicate ? `${id}-dup` : undefined}
        />
        {value && (
          <button
            type="button"
            className="btn-clear-input"
            // preventDefault : garde le clavier ouvert (pas de blur) pendant l'effacement
            onPointerDown={(e) => e.preventDefault()}
            onClick={clear}
            aria-label={`Effacer ${label}`}
          >✕</button>
        )}
      </div>
      {isDuplicate && <span id={`${id}-dup`} className="name-input-error">Nom déjà utilisé</span>}
    </div>
  )
}
