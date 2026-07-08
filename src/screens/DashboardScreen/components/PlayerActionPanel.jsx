import { useGameStore, ROLE_BY_ID, isPlayerWolf } from '../../../store/useGameStore'

/**
 * Panneau flottant d'actions pour le joueur sélectionné : changement de rôle
 * et désignation du Capitaine en préparation, élimination le jour, actions
 * contextuelles de nuit (voir, dévorer, infecter, charmer...).
 */
export default function PlayerActionPanel({
  selectedPlayer, currentNightStepId, nightSelection, handleNightActionSelect,
  handleEliminate, setCaptain, setSelectedId, startEditing,
}) {
  const { phase, players, wildChildModelId, chienLoupSide, captainId, charmedIds, nightActions } = useGameStore()

  if (!selectedPlayer) return null

  return (
    <div className="player-action-panel" role="dialog">
      <div className="pap-info">
        <div className="pap-name">
          {selectedPlayer.isPlush && '🐾 '}{selectedPlayer.name}
        </div>
        <div className="pap-role">
          {(() => {
            const model = players.find(x => x.id === wildChildModelId);
            const isMutated = selectedPlayer.roleId === 'enfant-sauvage' && model && !model.isAlive;
            const isDogWolfLoup = selectedPlayer.roleId === 'chien-loup' && chienLoupSide === 'loup';
            const isDogWolfVillage = selectedPlayer.roleId === 'chien-loup' && chienLoupSide === 'village';
            const suffix = selectedPlayer.isInfected ? ' (Infecté 🐺)' : (isMutated ? ' (Muté 🐺)' : (isDogWolfLoup ? ' (Camp Loup 🐺)' : (isDogWolfVillage ? ' (Camp Village 🏘️)' : '')));
            return (ROLE_BY_ID[selectedPlayer.roleId]?.icon ?? '❓') + ' ' + (ROLE_BY_ID[selectedPlayer.roleId]?.name ?? '?') + suffix;
          })()}
        </div>
      </div>

      <div className="pap-btns">
        {phase === 'preparation' ? (
          <>
            {!selectedPlayer.isPlush && (
              <select
                className="setup-input"
                style={{ padding: '6px 12px', borderRadius: 20, border: 'none', background: 'var(--color-primary)', color: 'var(--color-input-bg)', fontWeight: 'bold', cursor: 'pointer' }}
                onChange={(e) => {
                  if (e.target.value) {
                    useGameStore.getState().swapRoleSwap(selectedPlayer.id, e.target.value);
                    setSelectedId(null);
                  }
                }}
                value=""
              >
                <option value="" disabled>-- Changer son rôle --</option>
                {Array.from(new Set(players.filter(p => p.id !== selectedPlayer.id).map(p => p.roleId))).map(rid => (
                  <option key={rid} value={rid}>{ROLE_BY_ID[rid]?.name ?? rid}</option>
                ))}
              </select>
            )}
            {selectedPlayer.isAlive && selectedPlayer.id !== captainId && (
              <button className="pap-btn" style={{ background: 'var(--color-gold)', color: 'var(--color-on-primary)' }} onClick={() => { useGameStore.getState().saveHistory(); setCaptain(selectedPlayer.id); }}>
                🎖️  Désigner Capitaine
              </button>
            )}
          </>
        ) : phase === 'day' ? (
          <button
            id="btn-eliminate"
            className="pap-btn eliminate"
            onClick={() => handleEliminate(selectedPlayer.id)}
          >
            💀 Éliminer
          </button>
        ) : (
          /* ACTIONS DE NUIT (CONTEXTUELLES) */
          <>
            {currentNightStepId === 'cupidon' && (
              <button className="pap-btn lover" onClick={() => handleNightActionSelect()}>
                💖 {nightSelection.includes(selectedPlayer.id) ? 'Désélectionner' : 'Joueur Cupidonné'}
              </button>
            )}
            {currentNightStepId === 'voyante' && selectedPlayer.isAlive && selectedPlayer.roleId !== 'voyante' && !nightActions.seerSeen && (
              <button className="pap-btn see" onClick={() => handleNightActionSelect()}>
                👁️ Joueur vu par la Voyante
              </button>
            )}
            {currentNightStepId === 'loup-simple' && selectedPlayer.isAlive && !isPlayerWolf(selectedPlayer, players, useGameStore.getState()) && (
              <button className="pap-btn eliminate" onClick={() => handleNightActionSelect()}>
                🐺 Dévorer ce joueur
              </button>
            )}
            {currentNightStepId === 'infect-pere' &&
              selectedPlayer.isAlive &&
              !isPlayerWolf(selectedPlayer, players, useGameStore.getState()) &&
              selectedPlayer.id !== nightActions.wolvesVictim && (
                <button className="pap-btn poison" onClick={() => handleNightActionSelect()}>
                  ☣️  Infecter (Infection Latente)
                </button>
              )}
            {currentNightStepId === 'chien-loup' && selectedPlayer.roleId === 'chien-loup' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                <button className="pap-btn save choice-btn" onClick={() => handleNightActionSelect('village')}>
                  <span style={{ fontSize: '1.2rem', marginRight: 8 }}>🏘️</span> Devenir Villageois
                </button>
                <button className="pap-btn eliminate choice-btn" onClick={() => handleNightActionSelect('loup')}>
                  <span style={{ fontSize: '1.2rem', marginRight: 8 }}>🐺</span> Rejoindre la meute
                </button>
              </div>
            )}
            {currentNightStepId === 'joueur-flute' && selectedPlayer.isAlive && selectedPlayer.roleId !== 'joueur-flute' && !charmedIds.includes(selectedPlayer.id) && (
              <button className="pap-btn charm" onClick={() => handleNightActionSelect()}>
                🎶 Charmer ce joueur
              </button>
            )}
            {currentNightStepId === 'grand-mechant' && selectedPlayer.isAlive && !isPlayerWolf(selectedPlayer, players, useGameStore.getState()) && selectedPlayer.id !== nightActions.wolvesVictim && !nightActions.grandMechantVictim && (
              <button className="pap-btn eliminate" onClick={() => handleNightActionSelect()}>
                😈 2ème victime (GMM)
              </button>
            )}
            {currentNightStepId === 'loup-blanc' && selectedPlayer.isAlive && isPlayerWolf(selectedPlayer, players, useGameStore.getState()) && selectedPlayer.roleId !== 'loup-blanc' && !nightActions.whiteWolfVictim && (
              <button className="pap-btn eliminate" onClick={() => handleNightActionSelect()}>
                🤝 Mordre un autre Loup
              </button>
            )}
            {currentNightStepId === 'enfant-sauvage' && selectedPlayer.isAlive && selectedPlayer.roleId !== 'enfant-sauvage' && !wildChildModelId && (
              <button className="pap-btn see" onClick={() => handleNightActionSelect()}>
                🌿 Ce joueur sera mon modèle
              </button>
            )}
            {currentNightStepId === 'renard' && selectedPlayer.isAlive && selectedPlayer.roleId !== 'renard' && nightSelection.length === 0 && (
              <button className="pap-btn see" onClick={() => handleNightActionSelect()}>
                🦊 Analyser ce groupe
              </button>
            )}
            {currentNightStepId === 'corbeau' && selectedPlayer.isAlive && selectedPlayer.id !== players.find(p => p.roleId === 'corbeau')?.id && (
              <button className="pap-btn investigate" onClick={() => handleNightActionSelect()}>
                🐦 Désigner (2 voix)
              </button>
            )}
          </>
        )}

        {/* Renommage — toujours accessible ici, pas seulement au double-clic/survol
            (double-tap = zoom sur tablette, la cible tactile de l'app). */}
        <button
          className="pap-btn"
          onClick={() => startEditing(selectedPlayer, 'avatar')}
          aria-label={`Renommer ${selectedPlayer.name}`}
        >
          ✏️ Renommer
        </button>

        <button
          className="pap-btn close-btn"
          onClick={() => setSelectedId(null)}
          aria-label="Fermer"
        >✖</button>
      </div>
    </div>
  )
}
