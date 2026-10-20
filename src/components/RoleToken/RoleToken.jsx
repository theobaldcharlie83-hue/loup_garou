import { ROLE_BY_ID } from '../../store/useGameStore'
import { getRoleArt, FALLBACK_FRAME } from '../../data/roleArt'
import './RoleToken.css'

/**
 * Jeton illustré d'un rôle (style des cartes du jeu de société).
 *  - variant="token"     : jeton complet (cartes de rôle, révélation plein écran)
 *  - variant="medallion" : médaillon central rogné en cercle (avatars du cercle)
 * Les rôles sans illustration affichent leur icône sur un cadre neutre.
 */
export default function RoleToken({ roleId, variant = 'token', className = '', alt }) {
  const role = ROLE_BY_ID[roleId]
  const art = getRoleArt(roleId)
  const label = alt ?? role?.name ?? 'Rôle inconnu'

  if (!role) {
    return <span className={`role-token role-token--${variant} role-token--unknown ${className}`} role="img" aria-label={label}>❓</span>
  }

  return (
    <span
      className={`role-token role-token--${variant} ${className}`}
      role="img"
      aria-label={label}
      style={{ backgroundImage: `url(${art ?? FALLBACK_FRAME})` }}
    >
      {!art && <span className="role-token__glyph" aria-hidden="true">{role.icon}</span>}
    </span>
  )
}
