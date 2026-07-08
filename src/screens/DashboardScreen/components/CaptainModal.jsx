import { useRef } from 'react'
import { useFocusTrap } from '../../../hooks/useFocusTrap'

/** Modale d'information : un Capitaine doit être désigné avant de lancer la Nuit 1. */
export default function CaptainModal({ show, onClose }) {
  const modalRef = useRef(null)
  useFocusTrap(modalRef, show, onClose)
  if (!show) return null

  return (
    <div className="grimoire-modal-overlay" onClick={onClose}>
      <div className="grimoire-modal" ref={modalRef} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="grimoire-modal-icon">🎖️</div>
        <h2>Capitaine requis !</h2>
        <p>
          Avant de plonger le village dans les ténèbres,<br />
          vous devez désigner un <strong>Capitaine</strong>.<br />
          Cliquez sur un joueur, puis sur <em>"Désigner Capitaine"</em>.
        </p>
        <div className="grimoire-modal-actions">
          <button className="grimoire-modal-btn confirm" onClick={onClose}>
            Compris, je désigne !
          </button>
        </div>
      </div>
    </div>
  )
}
