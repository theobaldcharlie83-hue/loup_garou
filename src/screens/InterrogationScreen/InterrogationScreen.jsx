import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore, ROLE_BY_ID } from '../../store/useGameStore'
import { generateChoices, generatePlushieResponse } from '../../services/AiService'
import './InterrogationScreen.css'

const HAS_API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY &&
  import.meta.env.VITE_GEMINI_API_KEY !== 'your_gemini_api_key_here'

/* Trait de caractère généré via le nom pour la cohérence en cours de partie */
const PERSONALITIES = [
  "Peureux et timide",
  "Arrogant et fier",
  "Mystérieux et cryptique",
  "Naïf et extrêmement mignon",
  "Grognon et sarcastique"
]

export default function InterrogationScreen() {
  const navigate = useNavigate()
  const {
    players,
    dayNumber,
    activeInterrogationPlayerId,
    endInterrogation,
    addJournalEntry,
    trustGauge,
    setTrustGauge,
    unlockedClues,
    addUnlockedClue,
    hasWhiteWolfKilledWolf,
  } = useGameStore()

  const plush = players.find(p => p.id === activeInterrogationPlayerId)
  const role  = plush ? ROLE_BY_ID[plush.roleId] : null

  // Redirection d'urgence
  useEffect(() => {
    if (!plush) navigate('/dashboard')
  }, [plush, navigate])

  /* ── Détection Trahison Loup Blanc ── */
  useEffect(() => {
    if (!plush || !plush.isAlive || !plush.isPlush) return;
    
    // On veut savoir si c'est un loup "normal" face à un loup blanc tueur
    const alive = players.filter(p => p.isAlive);
    const getTeam = (p) => {
       if (p.isInfected) return 'loup';
       if (p.roleId === 'loup-blanc') return 'loup';
       return ROLE_BY_ID[p.roleId]?.team || 'village';
    };

    const wolves = alive.filter(p => getTeam(p) === 'loup');
    const hasLoupBlanc = wolves.some(w => w.roleId === 'loup-blanc');
    
    // Condition : 2 loups restants, un loup blanc qui a déjà tué, et la peluche est l'autre loup
    if (wolves.length === 2 && hasLoupBlanc && hasWhiteWolfKilledWolf && getTeam(plush) === 'loup' && plush.roleId !== 'loup-blanc') {
      if (trustGauge !== -1000) {
        setTrustGauge(-1000);
        // On pourrait aussi ajouter un indice ou un message journal
      }
    }
  }, [plush, players, hasWhiteWolfKilledWolf, trustGauge, setTrustGauge]);

  /* ── État de la Génération ── */
  const [choices, setChoices] = useState([])
  const [isGeneratingChoices, setIsGeneratingChoices] = useState(true)

  /* ── État de la Réponse ── */
  const [currentText, setCurrentText]   = useState('')
  const [isThinking,  setIsThinking]    = useState(false)
  const [pastReplies, setPastReplies]   = useState([])
  const [interrogationHistory, setInterrogationHistory] = useState([]) // Format AI : {q, a}
  const [interrogationStep, setInterrogationStep] = useState(1)
  const [error,       setError]         = useState(null)
  const historyEndRef = useRef(null)

  // Auto-scroll pour le mini journal d'interrogatoire
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [pastReplies])

  /* ── Variables de Contexte (State) ── */
  const deadPlayersList = players.filter(p => !p.isAlive).map(p => p.name).join(', ') || 'Aucun mort pour le moment'
  const currentDayLabel = `Jour ${dayNumber}`
  const plushPersonality = plush ? PERSONALITIES[plush.name.length % PERSONALITIES.length] : 'Neutre'

  /* ── INITIALISATION : Générer les Choices dynamiques ── */
  useEffect(() => {
    if (!plush) return
    async function initChoices() {
      setIsGeneratingChoices(true)
      const dynamicChoices = await generateChoices({
        dayNumber: currentDayLabel,
        deadPlayers: deadPlayersList,
        plushieName: plush.name
      })
      setChoices(dynamicChoices)
      setIsGeneratingChoices(false)
    }
    initChoices()
  }, [plush?.name, currentDayLabel, deadPlayersList])

  if (!plush || !role) return null

  /* ── ACTION : Cliquer sur un choix dynamique ── */
  const handleChoiceClick = async (choice) => {
    if (isThinking) return
    setError(null)
    setIsThinking(true)

    // Archiver pour scroll visuel
    if (currentText) {
      setPastReplies(prev => [...prev, currentText])
    }
    setCurrentText('')

    try {
      const result = await generatePlushieResponse({
        dayNumber: currentDayLabel,
        deadPlayers: deadPlayersList,
        plushieName: plush.name,
        plushiePersonality: plushPersonality,
        plushieSecretRole: role.name,
        selectedChoice: choice.text,
        history: interrogationHistory
      })

      setCurrentText(result.response)
      setInterrogationHistory(prev => [...prev, { q: choice.text, a: result.response }])

      addJournalEntry(
        `[Interrogatoire de ${plush.name}] Choix : "${choice.text}"`,
        'event',
      )

      // Étape suivante : Trust & Clues (Calculé par l'IA)
      if (result.trustScoreChange) {
        setTrustGauge(Math.max(0, Math.min(100, trustGauge + result.trustScoreChange)));
      }
      if (result.clue) {
        addUnlockedClue(result.clue);
        addJournalEntry(`[Indice] ${plush.name} a révélé : "${result.clue}"`, 'event');
      }

      setInterrogationStep(s => s + 1)
      if (interrogationStep < 3) {
        setChoices(result.nextChoices || [{ text: "Hmm...", confidenceImpact: 0 }])
      }

    } catch (err) {
      console.error('Erreur Gemini:', err)
      setError("La connexion avec la peluche a failli...")
    } finally {
      setIsThinking(false)
    }
  }

  const handleClose = () => {
    addJournalEntry(`L'interrogatoire de ${plush.name} est terminé.`, 'event')
    endInterrogation()
    navigate('/dashboard')
  }

  const actionColors = ['action-red', 'action-blue', 'action-green']
  const actionIcons  = ['🗡️', '🔍', '🤗']

  return (
    <div className="interrogation-screen" aria-label={`Interrogatoire de ${plush.name}`}>

      {/* ══ HEADER ══ */}
      <header className="intr-header">
        <button className="intr-header-back" onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>
        <h1 className="intr-header-title">🧸 Interrogatoire de {plush.name}</h1>
        <button className="intr-header-close" onClick={handleClose}>
          ✓ Clôturer
        </button>
      </header>

      {/* ══ CONTENU 2 COLONNES ══ */}
      <div className="intr-content">

        {/* ── Colonne Gauche : Avatar et Réponses ── */}
        <section className="intr-left">
          <div className="intr-avatar-wrap">
            <div className={`intr-avatar-ring ${trustGauge === -1000 ? 'terror-palsy' : ''}`}>
              🧸
              <div className="intr-avatar-plush-tag">🐾</div>
            </div>
            <div className="intr-avatar-name">{plush.name}</div>
          </div>

          {/* Jauge de Confiance */}
          <div className="intr-trust-wrap">
             <div className="intr-trust-label">
                <span>Niveau de Confiance</span>
                <span>{trustGauge === -1000 ? 'TERREUR ABSOLUE' : `${trustGauge}%`}</span>
             </div>
             <div className="intr-trust-bar-bg">
                <div 
                  className={`intr-trust-bar-fill ${trustGauge === -1000 ? 'terror-state' : ''}`} 
                  style={{ 
                    width: `${trustGauge === -1000 ? 100 : Math.max(0, trustGauge)}%`,
                    backgroundColor: trustGauge === -1000 ? '#ff0055' : (trustGauge > 70 ? '#4ade80' : trustGauge > 30 ? '#facc15' : '#ef4444')
                  }} 
                />
             </div>
          </div>

          <div className="intr-bubble-wrap">
            <div className="intr-bubble">
              {isThinking ? (
                <div className="intr-thinking">
                  <div className="thinking-dot" />
                  <div className="thinking-dot" />
                  <div className="thinking-dot" />
                </div>
              ) : currentText ? (
                <p className="intr-bubble-text" key={currentText}>
                  "{currentText}"
                </p>
              ) : (
                <p className="intr-bubble-placeholder">
                  {error
                    ? `⚠ ${error}`
                    : `Sélectionnez une option de dialogue. L'IA générera la réponse comportementale de ${plush.name}.`
                  }
                </p>
              )}
            </div>
          </div>

          {pastReplies.length > 0 && (
            <div className="intr-history">
              {pastReplies.map((text, i) => (
                <p key={i} className="intr-history-entry">"{text}"</p>
              ))}
              <div ref={historyEndRef} />
            </div>
          )}
        </section>

        {/* ── Colonne Droite : Choix Générés Dynamiquement ── */}
        <aside className="intr-right">
          <h2 className="intr-actions-title">Que souhaitez-vous lui dire ?</h2>
          <p className="intr-actions-subtitle" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Caractère : <strong>{plushPersonality.toLowerCase()}</strong></span>
            <span>Question {interrogationStep}/3</span>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            {isGeneratingChoices ? (
              <p className="intr-bubble-placeholder" style={{textAlign: 'center'}}>
                <em>L'Oracle analyse la situation et génère vos options...</em>
              </p>
            ) : interrogationStep > 3 ? (
              <div className="intr-demo-banner" style={{ textAlign: 'center', borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)' }}>
                <strong>Interrogatoire Terminé</strong>
                La peluche se mure dans le silence. Vous devez tirer vos propres conclusions et retourner au village.
              </div>
            ) : (
              choices.map((choice, idx) => (
                <button
                  key={idx}
                  className={`intr-action-btn ${actionColors[idx % 3]}`}
                  onClick={() => handleChoiceClick(choice)}
                  disabled={isThinking}
                >
                  <span className="intr-action-icon" aria-hidden="true">
                    {actionIcons[idx % 3]}
                    {choice.confidenceImpact !== undefined && (
                       <span className="intr-action-impact">
                         {choice.confidenceImpact > 0 ? `+${choice.confidenceImpact}` : choice.confidenceImpact}
                       </span>
                    )}
                  </span>
                  <span className="intr-action-label" style={{ fontSize: 'var(--text-body-md)', fontStyle: 'italic', fontWeight: '500' }}>
                    "{choice.text}"
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Section Indices */}
          <div className="intr-clues-box">
             <h3 className="intr-clues-title">📜 Indices récoltés</h3>
             {unlockedClues.length === 0 ? (
               <p className="intr-clues-empty">Aucun indice pour le moment...</p>
             ) : (
               <ul className="intr-clues-list">
                 {unlockedClues.map((clue, i) => (
                   <li key={i} className="intr-clue-item">✨ {clue}</li>
                 ))}
               </ul>
             )}
          </div>

          {!HAS_API_KEY && (
            <div className="intr-demo-banner" style={{ marginTop: 'auto' }}>
              <strong>⚠ Mode Démonstration</strong>
              La clé API Gemini est requise pour la génération dynamique réelle. Données locales affichées.
            </div>
          )}
        </aside>

      </div>
    </div>
  )
}
