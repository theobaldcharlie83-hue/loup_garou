import { useGameStore, ROLE_BY_ID } from '../../../store/useGameStore'
import { computeVoteTally } from '../../../services/voteTally'

// Hors composant pour rester compatible avec la règle react-hooks/purity :
// un tirage aléatoire n'est déclenché que depuis un gestionnaire onClick.
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Gouvernance de la phase de Jour : succession du Capitaine, ouverture du
 * Tribunal, recueil des votes (humains + IA), dépouillement et exécution
 * (ou "aucune exécution" en cas d'abstention/égalité sans capitaine).
 */
export default function TribunalPanel({
  alive, isAiVotingLoading, handlePlushiesVote, setQaModalPlushId,
  setHighlightedIds, handlePhaseToggle,
}) {
  const {
    phase, players, successionPendingForId, isVoting, setIsVoting,
    tribunalLocked, setTribunalLocked, dayVotes, condemnedPlayerId,
    corbeauTargetId, captainId, qaScoringData, eliminatePlayer,
  } = useGameStore()

  return (
    <>
      {/* La succession du Capitaine a sa propre modale plein écran
          (SuccessionModal) — pas de carte redondante ici. */}
      {phase === 'day' && !isVoting && !tribunalLocked && !successionPendingForId && (
        <div className="night-step-card end-night">
          <h3>Phase de Jour ☀️ </h3>
          <p>Écoutez les plaidoyers puis préparez-vous au Tribunal.</p>
          <button className="header-btn" style={{ marginTop: 15, alignSelf: 'center' }} onClick={() => setIsVoting(true)}>
            ⚖️  Ouvrir le Tribunal du Village
          </button>
        </div>
      )}

      {/* ── Tribunal Verrouillé ──────────────────────────── */}
      {phase === 'day' && tribunalLocked && (
        <div className="tribunal-locked-panel">
          <div style={{ fontSize: '2.5rem' }}>🪓</div>
          <h3>Sentence prononcée</h3>
          <div className="condemned-name-display">
            {players.find(p => p.id === condemnedPlayerId)?.name || 'Inconnu'}
          </div>
          <p>Le village a rendu son verdict. La nuit tombe sur le Grimoire...</p>
          <button
            className="header-btn primary-action"
            style={{ marginTop: 8, fontSize: '1rem', padding: '10px 22px' }}
            onClick={handlePhaseToggle}
          >
            🌙 Endormir le Village
          </button>
        </div>
      )}

      {phase === 'day' && isVoting && !tribunalLocked && (
        <div className="night-step-card end-night" style={{ width: 'min(500px, 92vw)', maxHeight: '60vh', overflowY: 'auto' }}>
          <h3>Tribunal du Village ⚖️ </h3>
          <p style={{ marginBottom: 10 }}>Récoltez les votes puis laissez les peluches juger.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginBottom: 15 }}>
            {alive.filter(p => !p.isPlush).map(human => (
              <div key={human.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>{human.name} vote :</span>
                <select
                  className="setup-input"
                  style={{ padding: '5px', width: 150 }}
                  value={dayVotes[human.id] || ''}
                  onChange={(e) => useGameStore.getState().setDayVotes({ ...dayVotes, [human.id]: e.target.value })}
                >
                  <option value="">(Abstention)</option>
                  {alive.filter(p => p.id !== human.id).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button className="header-btn" disabled={isAiVotingLoading} onClick={handlePlushiesVote} style={{ alignSelf: 'center', marginBottom: 15, display: alive.some(p => p.isPlush) ? 'block' : 'none' }}>
            {isAiVotingLoading ? '🤖 Calcul des probabilités...' : '🤖 IA : Faire Voter les Doudous'}
          </button>

          {Object.keys(dayVotes).length > 0 && (
            <div style={{ width: '100%', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Urne actuelle :</h4>
              <ul style={{ margin: 0, padding: '0 20px', fontSize: '0.9rem', color: 'var(--color-on-surface-variant)' }}>
                {Object.entries(dayVotes).map(([voterId, targetId]) => {
                  const v = players.find(p => p.id === voterId);
                  const t = players.find(p => p.id === targetId);
                  return (
                    <li key={voterId} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {v?.name} {t ? `élimine ${t.name}` : `ne vote pas`}
                      {v?.isPlush && qaScoringData[voterId] && (
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }} onClick={() => setQaModalPlushId(v.id)} title="Audit de vote">📊</button>
                      )}
                    </li>
                  )
                })}
              </ul>

              {(() => {
                // Décompte pur et testé : voix de pénalité du Corbeau, et vote
                // du Capitaine qui compte pour 2 (règle officielle p.21).
                const { max, victims } = computeVoteTally(dayVotes, { captainId, corbeauTargetId });

                const everyoneVoted = Object.keys(dayVotes).length === alive.length;

                if (!everyoneVoted) {
                  return (
                    <div style={{ marginTop: 15, padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 8, fontStyle: 'italic', color: 'var(--color-muted)', textAlign: 'center' }}>
                      En attente des votes de tous les joueurs... ({Object.keys(dayVotes).length} / {alive.length})
                    </div>
                  );
                }

                const captainAlive = players.find(p => p.id === captainId && p.isAlive);

                const handleNoExecution = () => {
                  useGameStore.getState().saveHistory();
                  useGameStore.getState().pushToJournal(`Le village n'est pas parvenu à s'accorder. Personne n'est exécuté ce jour.`, 'phase');
                  setIsVoting(false);
                  setTribunalLocked(true);
                };

                if (max === 0) {
                  return (
                    <div style={{ marginTop: 15, padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 8, textAlign: 'center' }}>
                      <p style={{ fontStyle: 'italic', color: 'var(--color-muted)', marginBottom: 10 }}>Le village s'est entièrement abstenu.</p>
                      <button className="header-btn" onClick={handleNoExecution}>
                        ⚖️ Aucune exécution (village indécis)
                      </button>
                    </div>
                  );
                }

                return (
                  <div style={{ marginTop: 15, padding: 10, background: 'var(--color-danger-container)', border: '1px solid var(--color-danger)', borderRadius: 8 }}>
                    <h4 style={{ color: 'var(--color-danger)', margin: '0 0 10px 0' }}>Issue du Vote :</h4>
                    {victims.length === 1 ? (
                      <>
                        <p>
                          <strong>{players.find(p => p.id === victims[0])?.name}</strong> est condamné(e) avec {max} voix.
                        </p>
                        <button className="header-btn" style={{ background: 'var(--color-danger)', color: '#fff', marginTop: 10 }} onClick={() => {
                          useGameStore.getState().saveHistory();
                          const targetPlayer = players.find(p => p.id === victims[0]);
                          useGameStore.getState().eliminatePlayer(victims[0], 'vote');
                          useGameStore.getState().pushToJournal(`Le village s'est réuni au tribunal et a éliminé ${targetPlayer?.name} (${ROLE_BY_ID[targetPlayer?.roleId]?.name}).`, 'death');
                          setIsVoting(false);
                          setTribunalLocked(true);
                        }}>
                          🪓 Exécuter
                        </button>
                      </>
                    ) : (
                      <div style={{ marginTop: 10 }}>
                        <p>⚖️  Égalité entre {victims.map(v => players.find(p => p.id === v)?.name).join(', ')}.</p>
                        {captainAlive ? (
                          <div style={{ marginTop: 10, border: '1px dashed var(--color-gold)', padding: 10, borderRadius: 5 }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-gold)' }}>Le Capitaine doit trancher l'égalité :</p>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 5, justifyContent: 'center' }}>
                              {victims.map(vid => (
                                <button key={vid} className="header-btn" style={{ padding: '6px 12px', fontSize: '0.9rem' }} onClick={() => {
                                  useGameStore.getState().saveHistory();
                                  const targetPlayer = players.find(p => p.id === vid);
                                  eliminatePlayer(vid, 'vote');
                                  useGameStore.getState().pushToJournal(`Le Capitaine a tranché l'égalité : ${targetPlayer?.name} est condamné(e).`, 'death');
                                  setIsVoting(false);
                                  setTribunalLocked(true);
                                }}>
                                  Trancher pour {players.find(p => p.id === vid)?.name}
                                </button>
                              ))}
                            </div>
                            {captainAlive.isPlush && (
                              <button
                                className="header-btn"
                                style={{ marginTop: 15, background: 'var(--color-gold)', color: '#000', alignSelf: 'center' }}
                                onClick={() => {
                                  useGameStore.getState().saveHistory();
                                  const validVictims = victims.filter(v => v !== captainId);
                                  const rnd = validVictims.length > 0 ? pickRandom(validVictims) : pickRandom(victims); // Fallback improbable

                                  const targetPlayer = players.find(p => p.id === rnd);
                                  setHighlightedIds([rnd]);
                                  setTimeout(() => {
                                    setHighlightedIds([]);
                                    eliminatePlayer(rnd, 'vote');
                                    useGameStore.getState().pushToJournal(`⚖️  Égalité au vote : Le Capitaine IA (${captainAlive.name}) a tranché pour éliminer ${targetPlayer?.name}.`, 'death');
                                    setIsVoting(false);
                                    setTribunalLocked(true);
                                  }, 2000);
                                }}
                              >
                                🤖 IA Capitaine : Trancher l'égalité
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ marginTop: 10, textAlign: 'center' }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontStyle: 'italic', marginBottom: 10 }}>Aucun capitaine en vie pour trancher. Discutez et changez un vote humain, ou renoncez à exécuter.</p>
                            <button className="header-btn" onClick={handleNoExecution}>
                              ⚖️ Aucune exécution (village indécis)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}
    </>
  )
}
