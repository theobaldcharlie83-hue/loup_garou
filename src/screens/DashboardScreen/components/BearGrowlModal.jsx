import { useRef } from 'react'
import { useFocusTrap } from '../../../hooks/useFocusTrap'

/** Modale d'alerte : l'ours du Montreur a grogné cette nuit. */
export default function BearGrowlModal({ show, onClose }) {
  const modalRef = useRef(null)
  useFocusTrap(modalRef, show, onClose)
  if (!show) return null

  return (
    <div className="qa-modal-overlay bear-growl-overlay" onClick={onClose}>
      <div className="qa-modal-content bear-growl-modal" ref={modalRef} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="bear-icon-large">🐻</div>
        <h2 className="bear-title">L'ours grogne !</h2>
        <p className="bear-text">Le village se réveille sous les rugissements de l'ours du Montreur...</p>
        <p className="bear-instruction">Annoncez aux villageois que l'ours a senti un danger !</p>
        <button
          className="header-btn primary-action"
          style={{ marginTop: 20, alignSelf: 'center', padding: '12px 30px', fontSize: '1.2rem' }}
          onClick={onClose}
        >
          Compris
        </button>
      </div>
    </div>
  )
}
