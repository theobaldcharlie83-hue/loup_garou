import { useGameStore, ROLE_BY_ID, isPlayerWolf } from '../../../store/useGameStore'
import { ENDGAME_CAPTAIN_THRESHOLD } from '../../../services/aiConfig'
import AIButton from './AIButton'

// Utilitaires hors composant : un tirage aléatoire n'est "impur" que s'il se
// produit pendant le rendu. Ici il n'est jamais appelé que depuis des
// gestionnaires onClick, mais on le sort du corps du composant pour lever
// toute ambiguïté vis-à-vis de la règle react-hooks/purity.
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Stratégie commune "Fin de Partie" des loups IA : viser le Capitaine si
// <= ENDGAME_CAPTAIN_THRESHOLD survivants et que son partenaire (s'il en a
// un) n'est pas déjà loup.
function pickWolfTarget(valids, alive, captainId, lovers) {
  let target = pickRandom(valids)
  if (alive.length <= ENDGAME_CAPTAIN_THRESHOLD && captainId) {
    const cap = valids.find(v => v.id === captainId)
    if (cap) {
      const partnerId = lovers.find(id => id !== captainId)
      const partner = partnerId ? alive.find(p => p.id === partnerId) : null
      const isPartnerWolf = partner && (['loup', 'solitaire'].includes(ROLE_BY_ID[partner.roleId]?.team) || partner.isInfected)
      if (!isPartnerWolf) target = cap
    }
  }
  return target
}

/**
 * Carte de l'étape de nuit courante : instructions, boutons "IA" pour les
 * peluches (unifiés via AIButton), affichages contextuels (Renard, Amoureux,
 * Sœurs...) et le bouton "Passer à la suite".
 */
export default function NightStepCard({
  currentStepInfo, nightSelection, setNightSelection, triggerHighlight,
  advanceNightPhase, handlePhaseToggle, isProcessingAction,
}) {
  const {
    players, nightActions, charmedIds, wildChildModelId, foxPowerLost,
    infectUsed, captainId, lovers,
    commitWildChildModel, commitFoxAction, commitGrandMechantVictim,
    commitWhiteWolfVictim, commitInfection,
  } = useGameStore()

  const alive = players.filter(p => p.isAlive)
  const wolves = alive.filter(p => isPlayerWolf(p, players, useGameStore.getState()))

  return (
    <div className={`night-step-card ${currentStepInfo.isEnd ? 'end-night' : ''}`}>
      <h3>{ROLE_BY_ID[currentStepInfo.id]?.icon} {currentStepInfo.label}</h3>

      {!currentStepInfo.isEnd ? (
        <>
          {/* ── Cupidon IA ── */}
          {currentStepInfo.id === 'cupidon' && players.find(p => p.roleId === 'cupidon' && p.isAlive)?.isPlush && nightSelection.length < 2 && (
            <AIButton label="Cupidon" onClick={() => {
              const shuffled = [...alive].sort(() => Math.random() - 0.5);
              if (shuffled.length >= 2) {
                const picks = [shuffled[0].id, shuffled[1].id];
                setNightSelection(picks);
                triggerHighlight(picks);
              }
            }} />
          )}

          {/* ── Chien-Loup IA ── */}
          {currentStepInfo.id === 'chien-loup' && players.find(p => p.roleId === 'chien-loup' && p.isAlive)?.isPlush && nightSelection.length === 0 && (
            <AIButton label="Chien-Loup" strategy="choisit son destin" onClick={() => {
              const side = Math.random() < 0.5 ? 'village' : 'loup';
              useGameStore.getState().setChienLoupSide(side);
              setNightSelection(['done']);
              const dog = players.find(p => p.roleId === 'chien-loup');
              if (dog) triggerHighlight([dog.id]);
            }} />
          )}

          {/* ── Enfant Sauvage IA ── */}
          {currentStepInfo.id === 'enfant-sauvage' && players.find(p => p.roleId === 'enfant-sauvage' && p.isAlive)?.isPlush && !wildChildModelId && (
            <AIButton label="Enfant Sauvage" onClick={() => {
              const valids = alive.filter(p => p.roleId !== 'enfant-sauvage' && ROLE_BY_ID[p.roleId]?.team !== 'loup' && !p.isInfected);
              if (valids.length > 0) {
                const rnd = pickRandom(valids);
                commitWildChildModel(rnd.id);
                setNightSelection([rnd.id]);
                triggerHighlight([rnd.id]);
              }
            }} />
          )}

          {/* ── Renard IA ── */}
          {currentStepInfo.id === 'renard' && players.find(p => p.roleId === 'renard' && p.isAlive)?.isPlush && nightSelection.length === 0 && !foxPowerLost && (
            <AIButton label="Renard" strategy="flair intelligent" onClick={() => {
              const valids = alive.filter(p => p.roleId !== 'renard');
              if (valids.length > 0) {
                const rnd = pickRandom(valids);
                const alivePlayers = players.filter(p => p.isAlive);
                const cIdx = alivePlayers.findIndex(p => p.id === rnd.id);
                if (cIdx !== -1) {
                  const left = alivePlayers[(cIdx - 1 + alivePlayers.length) % alivePlayers.length];
                  const right = alivePlayers[(cIdx + 1) % alivePlayers.length];
                  const groupIds = [left.id, rnd.id, right.id];
                  const isWolf = (p) => isPlayerWolf(p, players, useGameStore.getState());
                  const hasWolf = groupIds.some(id => isWolf(players.find(p => p.id === id)));
                  commitFoxAction(rnd.id, hasWolf, groupIds);
                  setNightSelection(groupIds);
                  triggerHighlight(groupIds);
                }
              }
            }} />
          )}

          {/* ── Renard : Affichage résultat Flair ── */}
          {currentStepInfo.id === 'renard' && (
            <div style={{ background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 10, textAlign: 'center' }}>
              {foxPowerLost ? (
                <p style={{ margin: 0, color: '#ff6b6b', fontWeight: 'bold' }}>❌ Pouvoir perdu (Flair épuisé par une erreur passée).</p>
              ) : nightSelection.length === 3 ? (
                <>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem' }}>🔍 Groupe analysé : <strong>{nightSelection.map(id => players.find(p => p.id === id)?.name).join(', ')}</strong></p>
                  <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: nightActions.foxHasWolf ? 'var(--color-danger)' : '#4dff88' }}>
                    {nightActions.foxHasWolf ? '🐺 OUI (Signe affirmatif)' : '✅ NON (Signe négatif)'}
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>Sélectionnez un joueur pour analyser son groupe de 3 (lui + ses 2 voisins vivants).</p>
              )}
            </div>
          )}

          {/* ── Voyante IA ── */}
          {currentStepInfo.id === 'voyante' && players.find(p => p.roleId === 'voyante' && p.isAlive)?.isPlush && !nightActions.seerSeen && (
            <AIButton label="Voyante" onClick={() => {
              const valids = alive.filter(p => p.roleId !== 'voyante' && !useGameStore.getState().seenBySeer.includes(p.id));
              if (valids.length > 0) {
                const rnd = pickRandom(valids);
                useGameStore.getState().commitSeerObservation(rnd.id);
                setNightSelection([rnd.id]);
                triggerHighlight([rnd.id]);
              } else {
                advanceNightPhase();
              }
            }} />
          )}

          {/* ── Loups IA ── */}
          {currentStepInfo.id === 'loup-simple' && wolves.every(w => w.isPlush) && !nightActions.wolvesVictim && (
            <AIButton
              label="Loups"
              strategy={alive.length <= ENDGAME_CAPTAIN_THRESHOLD ? 'Stratégie Capitaine' : 'Victime Aléatoire'}
              onClick={() => {
                const valids = alive.filter(p => !isPlayerWolf(p, players, useGameStore.getState()));
                if (valids.length > 0) {
                  const target = pickWolfTarget(valids, alive, captainId, lovers);
                  useGameStore.getState().commitWolvesVictim(target.id);
                  setNightSelection([target.id]);
                  triggerHighlight([target.id]);
                }
              }}
            />
          )}

          {/* ── Grand-Méchant-Loup IA ── */}
          {currentStepInfo.id === 'grand-mechant' && players.find(p => p.roleId === 'grand-mechant' && p.isAlive)?.isPlush && !nightActions.grandMechantVictim && (
            <AIButton
              label="Grand-Méchant-Loup"
              strategy={alive.length <= ENDGAME_CAPTAIN_THRESHOLD ? 'Stratégie Capitaine' : null}
              onClick={() => {
                const valids = alive.filter(p => !isPlayerWolf(p, players, useGameStore.getState()) && p.id !== nightActions.wolvesVictim);
                if (valids.length > 0) {
                  const target = pickWolfTarget(valids, alive, captainId, lovers);
                  commitGrandMechantVictim(target.id);
                  setNightSelection([target.id]);
                  triggerHighlight([target.id]);
                }
              }}
            />
          )}

          {/* ── Infect Père IA ── */}
          {currentStepInfo.id === 'infect-pere' && players.find(p => p.roleId === 'infect-pere' && p.isAlive)?.isPlush && !infectUsed && (
            <AIButton
              label="Infect Père"
              strategy={alive.length <= ENDGAME_CAPTAIN_THRESHOLD ? 'Stratégie Capitaine' : 'Dès que possible'}
              disabled={isProcessingAction}
              onClick={() => {
                const valids = alive.filter(p => {
                  const isWolf = isPlayerWolf(p, players, useGameStore.getState());
                  return !isWolf &&
                    p.id !== nightActions.wolvesVictim &&
                    p.id !== nightActions.grandMechantVictim;
                });

                if (valids.length > 0) {
                  const target = pickWolfTarget(valids, alive, captainId, lovers);
                  useGameStore.getState().pushToJournal(`🤖 L'IA Infect Père décide d'utiliser son pouvoir${alive.length <= ENDGAME_CAPTAIN_THRESHOLD ? ' stratégiquement sur le Capitaine' : ''}.`);
                  commitInfection(target.id);
                  setNightSelection([target.id]);
                  triggerHighlight([target.id]);
                } else {
                  useGameStore.getState().pushToJournal(`🤖 L'IA Infect Père ne trouve aucune cible valide à infecter.`);
                  advanceNightPhase();
                }
              }}
            />
          )}

          {/* ── Loup Blanc IA ── */}
          {currentStepInfo.id === 'loup-blanc' && players.find(p => p.roleId === 'loup-blanc' && p.isAlive)?.isPlush && !nightActions.whiteWolfVictim && (
            <AIButton label="Loup Blanc" strategy="élimine un Loup" disabled={isProcessingAction} onClick={() => {
              const otherWolves = alive.filter(p => isPlayerWolf(p, players, useGameStore.getState()) && p.id !== players.find(x => x.roleId === 'loup-blanc')?.id);
              if (otherWolves.length > 0) {
                const rnd = pickRandom(otherWolves);
                commitWhiteWolfVictim(rnd.id);
                setNightSelection([rnd.id]);
                triggerHighlight([rnd.id]);
              } else {
                advanceNightPhase();
              }
            }} />
          )}

          {/* ── Joueur de Flûte IA ── */}
          {currentStepInfo.id === 'joueur-flute' && players.find(p => p.roleId === 'joueur-flute' && p.isAlive)?.isPlush && nightSelection.length < 2 && (
            <AIButton label="Flûtiste" strategy="charmer 2 joueurs" onClick={() => {
              const valids = alive.filter(p => p.roleId !== 'joueur-flute' && !charmedIds.includes(p.id));
              if (valids.length > 0) {
                const shuffled = [...valids].sort(() => Math.random() - 0.5);
                const picks = shuffled.slice(0, Math.min(2, shuffled.length));
                const ids = picks.map(p => p.id);
                setNightSelection(ids);
                triggerHighlight(ids);
              }
            }} />
          )}

          {/* ── Corbeau IA ── */}
          {currentStepInfo.id === 'corbeau' && players.find(p => p.roleId === 'corbeau' && p.isAlive)?.isPlush && !nightActions.corbeauTargetId && (
            <AIButton label="Corbeau" onClick={() => {
              const valids = alive.filter(p => p.roleId !== 'corbeau');
              if (valids.length > 0) {
                const rnd = pickRandom(valids);
                useGameStore.getState().commitCorbeauTarget(rnd.id);
                setNightSelection([rnd.id]);
                triggerHighlight([rnd.id]);
              }
            }} />
          )}

          {/* ── Amoureux : révélation du couple ── */}
          {currentStepInfo.id === 'amoureux' && (
            <div style={{ background: 'rgba(255,100,150,0.12)', border: '1px solid rgba(255,100,150,0.4)', borderRadius: 8, padding: '10px 14px', marginBottom: 10, textAlign: 'center' }}>
              {lovers.length === 2 ? (
                <>
                  <p style={{ margin: '0 0 6px 0', fontSize: '1rem' }}>💞 Les Amoureux sont :</p>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem', color: '#ff8fab' }}>
                    {players.find(p => p.id === lovers[0])?.name} &amp; {players.find(p => p.id === lovers[1])?.name}
                  </p>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', opacity: 0.7 }}>Révélez-leur mutuellement leur partenaire.</p>
                </>
              ) : (
                <p style={{ margin: 0, color: 'var(--color-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>⏳ En attente que Cupidon désigne les amoureux...</p>
              )}
            </div>
          )}

          {/* ── Sœurs : info reconnaissance ── */}
          {currentStepInfo.id === 'soeurs' && (
            <div style={{ background: 'rgba(180,130,255,0.1)', border: '1px solid rgba(180,130,255,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 10, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85 }}>
                👯 Les deux <strong>Sœurs</strong> ({players.filter(p => p.roleId === 'soeurs' && p.isAlive).map(p => p.name).join(' & ') || '—'})
                ouvrent les yeux et se reconnaissent.</p>
            </div>
          )}

          {/* ── Montreur d'Ours : info position ── */}
          {currentStepInfo.id === 'montreur-ours' && (
            <div style={{ background: 'rgba(180,120,60,0.12)', border: '1px solid rgba(180,120,60,0.35)', borderRadius: 8, padding: '10px 14px', marginBottom: 10, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85 }}>
                🐻 Le <strong>Montreur d'Ours</strong> ({players.find(p => p.roleId === 'montreur-ours' && p.isAlive)?.name || '—'}) repère sa position.
                Son ours grognera chaque matin si l'un de ses voisins est Loup-Garou.</p>
            </div>
          )}

          {/* ── Joueurs charmés : reconnaissance mutuelle ── */}
          {currentStepInfo.id === 'joueurs-charmes' && (
            <div style={{ background: 'rgba(100,200,255,0.1)', border: '1px solid rgba(100,200,255,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 10, textAlign: 'left' }}>
              <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', fontSize: '0.9rem' }}>🎶 Joueurs charmés ({players.filter(p => charmedIds.includes(p.id) && p.isAlive).length}) :</p>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '0.9rem', opacity: 0.9 }}>
                {players.filter(p => charmedIds.includes(p.id) && p.isAlive).map(p => (
                  <li key={p.id}>{ROLE_BY_ID[p.roleId]?.icon} {p.name}</li>
                ))}
              </ul>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', opacity: 0.6 }}>Ils ouvrent les yeux, se reconnaissent, et se rendorment sans parler.</p>
            </div>
          )}

          {/* ── Bouton Passer ── */}
          <button
            className="night-step-btn"
            onClick={advanceNightPhase}
            disabled={
              (currentStepInfo.id === 'loup-simple' && !nightActions.wolvesVictim) ||
              (currentStepInfo.id === 'voyante' && !nightActions.seerSeen) ||
              (currentStepInfo.id === 'cupidon' && nightSelection.length < 2) ||
              (currentStepInfo.id === 'enfant-sauvage' && !wildChildModelId) ||
              (currentStepInfo.id === 'joueur-flute' && nightSelection.length < Math.min(2, alive.filter(p => p.roleId !== 'joueur-flute' && !charmedIds.includes(p.id)).length))
            }
          >
            {currentStepInfo.id === 'cupidon' && nightSelection.length === 2 ? '❤️ Valider le couple'
              : currentStepInfo.id === 'joueur-flute' ? '🎶 Charmer les joueurs'
              : currentStepInfo.id === 'enfant-sauvage' ? '🌿 Valider le Modèle'
              : currentStepInfo.id === 'corbeau' && nightSelection.length === 1 ? '🐦 Confirmer la désignation'
              : currentStepInfo.id === 'amoureux' ? '💞 Les amoureux se sont vus'
              : currentStepInfo.id === 'soeurs' ? '👯 Les Sœurs se sont reconnues'
              : currentStepInfo.id === 'montreur-ours' ? '🐻 Position mémorisée'
              : currentStepInfo.id === 'joueurs-charmes' ? '🎶 Reconnaissance terminée'
              : currentStepInfo.id === 'renard' ? (nightSelection.length === 3 ? '🦊 Valider le flair' : '🦊 Ne pas utiliser son flair')
              : currentStepInfo.id === 'loup-blanc' ? (nightActions.whiteWolfVictim ? '🤍 Confirmer l’élimination' : '🤍 Ne pas trahir la meute')
              : 'Passer à la suite'}
          </button>
        </>
      ) : (
        <button
          className="header-btn primary-action override-wake-btn"
          onClick={handlePhaseToggle}
        >
          <span aria-hidden="true">☀️ </span> Réveiller le Village
        </button>
      )}
    </div>
  )
}
