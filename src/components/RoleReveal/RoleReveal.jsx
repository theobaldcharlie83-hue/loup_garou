import { useEffect, useRef } from 'react'
import { ROLE_BY_ID } from '../../store/useGameStore'
import RoleToken from '../RoleToken/RoleToken'
import './RoleReveal.css'

/**
 * Révélation plein écran de la carte d'un joueur : le MJ tourne la tablette
 * vers le joueur réveillé (Voyante...) au lieu de se déplacer pour retourner
 * la carte physique. Un toucher n'importe où (ou Échap) referme l'écran.
 * Volontairement épuré : seul le rôle est visible, aucune autre information
 * de partie ne doit apparaître à l'écran pendant la révélation.
 */
export default function RoleReveal({ roleId, onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    if (!roleId) return
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [roleId, onClose])

  if (!roleId) return null
  const role = ROLE_BY_ID[roleId]

  return (
    <div className="role-reveal" role="dialog" aria-modal="true" aria-label={`Carte : ${role?.name ?? 'inconnue'}`} onClick={onClose}>
      <div className="role-reveal__card">
        <RoleToken roleId={roleId} className="role-reveal__token" />
        <div className="role-reveal__name">{role?.name ?? '?'}</div>
      </div>
      <button ref={closeRef} className="role-reveal__close" onClick={onClose}>
        Toucher pour refermer
      </button>
    </div>
  )
}
