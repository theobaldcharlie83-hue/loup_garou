import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore, ROLE_BY_ID, getPlayerTeam, isPlayerWolf } from '../../store/useGameStore'
import { calculatePlushieVoteScores } from '../../services/scoringEngine'
import { computeVoteTally } from '../../services/voteTally'
import RulesModal from '../../components/RulesModal/RulesModal'
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

}

/* Ordre officiel de nuit — Best Of (règles officielles complètes) */
const NIGHT_ORDER = [
  // ── NUIT 1 SEULEMENT ──────────────────────────────────────────────────────
  { id: 'cupidon',         isNight1Only: true,  label: 'Appeler Cupidon',                      instruction: 'Il désigne en secret les deux Amoureux. Il les réveille dos à dos ou leur montre leur partenaire.' },
  { id: 'amoureux',        isNight1Only: true,  label: 'Les Amoureux se reconnaissent',         instruction: 'Les deux Amoureux ouvrent les yeux et découvrent leur partenaire. Ils referment les yeux en silence.' },
  { id: 'voyante',         isNight1Only: false, label: 'Appeler la Voyante',                    instruction: 'Elle désigne un joueur. Montrez-lui sa carte de rôle en secret.' },
  { id: 'soeurs',          isNight1Only: true,  label: 'Appeler les Sœurs',                     instruction: 'Les deux Sœurs ouvrent les yeux et se reconnaissent mutuellement, sans parler.' },
  { id: 'enfant-sauvage',  isNight1Only: true,  label: 'Appeler l\'Enfant Sauvage',             instruction: 'Il désigne son modèle de rôle — il deviendra Loup-Garou si ce joueur vient à mourir.' },
  { id: 'montreur-ours',   isNight1Only: true,  label: 'Appeler le Montreur d\'Ours',           instruction: 'Il ouvre les yeux pour repérer sa position dans le cercle. Chaque matin, son ours grognera si un voisin immédiat est Loup-Garou.' },
  { id: 'chien-loup',      isNight1Only: true,  label: 'Appeler le Chien-Loup',                 instruction: 'Il choisit son camp : Villageois ou Loup-Garou. S\'il choisit Loup, il rejoindra la meute maintenant.' },
  // ── CHAQUE NUIT ───────────────────────────────────────────────────────────
  { id: 'loup-simple',     isNight1Only: false, defaultGroup: true, label: 'Appeler les Loups-Garous', instruction: 'Tous les Loups se réveillent et désignent leur victime. Inclut le Chien-Loup (si camp Loup), l\'Enfant Sauvage (si modèle mort), le joueur infecté. Choix OBLIGATOIRE.' },
  { id: 'infect-pere',     isNight1Only: false, label: 'Appeler l\'Infect Père des Loups (seul)', instruction: "Il se réveille seul. Il peut infecter un joueur (qui n'est pas déjà loup, ni la victime de la meute de ce tour) pour le rallier à la meute (une seule infection possible sur toute la partie)." },
  { id: 'grand-mechant',   isNight1Only: false, label: 'Appeler le Grand-Méchant-Loup (seul)',   instruction: 'Il se réveille seul. Il peut désigner une 2ème victime indépendante — uniquement si aucun Loup-Garou n\'est encore mort.' },
  { id: 'loup-blanc',      isNight1Only: false, label: 'Appeler le Loup-Garou Blanc',            instruction: 'Une nuit sur deux, il peut éliminer un autre Loup-Garou de la meute pour rester le seul survivant.' },
  { id: 'sorciere',        isNight1Only: false, label: 'Appeler la Sorcière',                    instruction: 'Montrez-lui la victime des Loups. Elle peut utiliser sa potion de Vie (sauver) et/ou sa potion de Mort (empoisonner un joueur).' },
  { id: 'renard',          isNight1Only: false, label: 'Appeler le Renard',                      instruction: 'Il désigne un groupe de 3 joueurs voisins. Faites-lui signe (oui/non) si un Loup-Garou est parmi eux.' },
  { id: 'joueur-flute',    isNight1Only: false, label: 'Appeler le Joueur de Flûte',             instruction: 'Il désigne 2 nouveaux joueurs à charmer. Il ne peut pas charmer le même joueur deux fois.' },
  { id: 'joueurs-charmes', isNight1Only: false, label: 'Les Joueurs Charmés se reconnaissent',   instruction: 'Tous les joueurs charmés ouvrent les yeux et se reconnaissent silencieusement entre eux.' },
  { id: 'corbeau',         isNight1Only: false, label: 'Appeler le Corbeau',                     instruction: 'Il désigne en secret un joueur qui recevra 2 voix supplémentaires contre lui lors du prochain tribunal.' },
]

const getGuidanceMessage = (phase, currentNightStepId, hasChasseurPending, hasSuccessionPending, isVoting, tribunalLocked) => {
  if (phase === 'preparation') {
    return "Mettez en place les joueurs dans le cercle. Double-cliquez pour échanger deux positions. Quand le cercle est prêt, désignez le Capitaine et lancez la nuit.";
  }
  if (hasChasseurPending) {
    return "Le Chasseur a été éliminé ! Attendez qu'il désigne sa cible et tire son dernier coup de fusil.";
  }
  if (hasSuccessionPending) {
    return "Le Capitaine est mort ! Il doit désigner un successeur parmi les survivants avant de s'éteindre.";
  }
  if (phase === 'day') {
    if (tribunalLocked) {
      return "Le condamné a été exécuté. Le village s'endort pour une nouvelle nuit.";
    }
    if (isVoting) {
      return "Le Tribunal est ouvert. Enregistrez les votes des joueurs humains, faites voter les doudous si besoin, puis appliquez la sentence.";
    }
    return "Laissez les villageois débattre librement des événements de la nuit dernière, puis ouvrez le tribunal pour voter.";
  }
  
  switch (currentNightStepId) {
    case 'cupidon':
      return "Cupidon se réveille et désigne les deux Amoureux de la partie.";
    case 'amoureux':
      return "Les Amoureux se réveillent silencieusement, se découvrent mutuellement, puis se rendorment.";
    case 'voyante':
      return "La Voyante se réveille et désigne un joueur pour découvrir sa véritable carte de rôle.";
    case 'soeurs':
      return "Les deux Sœurs ouvrent les yeux en silence pour se reconnaître.";
    case 'enfant-sauvage':
      return "L'Enfant Sauvage se réveille et désigne son modèle de rôle.";
    case 'montreur-ours':
      return "Le Montreur d'Ours se réveille brièvement pour repérer sa position dans le cercle.";
    case 'chien-loup':
      return "Le Chien-Loup se réveille et choisit son camp : Villageois ou Loup-Garou.";
    case 'loup-simple':
      return "La meute des Loups-Garous se réveille au complet et désigne sa victime de la nuit.";
    case 'infect-pere':
      return "L'Infect Père des Loups se réveille seul et peut infecter un joueur (qui n'est pas déjà loup, ni la victime de la meute de ce tour) pour le rallier à la meute.";
    case 'grand-mechant':
      return "Le Grand-Méchant-Loup se réveille et choisit une deuxième victime indépendante.";
    case 'loup-blanc':
      return "Le Loup-Garou Blanc se réveille et choisit s'il souhaite éliminer un autre loup.";
    case 'sorciere':
      return "La Sorcière examine ses grimoires et ses potions. Laissez-la décider de sauver ou d'empoisonner.";
    case 'renard':
      return "Le Renard désigne un joueur pour flairer son groupe de 3 (lui + ses 2 voisins).";
    case 'joueur-flute':
      return "Le Joueur de Flûte se réveille et désigne deux joueurs à charmer.";
    case 'joueurs-charmes':
      return "Tous les joueurs charmés ouvrent les yeux pour se reconnaître silencieusement.";
    case 'corbeau':
      return "Le Corbeau désigne en secret un joueur qui aura 2 voix de pénalité contre lui au prochain vote.";
    case 'fin-nuit':
      return "La nuit est terminée. Révélez les victimes de la nuit au réveil du village.";
    default:
      return "Suivez les instructions de l'étape de nuit affichée.";
  }
};

export default function DashboardScreen() {
  const navigate  = useNavigate()
  const {
    players, phase, dayNumber, journal,
    witchPotions, eliminatePlayer, setPhase,

    lovers, commitLovers,
    nightActions,
    commitWolvesVictim, commitSeerObservation, commitWitchLife, commitWitchDeath,
    commitWildChildModel, commitGrandMechantVictim, commitWhiteWolfVictim,
    wakeUpVillage,
    infectUsed, commitInfection,
    seenBySeer, ancienLives, wildChildModelId,

    dayVotes,
    nightStepIndex, setNightStepIndex,
    activeNightSteps, setActiveNightSteps,
    winner, charmedIds, setCharmedIds,
    captainId, setCaptain, transferCaptaincy, pendingInteractions,
    isVoting, setIsVoting, tribunalLocked, setTribunalLocked,
    chevalierContaminatedWolfId, chienLoupSide,
    foxPowerLost, commitFoxAction, undoAction, pastStates,
    renamePlayer, saveGameToLocalStorage,
    corbeauTargetId, condemnedPlayerId, qaScoringData
  } = useGameStore()

  const [selectedId, setSelectedId] = useState(null)
  const circleRef    = useRef(null)
  const journalRef   = useRef(null)
  const [dims, setDims] = useState({ cx: 0, cy: 0, rx: 0, ry: 0 })

  const [nightSelection, setNightSelection] = useState([])
  const [isAiVotingLoading, setIsAiVotingLoading] = useState(false)

  // Résolution interactive en tête de file (succession du Capitaine / tir du Chasseur).
  // On n'en traite qu'une à la fois — la file garantit l'enchaînement correct.
  const currentInteraction = pendingInteractions?.[0] ?? null
  const successionPendingForId = currentInteraction?.type === 'succession' ? currentInteraction.playerId : null
  const chasseurPendingId = currentInteraction?.type === 'hunter' ? currentInteraction.playerId : null

  // ── Étape 1 & 2 : nouveaux states UI/UX ─────────────────────
  const [highlightedIds, setHighlightedIds]       = useState([])      // IDs momentanément mis en lumière
  const [isProcessingAction, setIsProcessingAction] = useState(false) // Debounce global pour les animations
  const [captainModal, setCaptainModal]           = useState(false)   // Modale "désignez un capitaine"

  const [showBearModal, setShowBearModal] = useState(false)        // Modale d'alerte pour le grognement de l'ours
  const [hasShownBearGrowl, setHasShownBearGrowl] = useState(false) // Pour ne l'afficher qu'une fois par jour
  const [showRules, setShowRules] = useState(false)               // Contrôle de la modale des règles
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  
  // Modal QA
  const [qaModalPlushId, setQaModalPlushId] = useState(null)
  const [witchIaUsedForThisStep, setWitchIaUsedThisStep] = useState(false) // Usage unique du bouton IA par tour

  // ── States pour Renommage, Sauvegarde, Transitions, Modale Sorcière ──
  const [editingPlayerId, setEditingPlayerId] = useState(null)
  const [editSource, setEditSource] = useState(null) // 'sidebar' | 'avatar'
  const [editNameValue, setEditNameValue] = useState('')
  const editNameValueRef = useRef('') // ref pour éviter les closures stales dans onBlur
  const renameInputRef = useRef(null)  // ref pour forcer le focus sur l'input de renommage
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [transitionPhase, setTransitionPhase] = useState('')
  const [isTransitionActive, setIsTransitionActive] = useState(false)
  const [witchUseLife, setWitchUseLife] = useState(false)
  const [witchDeathTarget, setWitchDeathTarget] = useState('')
  const [showGuidanceBanner, setShowGuidanceBanner] = useState(true)

  /* Redirect si partie non démarrée */
  useEffect(() => {
    if (players.length === 0) navigate('/')
  }, [players.length, navigate])

  /* ── Screen Wake Lock API ──────────────────────────────────── */
  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log("Wake Lock acquired successfully");
        }
      } catch (err) {
        console.warn(`Failed to acquire Wake Lock: ${err.name}, ${err.message}`);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock !== null) {
        wakeLock.release()
          .then(() => { wakeLock = null; })
          .catch(err => console.error("Error releasing wake lock:", err));
      }
    };
  }, []);

  /* ── Overlay de Transition Jour/Nuit ───────────────────────── */
  useEffect(() => {
    if (phase === 'preparation') return;

    setTransitionPhase(phase);
    setIsTransitionActive(true);

    const timer = setTimeout(() => {
      setIsTransitionActive(false);
    }, 2500); // 2.5s fading animation

    return () => clearTimeout(timer);
  }, [phase, dayNumber]);

  /* ── Helpers Renommage ─────────────────────────────────────── */
  const startEditing = (player, source = 'sidebar') => {
    editNameValueRef.current = player.name
    setEditSource(source)
    setEditingPlayerId(player.id)
    setEditNameValue(player.name)
  }

  // Force le focus sur l'input dès qu'il apparaît (autoFocus ne marche pas dans les sidebars)
  useEffect(() => {
    if (editingPlayerId && renameInputRef.current) {
      // setTimeout 0 pour laisser le DOM se mettre à jour avant de focus
      const t = setTimeout(() => {
        if (renameInputRef.current) {
          renameInputRef.current.focus()
          renameInputRef.current.select()
        }
      }, 0)
      return () => clearTimeout(t)
    }
  }, [editingPlayerId])

  const finishEditing = (playerId) => {
    // Utilise la ref pour avoir la valeur la plus récente même après re-renders
    const currentValue = editNameValueRef.current.trim()
    const originalName = players.find(p => p.id === playerId)?.name
    if (currentValue && originalName && currentValue !== originalName) {
      renamePlayer(playerId, currentValue)
    }
    setEditingPlayerId(null)
    setEditSource(null)
    editNameValueRef.current = ''
  }

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
    const ro = new ResizeObserver(() => {
      compute()
    })
    if (circleRef.current) ro.observe(circleRef.current)

    const handleResize = () => {
      compute()
      setTimeout(compute, 150) // Deuxième passe après stabilisation du layout tablette/css
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  /* Auto-scroll journal */
  useEffect(() => {
    if (journalRef.current) {
      journalRef.current.scrollTo({
        top: journalRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [journal.length])

  // La mort du Chasseur est désormais détectée dans le store (eliminatePlayer empile
  // une interaction 'hunter' dans pendingInteractions), quelle qu'en soit la cause.

  // Détection du grognement de l'ours au réveil
  useEffect(() => {
    if (phase === 'night') {
      setHasShownBearGrowl(false);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'day' && players.some(p => p.isGroaning) && !hasShownBearGrowl) {
      setShowBearModal(true);
      setHasShownBearGrowl(true);
    }
  }, [phase, players, hasShownBearGrowl]);

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
                useGameStore.getState().pushToJournal(`🏹 Le Chasseur IA (${hunter.name}) a tiré sur ${rnd.name} !`, 'death');
                useGameStore.getState().resolveHunterShot(rid);
                setIsProcessingAction(false);
            }, 2000);
          } else {
            useGameStore.getState().resolveHunterShot(null);
            setIsProcessingAction(false);
          }
        }, 1500);
      }
    }
  }, [chasseurPendingId, players, isProcessingAction]);

  // Automatisation du Tie-break si le Capitaine est un PNJ
  // Automatisation du Tie-break supprimée pour permettre un déclenchement manuel par le MJ.

  /* Calcul des étapes de la nuit — ordre officiel Best Of */
  useEffect(() => {
    if (phase === 'night' && nightStepIndex === -1) {
      const activeRoles  = new Set(players.filter(p => p.isAlive).map(p => p.roleId))
      const hasCupidon   = activeRoles.has('cupidon')
      const hasWolves    = players.some(p =>
        p.isAlive && isPlayerWolf(p, players, useGameStore.getState()) && p.roleId !== 'joueur-flute'
      )
      const loupsBlancs  = players.filter(p => p.isAlive && p.roleId === 'loup-blanc')
      const deadWolves   = players.filter(p => !p.isAlive && isPlayerWolf(p, players, useGameStore.getState()))

      const steps = NIGHT_ORDER.filter(step => {
        // Étapes Nuit 1 uniquement : bloquer les nuits suivantes
        if (step.isNight1Only && dayNumber !== 1) return false

        // Cupidon : skip si les amoureux sont déjà désignés
        if (step.id === 'cupidon' && lovers.length > 0) return false

        // Amoureux : Nuit 1, seulement si Cupidon est en jeu (les amoureux se découvrent après lui)
        if (step.id === 'amoureux') return dayNumber === 1 && (hasCupidon || lovers.length === 2)

        // Sœurs : Nuit 1 si elles sont en jeu
        if (step.id === 'soeurs') return dayNumber === 1 && activeRoles.has('soeurs')

        // Montreur d'Ours : Nuit 1 uniquement (repérage position)
        if (step.id === 'montreur-ours') return dayNumber === 1 && activeRoles.has('montreur-ours')

        // Chien-Loup : Nuit 1 uniquement (choix de camp)
        if (step.id === 'chien-loup') return dayNumber === 1 && activeRoles.has('chien-loup')

        // Loups (groupe) : tous les loups vivants
        if (step.defaultGroup) return hasWolves

        // Infect Père des Loups : tant qu'il n'a pas encore infecté
        if (step.id === 'infect-pere') return activeRoles.has('infect-pere') && !infectUsed

        // Grand-Méchant-Loup : tant qu'aucun Loup-Garou n'est mort
        if (step.id === 'grand-mechant') return activeRoles.has('grand-mechant') && deadWolves.length === 0

        // Loup Blanc : une nuit sur deux
        if (step.id === 'loup-blanc') return loupsBlancs.length > 0 && dayNumber % 2 === 0

        // Joueurs charmés : toujours incluse si le Joueur de Flûte est en vie
        if (step.id === 'joueurs-charmes') return players.some(p => p.roleId === 'joueur-flute' && p.isAlive)

        // Corbeau : chaque nuit s'il est en jeu
        if (step.id === 'corbeau') return activeRoles.has('corbeau')

        // Cas général : le rôle est en vie
        if (activeRoles.has(step.id)) return true
        return false
      })

      steps.push({ id: 'fin-nuit', isEnd: true, label: 'Le Soleil se Lève', instruction: 'Les actions de la nuit sont réglées. Cliquez ci-dessous pour annoncer les événements de la nuit au village.' })

      setActiveNightSteps(steps)
      setNightStepIndex(0)
      setNightSelection([])
    }
  }, [phase, dayNumber, players, nightStepIndex]) // Correct dependency array to avoid stale state issues

  // Reset séparé pour le verrou du bouton IA de la sorcière, les animations et debounces
  useEffect(() => {
    setWitchIaUsedThisStep(false)
    setIsProcessingAction(false)
    setHighlightedIds([])
  }, [nightStepIndex, phase])

  /* Variables d'état utilitaires */
  const selectedPlayer  = players.find(p => p.id === selectedId)
  const currentStepInfo = phase === 'night' && nightStepIndex >= 0 && nightStepIndex < activeNightSteps.length ? activeNightSteps[nightStepIndex] : null
  const currentNightStepId = currentStepInfo?.id
  const guidanceText = getGuidanceMessage(phase, currentNightStepId, !!chasseurPendingId, !!successionPendingForId, isVoting, tribunalLocked)
  const [activeGuidanceText, setActiveGuidanceText] = useState('')

  // Gérer l'affichage automatique du bandeau de guidage et son archivage dans la Chronique
  useEffect(() => {
    if (guidanceText !== activeGuidanceText) {
      // Si on avait un texte affiché qui disparaît/change, on l'ajoute à la chronique
      if (activeGuidanceText && showGuidanceBanner) {
        useGameStore.getState().pushToJournal(activeGuidanceText, 'guidance');
      }
      setActiveGuidanceText(guidanceText || '');
      setShowGuidanceBanner(!!guidanceText);
    }
  }, [guidanceText, activeGuidanceText, showGuidanceBanner])

  /* ── Reset des choix de la Sorcière au début de son tour ────── */
  useEffect(() => {
    if (currentNightStepId === 'sorciere') {
      setWitchUseLife(false);
      setWitchDeathTarget('');
    }
  }, [currentNightStepId]);

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
  const wolves          = alive.filter(p => isPlayerWolf(p, players, useGameStore.getState()))
  const witchInGame     = players.some(p => p.roleId === 'sorciere')

  /* Handlers */
  const handleAvatar = (player) => {
    if (currentNightStepId === 'sorciere') return;
    // ── Phase de préparation : swap de place par double-clic ──
    if (phase === 'preparation') {
      if (!selectedId) {
        // Premier clic : sélectionner ce joueur
        setSelectedId(player.id)
      } else if (selectedId === player.id) {
        // Re-clic sur le même : désélectionner
        setSelectedId(null)
      } else {
        // Deuxième clic sur un autre joueur : effectuer le swap de place
        swapPlayers(selectedId, player.id)
        setSelectedId(null)
      }
      return
    }

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
    useGameStore.getState().saveHistory()
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
    useGameStore.getState().saveHistory()
    eliminatePlayer(pid, 'vote') // Élimination directe/MJ considérée comme 'vote'
    setSelectedId(null)
    // Le pouvoir du Chasseur (s'il s'agit de lui) est déclenché par le store, qui
    // empile une interaction 'hunter' dans pendingInteractions.
  }

  const handleReset = () => { useGameStore.getState().resetGame(); navigate('/') }

  const handleSave = () => {
    saveGameToLocalStorage()
    setIsSaveModalOpen(true)
  }

  const handleWitchIaSelect = () => {
    const witch = players.find(p => p.roleId === 'sorciere' && p.isAlive)
    if (!witch) return

    const potionProb = 0.1 + (dayNumber * 0.1) // N1: 20%, N2: 30%, N3: 40%...

    let suggestedLife = false
    let suggestedDeathTarget = ''

    // 1. Potion de Vie
    if (witchPotions.life && nightActions.wolvesVictim) {
      const victim = players.find(p => p.id === nightActions.wolvesVictim)
      const isSelf = victim?.id === witch.id
      const isVillageois = ROLE_BY_ID[victim?.roleId]?.team === 'village'

      if (isSelf) {
        // Sauvetage automatique de soi-même (100% prob)
        suggestedLife = true
      } else if (isVillageois && Math.random() < potionProb) {
        // Sauvetage probabiliste d'un autre villageois
        suggestedLife = true
      }
    }

    // 2. Potion de mort
    if (witchPotions.death && !nightActions.witchKilled && Math.random() < potionProb) {
      // Ciblage stratégique : le joueur ayant le score de confiance minimal
      const storeState = useGameStore.getState()
      const scores = calculatePlushieVoteScores(witch, alive, storeState)

      let minScore = Infinity
      let candidates = []

      Object.entries(scores).forEach(([pid, info]) => {
        if (pid === witch.id) return
        // EXCLUSION OBLIGATOIRE : La victime des loups de cette nuit
        if (pid === nightActions.wolvesVictim) return

        if (info.score < minScore) {
          minScore = info.score
          candidates = [pid]
        } else if (info.score === minScore) {
          candidates.push(pid)
        }
      })

      if (candidates.length > 0) {
        suggestedDeathTarget = candidates[Math.floor(Math.random() * candidates.length)]
      }
    }

    setWitchUseLife(suggestedLife)
    setWitchDeathTarget(suggestedDeathTarget)
    setWitchIaUsedThisStep(true)
  }

  const handleWitchValidation = () => {
    useGameStore.getState().saveHistory()
    if (witchUseLife && nightActions.wolvesVictim) {
      commitWitchLife(nightActions.wolvesVictim)
    }
    if (witchDeathTarget) {
      commitWitchDeath(witchDeathTarget)
    }
    advanceNightPhase()
  }

  /* ── Highlight aléatoire ─────────────────────────────── */
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
    useGameStore.getState().saveHistory()

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
      // Feedback immédiat dans le journal via une micro-notification ou highlight
      triggerHighlight([selectedPlayer.id]);
    } else if (currentNightStepId === 'renard') {
      // Le Renard choisit le joueur central.
      // On calcule les voisins pour l'affichage au MJ.
      const alivePlayers = players.filter(p => p.isAlive);
      const cIdx = alivePlayers.findIndex(p => p.id === selectedPlayer.id);
      if (cIdx !== -1) {
        const left = alivePlayers[(cIdx - 1 + alivePlayers.length) % alivePlayers.length];
        const right = alivePlayers[(cIdx + 1) % alivePlayers.length];
        const groupIds = [left.id, selectedPlayer.id, right.id];
        
        const isWolf = (p) => isPlayerWolf(p, players, useGameStore.getState());
        const hasWolf = groupIds.some(id => isWolf(players.find(p => p.id === id)));
        
        commitFoxAction(selectedPlayer.id, hasWolf, groupIds);
        setNightSelection(groupIds);
        triggerHighlight(groupIds);
      }
    } else if (currentNightStepId === 'corbeau') {
      setNightSelection([selectedPlayer.id]);
    }

    setSelectedId(null)
  }

  const advanceNightPhase = () => {
    useGameStore.getState().saveHistory()
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
      } else if (currentNightStepId === 'corbeau') {
        if (nightSelection.length === 1) {
          useGameStore.getState().commitCorbeauTarget(nightSelection[0]);
        } else {
          return;
        }
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
      } else if (currentNightStepId === 'loup-blanc') {
        if (nightActions.whiteWolfVictim) {
          const p = players.find(x => x.id === nightActions.whiteWolfVictim);
          pushToJournal(`🤍 Le Loup Blanc a décidé d'éliminer ${p?.name} de la meute cette nuit.`);
        } else {
          pushToJournal(`🤍 Le Loup Blanc a choisi de ne pas trahir la meute cette nuit.`);
        }
      } else if (currentNightStepId === 'joueur-flute' && nightSelection.length > 0) {
        const newCharmed = [...charmedIds]
        nightSelection.forEach(id => { if(!newCharmed.includes(id)) newCharmed.push(id) })
        setCharmedIds(newCharmed)
        pushToJournal(`Le Joueur de Flûte a charmé de nouvelles victimes...`)
      } else if (currentNightStepId === 'chien-loup' && nightSelection.length > 0) {
        const side = useGameStore.getState().chienLoupSide;
        pushToJournal(`Le Chien-Loup a choisi son camp : ${side === 'loup' ? 'Loups-Garous' : 'Villageois'}.`);
      } else if (currentNightStepId === 'amoureux') {
        if (lovers.length === 2) {
          const p1 = players.find(x => x.id === lovers[0]);
          const p2 = players.find(x => x.id === lovers[1]);
          pushToJournal(`💞 Les Amoureux (${p1?.name} & ${p2?.name}) se sont reconnus dans les ténèbres.`);
        }
      } else if (currentNightStepId === 'soeurs') {
        pushToJournal(`👯 Les deux Sœurs ont ouvert les yeux et se sont reconnues en silence.`);
      } else if (currentNightStepId === 'montreur-ours') {
        pushToJournal(`🐻 Le Montreur d'Ours a repéré sa position dans le cercle du village.`);
      } else if (currentNightStepId === 'joueurs-charmes') {
        const charmedNames = players.filter(p => charmedIds.includes(p.id) && p.isAlive).map(p => p.name).join(', ');
        pushToJournal(`🎶 Les joueurs charmés (${charmedNames}) se sont reconnus silencieusement.`);
      } else if (currentNightStepId === 'renard') {
        if (nightSelection.length === 3) {
          const central = players.find(p => p.id === nightActions.foxCentralId);
          const hasWolf = nightActions.foxHasWolf;
          pushToJournal(`🦊 Le Renard a flairé le groupe autour de ${central?.name}. Résultat : ${hasWolf ? 'Positif (🐺 présent)' : 'Négatif (Villageois innocents)'}.`);
        } else {
          pushToJournal(`🦊 Le Renard a choisi de ne pas utiliser son flair cette nuit.`);
        }
      }

      setNightSelection([]);
      setNightStepIndex(idx => idx + 1);
    }
  }

  const handlePlushiesVote = async () => {
    useGameStore.getState().saveHistory()
    setIsAiVotingLoading(true);
    try {
      const alivePlushies = alive.filter(p => p.isPlush);
      const storeState = useGameStore.getState();
      
      // 1) Calcul de la matrice absolue (QA Scoring Data) pour chaque peluche
      const scoringDataCurrent = {};
      alivePlushies.forEach(p => {
         scoringDataCurrent[p.id] = calculatePlushieVoteScores(p, alive, storeState);
      });
      storeState.setQAScoringData(scoringDataCurrent);

      // 2) Vote rationnel basé sur la jauge de confiance
      const aiVotes = alivePlushies.map(p => {
        const matrix = scoringDataCurrent[p.id] || {};
        const aliveOthers = alive.filter(o => o.id !== p.id && o.isAlive);
        let targetId = null;
        if (aliveOthers.length > 0) {
          const candidates = aliveOthers.map(o => ({ id: o.id, score: matrix[o.id]?.score ?? 0 }));
          const minScore = Math.min(...candidates.map(c => c.score));
          const targets = candidates.filter(c => c.score === minScore);
          targetId = targets[Math.floor(Math.random() * targets.length)]?.id ?? null;
        }
        return { plushId: p.id, voteForId: targetId };
      });
      
      // 3) Enregistrement des intentions de vote
      const newVotes = { ...storeState.dayVotes };
      if (Array.isArray(aiVotes)) {
        aiVotes.forEach(v => {
           // On enregistre même si c'est null pour avoir le compte exact des votants
           newVotes[v.plushId] = v.voteForId || "";
        });
      }
      storeState.setDayVotes(newVotes);
    } catch (err) {
      console.error("Erreur lors du vote IA:", err);
    } finally {
      setIsAiVotingLoading(false);
    }
  }

  const pm = PHASE_META[phase] ?? PHASE_META.night

  return (
    <div className={`dashboard-screen phase-${phase}`} aria-label="Tableau de bord">
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

      {/* ═ ═  HEADER ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═  */}
      <header className="dashboard-header">
        <span className="header-title">✧ Le Grimoire</span>

        <div className="header-phase-badge" role="status" aria-live="polite">
          <span aria-hidden="true">{pm.icon}</span>{pm.label}
        </div>

        <span className="header-day">Jour&nbsp;{dayNumber}</span>
        <div className="header-spacer" />

        <div className="header-actions">
          <button className="header-btn" onClick={() => navigate('/')}>
            🏠 Accueil
          </button>
          {phase !== 'preparation' && (
            <>
              {phase === 'day' && (
                <button
                  id="btn-phase-toggle"
                  className="header-btn primary-action"
                  onClick={handlePhaseToggle}
                  disabled={!tribunalLocked}
                  title={!tribunalLocked ? "Le village doit d'abord voter et condamner un joueur avant de s'endormir." : "Passer à la nuit"}
                  style={!tribunalLocked ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                >
                  <span aria-hidden="true">🌙</span> Endormir le Village
                </button>
              )}
            </>
          )}
          <button 
            id="btn-save" 
            className="header-btn"
            onClick={handleSave}
          >
            💾 Sauvegarder
          </button>
          <button id="btn-reset" className="header-btn" onClick={handleReset}>
            ↩ Reconfigurer
          </button>
        </div>
      </header>

      {/* ═ ═  3 COLONNES ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ == */}
      <div className={`dashboard-content${leftCollapsed ? ' left-collapsed' : ''}${rightCollapsed ? ' right-collapsed' : ''}`}>

        {/* ── Gauche : Le Grimoire ──────────────────────────── */}
        <aside className={`dashboard-sidebar left${leftCollapsed ? ' collapsed' : ''}`} aria-label="Grimoire">
          <button
            className="sidebar-toggle"
            onClick={() => setLeftCollapsed(v => !v)}
            aria-label={leftCollapsed ? 'Ouvrir le Grimoire' : 'Fermer le Grimoire'}
            title={leftCollapsed ? 'Ouvrir le Grimoire' : 'Fermer le Grimoire'}
          >
            {leftCollapsed ? '›' : '‹'}
          </button>
          <div className="sidebar-inner">

          {/* Stats */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">📊 Situation</div>
            <div className="stats-row">
              <span className="stats-label">En vie</span>
              <span className="stats-value alive">{alive.length}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">Éliminés</span>
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
              <div className="sidebar-section-title">🧪 Sorcière — Potions de Jour</div>
              <p style={{fontSize:'0.75rem', opacity: 0.6}}>Géré via action contextuelle la nuit.</p>
              <div className={`potion-item${!witchPotions.life ? ' used' : ''}`}>
                <span className="potion-icon">💊</span>
                <span className="potion-label">Potion de Vie</span>
                {witchPotions.life
                  ? <span className="potion-used-tag">Active</span>
                  : <span className="potion-used-tag">Épuisée</span>
                }
              </div>

              <div className={`potion-item${!witchPotions.death ? ' used' : ''}`}>
                <span className="potion-icon">☠️ </span>
                <span className="potion-label">Potion de Mort</span>
                {witchPotions.death
                  ? <span className="potion-used-tag">Active</span>
                  : <span className="potion-used-tag">Épuisée</span>
                }
              </div>
            </div>
          )}

          {/* Rôles */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">📋 Joueurs &amp; Rôles</div>
            {players.map(p => {
              const role = ROLE_BY_ID[p.roleId]
              const isEditing = editingPlayerId === p.id && editSource === 'sidebar'
              return (
                <div key={p.id} className={`role-list-item${!p.isAlive ? ' dead' : ''}`} style={{ alignItems: 'center' }}>
                  {isEditing ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={editNameValue}
                      onChange={(e) => {
                        editNameValueRef.current = e.target.value
                        setEditNameValue(e.target.value)
                      }}
                      onBlur={() => finishEditing(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); finishEditing(p.id) }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setEditingPlayerId(null)
                          editNameValueRef.current = ''
                        }
                      }}
                      maxLength={20}
                      style={{
                        background: '#1a0f41',
                        color: '#fff',
                        border: '1px solid rgba(232, 180, 249, 0.7)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.85rem',
                        flex: 1,
                        minWidth: 0,
                        outline: 'none',
                        boxShadow: '0 0 0 2px rgba(232, 180, 249, 0.3)',
                      }}
                    />
                  ) : (
                    <span className="role-list-name" style={{ display: 'flex', alignItems: 'center', gap: '3px', flex: 1, minWidth: 0 }}>
                      {p.isPlush && <span aria-hidden="true">🐾</span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      {(p.isInfected || nightActions.infectedTargetId === p.id) && <span title="Infecté" style={{ fontSize: '1em', flexShrink: 0 }}>☣️</span>}
                      {p.isAlive && (
                        <button
                          title="Modifier le nom"
                          aria-label={`Modifier le nom de ${p.name}`}
                          onClick={(e) => { e.stopPropagation(); startEditing(p) }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            padding: '1px 3px',
                            opacity: 0,
                            lineHeight: 1,
                            flexShrink: 0,
                            transition: 'opacity 0.15s',
                          }}
                          className="rename-pencil-sidebar"
                        >
                          ✏️
                        </button>
                      )}
                    </span>
                  )}
                  <span className="role-list-role" style={{ flexShrink: 0 }}>{role?.icon} {role?.name ?? '?'}</span>
                </div>
              )
            })}
          </div>

          <div className="sidebar-spacer" style={{ flex: 1 }} />

          {/* Bouton Règles */}
          <div className="sidebar-footer-action">
            <button
              className="rules-trigger-btn"
              onClick={() => setShowRules(true)}
            >
              <span className="btn-icon">📜</span>
              <span className="btn-text">Règles du Jeu</span>
            </button>
          </div>
          </div>{/* /sidebar-inner */}
        </aside>

        {/* ── Centre : Cercle des Joueurs ───────────────────── */}
        <main ref={circleRef} className="player-circle-zone" aria-label="Cercle des joueurs">

          {showGuidanceBanner && guidanceText && (
            <div 
              className="guidance-banner" 
              role="status" 
              aria-live="polite"
              onClick={() => {
                if (activeGuidanceText) {
                  useGameStore.getState().pushToJournal(activeGuidanceText, 'guidance');
                }
                setShowGuidanceBanner(false);
              }}
              title="Cliquer pour masquer et archiver dans la chronique"
            >
              <span className="guidance-banner-icon">💡</span>
              <span className="guidance-banner-text">{guidanceText}</span>
              <span className="guidance-banner-close" aria-hidden="true">×</span>
            </div>
          )}

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
            const isNightTarget = nightSelection.includes(player.id)
            const isWolvesTarget = nightActions.wolvesVictim === player.id
            const isLover = lovers.includes(player.id)
            const isInfected = player.isInfected || (nightActions.infectedTargetId === player.id)
            const isWildChildModel = player.id === wildChildModelId
            const isRandomHighlighted = highlightedIds.includes(player.id)

            const currentTeam = getPlayerTeam(player, players, useGameStore.getState())
            const tc    = TEAM_CLASS[currentTeam] ?? 'av-village'
            const isSel = selectedId === player.id

            return (
              <div
                key={`${player.id}-${player.name}`}
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
                  {/* Team badges */}
                  {(() => {
                    const model = players.find(p => p.id === wildChildModelId);
                    const isWildChildMutated = player.roleId === 'enfant-sauvage' && model && !model.isAlive;
       
                    
                    if (isInfected) return <div className="av-infected-badge" title="Infection réussie" aria-hidden="true">☣️</div>;
                    if (isWildChildMutated) return <div className="av-wildchild-badge mutated" title="Enfant Sauvage Muté" aria-hidden="true">🐺</div>;
                    
                    if (player.roleId === 'chien-loup') {
                      if (chienLoupSide === 'loup') return <div className="av-dogwolf-badge camp-loup" title="Chien-Loup (Rallié aux Loups)" aria-hidden="true">🐺</div>;
                      if (chienLoupSide === 'village') return <div className="av-dogwolf-badge camp-village" title="Chien-Loup (Resté Villageois)" aria-hidden="true">🏘️</div>;
                    }
                    return null;
                  })()}
                  {isWildChildModel && <div className="av-wildchild-badge" title="Modèle de l'Enfant Sauvage" aria-hidden="true">🌿</div>}
                  {player.id === captainId && <div className="av-captain-badge" title="Capitaine" aria-hidden="true">🎖️</div>}
                  {player.isGroaning && <div className="av-temp-badge" title="L'ours grogne !">🐻</div>}
                  {player.isBearSuspected && <div className="av-temp-badge" style={{ top: -35 }} title="Suspecté par l'Ours">🐻⚠️</div>}
                  {isLover && <div className="av-lover-badge" title="Amoureux" aria-hidden="true">💞</div>}
                  {charmedIds.includes(player.id) && <div className="av-charmed-badge" title="Charmé" aria-hidden="true">🎶</div>}
                  {seenBySeer.includes(player.id) && <div className="av-seer-badge" title="Révélé par la Voyante" aria-hidden="true">👁️</div>}
                  {player.id === corbeauTargetId && <div className="av-corbeau-badge" title="Cible du Corbeau (2 voix)" aria-hidden="true">🐦</div>}
                  
                  <span aria-hidden="true">{role?.icon ?? '❓'}</span>
                  {player.isPlush && <span className="av-plush-badge" aria-hidden="true">🐾</span>}
                  
                  {nightActions.wolvesVictim === player.id && <div className="av-temp-badge" aria-hidden="true">💀</div>}
                  {nightActions.grandMechantVictim === player.id && <div className="av-temp-badge grand-mechant-victim" aria-hidden="true" title="Victime du Grand-Méchant-Loup">💀</div>}
                  {nightActions.witchHealed && nightActions.wolvesVictim === player.id && <div className="av-temp-badge" style={{top: -65}} aria-hidden="true">💖</div>}
                  {nightActions.witchKilled === player.id && <div className="av-temp-badge" aria-hidden="true">☠️</div>}
                  {(player.deathCause === 'white-wolf' || nightActions.whiteWolfVictim === player.id) && <div className="av-temp-badge white-wolf-kill" title="Dévoré par le Loup Blanc" aria-hidden="true">🤍💀</div>}
                  {player.id === chevalierContaminatedWolfId && <div className="av-contaminated-badge" title="Contaminé par la rouille" aria-hidden="true">⚔️</div>}

                  {!player.isAlive && <div className="av-dead-overlay" aria-hidden="true">💀</div>}
                </div>
                <div className="av-name">
                  {editingPlayerId === player.id && editSource === 'avatar' ? (
                    <input
                      type="text"
                      ref={renameInputRef}
                      value={editNameValue}
                      onChange={(e) => {
                        editNameValueRef.current = e.target.value
                        setEditNameValue(e.target.value)
                      }}
                      onBlur={() => finishEditing(player.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') finishEditing(player.id)
                        if (e.key === 'Escape') {
                          setEditingPlayerId(null)
                          setEditSource(null)
                          editNameValueRef.current = ''
                        }
                      }}
                      maxLength={20}
                      onClick={(e) => e.stopPropagation()}
                      className="rename-input-avatar"
                      style={{
                        background: '#1a0f41',
                        color: '#fff',
                        border: '1px solid rgba(232, 180, 249, 0.5)',
                        borderRadius: '4px',
                        padding: '2px 4px',
                        fontSize: '0.9rem',
                        width: '80px',
                        textAlign: 'center'
                      }}
                    />
                  ) : (
                    <span onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEditing(player, 'avatar');
                    }}>
                      {player.name}
                    </span>
                  )}
                </div>
                <div className="av-role">
                  {player.roleId === 'ancien' && ancienLives > 0 ? `Ancien (🛡️ ${ancienLives})` : (role?.name ?? '?')}
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
              {selectedId ? (
                <p style={{marginBottom: 20, color: '#a78bfa', fontWeight: 'bold'}}>
                  ✦ <strong>{players.find(p => p.id === selectedId)?.name}</strong> sélectionné(e) —
                  cliquez sur un autre joueur pour intervertir leur place.
                  <button
                    onClick={() => setSelectedId(null)}
                    style={{ marginLeft: 10, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}
                    aria-label="Annuler la sélection"
                  >✖ Annuler</button>
                </p>
              ) : (
                <p style={{marginBottom: 20}}>
                  👆 Cliquez sur un joueur, puis sur un autre pour <strong>intervertir leur place</strong> dans le cercle. Quand tout est prêt, lancez la partie !
                </p>
              )}
              <button className="btn-launch-night" style={{ alignSelf: 'center' }} onClick={handlePhaseToggle}>
                <span className="moon-icon" aria-hidden="true">🌙</span> Lancer la Partie — Nuit 1
              </button>
            </div>
          )}

          {phase === 'night' && currentStepInfo && currentNightStepId !== 'sorciere' && (
            <div className={`night-step-card ${currentStepInfo.isEnd ? 'end-night' : ''}`}>
              <h3>{ROLE_BY_ID[currentStepInfo.id]?.icon} {currentStepInfo.label}</h3>
              
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
                    }}>🎲 Cupidon IA</button>
                  )}

                  {/* ── Chien-Loup IA ── */}
                  {currentStepInfo.id === 'chien-loup' && players.find(p => p.roleId === 'chien-loup' && p.isAlive)?.isPlush && nightSelection.length === 0 && (
                    <button className="header-btn ai-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const side = Math.random() < 0.5 ? 'village' : 'loup';
                        useGameStore.getState().setChienLoupSide(side);
                        setNightSelection(['done']);
                        const dog = players.find(p => p.roleId === 'chien-loup');
                        if (dog) triggerHighlight([dog.id]);
                    }}>✨ IA : Le Chien-Loup choisit son destin</button>
                  )}

                  {/* ── Enfant Sauvage IA ── */}
                  {currentStepInfo.id === 'enfant-sauvage' && players.find(p => p.roleId === 'enfant-sauvage' && p.isAlive)?.isPlush && !wildChildModelId && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const valids = alive.filter(p => p.roleId !== 'enfant-sauvage' && ROLE_BY_ID[p.roleId]?.team !== 'loup' && !p.isInfected);
                        if(valids.length > 0) {
                          const rnd = valids[Math.floor(Math.random() * valids.length)];
                          commitWildChildModel(rnd.id);
                          setNightSelection([rnd.id]);
                          triggerHighlight([rnd.id]);
                        }
                    }}>🎲 Enfant Sauvage IA</button>
                  )}

                  {/* ── Renard IA ── */}
                  {currentStepInfo.id === 'renard' && players.find(p => p.roleId === 'renard' && p.isAlive)?.isPlush && nightSelection.length === 0 && !foxPowerLost && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const valids = alive.filter(p => p.roleId !== 'renard');
                        if(valids.length > 0) {
                          const rnd = valids[Math.floor(Math.random() * valids.length)];
                          // On relance la logique de handleNightActionSelect pour ce joueur
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
                    }}>🎲 Renard IA (Flair intelligent)</button>
                  )}

                  {/* ── Renard : Affichage résultat Flair ── */}
                  {currentStepInfo.id === 'renard' && (
                    <div style={{ background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 10, textAlign: 'center' }}>
                      {foxPowerLost ? (
                        <p style={{ margin: 0, color: '#ff6b6b', fontWeight: 'bold' }}>❌ Pouvoir perdu (Flair épuisé par une erreur passée).</p>
                      ) : nightSelection.length === 3 ? (
                        <>
                          <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem' }}>🔍 Groupe analysé : <strong>{nightSelection.map(id => players.find(p => p.id === id)?.name).join(', ')}</strong></p>
                          <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: nightActions.foxHasWolf ? '#ff4d4d' : '#4dff88' }}>
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
                    }}>🎲 Voyante IA</button>
                  )}


                  {/* ── Loups IA ── */}
                  {currentStepInfo.id === 'loup-simple' && wolves.every(w => w.isPlush) && !nightActions.wolvesVictim && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const valids = alive.filter(p => !isPlayerWolf(p, players, useGameStore.getState()));
                        if(valids.length > 0) {
                          let target = valids[Math.floor(Math.random() * valids.length)];
                          
                          // Stratégie Fin de Partie : Cibler le Capitaine si alive <= 4
                          if (alive.length <= 4 && captainId) {
                            const cap = valids.find(v => v.id === captainId);
                            if (cap) {
                              const partnerId = lovers.find(id => id !== captainId);
                              const partner = partnerId ? alive.find(p => p.id === partnerId) : null;
                              const isPartnerWolf = partner && (['loup', 'solitaire'].includes(ROLE_BY_ID[partner.roleId]?.team) || partner.isInfected);
                              if (!isPartnerWolf) target = cap;
                            }
                          }

                          useGameStore.getState().commitWolvesVictim(target.id);
                          setNightSelection([target.id]);
                          triggerHighlight([target.id]);
                        }
                    }}>🎲 Loups IA {alive.length <= 4 ? '(Stratégie Capitaine)' : '(Victime Aléatoire)'}</button>
                  )}

                  {/* ── Grand-Méchant-Loup IA ── */}
                  {currentStepInfo.id === 'grand-mechant' && players.find(p => p.roleId === 'grand-mechant' && p.isAlive)?.isPlush && !nightActions.grandMechantVictim && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const valids = alive.filter(p => !isPlayerWolf(p, players, useGameStore.getState()) && p.id !== nightActions.wolvesVictim);
                        if(valids.length > 0) {
                          let target = valids[Math.floor(Math.random() * valids.length)];

                          // Stratégie Fin de Partie : Cibler le Capitaine si alive <= 4
                          if (alive.length <= 4 && captainId) {
                            const cap = valids.find(v => v.id === captainId);
                            if (cap) {
                               const partnerId = lovers.find(id => id !== captainId);
                               const partner = partnerId ? alive.find(p => p.id === partnerId) : null;
                               const isPartnerWolf = partner && (['loup', 'solitaire'].includes(ROLE_BY_ID[partner.roleId]?.team) || partner.isInfected);
                               if (!isPartnerWolf) target = cap;
                            }
                          }

                          commitGrandMechantVictim(target.id);
                          setNightSelection([target.id]);
                          triggerHighlight([target.id]);
                        }
                    }}>🎲 Grand-Méchant-Loup IA {alive.length <= 4 ? '(Stratégie Capitaine)' : ''}</button>
                  )}

                  {/* ── Infect Père IA ── */}
                  {currentStepInfo.id === 'infect-pere' && players.find(p => p.roleId === 'infect-pere' && p.isAlive)?.isPlush && !infectUsed && (
                    <button className="header-btn" disabled={isProcessingAction} style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const valids = alive.filter(p => {
                          const isWolf = isPlayerWolf(p, players, useGameStore.getState());
                          return !isWolf && 
                          p.id !== nightActions.wolvesVictim &&
                          p.id !== nightActions.grandMechantVictim;
                        });
                        
                        if (valids.length > 0) {
                          let target = valids[Math.floor(Math.random() * valids.length)];

                          // Stratégie Fin de Partie : Cibler le Capitaine si alive <= 4
                          if (alive.length <= 4 && captainId) {
                            const cap = valids.find(v => v.id === captainId);
                            if (cap) {
                              const partnerId = lovers.find(id => id !== captainId);
                              const partner = partnerId ? alive.find(p => p.id === partnerId) : null;
                              const isPartnerWolf = partner && (['loup', 'solitaire'].includes(ROLE_BY_ID[partner.roleId]?.team) || partner.isInfected);
                              if (!isPartnerWolf) target = cap;
                            }
                          }

                          useGameStore.getState().pushToJournal(`🤖 L'IA Infect Père décide d'utiliser son pouvoir${alive.length <= 4 ? ' stratégiquement sur le Capitaine' : ''}.`);
                          commitInfection(target.id);
                          setNightSelection([target.id]);
                          triggerHighlight([target.id]);
                        } else {
                          useGameStore.getState().pushToJournal(`🤖 L'IA Infect Père ne trouve aucune cible valide à infecter.`);
                          advanceNightPhase();
                        }
                    }}>🎲 Infect Père IA {alive.length <= 4 ? '(Stratégie Capitaine)' : '(Dès que possible)'}</button>
                  )}

                  {/* ── Loup Blanc IA ── */}
                  {currentStepInfo.id === 'loup-blanc' && players.find(p => p.roleId === 'loup-blanc' && p.isAlive)?.isPlush && !nightActions.whiteWolfVictim && (
                    <button className="header-btn" disabled={isProcessingAction} style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const otherWolves = alive.filter(p => isPlayerWolf(p, players, useGameStore.getState()) && p.id !== players.find(x => x.roleId === 'loup-blanc')?.id);
                        if(otherWolves.length > 0) {
                          const rnd = otherWolves[Math.floor(Math.random() * otherWolves.length)];
                          commitWhiteWolfVictim(rnd.id);
                          setNightSelection([rnd.id]);
                          triggerHighlight([rnd.id]);
                        } else { 
                          advanceNightPhase(); 
                        }
                    }}>🎲 Loup Blanc IA (Élimine un Loup)</button>
                  )}

                  {/* ── Joueur de Flûte IA ── */}
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
                    }}>🎲 Flûtiste IA (Charmer 2 joueurs)</button>
                  )}

                  {/* ── Sorcière IA ── */}
                  {currentStepInfo.id === 'sorciere' && players.find(p => p.roleId === 'sorciere' && p.isAlive)?.isPlush && (witchPotions.life || witchPotions.death) && (
                    <button 
                      className="header-btn" 
                      disabled={isProcessingAction || witchIaUsedForThisStep} 
                      style={{marginBottom: 10, alignSelf:'center'}} 
                      onClick={() => {
                        setWitchIaUsedThisStep(true); // Verrouillage immédiat
                        const witch = players.find(p => p.roleId === 'sorciere' && p.isAlive);
                        const potionProb = 0.1 + (dayNumber * 0.1); // N1: 20%, N2: 30%, N3: 40%...

                        // 1. Potion de Vie
                        if(witchPotions.life && nightActions.wolvesVictim) {
                          const victim = players.find(p => p.id === nightActions.wolvesVictim);
                          const isSelf = victim?.id === witch.id;
                          const isVillageois = ROLE_BY_ID[victim?.roleId]?.team === 'village';

                          if (isSelf) {
                            // Sauvetage automatique de soi-même (100% prob)
                            commitWitchLife(nightActions.wolvesVictim);
                            triggerHighlight([nightActions.wolvesVictim]);
                          } else if (isVillageois && Math.random() < potionProb) {
                            // Sauvetage probabiliste d'un autre villageois
                            commitWitchLife(nightActions.wolvesVictim);
                            triggerHighlight([nightActions.wolvesVictim]);
                          }
                        }

                        // 2. Potion de mort
                        if(witchPotions.death && !nightActions.witchKilled && Math.random() < potionProb) {
                          // Ciblage stratégique : le joueur ayant le score de confiance minimal
                          const storeState = useGameStore.getState();
                          const scores = calculatePlushieVoteScores(witch, alive, storeState);
                          
                          let minScore = Infinity;
                          let candidates = [];

                          Object.entries(scores).forEach(([pid, info]) => {
                             if (pid === witch.id) return;
                             // EXCLUSION OBLIGATOIRE : La victime des loups de cette nuit
                             if (pid === nightActions.wolvesVictim) return;

                             if (info.score < minScore) {
                               minScore = info.score;
                               candidates = [pid];
                             } else if (info.score === minScore) {
                               candidates.push(pid);
                             }
                          });

                          if (candidates.length > 0) {
                            const targetId = candidates[Math.floor(Math.random() * candidates.length)];
                            commitWitchDeath(targetId);
                            triggerHighlight([targetId]);
                          }
                        }
                    }}>🎲 Sorcière IA (Sauvetage Stratégique)</button>
                  )}

                  {/* ── Corbeau IA ── */}
                  {currentStepInfo.id === 'corbeau' && players.find(p => p.roleId === 'corbeau' && p.isAlive)?.isPlush && !nightActions.corbeauTargetId && (
                    <button className="header-btn" style={{marginBottom: 10, alignSelf:'center'}} onClick={() => {
                        const valids = alive.filter(p => p.roleId !== 'corbeau');
                        if(valids.length > 0) {
                          const rnd = valids[Math.floor(Math.random() * valids.length)];
                          useGameStore.getState().commitCorbeauTarget(rnd.id);
                          setNightSelection([rnd.id]);
                          triggerHighlight([rnd.id]);
                        }
                    }}>🎲 Corbeau IA</button>
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
                        <p style={{ margin: 0, color: '#aaa', fontStyle: 'italic', fontSize: '0.9rem' }}>⏳ En attente que Cupidon désigne les amoureux...</p>
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
          )}

          {/* ── Succession du Capitaine ── */}
          {successionPendingForId && (
            <div className="night-step-card end-night" style={{border: '2px solid #ffd700', background: 'rgba(255, 215, 0, 0.1)'}}>
              <h3 style={{color: '#ffd700'}}>🎖️ Succession du Capitaine</h3>
              <p>Le Capitaine précédent a péri. Désignez un successeur parmi les survivants :</p>
              <div style={{display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 15}}>
                {alive.filter(p => p.id !== successionPendingForId).map(p => (
                  <button 
                    key={p.id} 
                    className="header-btn" 
                    style={{padding: '8px 16px'}}
                    onClick={() => {
                      useGameStore.getState().saveHistory();
                      transferCaptaincy(p.id);
                      useGameStore.getState().pushToJournal(`🎖️ ${p.name} a été nommé nouveau Capitaine par son prédécesseur.`, 'event');
                    }}
                  >
                    Nommer {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'day' && !isVoting && !tribunalLocked && !successionPendingForId && (
            <div className="night-step-card end-night">
              <h3>Phase de Jour ☀️ </h3>
              <p>Écoutez les plaidoyers puis préparez-vous au Tribunal.</p>
              <button className="header-btn" style={{marginTop: 15, alignSelf: 'center'}} onClick={() => setIsVoting(true)}>
                ⚖️  Ouvrir le Tribunal du Village
              </button>
            </div>
          )}

          {/* ── Tribunal Verrouillé ──────────────────────────── */}
          {phase === 'day' && tribunalLocked && (
            <div className="tribunal-locked-panel">
              <div style={{fontSize: '2.5rem'}}>🪓</div>
              <h3>Sentence prononcée</h3>
              <div className="condemned-name-display">
                {players.find(p => p.id === condemnedPlayerId)?.name || 'Inconnu'}
              </div>
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
                <h3>Tribunal du Village ⚖️ </h3>
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
                   {isAiVotingLoading ? '🤖 Calcul des probabilités...' : '🤖 IA : Faire Voter les Doudous'}
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
                              {voterId === captainId && t && (
                                <span title="Voix du Capitaine (×2)" style={{color:'#ffd700', fontWeight:'bold', fontSize:'0.8rem'}}>🎖️ ×2</span>
                              )}
                              {v?.isPlush && qaScoringData[voterId] && (
                                 <button style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem'}} onClick={() => setQaModalPlushId(v.id)} title="Audit de vote">📊</button>
                              )}
                            </li>
                          )
                       })}
                     </ul>

                     {(() => {
                        // Décompte pur : Capitaine = 2 voix, Corbeau = +2 sur sa cible.
                        // En cas d'égalité, le Capitaine tranche manuellement (UI ci-dessous),
                        // sans cumuler à nouveau son influence.
                        const { max, victims } = computeVoteTally(dayVotes, { captainId, corbeauTargetId });

                        const everyoneVoted = Object.keys(dayVotes).length === alive.length;

                        if (!everyoneVoted) {
                          return (
                            <div style={{marginTop: 15, padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 8, fontStyle: 'italic', color: '#aaa', textAlign: 'center'}}>
                               En attente des votes de tous les joueurs... ({Object.keys(dayVotes).length} / {alive.length})
                            </div>
                          );
                        }

                        if (max === 0) return null;
                        
                        const captainAlive = players.find(p => p.id === captainId && p.isAlive);

                        return (
                          <div style={{marginTop: 15, padding: 10, background: '#2d0a0a', border: '1px solid #ff4d4d', borderRadius: 8}}>
                            <h4 style={{color: '#ff4d4d', margin: '0 0 10px 0'}}>Issue du Vote :</h4>
                            {victims.length === 1 ? (
                              <>
                                <p>
                                  <strong>{players.find(p=>p.id===victims[0])?.name}</strong> est condamné(e) avec {max} voix.
                                </p>
                                <button className="header-btn" style={{background: '#ff4d4d', color: '#fff', marginTop: 10}} onClick={() => {
                                   useGameStore.getState().saveHistory();
                                   const targetPlayer = players.find(p=>p.id===victims[0]);
                                   useGameStore.getState().eliminatePlayer(victims[0], 'vote');
                                   useGameStore.getState().pushToJournal(`Le village s'est réuni au tribunal et a éliminé ${targetPlayer?.name} (${ROLE_BY_ID[targetPlayer?.roleId]?.name}).`, 'death');
                                   setIsVoting(false);
                                   setTribunalLocked(true);
                                }}>
                                   🪓 Exécuter
                                </button>
                              </>
                            ) : (
                              <div style={{marginTop: 10}}>
                                <p>⚖️  Égalité entre {victims.map(v => players.find(p=>p.id===v)?.name).join(', ')}.</p>
                                {captainAlive ? (
                                  <div style={{marginTop: 10, border: '1px dashed #ffd700', padding: 10, borderRadius: 5}}>
                                     <p style={{fontSize: '0.8rem', color: '#ffd700'}}>Le Capitaine doit trancher l'égalité :</p>
                                     <div style={{display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 5, justifyContent: 'center'}}>
                                        {victims.map(vid => (
                                          <button key={vid} className="header-btn" style={{padding: '6px 12px', fontSize: '0.9rem'}} onClick={() => {
                                             useGameStore.getState().saveHistory();
                                             const targetPlayer = players.find(p=>p.id===vid);
                                             eliminatePlayer(vid, 'vote');
                                             useGameStore.getState().pushToJournal(`Le Capitaine a tranché l'égalité : ${targetPlayer?.name} est condamné(e).`, 'death');
                                             setIsVoting(false);
                                             setTribunalLocked(true);
                                          }}>
                                             Trancher pour {players.find(p=>p.id===vid)?.name}
                                          </button>
                                        ))}
                                     </div>
                                     {captainAlive.isPlush && (
                                       <button 
                                         className="header-btn" 
                                         style={{marginTop: 15, background: '#ffd700', color: '#000', alignSelf: 'center'}}
                                         onClick={() => {
                                           useGameStore.getState().saveHistory();
                                           const validVictims = victims.filter(v => v !== captainId);
                                           const rnd = validVictims.length > 0 
                                             ? validVictims[Math.floor(Math.random() * validVictims.length)]
                                             : victims[Math.floor(Math.random() * victims.length)]; // Fallback improbable
                                           
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
                        <button className="pap-btn" style={{background: '#ffd700', color: '#000'}} onClick={() => { useGameStore.getState().saveHistory(); setCaptain(selectedPlayer.id); }}>
                           🎖️  Désigner Capitaine
                        </button>
                     )}
                   </>
                ) : phase === 'day' ? (
                  <>

                    <button
                      id="btn-eliminate"
                      className="pap-btn eliminate"
                      onClick={() => handleEliminate(selectedPlayer.id)}
                    >
                      💀 Éliminer
                    </button>
                  </>
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
                       <div style={{display:'flex', gap: 10, marginTop: 5}}>
                         <button className="pap-btn save choice-btn" onClick={() => handleNightActionSelect('village')}>
                            <span style={{fontSize: '1.2rem', marginRight: 8}}>🏘️</span> Devenir Villageois
                         </button>
                         <button className="pap-btn eliminate choice-btn" onClick={() => handleNightActionSelect('loup')}>
                            <span style={{fontSize: '1.2rem', marginRight: 8}}>🐺</span> Rejoindre la meute
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
                <button
                  className="pap-btn close-btn"
                  onClick={() => setSelectedId(null)}
                  aria-label="Fermer"
                >✖</button>
              </div>
            </div>
          )}

          {/* MODALE CHASSEUR - Déclenche au moment de sa mort */}
          {chasseurPendingId && (
            <div className="qa-modal-overlay">
              <div className="qa-modal-content" style={{textAlign:'center', padding: '30px 40px'}}>
                <div style={{fontSize: '3rem', marginBottom: 12}}>🔫</div>
                <h2 style={{marginBottom: 8}}>Le Chasseur tire !</h2>
                <p style={{marginBottom: 20, opacity: 0.8}}>Avant de tomber, le Chasseur doit désigner sa cible...</p>
                <div style={{display:'flex', flexDirection:'column', gap: 10, maxHeight: '40vh', overflowY:'auto', marginBottom: 20}}>
                  {alive.map(p => (
                    <button 
                      key={p.id} 
                      className="header-btn" 
                      style={{justifyContent:'flex-start', gap: 12}}
                      onClick={() => {
                        useGameStore.getState().saveHistory();
                        useGameStore.getState().pushToJournal(`🔫 Le Chasseur tire et emporte ${p.name} dans la mort !`, 'death');
                        useGameStore.getState().resolveHunterShot(p.id);
                      }}>
                      {ROLE_BY_ID[p.roleId]?.icon} {p.name}
                    </button>
                  ))}
                </div>
                <button className="header-btn" style={{alignSelf:'center', opacity:0.6}} onClick={() => useGameStore.getState().resolveHunterShot(null)}>
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
                      <button onClick={() => setQaModalPlushId(null)} className="pap-btn close-btn" style={{position:'static',fontSize:'1rem'}}>✖</button>
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
                                      {info.breakdown.map((bk, i) => <div key={i}>• {bk.reason}</div>)}
                                   </div>
                                )}
                             </div>
                          )
                      })}
                   </div>
                </div>
             </div>
          )}

          {/* MODALE GROGNEMENT DE L'OURS */}
          {showBearModal && (
            <div className="qa-modal-overlay bear-growl-overlay" onClick={() => setShowBearModal(false)}>
              <div className="qa-modal-content bear-growl-modal" onClick={e => e.stopPropagation()}>
                <div className="bear-icon-large">🐻</div>
                <h2 className="bear-title">L'ours grogne !</h2>
                <p className="bear-text">Le village se réveille sous les rugissements de l'ours du Montreur...</p>
                <p className="bear-instruction">Annoncez aux villageois que l'ours a senti un danger !</p>
                <button 
                  className="header-btn primary-action" 
                  style={{marginTop: 20, alignSelf:'center', padding: '12px 30px', fontSize: '1.2rem'}}
                  onClick={() => setShowBearModal(false)}
                >
                  Compris
                </button>
              </div>
            </div>
          )}

        </main>

        {/* ── Droite : Le Journal ───────────────────────────── */}
        <aside className={`dashboard-sidebar right${rightCollapsed ? ' collapsed' : ''}`} aria-label="Journal">
          <button
            className="sidebar-toggle"
            onClick={() => setRightCollapsed(v => !v)}
            aria-label={rightCollapsed ? 'Ouvrir la Chronique' : 'Fermer la Chronique'}
            title={rightCollapsed ? 'Ouvrir la Chronique' : 'Fermer la Chronique'}
          >
            {rightCollapsed ? '‹' : '›'}
          </button>
          <div className="sidebar-inner">
          <div className="journal-header">
            <div className="journal-title">📖 Chronique du Village</div>
            {pastStates?.length > 0 && (
              <button className="header-btn" style={{padding: '4px 8px', fontSize: '0.8rem'}} onClick={undoAction}>
                ↩ Annuler
              </button>
            )}
          </div>
          <div ref={journalRef} className="journal-entries" role="log" aria-live="polite">
            {journal.map(entry => (
              <div key={entry.id} className={`journal-entry ${entry.type === 'guidance' ? 'guidance-entry' : ''}`}>
                {entry.type === 'guidance' ? (
                  <span className="jicon-guidance" aria-hidden="true">💡</span>
                ) : (
                  <div className={`jdot ${entry.type}`} aria-hidden="true" />
                )}
                <p className={`jtext ${entry.type}`}>{entry.text}</p>
              </div>
            ))}
          </div>
          </div>{/* /sidebar-inner */}
        </aside>
      </div>

      {/* ═ ═  ÉCRAN DE VICTOIRE ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═  */}
      {winner && (
        <div className="victory-overlay">
           <div className="victory-card">
              <div className="victory-icon">
                 {winner === 'village' && '🏘️'}
                 {winner === 'loups' && '🐺'}
                 {winner === 'joueur-flute' && '🎶'}
                 {winner === 'loup-blanc' && '⚪'}
                 {winner === 'ange' && '😇'}
                 {winner === 'amoureux' && '💖'}
                 {winner === 'aucun' && '💀'}
              </div>
              <h1 className="victory-title">
                 {winner === 'village' && 'Victoire du Village !'}
                 {winner === 'loups' && 'Les Loups-Garous triomphent !'}
                 {winner === 'joueur-flute' && 'Le Joueur de Flûte a envouté tout le monde !'}
                 {winner === 'loup-blanc' && 'Le Loup Blanc est le seul survivant !'}
                 {winner === 'ange' && 'L\'Ange a réussi son martyr !'}
                 {winner === 'amoureux' && 'L\'Amour est plus fort que tout !'}
                 {winner === 'aucun' && 'Tout le monde est mort... Match nul !'}
              </h1>
              <p className="victory-subtitle">La partie est terminée.</p>
              
              <div className="victory-survivors">
                 <h3>Survivants :</h3>
                 <ul>
                    {players.filter(p => p.isAlive).map(p => {
                       const model = players.find(x => x.id === wildChildModelId);
                       const isMutated = p.roleId === 'enfant-sauvage' && model && !model.isAlive;
                       const isDogWolfLoup = p.roleId === 'chien-loup' && chienLoupSide === 'loup';
                       const suffix = p.isInfected ? ' - INFECTÉ 🐺' : (isMutated ? ' - MUTÉ 🐺' : (isDogWolfLoup ? ' - CAMP LOUP 🐺' : ''));
                       return (
                          <li key={p.id}>
                             {ROLE_BY_ID[p.roleId]?.icon} {p.name} ({ROLE_BY_ID[p.roleId]?.name}{suffix})
                          </li>
                       );
                    })}
                    {players.filter(p => p.isAlive).length === 0 && <li>Aucun survivant...</li>}
                 </ul>
              </div>

              <button className="header-btn primary-action" onClick={handleReset} style={{marginTop: 30, padding: '12px 30px', fontSize:'1.2rem'}}>
                 🔄 Nouvelle Partie
              </button>
           </div>
        </div>
      )}
      {/* Modal Succession Capitaine */}
      {successionPendingForId && (
        <div className="succession-overlay">
           <div className="succession-modal">
              <h2>🎖️ Le Dernier Souffle</h2>
              <p>Le Capitaine <strong>{players.find(p => p.id === successionPendingForId)?.name}</strong> a été éliminé.</p>
              <p>Il doit désigner son successeur avant de partir...</p>
              
              <div className="succession-grid">
                 {players.filter(p => p.isAlive).map(p => (
                    <button key={p.id} className="succession-item" onClick={() => transferCaptaincy(p.id)}>
                       <span className="avatar-mini">{ROLE_BY_ID[p.roleId]?.icon}</span>
                       <span className="name">{p.name} {p.isPlush ? '(🧸)' : '(👤)'}</span>
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
                    🎲 Choix Aléatoire
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* ── MODALE : DÉSIGNER UN CAPITAINE ────────────────── */}
      {captainModal && (
        <div className="grimoire-modal-overlay" onClick={() => setCaptainModal(false)}>
          <div className="grimoire-modal" onClick={e => e.stopPropagation()}>
            <div className="grimoire-modal-icon">🎖️</div>
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

      {/* ── MODALE DÉDIÉE : LA SORCIÈRE ────────────────── */}
      {phase === 'night' && currentNightStepId === 'sorciere' && (
        <div className="grimoire-modal-overlay">
          <div className="grimoire-modal" onClick={e => e.stopPropagation()}>
            <div className="grimoire-modal-icon">🧙‍♀️</div>
            <h2>Tour de la Sorcière</h2>
            <p className="grimoire-modal-desc" style={{ color: 'var(--text-body-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Étape dédiée pour préparer les potions de vie et de mort.
            </p>

            <div className="witch-modal-body">
              {/* SECTION POTION DE VIE */}
              <div className={`witch-potion-section${!witchPotions.life ? ' disabled' : ''}`}>
                <div className="witch-potion-header">
                  <span className="witch-potion-title">💖 Potion de Vie</span>
                  {witchPotions.life ? (
                    <label className="switch-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={witchUseLife}
                        onChange={(e) => {
                          if (!nightActions.wolvesVictim) return;
                          setWitchUseLife(e.target.checked);
                        }}
                        disabled={!nightActions.wolvesVictim}
                      />
                      <span>Sauver la victime</span>
                    </label>
                  ) : (
                    <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>Déjà utilisée</span>
                  )}
                </div>
                <div className="witch-potion-detail" style={{ fontSize: '0.9rem', color: '#ccc' }}>
                  {nightActions.wolvesVictim ? (
                    <span>
                      Victime des Loups : <strong>{players.find(p => p.id === nightActions.wolvesVictim)?.name}</strong>
                    </span>
                  ) : (
                    <span>Aucune victime des loups ce soir.</span>
                  )}
                </div>
              </div>

              {/* SECTION POTION DE MORT */}
              <div className={`witch-potion-section${!witchPotions.death ? ' disabled' : ''}`}>
                <div className="witch-potion-header">
                  <span className="witch-potion-title">☠️ Potion de Mort</span>
                  {!witchPotions.death && <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>Déjà utilisée</span>}
                </div>
                {witchPotions.death && (
                  <select
                    className="witch-select"
                    value={witchDeathTarget}
                    onChange={(e) => setWitchDeathTarget(e.target.value)}
                  >
                    <option value="">-- Ne tuer personne --</option>
                    {players
                      .filter(p => p.isAlive && p.roleId !== 'sorciere')
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({ROLE_BY_ID[p.roleId]?.name})
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grimoire-modal-actions">
              {/* Bouton Suggestion IA */}
              {players.some(p => p.roleId === 'sorciere' && p.isAlive) && (witchPotions.life || witchPotions.death) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="grimoire-modal-btn"
                    style={{
                      background: witchIaUsedForThisStep ? 'rgba(255, 255, 255, 0.05)' : 'rgba(167, 139, 250, 0.1)',
                      border: witchIaUsedForThisStep ? '1px solid rgba(255, 255, 255, 0.15)' : '1px dashed #a78bfa',
                      color: witchIaUsedForThisStep ? '#888' : '#a78bfa',
                      padding: '8px 16px',
                      fontSize: '0.9rem',
                      alignSelf: 'center',
                      cursor: witchIaUsedForThisStep ? 'not-allowed' : 'pointer',
                      borderRadius: '8px',
                      width: 'auto'
                    }}
                    onClick={handleWitchIaSelect}
                    disabled={witchIaUsedForThisStep}
                  >
                    🎲 Suggestion Sorcière IA
                  </button>
                  {witchIaUsedForThisStep && (
                    <div style={{ color: '#a78bfa', fontSize: '0.85rem', textAlign: 'center', marginTop: '4px' }}>
                      🤖 Suggestion IA appliquée. (Vous pouvez modifier manuellement)
                    </div>
                  )}
                </div>
              )}

              <button
                className="grimoire-modal-btn confirm"
                onClick={handleWitchValidation}
              >
                🧙‍♀️ Valider les choix et continuer
              </button>

              {pastStates?.length > 0 && (
                <button
                  className="grimoire-modal-btn cancel"
                  onClick={undoAction}
                >
                  ↩ Annuler l'action précédente
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── OVERLAY DE TRANSITION ────────────────────────── */}
      <div className={`phase-transition-overlay${isTransitionActive ? ' active' : ''} ${transitionPhase === 'day' ? 'to-day' : transitionPhase === 'night' ? 'to-night' : ''}`}>
        <div className="phase-transition-content">
          <div className="phase-transition-icon">
            {transitionPhase === 'night' ? '🌙' : '☀️'}
          </div>
          <div className="phase-transition-text">
            {transitionPhase === 'night' ? 'La Nuit Tombe...' : 'Le Jour se Lève...'}
          </div>
        </div>
      </div>

      {/* ── MODALE APRES SAUVEGARDE ────────────────── */}
      {isSaveModalOpen && (
        <div className="grimoire-modal-overlay">
          <div className="grimoire-modal" onClick={e => e.stopPropagation()}>
            <div className="grimoire-modal-icon">💾</div>
            <h2>Partie Sauvegardée !</h2>
            <p>
              Votre progression a bien été enregistrée.<br/>
              Que souhaitez-vous faire ?
            </p>
            <div className="grimoire-modal-actions">
              <button 
                className="grimoire-modal-btn confirm" 
                onClick={() => setIsSaveModalOpen(false)}
              >
                Continuer la partie
              </button>
              <button 
                className="grimoire-modal-btn cancel" 
                onClick={() => {
                  setIsSaveModalOpen(false);
                  navigate('/');
                }}
              >
                Retourner à l'accueil
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}