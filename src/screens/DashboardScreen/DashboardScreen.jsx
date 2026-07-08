import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore, ROLE_BY_ID, isPlayerWolf } from '../../store/useGameStore'
import { calculatePlushieVoteScores } from '../../services/scoringEngine'
import { decideWitchAction } from '../../services/aiStrategies'
import RulesModal from '../../components/RulesModal/RulesModal'
import HunterModal from './components/HunterModal'
import ScoringAuditModal from './components/ScoringAuditModal'
import BearGrowlModal from './components/BearGrowlModal'
import VictoryOverlay from './components/VictoryOverlay'
import SuccessionModal from './components/SuccessionModal'
import CaptainModal from './components/CaptainModal'
import WitchModal from './components/WitchModal'
import SaveModal from './components/SaveModal'
import PlayerCircle from './components/PlayerCircle'
import NightStepCard from './components/NightStepCard'
import TribunalPanel from './components/TribunalPanel'
import PlayerActionPanel from './components/PlayerActionPanel'
import PhaseTransitionOverlay from './components/PhaseTransitionOverlay'
import { PHASE_META, NIGHT_ORDER, getGuidanceMessage } from './dashboardConstants'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import './DashboardScreen.css'

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

    nightStepIndex, setNightStepIndex,
    activeNightSteps, setActiveNightSteps,
    winner, charmedIds, setCharmedIds,
    captainId, setCaptain, transferCaptaincy, pendingInteractions,
    isVoting, setIsVoting, tribunalLocked, setTribunalLocked,
    chevalierContaminatedWolfId, chienLoupSide,
    commitFoxAction, undoAction, pastStates,
    renamePlayer, saveGameToLocalStorage,
    corbeauTargetId,
  } = useGameStore()

  // Résolution interactive en tête de file (succession du Capitaine / tir du Chasseur).
  // On n'en traite qu'une à la fois — la file garantit l'enchaînement correct.
  const currentInteraction = pendingInteractions?.[0] ?? null
  const successionPendingForId = currentInteraction?.type === 'succession' ? currentInteraction.playerId : null
  const chasseurPendingId = currentInteraction?.type === 'hunter' ? currentInteraction.playerId : null

  const [selectedId, setSelectedId] = useState(null)
  const circleRef    = useRef(null)
  const journalRef   = useRef(null)
  const [dims, setDims] = useState({ cx: 0, cy: 0, rx: 0, ry: 0 })

  const [nightSelection, setNightSelection] = useState([])
  const [isAiVotingLoading, setIsAiVotingLoading] = useState(false)

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
  const [saveSuccess, setSaveSuccess] = useState(true)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Piège de focus (accessibilité) pour la modale de confirmation de reconfiguration
  // (les autres modales — Capitaine, Sauvegarde, Règles... — gèrent leur propre piège).
  const resetModalRef = useRef(null)
  useFocusTrap(resetModalRef, showResetConfirm, () => setShowResetConfirm(false))
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

  /* ── Repli automatique des sidebars la nuit ────────────────────
     La nuit, le MJ n'a besoin que de l'étape en cours et du cercle ;
     on replie le Grimoire et la Chronique pour dégager l'écran. Le MJ
     peut les rouvrir manuellement sans que cet effet ne les referme
     (il ne se redéclenche qu'au changement de phase, pas au toggle). */
  useEffect(() => {
    const collapsed = phase === 'night'
    setLeftCollapsed(collapsed)
    setRightCollapsed(collapsed)
  }, [phase]);

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
  }, [phase, dayNumber, players, nightStepIndex, infectUsed, lovers.length, setActiveNightSteps, setNightStepIndex])

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
  const swapPlayers = useGameStore((s) => s.swapPlayers)
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
    // Le pouvoir du Chasseur (s'il s'agit de lui) est déclenché par le store, qui
    // empile une interaction 'hunter' dans pendingInteractions.
    setSelectedId(null)
  }

  const handleReset = () => { useGameStore.getState().resetGame(); navigate('/') }

  const handleSave = () => {
    const ok = saveGameToLocalStorage()
    setSaveSuccess(ok)
    setIsSaveModalOpen(true)
  }

  const handleWitchIaSelect = () => {
    const witch = players.find(p => p.roleId === 'sorciere' && p.isAlive)
    if (!witch) return

    const { useLife, deathTargetId } = decideWitchAction({
      witch, players, alive, storeState: useGameStore.getState(),
      dayNumber, witchPotions, nightActions,
    })

    setWitchUseLife(useLife)
    setWitchDeathTarget(deathTargetId || '')
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
                <>
                  {!tribunalLocked && (
                    <span className="header-disabled-hint" role="status">
                      Votez et condamnez un joueur pour pouvoir endormir le village
                    </span>
                  )}
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
                </>
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
          <button id="btn-reset" className="header-btn" onClick={() => setShowResetConfirm(true)}>
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
                        background: 'var(--color-input-bg)',
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
                            opacity: 0.5,
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

          <PlayerCircle
            players={players}
            dims={dims}
            nightSelection={nightSelection}
            nightActions={nightActions}
            lovers={lovers}
            wildChildModelId={wildChildModelId}
            highlightedIds={highlightedIds}
            selectedId={selectedId}
            captainId={captainId}
            charmedIds={charmedIds}
            seenBySeer={seenBySeer}
            corbeauTargetId={corbeauTargetId}
            chevalierContaminatedWolfId={chevalierContaminatedWolfId}
            chienLoupSide={chienLoupSide}
            ancienLives={ancienLives}
            editingPlayerId={editingPlayerId}
            editSource={editSource}
            editNameValue={editNameValue}
            editNameValueRef={editNameValueRef}
            renameInputRef={renameInputRef}
            startEditing={startEditing}
            finishEditing={finishEditing}
            setEditingPlayerId={setEditingPlayerId}
            setEditSource={setEditSource}
            setEditNameValue={setEditNameValue}
            handleAvatar={handleAvatar}
            handleDragStart={handleDragStart}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
          />

          {phase === 'preparation' && (
            <div className="night-step-card end-night">
              <h3>Répartition et Vérification</h3>
              {selectedId ? (
                <p style={{marginBottom: 20, color: 'var(--color-accent-ai)', fontWeight: 'bold'}}>
                  ✦ <strong>{players.find(p => p.id === selectedId)?.name}</strong> sélectionné(e) —
                  cliquez sur un autre joueur pour intervertir leur place.
                  <button
                    onClick={() => setSelectedId(null)}
                    style={{ marginLeft: 10, background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.85rem' }}
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
            <NightStepCard
              currentStepInfo={currentStepInfo}
              nightSelection={nightSelection}
              setNightSelection={setNightSelection}
              triggerHighlight={triggerHighlight}
              advanceNightPhase={advanceNightPhase}
              handlePhaseToggle={handlePhaseToggle}
              isProcessingAction={isProcessingAction}
            />
          )}

          <TribunalPanel
            alive={alive}
            isAiVotingLoading={isAiVotingLoading}
            handlePlushiesVote={handlePlushiesVote}
            setQaModalPlushId={setQaModalPlushId}
            setHighlightedIds={setHighlightedIds}
            handlePhaseToggle={handlePhaseToggle}
          />

          {/* Panel actions joueur sélectionné */}
          <PlayerActionPanel
            selectedPlayer={selectedPlayer}
            currentNightStepId={currentNightStepId}
            nightSelection={nightSelection}
            handleNightActionSelect={handleNightActionSelect}
            handleEliminate={handleEliminate}
            setCaptain={setCaptain}
            setSelectedId={setSelectedId}
            startEditing={startEditing}
          />

          {/* MODALE CHASSEUR - Déclenche au moment de sa mort */}
          <HunterModal
            chasseurPendingId={chasseurPendingId}
            alive={alive}
          />

          {/* MODALE QA AUDIT DES PELUCHES */}
          <ScoringAuditModal
            qaModalPlushId={qaModalPlushId}
            players={players}
            onClose={() => setQaModalPlushId(null)}
          />

          {/* MODALE GROGNEMENT DE L'OURS */}
          <BearGrowlModal show={showBearModal} onClose={() => setShowBearModal(false)} />

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
      <VictoryOverlay
        winner={winner}
        players={players}
        wildChildModelId={wildChildModelId}
        chienLoupSide={chienLoupSide}
        onReset={handleReset}
      />
      {/* Modal Succession Capitaine */}
      <SuccessionModal
        successionPendingForId={successionPendingForId}
        players={players}
        transferCaptaincy={transferCaptaincy}
      />

      {/* ── MODALE : DÉSIGNER UN CAPITAINE ────────────────── */}
      <CaptainModal show={captainModal} onClose={() => setCaptainModal(false)} />

      {/* ── MODALE DÉDIÉE : LA SORCIÈRE ────────────────── */}
      <WitchModal
        show={phase === 'night' && currentNightStepId === 'sorciere'}
        players={players}
        nightActions={nightActions}
        witchPotions={witchPotions}
        witchUseLife={witchUseLife}
        setWitchUseLife={setWitchUseLife}
        witchDeathTarget={witchDeathTarget}
        setWitchDeathTarget={setWitchDeathTarget}
        witchIaUsedForThisStep={witchIaUsedForThisStep}
        onWitchIaSelect={handleWitchIaSelect}
        onValidate={handleWitchValidation}
        undoAction={undoAction}
        pastStates={pastStates}
      />

      {/* ── OVERLAY DE TRANSITION ────────────────────────── */}
      <PhaseTransitionOverlay active={isTransitionActive} phase={transitionPhase} />

      {/* ── MODALE APRES SAUVEGARDE ────────────────── */}
      <SaveModal
        show={isSaveModalOpen}
        success={saveSuccess}
        onContinue={() => setIsSaveModalOpen(false)}
        onGoHome={() => { setIsSaveModalOpen(false); navigate('/'); }}
      />

      {/* ── MODALE : CONFIRMATION DE RECONFIGURATION ────────── */}
      {showResetConfirm && (
        <div className="grimoire-modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="grimoire-modal" ref={resetModalRef} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="grimoire-modal-icon">⚠️</div>
            <h2>Quitter la partie en cours ?</h2>
            <p>
              Reconfigurer va <strong>effacer la partie en cours</strong> et revenir à l'écran de préparation.<br/>
              Pensez à sauvegarder si vous souhaitez la reprendre plus tard.
            </p>
            <div className="grimoire-modal-actions">
              <button
                className="grimoire-modal-btn confirm"
                onClick={() => {
                  saveGameToLocalStorage();
                  setShowResetConfirm(false);
                  handleReset();
                }}
              >
                💾 Sauvegarder puis quitter
              </button>
              <button
                className="grimoire-modal-btn cancel"
                onClick={() => {
                  setShowResetConfirm(false);
                  handleReset();
                }}
              >
                Quitter sans sauvegarder
              </button>
              <button
                className="grimoire-modal-btn"
                onClick={() => setShowResetConfirm(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}