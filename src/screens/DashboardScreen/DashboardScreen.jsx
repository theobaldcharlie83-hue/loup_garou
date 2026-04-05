import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore, ROLE_BY_ID } from '../../store/useGameStore'
import { generatePlushiesVotes } from '../../services/geminiService'
import { calculatePlushieVoteScores } from '../../services/scoringEngine'
import './DashboardScreen.css'

/* Classe CSS par équipe */
const TEAM_CLASS = {
  loup:      'av-loup',
  village:   'av-village',
  ambigu:    'av-ambigu',
  solitaire: 'av-solitaire',
}

/* Phase labels & icons */
const PHASE_META = {
  night:         { label: 'Phase de Nuit',    icon: '🌙' },
  day:           { label: 'Phase de Jour',     icon: '☀️' },
  interrogation: { label: 'Interrogatoire',    icon: 'ðŸ§¸' },
}

/* Ordre officiel de nuit — Best Of */
const NIGHT_ORDER = [
  // Nuit 1 seulement
  { id: 'cupidon',       isNight1Only: true,  label: 'Appeler Cupidon',              instruction: 'Il désigne les deux amoureux.' },
  { id: 'chien-loup',   isNight1Only: true,  label: 'Appeler le Chien-Loup',        instruction: 'Il choisit son camp : Villageois ou Loup-Garou.' },
  { id: 'enfant-sauvage', isNight1Only: true, label: 'Appeler l\'Enfant Sauvage',   instruction: 'Il désigne son modèle de rôle — il deviendra loup si ce joueur meurt.' },
  // Chaque nuit
  { id: 'voyante',       label: 'Appeler la Voyante',          instruction: 'Elle désigne un joueur pour voir sa carte.' },
  { id: 'renard',        label: 'Appeler le Renard',            instruction: 'Il analyse un groupe de 3 joueurs voisins. Indiquez-lui si un loup est présent.' },
  { id: 'loup-simple',  defaultGroup: true, label: 'Appeler les Loups-Garous',     instruction: 'Ils choisissent leur victime. Choix OBLIGATOIRE.' },
  { id: 'grand-mechant', label: 'Appeler le Grand-Méchant-Loup', instruction: 'Il peut désigner une 2ème victime seul (si aucun loup n\'est mort).' },
  { id: 'infect-pere',  label: 'Appeler l\'Infect Père des Loups', instruction: 'Il peut infecter la victime des loups.' },
  { id: 'loup-blanc',   label: 'Appeler le Loup Blanc',        instruction: 'Il peut (une nuit sur deux) éliminer un autre loup.' },
  { id: 'joueur-flute', label: 'Appeler le Joueur de FlÃ»te',   instruction: 'Il désigne deux nouveaux joueurs à charmer.' },
  { id: 'sorciere',     label: 'Appeler la Sorcière',          instruction: 'Montrez-lui la victime. Elle peut ressusciter ou empoisonner.' },
]

export default function DashboardScreen() {
  const navigate  = useNavigate()
  const {
    players, phase, dayNumber, journal,
    witchPotions, eliminatePlayer, setPhase,
    startInterrogation,
    lovers, commitLovers,
    nightActions, setNightAction,
    commitWolvesVictim, commitSeerObservation, commitWitchLife, commitWitchDeath,
    commitWildChildModel, commitGrandMechantVictim, commitWhiteWolfVictim,
    wakeUpVillage,
    infectUsed, commitInfection,
    seenBySeer, ancienLives, wildChildModelId,
    hasInterrogatedToday, setInterrogatedToday,
    dayVotes, setDayVotes,
    nightStepIndex, setNightStepIndex,
    activeNightSteps, setActiveNightSteps,
    winner, charmedIds, setCharmedIds,
    captainId, setCaptain, transferCaptaincy, successionPendingForId,
  } = useGameStore()

  const [selectedId, setSelectedId] = useState(null)
  const circleRef    = useRef(null)
  const journalEnd   = useRef(null)
  const [dims, setDims] = useState({ cx: 0, cy: 0, rx: 0, ry: 0 })

  const [nightSelection, setNightSelection] = useState([])
  const [isVoting, setIsVoting] = useState(false)
  const [isAiVotingLoading, setIsAiVotingLoading] = useState(false)
  const [chasseurPendingId, setChasseurPendingId] = useState(null)
  
  // ── Ã‰tape 1 & 2 : nouveaux states UI/UX ────────────────────â”€
  const [highlightedIds, setHighlightedIds]       = useState([])      // IDs momentanément mis en lumière
  const [isProcessingAction, setIsProcessingAction] = useState(false) // Debounce global pour les animations
  const [captainModal, setCaptainModal]           = useState(false)   // Modale "désignez un capitaine"
  const [interrogationModal, setInterrogationModal] = useState(null)  // Modale de confirmation interrogatoire
  const [tribunalLocked, setTribunalLocked]       = useState(false)   // Verrou post-exécution au Tribunal
  
  // Modal QA
  const [qaModalPlushId, setQaModalPlushId] = useState(null)

  const prevPlayersRef = useRef(players)

  /* Redirect si partie non démarrée */
  useEffect(() => {
    if (players.length === 0) navigate('/')
  }, [players.length, navigate])

  /* Calcul dynamique de l'ellipse */
  useEffect(() => {
    const compute = () => {
      if (!circleRef.current) return
      const { width, height } = circleRef.current.getBoundingClientRect()
      const pad = 60
      setDims({
        cx: width  / 2,
        cy: height / 2,
        rx: Math.max(40, width  / 2 - pad),
        ry: Math.max(40, height / 2 - pad - 16),
      })
    }
    compute()
    const ro = new ResizeObserver(compute)
    if (circleRef.current) ro.observe(circleRef.current)
    return () => ro.disconnect()
  }, [])

  /* Auto-scroll journal */
  useEffect(() => {
    journalEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [journal.length])

  // Détection automatique de la mort du Chasseur (Nuit ou Vote)
  useEffect(() => {
    const wasHunterAlive = prevPlayersRef.current.find(p => p.roleId === 'chasseur' && p.isAlive);
    const isHunterDead = players.find(p => p.roleId === 'chasseur' && !p.isAlive);

    if (wasHunterAlive && isHunterDead && !chasseurPendingId) {
      setChasseurPendingId(isHunterDead.id);
    }
    prevPlayersRef.current = players;
  }, [players, chasseurPendingId]);

  // Automatisation du tir du Chasseur si c'est un PNJ (Doudou)
  useEffect(() => {
    if (chasseurPendingId) {
      const hunter = players.find(p => p.id === chasseurPendingId);
      if (hunter && hunter.isPlush && !isProcessingAction) {
        setIsProcessingAction(true);
        setTimeout(() => {
          const targets = players.filter(p => p.isAlive);
          if (targets.length > 0) {
            // IA Simplifiée : Tire sur un non-loup ou random
            const rnd = targets[Math.floor(Math.random() * targets.length)];
            const rid = rnd.id;
            
            setHighlightedIds([rid]); // Highlight manuel ici
            setTimeout(() => {
               setHighlightedIds([]);
               eliminatePlayer(rid, 'hunter');
               useGameStore.getState().pushToJournal(`ðŸ¹ Le Chasseur IA (${hunter.name}) a tiré sur ${rnd.name} !`, 'death');
               setChasseurPendingId(null);
               setIsProcessingAction(false);
            }, 2000);
          } else {
            setChasseurPendingId(null);
            setIsProcessingAction(false);
          }
        }, 1500);
      }
    }
  }, [chasseurPendingId, players, isProcessingAction]);

  // Automatisation du Tie-break si le Capitaine est un PNJ
  useEffect(() => {
    if (phase === 'day' && isVoting && !tribunalLocked && !isProcessingAction) {
      const tally = {};
      Object.entries(dayVotes).forEach(([voterId, targetId]) => {
        if (targetId) {
          const weight = voterId === captainId ? 2 : 1;
          tally[targetId] = (tally[targetId] || 0) + weight;
        }
      });
      let max = 0, victims = [];
      Object.entries(tally).forEach(([id, count]) => {
        if (count > max) { max = count; victims = [id]; }
        else if (count === max) { victims.push(id); }
      });

      const captainAlive = players.find(p => p.id === captainId && p.isAlive);
      if (victims.length > 1 && captainAlive?.isPlush) {
        setIsProcessingAction(true);
        // IA décide après 3 secondes
        setTimeout(() => {
          const rnd = victims[Math.floor(Math.random() * victims.length)];
          const targetPlayer = players.find(p => p.id === rnd);
          setHighlightedIds([rnd]); 
          setTimeout(() => {
            setHighlightedIds([]);
            eliminatePlayer(rnd, 'vote');
            useGameStore.getState().pushToJournal(`âš–ï¸ Ã‰galité au vote : Le Capitaine IA (${captainAlive.name}) a tranché pour éliminer ${targetPlayer?.name}.`, 'death');
            setIsVoting(false);
            setTribunalLocked(true);
            setIsProcessingAction(false);
          }, 2000);
        }, 2000);
      }
    }
  }, [dayVotes, captainId, players, phase, isVoting, tribunalLocked, isProcessingAction]);

  /* Calcul des étapes de la nuit */
  useEffect(() => {
    if (phase === 'night' && nightStepIndex === -1) {
      const activeRoles = new Set(players.filter(p => p.isAlive).map(p => p.roleId))
      const hasWolves = players.some(p => p.isAlive && ['loup', 'solitaire'].includes(ROLE_BY_ID[p.roleId]?.team) && p.roleId !== 'joueur-flute' && p.roleId !== 'ange')
      const loupsBlancs = players.filter(p => p.isAlive && p.roleId === 'loup-blanc')
      const otherWolves = players.filter(p => p.isAlive && ROLE_BY_ID[p.roleId]?.team === 'loup' && p.roleId !== 'loup-blanc')
      const steps = NIGHT_ORDER.filter(step => {
        if (step.id === 'cupidon' && lovers.length > 0) return false
        if (step.isNight1Only && dayNumber !== 1) return false
        if (step.defaultGroup && hasWolves) return true
        if (step.id === 'grand-mechant') return activeRoles.has('grand-mechant') && otherWolves.length > 0  // Actif si aucun loup n'est mort
        if (step.id === 'loup-blanc') return loupsBlancs.length > 0 && otherWolves.length > 0 && dayNumber % 2 === 0  // Une nuit sur deux
        if (step.id === 'infect-pere') return activeRoles.has('infect-pere') && !infectUsed
        if (activeRoles.has(step.id)) return true
        return false
      })
      
      steps.push({ id: 'fin-nuit', isEnd: true, label: 'Le Soleil se Lève', instruction: 'Les actions de la nuit sont réglées. Cliquez ci-dessous pour annoncer les événements.' })
      
      setActiveNightSteps(steps)
      setNightStepIndex(0)
    } else if (phase !== 'night') {
      // Nettoyage si on quitte la nuit
      if (nightStepIndex !== -1) {
        setNightStepIndex(-1)
        setActiveNightSteps([])
      }
      setNightSelection([])
    }
  }, [phase, dayNumber]) // Réduit les dépendances pour éviter le reset mid-nuit

  /* Variables d'état utilitaires */
  const selectedPlayer  = players.find(p => p.id === selectedId)
  const currentStepInfo = phase === 'night' && nightStepIndex >= 0 && nightStepIndex < activeNightSteps.length ? activeNightSteps[nightStepIndex] : null
  const currentNightStepId = currentStepInfo?.id

  /* Drag & Drop logic */
  const { swapPlayers } = useGameStore()
  const handleDragStart = (e, pid) => {
    e.dataTransfer.setData('text/plain', pid)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const handleDrop = (e, targetPid) => {
    e.preventDefault()
    const sourcePid = e.dataTransfer.getData('text/plain')
    if (sourcePid && sourcePid !== targetPid) {
      swapPlayers(sourcePid, targetPid)
    }
  }

  const alive           = players.filter(p => p.isAlive)
  const wolves          = alive.filter(p => ['loup','solitaire'].includes(ROLE_BY_ID[p.roleId]?.team))
  const witchInGame     = players.some(p => p.roleId === 'sorciere')

  /* Handlers */
  const handleAvatar = (player) => {
    // Si c'est le jour, seul les vivants sont sélectionnables
    if (phase === 'day' && !player.isAlive) return
    // Si c'est la nuit, la sorcière et l'Infect peuvent cibler un personnage "récemment mort"
    if (phase === 'night' && !player.isAlive) {
       // Only allow interaction with dead if it's Sorciere or Infect with victims
       const isVictim = (nightActions.wolvesVictim === player.id) || (nightActions.witchKilled === player.id)
       if (!isVictim) return 
    }

    setSelectedId(prev => prev === player.id ? null : player.id)
  }
  
  const handlePhaseToggle = () => {
    setSelectedId(null)
    if (phase === 'preparation') {
      if (!captainId) {
        setCaptainModal(true)  // Remplace alert() — modale custom thème Grimoire
        return;
      }
      useGameStore.getState().pushToJournal("Début de la Nuit 1. Le village s'endort pour la première fois.", 'phase')
      setPhase('night')
      return;
    }
    if (phase === 'night') {
      wakeUpVillage()
    } else {
      setIsVoting(false)
      setTribunalLocked(false)  // reset du verrou au passage à la nuit
      setPhase('night')
    }
  }

  const handleEliminate = (pid) => {
    const p = players.find(x => x.id === pid)
    eliminatePlayer(pid, 'vote') // Ã‰limination directe/MJ considérée comme 'vote'
    setSelectedId(null)
    // Si c'est un chasseur vivant => déclencher son pouvoir
    if (p?.roleId === 'chasseur' && p?.isAlive) {
      setChasseurPendingId(pid)
    }
  }
  const handleInterrogate = (player) => { startInterrogation(player.id); navigate('/interrogation') }
  const handleReset = () => { useGameStore.getState().resetGame(); navigate('/') }

  /* ── Highlight aléatoire ──────────────────────────────â”€ */
  const triggerHighlight = (ids) => {
    setIsProcessingAction(true)
    setHighlightedIds(ids)
    setTimeout(() => {
      setHighlightedIds([])
      setIsProcessingAction(false)
    }, 2500)
  }

  // ── Handlers NUIT (Boutons Contextuels) ──────────────
  const handleNightActionSelect = (actionType) => {
    if (!selectedPlayer) return

    if (currentNightStepId === 'cupidon') {
      setNightSelection(prev => {
        const has = prev.includes(selectedPlayer.id)
        if (has) return prev.filter(x => x !== selectedPlayer.id)
        if (prev.length >= 2) return prev
        return [...prev, selectedPlayer.id]
      })
    } else if (currentNightStepId === 'voyante') {
      commitSeerObservation(selectedPlayer.id)
      setNightSelection([selectedPlayer.id])
    } else if (currentNightStepId === 'loup-simple') {
      commitWolvesVictim(selectedPlayer.id)
      setNightSelection([selectedPlayer.id])
    } else if (currentNightStepId === 'grand-mechant') {
      commitGrandMechantVictim(selectedPlayer.id)
      setNightSelection([selectedPlayer.id])
    } else if (currentNightStepId === 'loup-blanc') {
      commitWhiteWolfVictim(selectedPlayer.id)
      setNightSelection([selectedPlayer.id])
    } else if (currentNightStepId === 'enfant-sauvage') {
      commitWildChildModel(selectedPlayer.id)
      setNightSelection([selectedPlayer.id])
    } else if (currentNightStepId === 'sorciere') {
      if (actionType === 'life' && witchPotions.life) {
         commitWitchLife(nightActions.wolvesVictim)
      } else if (actionType === 'death' && witchPotions.death) {
         commitWitchDeath(selectedPlayer.id)
      }
    } else if (currentNightStepId === 'infect-pere') {
      commitInfection(selectedPlayer.id)
      setNightSelection([selectedPlayer.id])
    } else if (currentNightStepId === 'joueur-flute') {
      setNightSelection(prev => {
        if (prev.includes(selectedPlayer.id)) return prev.filter(x => x !== selectedPlayer.id)
        if (prev.length >= 2) return prev
        return [...prev, selectedPlayer.id]
      })
    } else if (currentNightStepId === 'chien-loup') {
      useGameStore.getState().setChienLoupSide(actionType);
      setNightSelection(['done']);
    } else if (currentNightStepId === 'renard') {
      setNightSelection([selectedPlayer.id]) // Le MJ cible un joueur central
    }

    setSelectedId(null)
  }

  const advanceNightPhase = () => {
    const { pushToJournal } = useGameStore.getState();

    if (currentNightStepId === 'cupidon') {
      if (nightSelection.length === 2) {
        commitLovers(nightSelection[0], nightSelection[1]);
        const p1 = players.find(x => x.id === nightSelection[0]);
        const p2 = players.find(x => x.id === nightSelection[1]);
        pushToJournal(`Cupidon a formé un couple : ${p1?.name} & ${p2?.name}.`);
        setNightSelection([]);
        setNightStepIndex(idx => idx + 1);
      }
    } else {
      if (currentNightStepId === 'voyante' && nightActions.seerSeen) {
        const p = players.find(x => x.id === nightActions.seerSeen);
        const roleName = ROLE_BY_ID[p?.roleId]?.name;
        pushToJournal(`La Voyante a espionné le rôle de ${p?.name} (${roleName}).`);
      } else if (currentNightStepId === 'loup-simple' && nightActions.wolvesVictim) {
        const p = players.find(x => x.id === nightActions.wolvesVictim);
        pushToJournal(`Les Loups ont jeté leur dévolu sur ${p?.name} cette nuit.`);
      } else if (currentNightStepId === 'grand-mechant' && nightActions.grandMechantVictim) {
        const p = players.find(x => x.id === nightActions.grandMechantVictim);
        pushToJournal(`Le Grand-Méchant-Loup a choisi une deuxième victime : ${p?.name}.`);
      } else if (currentNightStepId === 'loup-blanc' && nightActions.whiteWolfVictim) {
        const p = players.find(x => x.id === nightActions.whiteWolfVictim);
        pushToJournal(`Le Loup Blanc a ciblé un membre de sa propre meute : ${p?.name}.`);
      } else if (currentNightStepId === 'enfant-sauvage' && wildChildModelId) {
        const p = players.find(x => x.id === wildChildModelId);
        pushToJournal(`L'Enfant Sauvage a choisi son modèle : ${p?.name}.`);
      } else if (currentNightStepId === 'sorciere') {
        if (nightActions.witchHealed) {
          const p = players.find(x => x.id === nightActions.wolvesVictim);
          pushToJournal(`La Sorcière a utilisé sa potion de vie pour sauver ${p?.name}.`);
        }
        if (nightActions.witchKilled) {
          const p = players.find(x => x.id === nightActions.witchKilled);
          pushToJournal(`La Sorcière a empoisonné ${p?.name}.`);
        }
      } else if (currentNightStepId === 'infect-pere' && nightActions.infectedTargetId) {
        const p = players.find(x => x.id === nightActions.infectedTargetId);
        pushToJournal(`Le Père des Loups a secrètement administré son sang à ${p?.name}.`);
      } else if (currentNightStepId === 'joueur-flute' && nightSelection.length > 0) {
        const newCharmed = [...charmedIds]
        nightSelection.forEach(id => { if(!newCharmed.includes(id)) newCharmed.push(id) })
        setCharmedIds(newCharmed)
        pushToJournal(`Le Joueur de FlÃ»te a charmé de nouvelles victimes...`)
        useGameStore.getState().checkGameOver()
      } else if (currentNightStepId === 'chien-loup' && nightSelection.length > 0) {
        const side = useGameStore.getState().chienLoupSide;
        pushToJournal(`Le Chien-Loup a choisi son camp : ${side === 'loup' ? 'Loups-Garous' : 'Villageois'}.`);
      }

      setNightSelection([]);
      setNightStepIndex(idx => idx + 1);
    }
  }

  const handlePlushiesVote = async () => {
    setIsAiVotingLoading(true);
    const alivePlushies = alive.filter(p => p.isPlush);
    const storeState = useGameStore.getState();
    
    // 1) Calcul de la matrice absolue (QA Scoring Data) pour chaque peluche
    const scoringDataCurrent = {};
    alivePlushies.forEach(p => {
       scoringDataCurrent[p.id] = calculatePlushieVoteScores(p, alive, storeState);
    });
    storeState.setQAScoringData(scoringDataCurrent);

    // 2) Génération Textuelle & IA
    const aiVotes = await generatePlushiesVotes({
       plushiesToVote: alivePlushies.map(p => ({ ...p, roleName: ROLE_BY_ID[p.roleId]?.name })),
       allPlayers: alive,
       journalHistory: storeState.journal,
       qaScoringData: scoringDataCurrent
    });
    
    // 3) Enregistrement des intentions de vote
    const newVotes = { ...storeState.dayVotes };
    aiVotes.forEach(v => {
       if (v.voteForId) newVotes[v.plushId] = v.voteForId;
    });
    storeState.setDayVotes(newVotes);
    setIsAiVotingLoading(false);
  }

  const pm = PHASE_META[phase] ?? PHASE_META.night

  return (
    <div className={`dashboard-screen phase-${phase}`} aria-label="Tableau de bord">

      {/* â•â• HEADER â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <header className="dashboard-header">
        <span className="header-title">âœ¦ Le Grimoire</span>

        <div className="header-phase-badge" role="status" aria-live="polite">
          <span aria-hidden="true">{pm.icon}</span>{pm.label}
        </div>

        <span className="header-day">Jour&nbsp;{dayNumber}</span>
        <div className="header-spacer" />

        <div className="header-actions">
          {phase !== 'interrogation' && phase !== 'preparation' && (
            <>
              {phase === 'day' && (
                <button
                  id="btn-phase-toggle"
                  className="header-btn primary-action"
                  onClick={handlePhaseToggle}
                >
                  <span aria-hidden="true">🌙</span> Endormir le Village
                </button>
              )}
            </>
          )}
          <button id="btn-reset" className="header-btn" onClick={handleReset}>
            â†© Reconfigurer
          </button>
        </div>
      </header>

      {/* â•â• 3 COLONNES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•== */}
      <div className="dashboard-content">

        {/* ── Gauche : Le Grimoire ──────────────────────────── */}
        <aside className="dashboard-sidebar left" aria-label="Grimoire">

          {/* Stats */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">ðŸ“Š Situation</div>
            <div className="stats-row">
              <span className="stats-label">En vie</span>
              <span className="stats-value alive">{alive.length}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">Ã‰liminés</span>
              <span className="stats-value">{players.length - alive.length}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">Loups actifs</span>
              <span className="stats-value wolf">{wolves.length}</span>
            </div>
          </div>

          {/* Sorcière */}
          {witchInGame && phase === 'day' && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">ðŸ§ª Sorcière — Potions de Jour</div>
              <p style={{fontSize:'0.75rem', opacity: 0.6}}>Géré via action contextuelle la nuit.</p>
              <div className={`potion-item${!witchPotions.life ? ' used' : ''}`}>
                <span className="potion-icon">ðŸ’Š</span>
                <span className="potion-label">Potion de Vie</span>
                {witchPotions.life
                  ? <span className="potion-used-tag">Active</span>
                  : <span className="potion-used-tag">Ã‰puisée</span>
                }
              </div>

              <div className={`potion-item${!witchPotions.death ? ' used' : ''}`}>
                <span className="potion-icon">☠️</span>
                <span className="potion-label">Potion de Mort</span>
                {witchPotions.death
                  ? <span className="potion-used-tag">Active</span>
                  : <span className="potion-used-tag">Ã‰puisée</span>
                }
              </div>
            </div>
          )}

          {/* Rôles */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">ðŸ“‹ Joueurs &amp; Rôles</div>
            {players.map(p => {
              const role = ROLE_BY_ID[p.roleId]
              return (
                <div key={p.id} className={`role-list-item${!p.isAlive ? ' dead' : ''}`}>
                  <span className="role-list-name">
                    {p.isPlush && <span aria-hidden="true">ðŸ¾</span>}
                    {p.name}
                  </span>
                  <span className="role-list-role">{role?.icon} {role?.name ?? '?'}</span>
                </div>
              )
            })}
          </div>
        </aside>

        {/* ── Centre : Cercle des Joueurs ───────────────────── */}
        <main ref={circleRef} className="player-circle-zone" aria-label="Cercle des joueurs">

          {/* Guide SVG ellipse */}
          {dims.rx > 0 && (
            <svg className="ellipse-svg" aria-hidden="true">
              <ellipse
                cx={dims.cx} cy={dims.cy}
                rx={dims.rx} ry={dims.ry}
                fill="none"
                stroke="rgba(71,70,78,0.18)"
                strokeWidth="1"
                strokeDasharray="5 9"
              />
            </svg>
          )}

          {/* Avatars positionnés sur l'ellipse */}
          {dims.rx > 0 && players.map((player, idx) => {
            const angle = (2 * Math.PI / players.length) * idx - Math.PI / 2
            const left  = dims.cx + dims.rx * Math.cos(angle)
            const top   = dims.cy + dims.ry * Math.sin(angle)
            const role  = ROLE_BY_ID[player.roleId]
            const tc    = TEAM_CLASS[role?.team] ?? 'av-village'
            const isSel = selectedId === player.id

            // Visual feedback contextuel (Nuit)
            const isNightTarget = nightSelection.includes(player.id)
            const isWolvesTarget = nightActions.wolvesVictim === player.id
            const isLover = lovers.includes(player.id)
            const isInfected = player.isInfected || (nightActions.infectedTargetId === player.id)
            const isWildChildModel = player.id === wildChildModelId
            const isRandomHighlighted = highlightedIds.includes(player.id)

            return (
              <div
                key={player.id}
                className={`player-avatar${!player.isAlive ? ' dead' : ''}${isSel ? ' selected' : ''}${isWolvesTarget ? ' target-wolves' : (isNightTarget ? ' target' : '')}${isRandomHighlighted ? ' random-highlight' : ''}`}
                style={{ left, top }}
                onClick={() => handleAvatar(player)}
                draggable
                onDragStart={(e) => handleDragStart(e, player.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, player.id)}
                role="button"
                tabIndex={player.isAlive ? 0 : -1}
                aria-pressed={isSel}
                aria-label={`${player.name}${player.isPlush ? ' (peluche)' : ''}, ${role?.name ?? '?'}${!player.isAlive ? ', éliminé' : ''}`}
                onKeyDown={e => e.key === 'Enter' && handleAvatar(player)}
              >
                <div className={`avatar-circle ${tc}`}>
                  {isWildChildModel && <div className="av-wildchild-badge" title="Modèle de l'Enfant Sauvage" aria-hidden="true">ðŸŒ¿</div>}
                  <span aria-hidden="true">{role?.icon ?? 'â“'}</span>
                  {player.isPlush && <span className="av-plush-badge" aria-hidden="true">ðŸ¾</span>}
                  
                  {nightActions.wolvesVictim === player.id && <div className="av-temp-badge" aria-hidden="true">ðŸ’€</div>}
                  {nightActions.witchHealed && nightActions.wolvesVictim === player.id && <div className="av-temp-badge" style={{top: -65}} aria-hidden="true">ðŸ’–</div>}
                  {nightActions.witchKilled === player.id && <div className="av-temp-badge" aria-hidden="true">☠️</div>}

                  {!player.isAlive && <div className="av-dead-overlay" aria-hidden="true">ðŸ’€</div>}
                </div>
                <div className="av-name">{player.name}</div>
                <div className="av-role">
                  {player.roleId === 'ancien' && ancienLives > 0 ? `Ancien (ðŸ›¡ï¸${ancienLives})` : (role?.name ?? '?')}
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

          {phase === 'preparation' && (
            <div className="night-step-card end-night">
              <h3>Répartition et Vérification</h3>
              <p style={{marginBottom: 20}}>Cliquez sur un humain pour intervertir secrètement son rôle. Quand tout est prêt, lancez la partie !</p>
              <button className="header-btn primary-action" style={{ alignSelf: 'center', fontSize: '1.2rem', padding: '12px 24px' }} onClick={handlePhaseToggle}>
                <span aria-hidden="true">☀️</span> Lancer la Partie (Nuit 1)
              </button>
            </div>
          )}

          {phase === 'night' && currentStepInfo && (
            <div className={`night-step-card ${currentStepInfo.isEnd ? 'end-night' : ''}`}>
              <h3>{currentStepInfo.label}</h3>
              <p>{currentStepInfo.instruction}</p>
              
              {!currentStepInfo.isEnd ? (
                <>
                  {/* ── Cupidon IA ── */}
                  {currentStepInfo.id === 'cupidon' && players.find(p => p.roleId === 'cupidon' && p.isAlive)?.isPlush && nightSelection.length < 2 && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const shuffled = [...alive].sort(() => Math.random() - 0.5);
                        if(shuffled.length >= 2) {
                          const picks = [shuffled[0].id, shuffled[1].id];
                          setNightSelection(picks);
                          triggerHighlight(picks);
                        }
                    }}>ðŸŽ² Cupidon IA</button>
                  )}

                  {/* ── Chien-Loup IA ── */}
                  {currentStepInfo.id === 'chien-loup' && players.find(p => p.roleId === 'chien-loup' && p.isAlive)?.isPlush && nightSelection.length === 0 && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const side = Math.random() < 0.5 ? 'village' : 'loup';
                        useGameStore.getState().setChienLoupSide(side);
                        setNightSelection(['done']);
                    }}>ðŸŽ² Chien-Loup IA</button>
                  )}

                  {/* ── Enfant Sauvage IA ── */}
                  {currentStepInfo.id === 'enfant-sauvage' && players.find(p => p.roleId === 'enfant-sauvage' && p.isAlive)?.isPlush && !wildChildModelId && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const valids = alive.filter(p => p.roleId !== 'enfant-sauvage' && ROLE_BY_ID[p.roleId]?.team !== 'loup');
                        if(valids.length > 0) {
                          const rnd = valids[Math.floor(Math.random() * valids.length)];
                          commitWildChildModel(rnd.id);
                          setNightSelection([rnd.id]);
                          triggerHighlight([rnd.id]);
                        }
                    }}>ðŸŽ² Enfant Sauvage IA</button>
                  )}

                  {/* ── Voyante IA ── */}
                  {currentStepInfo.id === 'voyante' && players.find(p => p.roleId === 'voyante' && p.isAlive)?.isPlush && !nightActions.seerSeen && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const valids = alive.filter(p => p.roleId !== 'voyante' && !seenBySeer.includes(p.id));
                        if(valids.length > 0) {
                          const rnd = valids[Math.floor(Math.random() * valids.length)];
                          useGameStore.getState().commitSeerObservation(rnd.id);
                          setNightSelection([rnd.id]);
                          triggerHighlight([rnd.id]);
                        } else {
                          advanceNightPhase();
                        }
                    }}>ðŸŽ² Voyante IA</button>
                  )}

                  {/* ── Renard IA ── */}
                  {currentStepInfo.id === 'renard' && players.find(p => p.roleId === 'renard' && p.isAlive)?.isPlush && nightSelection.length === 0 && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const valids = alive.filter(p => p.roleId !== 'renard');
                        if(valids.length > 0) {
                          const rnd = valids[Math.floor(Math.random() * valids.length)];
                          setNightSelection([rnd.id]);
                        }
                    }}>ðŸŽ² Renard IA (Groupe analysé)</button>
                  )}

                  {/* ── Loups IA ── */}
                  {currentStepInfo.id === 'loup-simple' && wolves.every(w => w.isPlush) && !nightActions.wolvesVictim && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const valids = alive.filter(p => !['loup','solitaire'].includes(ROLE_BY_ID[p.roleId]?.team));
                        if(valids.length > 0) {
                          const rnd = valids[Math.floor(Math.random() * valids.length)];
                          useGameStore.getState().commitWolvesVictim(rnd.id);
                          setNightSelection([rnd.id]);
                          triggerHighlight([rnd.id]);
                        }
                    }}>ðŸŽ² Loups IA (Victime Aléatoire)</button>
                  )}

                  {/* ── Grand-Méchant-Loup IA ── */}
                  {currentStepInfo.id === 'grand-mechant' && players.find(p => p.roleId === 'grand-mechant' && p.isAlive)?.isPlush && !nightActions.grandMechantVictim && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const valids = alive.filter(p => !['loup','solitaire'].includes(ROLE_BY_ID[p.roleId]?.team) && p.id !== nightActions.wolvesVictim);
                        if(valids.length > 0) {
                          const rnd = valids[Math.floor(Math.random() * valids.length)];
                          commitGrandMechantVictim(rnd.id);
                          setNightSelection([rnd.id]);
                          triggerHighlight([rnd.id]);
                        }
                    }}>ðŸŽ² Grand-Méchant-Loup IA</button>
                  )}

                  {/* ── Infect Père IA ── */}
                  {currentStepInfo.id === 'infect-pere' && players.find(p => p.roleId === 'infect-pere' && p.isAlive)?.isPlush && !infectUsed && nightActions.wolvesVictim && (
                    <button className="header-btn" disabled={isProcessingAction} style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        // Retrait probabilité : l'Infect PNJ infecte toujours sa cible prioritaire
                        commitInfection(nightActions.wolvesVictim);
                        setNightSelection([nightActions.wolvesVictim]);
                        triggerHighlight([nightActions.wolvesVictim]);
                    }}>ðŸŽ² Infect Père IA (Infection systématique)</button>
                  )}

                  {/* ── Loup Blanc IA ── */}
                  {currentStepInfo.id === 'loup-blanc' && players.find(p => p.roleId === 'loup-blanc' && p.isAlive)?.isPlush && !nightActions.whiteWolfVictim && (
                    <button className="header-btn" disabled={isProcessingAction} style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const otherWolves = alive.filter(p => ROLE_BY_ID[p.roleId]?.team === 'loup' && p.roleId !== 'loup-blanc');
                        if(otherWolves.length > 0) {
                          const rnd = otherWolves[Math.floor(Math.random() * otherWolves.length)];
                          commitWhiteWolfVictim(rnd.id);
                          setNightSelection([rnd.id]);
                          triggerHighlight([rnd.id]);
                        } else { 
                          advanceNightPhase(); 
                        }
                    }}>ðŸŽ² Loup Blanc IA (Ã‰limine un Loup)</button>
                  )}

                  {/* ── Joueur de FlÃ»te IA ── */}
                  {currentStepInfo.id === 'joueur-flute' && players.find(p => p.roleId === 'joueur-flute' && p.isAlive)?.isPlush && nightSelection.length < 2 && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const valids = alive.filter(p => p.roleId !== 'joueur-flute' && !charmedIds.includes(p.id));
                        if(valids.length > 0) {
                          const shuffled = [...valids].sort(() => Math.random() - 0.5);
                          const picks = shuffled.slice(0, Math.min(2, shuffled.length));
                          const ids = picks.map(p => p.id);
                          setNightSelection(ids);
                          triggerHighlight(ids);
                        }
                    }}>ðŸŽ² FlÃ»tiste IA (Charmer 2 joueurs)</button>
                  )}

                  {/* ── Sorcière IA ── */}
                  {currentStepInfo.id === 'sorciere' && players.find(p => p.roleId === 'sorciere' && p.isAlive)?.isPlush && (witchPotions.life || witchPotions.death) && (
                    <button className="header-btn" disabled={isProcessingAction} style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        // IA Stratégique : Sauve systématiquement si c'est un villageois
                        if(witchPotions.life && nightActions.wolvesVictim) {
                          const victim = players.find(p => p.id === nightActions.wolvesVictim);
                          if (ROLE_BY_ID[victim?.roleId]?.team === 'village') {
                            commitWitchLife(nightActions.wolvesVictim);
                            triggerHighlight([nightActions.wolvesVictim]);
                          }
                        }
                        // Potion de mort : Toujours 33% car c'est risqué, mais sans le double random imbriqué
                        if(witchPotions.death && !nightActions.witchKilled && Math.random() < 0.33) {
                          const valids = alive.filter(p => !['loup', 'solitaire'].includes(ROLE_BY_ID[p.roleId]?.team) === false); // Cible les non-villageois suspectés
                          const targets = valids.length > 0 ? valids : alive.filter(p => p.roleId !== 'sorciere');
                          const rnd = targets[Math.floor(Math.random() * targets.length)];
                          commitWitchDeath(rnd.id);
                          triggerHighlight([rnd.id]);
                        }
                    }}>ðŸŽ² Sorcière IA (Sauvetage Stratégique)</button>
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
                    {currentStepInfo.id === 'cupidon' && nightSelection.length === 2 ? 'â¤ï¸ Valider le couple' 
                      : currentStepInfo.id === 'joueur-flute' ? 'ðŸŽ¶ Charmer les joueurs'
                      : currentStepInfo.id === 'enfant-sauvage' ? 'ðŸŒ¿ Valider le Modèle'
                      : 'Passer à la suite'}
                  </button>
                </>
              ) : (
                <button
                  className="header-btn primary-action override-wake-btn"
                  onClick={handlePhaseToggle}
                >
                  <span aria-hidden="true">☀️</span> Réveiller le Village
                </button>
              )}
            </div>
          )}

          {phase === 'day' && !isVoting && !tribunalLocked && (
            <div className="night-step-card end-night">
              <h3>Phase de Jour ☀️</h3>
              <p>Ã‰coutez les plaidoyers, interrogez UNE SEULE peluche pour récolter des indices, puis préparez-vous au Tribunal.</p>
              <button className="header-btn" style={{marginTop: 15, alignSelf: 'center'}} onClick={() => setIsVoting(true)}>
                âš–ï¸ Ouvrir le Tribunal du Village
              </button>
            </div>
          )}

          {/* ── Tribunal Verrouillé ──────────────────────────── */}
          {phase === 'day' && tribunalLocked && (
            <div className="tribunal-locked-panel">
              <div style={{fontSize: '2.5rem'}}>ðŸª“</div>
              <h3>Sentence prononcée</h3>
              <p>Le village a rendu son verdict. La nuit tombe sur le Grimoire...</p>
              <button
                className="header-btn primary-action"
                style={{marginTop: 8, fontSize: '1rem', padding: '10px 22px'}}
                onClick={handlePhaseToggle}
              >
                🌙 Endormir le Village
              </button>
            </div>
          )}

          {phase === 'day' && isVoting && !tribunalLocked && (
             <div className="night-step-card end-night" style={{width: 500, maxHeight: '60vh', overflowY: 'auto'}}>
                <h3>Tribunal du Village âš–ï¸</h3>
                <p style={{marginBottom: 10}}>Récoltez les votes puis laissez les peluches juger.</p>
                
                <div style={{display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginBottom: 15}}>
                  {alive.filter(p => !p.isPlush).map(human => (
                     <div key={human.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                       <span style={{fontWeight:'bold'}}>{human.name} vote :</span>
                       <select 
                         className="setup-input"
                         style={{padding: '5px', width: 150}}
                         value={dayVotes[human.id] || ''}
                         onChange={(e) => useGameStore.getState().setDayVotes({...dayVotes, [human.id]: e.target.value})}
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
                   {isAiVotingLoading ? 'ðŸ¤– Calcul des probabilités...' : 'ðŸ¤– IA : Faire Voter les Doudous'}
                </button>

                {Object.keys(dayVotes).length > 0 && (
                  <div style={{width: '100%', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8}}>
                     <h4 style={{margin: '0 0 10px 0'}}>Urne actuelle :</h4>
                     <ul style={{margin: 0, padding: '0 20px', fontSize: '0.9rem', color: '#ccc'}}>
                       {Object.entries(dayVotes).map(([voterId, targetId]) => {
                          const v = players.find(p=>p.id===voterId);
                          const t = players.find(p=>p.id===targetId);
                          return (
                            <li key={voterId} style={{display:'flex', alignItems:'center', gap: 5}}>
                              {v?.name} {t ? `élimine ${t.name}` : `ne vote pas`}
                              {v?.isPlush && useGameStore.getState().qaScoringData[voterId] && (
                                 <button style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem'}} onClick={() => setQaModalPlushId(v.id)} title="Audit de vote">ðŸ“Š</button>
                              )}
                            </li>
                          )
                       })}
                     </ul>

                     {(() => {
                        const tally = {};
                        Object.entries(dayVotes).forEach(([voterId, targetId]) => {
                           if (targetId) {
                              const weight = voterId === captainId ? 2 : 1;
                              tally[targetId] = (tally[targetId] || 0) + weight;
                           }
                        });
                        let max = 0, victims = [];
                        Object.entries(tally).forEach(([id, count]) => {
                           if (count > max) { max = count; victims = [id]; }
                           else if (count === max) { victims.push(id); }
                        });
                        if (max === 0) return null;

                        const captainAlive = players.find(p => p.id === captainId && p.isAlive);
                        
                        return (
                          <div style={{marginTop: 15, padding: 10, background: '#2d0a0a', border: '1px solid #ff4d4d', borderRadius: 8}}>
                            <h4 style={{color: '#ff4d4d', margin: '0 0 10px 0'}}>Issue du Vote :</h4>
                            {victims.length === 1 ? (
                              <>
                                <p><strong>{players.find(p=>p.id===victims[0])?.name}</strong> est condamné(e) avec {max} voix.</p>
                                <button className="header-btn" style={{background: '#ff4d4d', color: '#fff', marginTop: 10}} onClick={() => {
                                   const targetPlayer = players.find(p=>p.id===victims[0]);
                                   useGameStore.getState().eliminatePlayer(victims[0], 'vote');
                                   useGameStore.getState().pushToJournal(`Le village s'est réuni au tribunal et a éliminé ${targetPlayer?.name} (${ROLE_BY_ID[targetPlayer?.roleId]?.name}).`, 'death');
                                   setIsVoting(false);
                                   setTribunalLocked(true); // â† Verrouillage du Tribunal
                                }}>
                                   ðŸª“ Exécuter
                                </button>
                              </>
                            ) : (
                              <div style={{marginTop: 10}}>
                                <p>âš–ï¸ Ã‰galité entre {victims.map(v => players.find(p=>p.id===v)?.name).join(', ')}.</p>
                                {captainAlive ? (
                                  <div style={{marginTop: 10, border: '1px dashed #ffd700', padding: 10, borderRadius: 5}}>
                                     <p style={{fontSize: '0.8rem', color: '#ffd700'}}>Le Capitaine doit trancher l'égalité :</p>
                                     <div style={{display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5}}>
                                        {victims.map(vid => (
                                          <button key={vid} className="header-btn" style={{padding: '4px 8px', fontSize: '0.8rem'}} onClick={() => {
                                             const targetPlayer = players.find(p=>p.id===vid);
                                             eliminatePlayer(vid, 'vote');
                                             useGameStore.getState().pushToJournal(`Le Capitaine a tranché l'égalité : ${targetPlayer?.name} est condamné(e).`, 'death');
                                             setIsVoting(false);
                                             setTribunalLocked(true); // â† Verrouillage du Tribunal
                                          }}>
                                             Trancher pour {players.find(p=>p.id===vid)?.name}
                                          </button>
                                        ))}
                                     </div>
                                  </div>
                                ) : (
                                  <p style={{fontSize: '0.8rem', color: '#aaa', fontStyle: 'italic'}}>Aucun capitaine en vie pour trancher. Discutez et changez un vote humain.</p>
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

          {/* Panel actions joueur sélectionné */}
          {selectedPlayer && (
            <div className="player-action-panel" role="dialog">
              <div className="pap-info">
                <div className="pap-name">
                  {selectedPlayer.isPlush && 'ðŸ¾ '}{selectedPlayer.name}
                </div>
                <div className="pap-role">
                  {ROLE_BY_ID[selectedPlayer.roleId]?.icon}{' '}
                  {ROLE_BY_ID[selectedPlayer.roleId]?.name ?? '?'}
                </div>
              </div>

              <div className="pap-btns">
                {phase === 'preparation' ? (
                   <>
                     {!selectedPlayer.isPlush && (
                       <select 
                         className="setup-input" 
                         style={{ padding: '6px 12px', borderRadius: 20, border: 'none', background: '#e8b4f9', color: '#1a0f41', fontWeight: 'bold', cursor: 'pointer' }}
                         onChange={(e) => {
                           if(e.target.value) {
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
                        <button className="pap-btn" style={{background: '#ffd700', color: '#000'}} onClick={() => setCaptain(selectedPlayer.id)}>
                           ðŸŽ–ï¸ Désigner Capitaine
                        </button>
                     )}
                   </>
                ) : phase === 'day' ? (
                  <>
                    {selectedPlayer.isPlush && (
                      <button
                        id="btn-interrogate"
                        className="pap-btn interrogate"
                        disabled={hasInterrogatedToday}
                        onClick={() => {
                          if (!hasInterrogatedToday) {
                            setInterrogationModal(selectedPlayer) // Ouvre la modale custom
                            setSelectedId(null)
                          }
                        }}
                      >
                        ðŸŽ­ Interroger {hasInterrogatedToday && '(Utilisé)'}
                      </button>
                    )}
                    <button
                      id="btn-eliminate"
                      className="pap-btn eliminate"
                      onClick={() => handleEliminate(selectedPlayer.id)}
                    >
                      ðŸ’€ Ã‰liminer
                    </button>
                  </>
                ) : (
                  /* ACTIONS DE NUIT (CONTEXTUELLES) */
                  <>
                    {currentNightStepId === 'cupidon' && (
                       <button className="pap-btn lover" onClick={() => handleNightActionSelect()}>
                         ðŸ’– {nightSelection.includes(selectedPlayer.id) ? 'Désélectionner' : 'Joueur Cupidonné'}
                       </button>
                    )}
                    {currentNightStepId === 'voyante' && selectedPlayer.isAlive && selectedPlayer.roleId !== 'voyante' && !nightActions.seerSeen && (
                       <button className="pap-btn see" onClick={() => handleNightActionSelect()}>
                         ðŸ‘ï¸ Joueur vu par la Voyante
                       </button>
                    )}
                    {currentNightStepId === 'loup-simple' && selectedPlayer.isAlive && !['loup','solitaire','loup-infecte'].includes(ROLE_BY_ID[selectedPlayer.roleId]?.team) && (
                       <button className="pap-btn eliminate" onClick={() => handleNightActionSelect()}>
                         ðŸº Dévorer ce joueur
                       </button>
                    )}
                    {currentNightStepId === 'sorciere' && (
                       <>
                         {nightActions.wolvesVictim === selectedPlayer.id && witchPotions.life && (
                           <button className="pap-btn save" onClick={() => handleNightActionSelect('life')}>
                             ðŸ’– Potion de vie (Sauver)
                           </button>
                         )}
                         {selectedPlayer.isAlive && selectedPlayer.id !== nightActions.wolvesVictim && selectedPlayer.roleId !== 'sorciere' && !nightActions.witchKilled && witchPotions.death && (
                           <button className="pap-btn eliminate" onClick={() => handleNightActionSelect('death')}>
                             ☠️ Potion de mort (Ã‰liminer)
                           </button>
                         )}
                       </>
                    )}
                    {currentNightStepId === 'infect-pere' && selectedPlayer.isAlive && !selectedPlayer.isInfected && (
                       <button className="pap-btn poison" onClick={() => handleNightActionSelect()}>
                         â˜£ï¸ Infecter (Infection Latente)
                       </button>
                    )}
                    {currentNightStepId === 'chien-loup' && selectedPlayer.roleId === 'chien-loup' && (
                       <div style={{display:'flex', gap: 5}}>
                         <button className="pap-btn save" onClick={() => handleNightActionSelect('village')}>ðŸ˜ï¸ Village</button>
                         <button className="pap-btn eliminate" onClick={() => handleNightActionSelect('loup')}>ðŸº Loup</button>
                       </div>
                    )}
                    {currentNightStepId === 'joueur-flute' && selectedPlayer.isAlive && selectedPlayer.roleId !== 'joueur-flute' && !charmedIds.includes(selectedPlayer.id) && (
                       <button className="pap-btn charm" onClick={() => handleNightActionSelect()}>
                         ðŸŽ¶ Charmer ce joueur
                       </button>
                    )}
                    {currentNightStepId === 'grand-mechant' && selectedPlayer.isAlive && !['loup','solitaire'].includes(ROLE_BY_ID[selectedPlayer.roleId]?.team) && selectedPlayer.id !== nightActions.wolvesVictim && !nightActions.grandMechantVictim && (
                       <button className="pap-btn eliminate" onClick={() => handleNightActionSelect()}>
                         ðŸ˜ˆ 2ème victime (GMM)
                       </button>
                    )}
                    {currentNightStepId === 'loup-blanc' && selectedPlayer.isAlive && ROLE_BY_ID[selectedPlayer.roleId]?.team === 'loup' && selectedPlayer.roleId !== 'loup-blanc' && !nightActions.whiteWolfVictim && (
                       <button className="pap-btn eliminate" onClick={() => handleNightActionSelect()}>
                         ðŸ¤ Mordre un autre Loup
                       </button>
                    )}
                    {currentNightStepId === 'enfant-sauvage' && selectedPlayer.isAlive && selectedPlayer.roleId !== 'enfant-sauvage' && !wildChildModelId && (
                       <button className="pap-btn see" onClick={() => handleNightActionSelect()}>
                         ðŸŒ¿ Ce joueur sera mon modèle
                       </button>
                    )}
                    {currentNightStepId === 'renard' && selectedPlayer.isAlive && selectedPlayer.roleId !== 'renard' && nightSelection.length === 0 && (
                       <button className="pap-btn see" onClick={() => handleNightActionSelect()}>
                         ðŸ¦Š Analyser ce groupe
                       </button>
                    )}
                  </>
                )}
                <button
                  className="pap-btn close-btn"
                  onClick={() => setSelectedId(null)}
                  aria-label="Fermer"
                >âœ•</button>
              </div>
            </div>
          )}

          {/* MODALE CHASSEUR - Déclenche au moment de sa mort */}
          {chasseurPendingId && (
            <div className="qa-modal-overlay">
              <div className="qa-modal-content" style={{textAlign:'center', padding: '30px 40px'}}>
                <div style={{fontSize: '3rem', marginBottom: 12}}>ðŸŽ¹</div>
                <h2 style={{marginBottom: 8}}>Le Chasseur tire !</h2>
                <p style={{marginBottom: 20, opacity: 0.8}}>Avant de tomber, le Chasseur doit désigner sa cible...</p>
                <div style={{display:'flex', flexDirection:'column', gap: 10, maxHeight: '40vh', overflowY:'auto', marginBottom: 20}}>
                  {alive.map(p => (
                    <button 
                      key={p.id} 
                      className="header-btn" 
                      style={{justifyContent:'flex-start', gap: 12}}
                      onClick={() => {
                        eliminatePlayer(p.id, 'hunter');
                        useGameStore.getState().pushToJournal(`ðŸŽ¹ Le Chasseur tire et emporte ${p.name} dans la mort !`, 'death');
                        setChasseurPendingId(null);
                      }}>
                      {ROLE_BY_ID[p.roleId]?.icon} {p.name}
                    </button>
                  ))}
                </div>
                <button className="header-btn" style={{alignSelf:'center', opacity:0.6}} onClick={() => setChasseurPendingId(null)}>
                  (Passer — le Chasseur rate sa cible)
                </button>
              </div>
            </div>
          )}

          {/* MODALE QA AUDIT DES PELUCHES */}
          {qaModalPlushId && (
             <div className="qa-modal-overlay" onClick={() => setQaModalPlushId(null)}>
                <div className="qa-modal-content" onClick={e => e.stopPropagation()}>
                   <div style={{display:'flex',justifyContent:'space-between', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 10}}>
                      <h3>Audit Scoring : {players.find(p=>p.id===qaModalPlushId)?.name}</h3>
                      <button onClick={() => setQaModalPlushId(null)} className="pap-btn close-btn" style={{position:'static',fontSize:'1rem'}}>âœ•</button>
                   </div>
                   <div style={{marginTop: 15, maxHeight: '60vh', overflowY:'auto'}}>
                      {Object.entries(useGameStore.getState().qaScoringData[qaModalPlushId] || {}).map(([targetId, info]) => {
                          const t = players.find(p=>p.id===targetId);
                          if (!t) return null;
                          return (
                             <div key={targetId} style={{marginBottom: 10, background:'rgba(255,255,255,0.05)', padding: 10, borderRadius: 6}}>
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom: 5}}>
                                   <strong>{t.name}</strong>
                                   <span style={{fontWeight:'bold', color: info.score > 0 ? '#4caf50' : info.score < 0 ? '#f44336' : '#fff'}}>{info.score > 0 ? '+' : ''}{info.score}</span>
                                </div>
                                <div className="qa-progress-container">
                                   <div className="qa-bar-center" />
                                   {info.score < 0 && <div className="qa-progress-bar-negative" style={{width: `${(Math.abs(info.score)/1000)*50}%`}} />}
                                   {info.score > 0 && <div className="qa-progress-bar-positive" style={{left:'50%', width: `${(info.score/1000)*50}%`}} />}
                                </div>
                                {info.breakdown.length > 0 && (
                                   <div style={{fontSize:'0.8rem', color:'#aaa', marginTop:6}}>
                                      {info.breakdown.map((bk, i) => <div key={i}>â€¢ {bk.reason}</div>)}
                                   </div>
                                )}
                             </div>
                          )
                      })}
                   </div>
                </div>
             </div>
          )}

        </main>

        {/* ── Droite : Le Journal ────────────────────────────â”€ */}
        <aside className="dashboard-sidebar right" aria-label="Journal">
          <div className="journal-header">
            <div className="journal-title">ðŸ“– Chronique du Village</div>
          </div>
          <div className="journal-entries" role="log" aria-live="polite">
            {journal.map(entry => (
              <div key={entry.id} className="journal-entry">
                <div className={`jdot ${entry.type}`} aria-hidden="true" />
                <p className={`jtext ${entry.type}`}>{entry.text}</p>
              </div>
            ))}
            <div ref={journalEnd} />
          </div>
        </aside>
      </div>

      {/* â•â• Ã‰CRAN DE VICTOIRE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {winner && (
        <div className="victory-overlay">
           <div className="victory-card">
              <div className="victory-icon">
                 {winner === 'village' && 'ðŸ˜ï¸'}
                 {winner === 'loups' && 'ðŸº'}
                 {winner === 'joueur-flute' && 'ðŸŽ¶'}
                 {winner === 'loup-blanc' && 'âšª'}
                 {winner === 'ange' && 'ðŸ˜‡'}
                 {winner === 'amoureux' && 'ðŸ’˜'}
                 {winner === 'aucun' && 'ðŸ’€'}
              </div>
              <h1 className="victory-title">
                 {winner === 'village' && 'Victoire du Village !'}
                 {winner === 'loups' && 'Les Loups-Garous triomphent !'}
                 {winner === 'joueur-flute' && 'Le Joueur de FlÃ»te a envouté tout le monde !'}
                 {winner === 'loup-blanc' && 'Le Loup Blanc est le seul survivant !'}
                 {winner === 'ange' && 'L\'Ange a réussi son martyr !'}
                 {winner === 'amoureux' && 'L\'Amour est plus fort que tout !'}
                 {winner === 'aucun' && 'Tout le monde est mort... Match nul !'}
              </h1>
              <p className="victory-subtitle">La partie est terminée.</p>
              
              <div className="victory-survivors">
                 <h3>Survivants :</h3>
                 <ul>
                    {players.filter(p => p.isAlive).map(p => (
                       <li key={p.id}>
                          {ROLE_BY_ID[p.roleId]?.icon} {p.name} ({ROLE_BY_ID[p.roleId]?.name})
                       </li>
                    ))}
                    {players.filter(p => p.isAlive).length === 0 && <li>Aucun survivant...</li>}
                 </ul>
              </div>

              <button className="header-btn primary-action" onClick={handleReset} style={{marginTop: 30, padding: '12px 30px', fontSize:'1.2rem'}}>
                 ðŸ”„ Nouvelle Partie
              </button>
           </div>
        </div>
      )}
      {/* Modal Succession Capitaine */}
      {successionPendingForId && (
        <div className="succession-overlay">
           <div className="succession-modal">
              <h2>ðŸŽ–ï¸ Le Dernier Souffle</h2>
              <p>Le Capitaine <strong>{players.find(p => p.id === successionPendingForId)?.name}</strong> a été éliminé.</p>
              <p>Il doit désigner son successeur avant de partir...</p>
              
              <div className="succession-grid">
                 {players.filter(p => p.isAlive).map(p => (
                    <button key={p.id} className="succession-item" onClick={() => transferCaptaincy(p.id)}>
                       <span className="avatar-mini">{ROLE_BY_ID[p.roleId]?.icon}</span>
                       <span className="name">{p.name} {p.isPlush ? '(ðŸ§¸)' : '(ðŸ‘¤)'}</span>
                    </button>
                 ))}
                 
                 {/* Option Aléatoire pour PNJ ou MJ pressé */}
                 <button className="succession-item random" onClick={() => {
                    const alivePool = players.filter(p => p.isAlive);
                    if (alivePool.length > 0) {
                       const randomIdx = Math.floor(Math.random() * alivePool.length);
                       transferCaptaincy(alivePool[randomIdx].id);
                    }
                 }}>
                    ðŸŽ² Choix Aléatoire
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* ── MODALE : DÃ‰SIGNER UN CAPITAINE ────────────────── */}
      {captainModal && (
        <div className="grimoire-modal-overlay" onClick={() => setCaptainModal(false)}>
          <div className="grimoire-modal" onClick={e => e.stopPropagation()}>
            <div className="grimoire-modal-icon">ðŸŽ–ï¸</div>
            <h2>Capitaine requis !</h2>
            <p>
              Avant de plonger le village dans les ténèbres,<br/>
              vous devez désigner un <strong>Capitaine</strong>.<br/>
              Cliquez sur un joueur, puis sur <em>"Désigner Capitaine"</em>.
            </p>
            <div className="grimoire-modal-actions">
              <button className="grimoire-modal-btn confirm" onClick={() => setCaptainModal(false)}>
                Compris, je désigne !
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALE : CONFIRMATION INTERROGATOIRE ──────────── */}
      {interrogationModal && (
        <div className="grimoire-modal-overlay" onClick={() => setInterrogationModal(null)}>
          <div className="grimoire-modal" onClick={e => e.stopPropagation()}>
            <div className="grimoire-modal-icon">ðŸŽ­</div>
            <h2>Interroger {interrogationModal.name} ?</h2>
            <p>
              Vous ne disposez que d'<strong>un seul interrogatoire</strong> par jour.<br/>
              Une fois commencé, vous ne pourrez plus en mener d'autre aujourd'hui.
            </p>
            <div className="grimoire-modal-actions">
              <button className="grimoire-modal-btn cancel" onClick={() => setInterrogationModal(null)}>
                Annuler
              </button>
              <button className="grimoire-modal-btn confirm" onClick={() => {
                setInterrogatedToday(true)
                handleInterrogate(interrogationModal)
                setInterrogationModal(null)
              }}>
                ðŸŽ­ Oui, interroger !
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
