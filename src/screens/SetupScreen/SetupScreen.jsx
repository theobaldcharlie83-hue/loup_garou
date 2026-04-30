import { useNavigate } from 'react-router-dom'
import { useGameStore, ROLE_CATALOG, DEFAULT_PLUSH_NAMES, DEFAULT_HUMAN_NAMES } from '../../store/useGameStore'
import './SetupScreen.css'

/* ─── Groupement des rôles par équipe ──────────────────────── */
const TEAM_ORDER = ['loup', 'village', 'ambigu', 'solitaire']
const TEAM_META = {
  loup:      { label: 'Loups-Garous', icon: '🐺' },
  village:   { label: 'Villageois',   icon: '🏡' },
  ambigu:    { label: 'Ambigus',      icon: '🌀' },
  solitaire: { label: 'Solitaires',   icon: '⭐' },
}

/* ─── Composant principal ───────────────────────────────────── */
export default function SetupScreen() {
  const navigate = useNavigate()

  const {
    humanCount, setHumanCount,
    plushCount, setPlushCount,
    humanNames, setHumanName,
    plushNames, setPlushName,
    roleSelection, setRoleQty,
    getTotalRoles, getTotalPlayers,
    isReadyToStart, startGame,
  } = useGameStore()

  const totalRoles   = getTotalRoles()
  const totalPlayers = getTotalPlayers()
  const ready        = isReadyToStart()

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
                  <div className="name-input-row" key={`h-${i}`}>
                    <label className="name-input-label" htmlFor={`human-name-${i}`}>
                      Joueur {i + 1}
                    </label>
                    <div className="input-with-clear">
                      <input
                        id={`human-name-${i}`}
                        className="name-input"
                        type="text"
                        value={name}
                        onChange={(e) => setHumanName(i, e.target.value)}
                        placeholder={`Prénom du joueur ${i + 1}`}
                        maxLength={20}
                        autoComplete="off"
                        list="human-suggestions"
                        aria-label={`Nom du joueur humain ${i + 1}`}
                      />
                      {name && (
                        <button
                          className="btn-clear-input"
                          onClick={() => setHumanName(i, '')}
                          aria-label="Effacer le nom"
                          title="Effacer le nom"
                        >
                          ✖
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Datalist pour autocomplétion des humains */}
        <datalist id="human-suggestions">
          {DEFAULT_HUMAN_NAMES.map((name, idx) => (
            <option key={idx} value={name} />
          ))}
        </datalist>

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
            {ready && (
              <span className="ready">✦ Prêt à démarrer !</span>
            )}
          </div>

          <button
            id="btn-commencer-chronique"
            className="btn-primary setup-cta"
            onClick={handleStart}
            disabled={!ready}
            aria-disabled={!ready}
          >
            <span className="material-symbols-outlined icon-filled" aria-hidden="true">
              auto_stories
            </span>
            Commencer la Chronique
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          ZONE CENTRALE — Grille des Rôles
      ══════════════════════════════════════════ */}
      <main className="setup-roles-zone" aria-label="Sélection des rôles">
        <div className="roles-zone-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  <div className="name-input-row" key={`p-${i}`}>
                    <label className="name-input-label" htmlFor={`plush-name-${i}`}>
                      Peluche {i + 1}
                    </label>
                    <div className="input-with-clear">
                      <input
                        id={`plush-name-${i}`}
                        className="name-input plush"
                        type="text"
                        value={name}
                        onChange={(e) => setPlushName(i, e.target.value)}
                        placeholder="Nom de la peluche"
                        maxLength={20}
                        autoComplete="off"
                        list="plush-suggestions"
                        aria-label={`Nom de la peluche ${i + 1}`}
                      />
                      {name && (
                        <button
                          className="btn-clear-input"
                          onClick={() => setPlushName(i, '')}
                          aria-label="Effacer le nom"
                          title="Effacer le nom"
                        >
                          ✖
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Datalist pour autocomplétion des peluches */}
        <datalist id="plush-suggestions">
          {DEFAULT_PLUSH_NAMES.map((name, idx) => (
            <option key={idx} value={name} />
          ))}
        </datalist>
      </aside>
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
      <div className="role-card__icon" aria-hidden="true">{role.icon}</div>

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
        <div className="role-card__hint" style={{ fontSize: '0.65rem', color: '#a78bfa', marginTop: 4, textAlign: 'center', fontStyle: 'italic' }}>
          {hint}
        </div>
      )}
    </article>
  )
}
