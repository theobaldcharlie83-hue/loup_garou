import { useRef } from 'react'
import { useFocusTrap } from '../../../hooks/useFocusTrap'

/** Modale de confirmation après sauvegarde — affiche aussi l'échec (ex. quota localStorage plein). */
export default function SaveModal({ show, success, onContinue, onGoHome }) {
  const modalRef = useRef(null)
  useFocusTrap(modalRef, show, onContinue)
  if (!show) return null

  return (
    <div className="grimoire-modal-overlay">
      <div className="grimoire-modal" ref={modalRef} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="grimoire-modal-icon">{success ? '💾' : '⚠️'}</div>
        <h2>{success ? 'Partie Sauvegardée !' : 'Échec de la sauvegarde'}</h2>
        <p>
          {success ? (
            <>Votre progression a bien été enregistrée.<br />Que souhaitez-vous faire ?</>
          ) : (
            <>La sauvegarde a échoué (espace de stockage plein ou indisponible).<br />Votre partie continue normalement, mais pensez à libérer de la place.</>
          )}
        </p>
        <div className="grimoire-modal-actions">
          <button className="grimoire-modal-btn confirm" onClick={onContinue}>
            Continuer la partie
          </button>
          {success && (
            <button className="grimoire-modal-btn cancel" onClick={onGoHome}>
              Retourner à l'accueil
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
