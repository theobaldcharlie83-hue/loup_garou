import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore, ROLE_CATALOG, DEFAULT_PLUSH_NAMES } from '../../store/useGameStore'
import NameField from './NameField'
import RoleToken from '../../components/RoleToken/RoleToken'
import './SetupScreen.css'

/* ─── Groupement des rôles par équipe ──────────────────────── */
const TEAM_ORDER = ['loup', 'village', 'ambigu', 'solitaire']
const TEAM_META = {
  loup:      { label: 'Loups-Garous', icon: '🐺' },
  village:   { label: 'Villageois',   icon: '🏡' },
  ambigu:    { label: 'Ambigus',      icon: '🌀' },
  solitaire: { label: 'Solitaires',   icon: '⭐' },
}

/* ─── Noms effectifs (identiques aux replis de startGame) ─────── */
const defaultPlushName = (i) => DEFAULT_PLUSH_NAMES[i] ?? `Peluche numéro ${i + 1}`
const normalize = (n) => n.trim().toLocaleLowerCase('fr')
const effectiveHumanName = (name, i) => normalize(name ?? '') || normalize(`Joueur ${i + 1}`)
const effectivePlushName = (name, i) => normalize(name ?? '') || normalize(defaultPlushName(i))

/* ─── Composant principal ───────────────────────────────────── */
export default function SetupScreen() {
  const navigate = useNavigate()
  const [savedGames, setSavedGames] = useState([])
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null) // suppression en 2 temps

  const {
    humanCount, setHumanCount,
    plushCount, setPlushCount,
    humanNames, setHumanName,
    plushNames, setPlushName,
    roleSelection, setRoleQty,
    getTotalRoles, getTotalPlayers,
    isReadyToStart, startGame,
    loadGameFromLocalStorage,
    deleteSavedGameFromLocalStorage,
    players,
    phase,
  } = useGameStore()

  const totalRoles   = getTotalRoles()
  const totalPlayers = getTotalPlayers()

  // Noms tels qu'ils seront réellement attribués (mêmes règles de repli que startGame)
  // afin de détecter les doublons, source d'ambiguïté dans les votes et le journal.
  const allEffectiveNames = [
    ...humanNames.map(effectiveHumanName),
    ...plushNames.map(effectivePlushName),
  ]
  const duplicateNames = new Set(
    allEffectiveNames.filter((n, i) => allEffectiveNames.indexOf(n) !== i)
  )
  const hasDuplicates = duplicateNames.size > 0
  const ready        = isReadyToStart() && !hasDuplicates

  const hasActiveGame = players && players.length > 0 && phase !== 'setup'

  /* Rôles groupés */
  const rolesByTeam = TEAM_ORDER.reduce((acc, team) => {
    acc[team] = ROLE_CATALOG.filter((r) => r.team === team)
    return acc
  }, {})

  const handleStart = () => {
    if (!ready) return
    startGame()
    navigate('/dashboard')
  }

  const loadSavedGames = () => {
    try {
      const listStr = localStorage.getItem('loup_garou_saved_games')
      let list = []
      if (listStr) {
        list = JSON.parse(listStr)
      }

      const legacySave = localStorage.getItem('loup_garou_saved_game')
      if (list.length === 0 && legacySave) {
        const parsed = JSON.parse(legacySave)
        const date = new Date()
        const formattedDate = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' à ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        const saveId = parsed.activeSaveId || Date.now()
        const newSave = {
          id: saveId,
          name: parsed.players ? `Partie récupérée (${parsed.players.length} joueurs)` : `Partie sauvegardée du ${formattedDate}`,
          timestamp: Date.now(),
          state: { ...parsed, activeSaveId: saveId }
        }
        list.push(newSave)
        localStorage.setItem('loup_garou_saved_games', JSON.stringify(list))
      }

      list.sort((a, b) => b.timestamp - a.timestamp)
      setSavedGames(list)
    } catch (e) {
      console.error("Error reading saved games:", e)
    }
  }

  useEffect(() => {
    loadSavedGames()
  }, [])

  const handleResume = (id) => {
    const success = loadGameFromLocalStorage(id)
    if (success) {
      setIsResumeModalOpen(false)
      navigate('/dashboard')
    }
  }

  const handleDeleteSave = (id) => {
    if (pendingDeleteId !== id) { setPendingDeleteId(id); return }
    deleteSavedGameFromLocalStorage(id)
    setPendingDeleteId(null)
    loadSavedGames()
  }

  const handleAutoAssign = () => {
    // RAZ
    ROLE_CATALOG.forEach(r => setRoleQty(r.id, 0))
    if (totalPlayers === 0) return

    let remaining = totalPlayers
    const selection = {}
    const addRole = (id, max = 1) => {
      const current = selection[id] || 0
      if (remaining > 0 && current < max) {
        selection[id] = current + 1
        remaining--
      }
    }

    // 1. Essentiels
    addRole('voyante', 1)
    if (totalPlayers >= 8) addRole('sorciere', 1)
    if (totalPlayers >= 10) addRole('cupidon', 1)

    // 2. Loups (~25-30%)
    const wolfCount = Math.max(1, Math.floor(totalPlayers / 3.5))
    for (let i = 0; i < wolfCount; i++) {
       if (i === 0 && totalPlayers >= 12) addRole('infect-pere', 1)
       else if ((selection['loup-simple'] || 0) < 3) addRole('loup-simple', 3)
       else addRole('grand-mechant', 1)
    }

    // 3. Remplissage (Villageois puis spéciaux si besoin)
    while (remaining > 0) {
      if ((selection['villageois'] || 0) < 7) {
        addRole('villageois', 7)
      } else {
        // Les Sœurs sont exclues de l'auto-assign (elles ne s'ajoutent que par 2)
        const specials = ROLE_CATALOG.filter(r => r.team === 'village' && r.id !== 'villageois' && r.id !== 'soeurs' && (selection[r.id] || 0) < r.maxQty)
        if (specials.length > 0) {
          addRole(specials[Math.floor(Math.random() * specials.length)].id, 1)
        } else {
          break
        }
      }
    }

    Object.entries(selection).forEach(([id, qty]) => {
      setRoleQty(id, qty)
    })
  }

  return (
    <div className="setup-screen" role="main" aria-label="Configuration de la partie">

      {/* ══════════════════════════════════════════
          PANNEAU GAUCHE — Joueurs Humains
      ══════════════════════════════════════════ */}
      <aside className="setup-sidebar" aria-label="Paramètres des joueurs humains">

        {/* En-tête */}
        <div className="setup-sidebar__header">
          <h1 className="setup-sidebar__title">Le Grimoire<br />du Village</h1>
          <p className="setup-sidebar__subtitle">Préparez la Chronique</p>
        </div>

        <div className="setup-sidebar__scrollable-area">
          {/* ──── Joueurs Humains ──── */}
          <div className={`player-block${humanCount > 0 ? ' has-players' : ''}`}>
            <div className="player-block__header">
              <div className="player-block__top">
                <div>
                  <div className="player-block__label">
                    <span aria-hidden="true">👤</span> Joueurs Humains
                  </div>
                  <div className="player-block__sublabel">Conteurs à table</div>
                </div>
                <div className="player-block__controls">
                  <button
                    id="human-count-dec"
                    className="counter-btn"
                    onClick={() => setHumanCount(Math.max(0, humanCount - 1))}
                    disabled={humanCount === 0}
                    aria-label="Retirer un joueur humain"
                  >−</button>
                  <span className="counter-value" aria-label={`${humanCount} joueurs humains`}>
                    {humanCount}
                  </span>
                  <button
                    id="human-count-inc"
                    className="counter-btn"
                    onClick={() => setHumanCount(Math.min(16 - plushCount, humanCount + 1))}
                    disabled={humanCount + plushCount >= 16}
                    aria-label="Ajouter un joueur humain"
                  >+</button>
                </div>
              </div>
            </div>

            {/* Champs de noms humains */}
            {humanCount > 0 && (
              <div className="player-names-list" role="group" aria-label="Noms des joueurs humains">
                {humanNames.map((name, i) => (
                  <NameField
                    key={`h-${i}`}
                    id={`human-name-${i}`}
                    nextId={i + 1 < humanCount ? `human-name-${i + 1}` : null}
                    label={`Joueur ${i + 1}`}
                    value={name}
                    placeholder={`Joueur ${i + 1}`}
                    onChange={(v) => setHumanName(i, v)}
                    isDuplicate={duplicateNames.has(effectiveHumanName(name, i))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ──── Footer : résumé + CTA ──── */}
        <div className="setup-footer">
          <div className="setup-summary" role="status" aria-live="polite" aria-atomic="true">
            <strong>{totalPlayers}</strong> joueur{totalPlayers !== 1 ? 's' : ''}{' '}·{' '}
            <strong>{totalRoles}</strong> rôle{totalRoles !== 1 ? 's' : ''}

            {totalPlayers > 0 && totalRoles > 0 && totalRoles !== totalPlayers && (
              <span className="mismatch">
                ⚠ {totalRoles > totalPlayers
                  ? `${totalRoles - totalPlayers} rôle${totalRoles - totalPlayers > 1 ? 's' : ''} en trop`
                  : `${totalPlayers - totalRoles} rôle${totalPlayers - totalRoles > 1 ? 's' : ''} manquant${totalPlayers - totalRoles > 1 ? 's' : ''}`
                }
              </span>
            )}
            {hasDuplicates && (
              <span className="mismatch">⚠ Deux joueurs portent le même nom</span>
            )}
            {ready && (
              <span className="ready">✦ Prêt à démarrer !</span>
            )}
          </div>

          {hasActiveGame && (
            <button
              id="btn-retourner-jeu"
              className="btn-secondary setup-cta"
              onClick={() => navigate('/dashboard')}
            >
              <span aria-hidden="true">▶️</span>
              Retourner à la partie en cours
            </button>
          )}

          {savedGames.length > 0 && (
            <button
              id="btn-reprendre-chronique"
              className="btn-ghost setup-cta"
              onClick={() => setIsResumeModalOpen(true)}
            >
              <span aria-hidden="true">📂</span>
              Reprendre une partie sauvegardée
            </button>
          )}

          <button
            id="btn-commencer-chronique"
            className="btn-primary setup-cta"
            onClick={handleStart}
            disabled={!ready}
            aria-disabled={!ready}
          >
            <span aria-hidden="true">📖</span>
            Commencer la Chronique
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          ZONE CENTRALE — Grille des Rôles
      ══════════════════════════════════════════ */}
      <main className="setup-roles-zone" aria-label="Sélection des rôles">
        <div className="roles-zone-header">
          <div>
            <h2>Choix des Rôles</h2>
            <p>Sélectionnez les personnages qui peupleront votre chronique.</p>
          </div>
          {totalPlayers > 0 && (
            <button
              className="btn-choix-rapide"
              onClick={handleAutoAssign}
            >
              ✨ Choix rapide
            </button>
          )}
        </div>

        {TEAM_ORDER.map((team) => (
          <section key={team} aria-label={`Équipe ${TEAM_META[team].label}`}>
            <h3 className={`roles-section-title team-${team}`}>
              <span aria-hidden="true">{TEAM_META[team].icon}</span>
              {TEAM_META[team].label}
            </h3>
            <div className="roles-grid">
              {rolesByTeam[team].map((role) => {
                const qty = roleSelection[role.id] ?? 0
                // Les Sœurs ne peuvent être que 0 ou 2 (jamais 1)
                const isSoeurs = role.id === 'soeurs'
                const handleDecrement = isSoeurs
                  ? () => setRoleQty(role.id, 0)
                  : () => setRoleQty(role.id, Math.max(0, qty - 1))
                const handleIncrement = isSoeurs
                  ? () => setRoleQty(role.id, qty === 0 ? 2 : qty)
                  : () => setRoleQty(role.id, Math.min(role.maxQty, qty + 1))
                return (
                  <RoleCard
                    key={role.id}
                    role={role}
                    qty={qty}
                    onDecrement={handleDecrement}
                    onIncrement={handleIncrement}
                    hint={isSoeurs ? 'Rôle duo uniquement (0 ou 2)' : null}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </main>

      {/* ══════════════════════════════════════════
          PANNEAU DROIT — Joueurs Peluches
      ══════════════════════════════════════════ */}
      <aside className="setup-sidebar-right" aria-label="Paramètres des peluches">
        <div className="setup-sidebar__scrollable-area">
          {/* ──── Joueurs Peluches ──── */}
          <div className={`player-block${plushCount > 0 ? ' has-players' : ''}`}>
            <div className="player-block__header">
              <div className="player-block__top">
                <div>
                  <div className="player-block__label">
                    <span aria-hidden="true">🧸</span> Joueurs Peluches
                  </div>
                  <div className="player-block__sublabel">Gardiens du foyer</div>
                </div>
                <div className="player-block__controls">
                  <button
                    id="plush-count-dec"
                    className="counter-btn"
                    onClick={() => setPlushCount(Math.max(0, plushCount - 1))}
                    disabled={plushCount === 0}
                    aria-label="Retirer une peluche"
                  >−</button>
                  <span className="counter-value" aria-label={`${plushCount} peluches`}>
                    {plushCount}
                  </span>
                  <button
                    id="plush-count-inc"
                    className="counter-btn"
                    onClick={() => setPlushCount(Math.min(16 - humanCount, plushCount + 1))}
                    disabled={humanCount + plushCount >= 16}
                    aria-label="Ajouter une peluche"
                  >+</button>
                </div>
              </div>
            </div>

            {/* Champs de noms peluches */}
            {plushCount > 0 && (
              <div className="player-names-list" role="group" aria-label="Noms des peluches">
                {plushNames.map((name, i) => (
                  <NameField
                    key={`p-${i}`}
                    id={`plush-name-${i}`}
                    nextId={i + 1 < plushCount ? `plush-name-${i + 1}` : null}
                    label={`Peluche ${i + 1}`}
                    value={name}
                    placeholder={defaultPlushName(i)}
                    onChange={(v) => setPlushName(i, v)}
                    isDuplicate={duplicateNames.has(effectivePlushName(name, i))}
                    variant="plush"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── MODALE SÉLECTEUR DE SAUVEGARDES ── */}
      {isResumeModalOpen && (
        <div className="setup-modal-overlay" onClick={() => { setIsResumeModalOpen(false); setPendingDeleteId(null) }}>
          <div className="setup-modal" onClick={e => e.stopPropagation()}>
            <div className="setup-modal-header">
              <h2>Parties Sauvegardées</h2>
              <button className="setup-modal-close" onClick={() => setIsResumeModalOpen(false)}>✖</button>
            </div>
            <div className="setup-modal-body">
              {savedGames.length === 0 ? (
                <p className="no-saves-text">Aucune sauvegarde trouvée.</p>
              ) : (
                savedGames.map((game) => (
                  <div key={game.id} className="save-item-row">
                    <div className="save-item-info">
                      <span className="save-item-name">{game.name}</span>
                    </div>
                    <div className="save-item-actions">
                      <button
                        className="btn-load-save"
                        onClick={() => handleResume(game.id)}
                      >
                        Charger
                      </button>
                      <button
                        className={`btn-delete-save${pendingDeleteId === game.id ? ' confirm' : ''}`}
                        onClick={() => handleDeleteSave(game.id)}
                        aria-label={pendingDeleteId === game.id ? 'Confirmer la suppression' : 'Supprimer la sauvegarde'}
                      >
                        {pendingDeleteId === game.id ? 'Confirmer ?' : '🗑️'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Sous-composant : Carte Rôle ───────────────────────────── */
function RoleCard({ role, qty, onDecrement, onIncrement, hint }) {
  const isSelected = qty > 0

  return (
    <article
      className={`role-card${isSelected ? ' selected' : ''}`}
      role="group"
      aria-label={`${role.name}, ${qty} sélectionné${qty > 1 ? 's' : ''} sur ${role.maxQty} maximum`}
    >
      <div className="role-card__art" aria-hidden="true">
        <RoleToken roleId={role.id} />
        {qty > 1 && <span className="role-card__count">×{qty}</span>}
      </div>

      <div className="role-card__name">{role.name}</div>

      {role.maxQty > 1 && (
        <div className="role-card__max text-muted">
          max {role.maxQty}
        </div>
      )}

      <div className="role-card__qty">
        <button
          id={`role-${role.id}-dec`}
          className="qty-btn"
          onClick={onDecrement}
          disabled={qty === 0}
          aria-label={`Retirer ${role.name}`}
        >−</button>

        <span className={`qty-value${isSelected ? ' active' : ''}`} aria-live="polite">
          {qty}
        </span>

        <button
          id={`role-${role.id}-inc`}
          className="qty-btn"
          onClick={onIncrement}
          disabled={qty >= role.maxQty}
          aria-label={`Ajouter ${role.name}`}
        >+</button>
      </div>

      {hint && (
        <div className="role-card__hint">
          {hint}
        </div>
      )}
    </article>
  )
}
