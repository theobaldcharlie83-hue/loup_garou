import { ROLE_BY_ID, getPlayerTeam, useGameStore } from '../../../store/useGameStore'
import RoleToken from '../../../components/RoleToken/RoleToken'
import { TEAM_CLASS } from '../dashboardConstants'


/**
 * Détermine au plus 2 badges à afficher sur l'avatar, par ordre de priorité :
 * 1) ce qui se passe cette nuit précise (mort/soin/cible en cours de résolution)
 * 2) le fait marquant le plus important déjà révélé (infection, capitaine...)
 * Le reste de l'information (amoureux, charmé, vu par la voyante...) reste
 * disponible dans le panneau de détail au clic, pour ne pas saturer le cercle.
 */
function getAvatarBadges(player, { players, wildChildModelId, chienLoupSide, nightActions, captainId, isLover, isWildChildModel, charmedIds, seenBySeer, corbeauTargetId, chevalierContaminatedWolfId, isInfected }) {
  const badges = []

  // Priorité 1 — action de nuit en cours de résolution sur ce joueur
  if (nightActions.wolvesVictim === player.id) badges.push({ key: 'wolves-victim', cls: 'av-temp-badge', title: 'Victime des Loups', icon: '💀' })
  if (nightActions.grandMechantVictim === player.id) badges.push({ key: 'gmm-victim', cls: 'av-temp-badge grand-mechant-victim', title: 'Victime du Grand-Méchant-Loup', icon: '💀' })
  if (nightActions.witchHealed && nightActions.wolvesVictim === player.id) badges.push({ key: 'healed', cls: 'av-temp-badge', title: 'Soigné par la Sorcière', icon: '💖', style: { top: -65 } })
  if (nightActions.witchKilled === player.id) badges.push({ key: 'witch-killed', cls: 'av-temp-badge', title: 'Empoisonné par la Sorcière', icon: '☠️' })
  if (player.deathCause === 'white-wolf' || nightActions.whiteWolfVictim === player.id) badges.push({ key: 'white-wolf', cls: 'av-temp-badge white-wolf-kill', title: 'Dévoré par le Loup Blanc', icon: '🤍💀' })

  // Priorité 2 — faits révélés persistants
  const model = players.find(p => p.id === wildChildModelId)
  const isWildChildMutated = player.roleId === 'enfant-sauvage' && model && !model.isAlive
  if (isInfected) badges.push({ key: 'infected', cls: 'av-infected-badge', title: 'Infection réussie', icon: '☣️' })
  if (isWildChildMutated) badges.push({ key: 'wildchild-mutated', cls: 'av-wildchild-badge mutated', title: 'Enfant Sauvage Muté', icon: '🐺' })
  if (player.roleId === 'chien-loup' && chienLoupSide === 'loup') badges.push({ key: 'dogwolf-loup', cls: 'av-dogwolf-badge camp-loup', title: 'Chien-Loup (Rallié aux Loups)', icon: '🐺' })
  if (player.roleId === 'chien-loup' && chienLoupSide === 'village') badges.push({ key: 'dogwolf-village', cls: 'av-dogwolf-badge camp-village', title: 'Chien-Loup (Resté Villageois)', icon: '🏘️' })
  if (player.id === chevalierContaminatedWolfId) badges.push({ key: 'contaminated', cls: 'av-contaminated-badge', title: 'Contaminé par la rouille', icon: '⚔️' })
  if (player.id === captainId) badges.push({ key: 'captain', cls: 'av-captain-badge', title: 'Capitaine', icon: '🎖️' })
  if (player.isGroaning) badges.push({ key: 'groaning', cls: 'av-temp-badge', title: "L'ours grogne !", icon: '🐻' })
  if (player.isBearSuspected) badges.push({ key: 'bear-suspected', cls: 'av-temp-badge', title: 'Suspecté par l\'Ours', icon: '🐻⚠️', style: { top: -35 } })
  if (isWildChildModel) badges.push({ key: 'wildchild-model', cls: 'av-wildchild-badge', title: "Modèle de l'Enfant Sauvage", icon: '🌿' })
  if (isLover) badges.push({ key: 'lover', cls: 'av-lover-badge', title: 'Amoureux', icon: '💞' })
  if (charmedIds.includes(player.id)) badges.push({ key: 'charmed', cls: 'av-charmed-badge', title: 'Charmé', icon: '🎶' })
  if (seenBySeer.includes(player.id)) badges.push({ key: 'seer', cls: 'av-seer-badge', title: 'Révélé par la Voyante', icon: '👁️' })
  if (player.id === corbeauTargetId) badges.push({ key: 'corbeau', cls: 'av-corbeau-badge', title: 'Cible du Corbeau (2 voix)', icon: '🐦' })

  return badges.slice(0, 2)
}

/** Taille d'avatar adaptée au nombre de joueurs et à la place disponible. */
function computeAvatarSize(dims, count) {
  if (!count || dims.rx <= 0) return 64
  // Périmètre approximatif de l'ellipse (Ramanujan) réparti entre les joueurs
  const { rx, ry } = dims
  const perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)))
  const slot = perimeter / count
  // Sur les côtés de l'ellipse, l'écart vertical entre deux joueurs vaut ≈ ry·Δθ ;
  // il doit contenir l'avatar ET son nom + rôle (~40px) sans chevauchement.
  const sideGap = ry * (2 * Math.PI / count) * 0.95 - 40
  return Math.round(Math.max(44, Math.min(92, slot * 0.58, sideGap)))
}

/** Le cercle des joueurs : ellipse-guide + avatars illustrés, badges limités. */
export default function PlayerCircle({
  players, dims, phase, nightSelection, nightActions, lovers, wildChildModelId, highlightedIds,
  selectedId, captainId, charmedIds, seenBySeer, corbeauTargetId, chevalierContaminatedWolfId,
  chienLoupSide, ancienLives, handleAvatar, handleDragStart, handleDragOver, handleDrop,
}) {
  const avatarSize = computeAvatarSize(dims, players.length)
  const canDrag = phase === 'preparation'

  return (
    <>
      {/* Guide SVG ellipse */}
      {dims.rx > 0 && (
        <svg className="ellipse-svg" aria-hidden="true">
          <ellipse
            cx={dims.cx} cy={dims.cy}
            rx={dims.rx} ry={dims.ry}
            fill="none"
            stroke="rgba(240, 210, 154, 0.16)"
            strokeWidth="1.5"
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Avatars positionnés sur l'ellipse */}
      {dims.rx > 0 && players.map((player, idx) => {
        const angle = (2 * Math.PI / players.length) * idx - Math.PI / 2
        const left  = dims.cx + dims.rx * Math.cos(angle)
        const top   = dims.cy + dims.ry * Math.sin(angle)
        const role  = ROLE_BY_ID[player.roleId]
        const isNightTarget = nightSelection.includes(player.id)
        const isWolvesTarget = nightActions.wolvesVictim === player.id
        const isLover = lovers.includes(player.id)
        const isInfected = player.isInfected || (nightActions.infectedTargetId === player.id)
        const isWildChildModel = player.id === wildChildModelId
        const isRandomHighlighted = highlightedIds.includes(player.id)

        const currentTeam = getPlayerTeam(player, players, useGameStore.getState())
        const tc    = TEAM_CLASS[currentTeam] ?? 'av-village'
        const isSel = selectedId === player.id

        const badges = getAvatarBadges(player, {
          players, wildChildModelId, chienLoupSide, nightActions, captainId, isLover,
          isWildChildModel, charmedIds, seenBySeer, corbeauTargetId, chevalierContaminatedWolfId, isInfected,
        })

        return (
          <div
            key={player.id}
            className={`player-avatar${!player.isAlive ? ' dead' : ''}${isSel ? ' selected' : ''}${isWolvesTarget ? ' target-wolves' : (isNightTarget ? ' target' : '')}${isRandomHighlighted ? ' random-highlight' : ''}`}
            style={{ left, top, '--av-size': `${avatarSize}px` }}
            onClick={() => handleAvatar(player)}
            draggable={canDrag}
            onDragStart={canDrag ? (e) => handleDragStart(e, player.id) : undefined}
            onDragOver={canDrag ? handleDragOver : undefined}
            onDrop={canDrag ? (e) => handleDrop(e, player.id) : undefined}
            role="button"
            tabIndex={0}
            aria-pressed={isSel}
            aria-label={`${player.name}${player.isPlush ? ' (peluche)' : ''}, ${role?.name ?? '?'}${!player.isAlive ? ', éliminé' : ''}`}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAvatar(player) } }}
          >
            <div className={`avatar-circle ${tc}`}>
              <RoleToken roleId={player.roleId} variant="medallion" alt="" />
              {badges.map(b => (
                <div key={b.key} className={b.cls} style={b.style} title={b.title} aria-hidden="true">{b.icon}</div>
              ))}
              {player.isPlush && <span className="av-plush-badge" aria-hidden="true">🧸</span>}
              {!player.isAlive && <div className="av-dead-overlay" aria-hidden="true">💀</div>}
            </div>
            <div className="av-name">{player.name}</div>
            <div className="av-role">
              {player.roleId === 'ancien' && ancienLives > 0 ? `Ancien · ${ancienLives} ♥` : (role?.name ?? '?')}
            </div>
          </div>
        )
      })}

      {players.length === 0 && (
        <div className="circle-hint">
          <span style={{ fontSize: '3rem' }}>🌙</span>
          Le village attend ses habitants…
        </div>
      )}
    </>
  )
}
