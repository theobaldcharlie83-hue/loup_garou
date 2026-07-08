import { useEffect } from 'react'

/**
 * Ferme une modale dismissible (non bloquante) sur la touche Échap.
 * N'est branché que sur les modales qui ont un vrai bouton de fermeture —
 * les modales qui exigent une décision (Chasseur, Sorcière, Succession...)
 * n'ont volontairement pas de sortie au clavier.
 */
export default function useEscapeToClose(active, onClose) {
  useEffect(() => {
    if (!active) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, onClose])
}
