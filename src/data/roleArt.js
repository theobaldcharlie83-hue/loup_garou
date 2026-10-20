/**
 * Illustrations des rôles — jetons extraits du livret de règles « Best Of ».
 * Le Corbeau n'existant pas dans le Best Of, il utilise un cadre neutre
 * (corbeau-frame) sur lequel l'icône est superposée par <RoleToken>.
 */
const files = import.meta.glob('../assets/roles/*.webp', { eager: true, import: 'default' })

export const ROLE_ART = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop().replace('.webp', ''), url])
)

/** URL du jeton d'un rôle, ou null s'il n'a pas d'illustration dédiée. */
export const getRoleArt = (roleId) => ROLE_ART[roleId] ?? null

/** Cadre de repli pour les rôles sans illustration (ex. Corbeau). */
export const FALLBACK_FRAME = ROLE_ART['corbeau-frame']
