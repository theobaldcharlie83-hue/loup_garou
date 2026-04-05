/**
 * useGameStore — Zustand store central du Grimoire du Village
 * Gère : joueurs, rôles choisis, phase de jeu, journal d'événements
 */
import { create } from 'zustand'

/* ─── CATALOGUE OFFICIEL "BEST OF" ─────────────────────────── */
export const ROLE_CATALOG = [
  // ── Loups-Garous
  { id: 'loup-simple',   name: 'Simple Loup-Garou',          team: 'loup',      maxQty: 3, icon: '🐺' },
  { id: 'infect-pere',   name: 'Infect Père des Loups',       team: 'loup',      maxQty: 1, icon: '☣️' },
  { id: 'grand-mechant', name: 'Grand-Méchant-Loup',          team: 'loup',      maxQty: 1, icon: '😈' },
  // ── Villageois
  { id: 'villageois',    name: 'Simple Villageois',           team: 'village',   maxQty: 7, icon: '👨‍🌾' },
  { id: 'cupidon',       name: 'Cupidon',                     team: 'village',   maxQty: 1, icon: '💘' },
  { id: 'voyante',       name: 'Voyante',                     team: 'village',   maxQty: 1, icon: '🔮' },
  { id: 'soeurs',        name: 'Les Sœurs',                   team: 'village',   maxQty: 2, icon: '👯' },
  { id: 'petite-fille',  name: 'Petite Fille',                team: 'village',   maxQty: 1, icon: '👧' },
  { id: 'renard',        name: 'Renard',                      team: 'village',   maxQty: 1, icon: '🦊' },
  { id: 'chevalier',     name: "Chevalier à l'Épée Rouillée", team: 'village',   maxQty: 1, icon: '⚔️' },
  { id: 'ancien',        name: 'Ancien',                      team: 'village',   maxQty: 1, icon: '🧙' },
  { id: 'sorciere',      name: 'Sorcière',                    team: 'village',   maxQty: 1, icon: '🧪' },
  { id: 'montreur-ours', name: "Montreur d'Ours",             team: 'village',   maxQty: 1, icon: '🐻' },
  { id: 'chasseur',      name: 'Chasseur',                    team: 'village',   maxQty: 1, icon: '🏹' },
  // ── Ambigus
  { id: 'enfant-sauvage',name: 'Enfant Sauvage',              team: 'ambigu',    maxQty: 1, icon: '🌿' },
  { id: 'chien-loup',    name: 'Chien-Loup',                  team: 'ambigu',    maxQty: 1, icon: '🐕' },
  // ── Solitaires
  { id: 'loup-blanc',    name: 'Loup-Garou Blanc',            team: 'solitaire', maxQty: 1, icon: '🤍' },
  { id: 'joueur-flute',  name: 'Joueur de Flûte',             team: 'solitaire', maxQty: 1, icon: '🎶' },
  { id: 'ange',          name: 'Ange',                        team: 'solitaire', maxQty: 1, icon: '😇' },
]

/* Lookup rapide par id */
export const ROLE_BY_ID = Object.fromEntries(ROLE_CATALOG.map((r) => [r.id, r]))

/* Noms par défaut pour les peluches selon la liste exhaustive */
export const DEFAULT_PLUSH_NAMES = [
  'Marmottin', 'Cacou', 'La poule', 'Lapyro', 'Pinpin', 'Poule en or',
  'La vieille', 'Poussin', 'Loulou', 'La soeur M', 'Le papa M', 'La maman M', 'Le frère M'
]

/* Noms par défaut pour les humains */
export const DEFAULT_HUMAN_NAMES = [
  'Léonie', 'Lise', 'Timéo', 'Papa', 'Maman'
]

/* ─── UTILITAIRE : Fisher-Yates shuffle ────────────────────── */
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ─── ÉTAT INITIAL ─────────────────────────────────────────── */
const initialState = {
  // ── Configuration
  humanCount:    0,
  plushCount:    0,
  humanNames:    [],   // string[]  (length === humanCount)
  plushNames:    [],   // string[]  (length === plushCount, pré-rempli)
  roleSelection: {},   // { [roleId]: qty }

  // ── Joueurs & rôles distribués
  players: [],
  // player shape: { id, name, isPlush, roleId, isAlive, couplePartnerId? }

  // ── Phase de jeu
  phase:     'setup', // 'setup' | 'night' | 'day' | 'interrogation'
  dayNumber: 1,

  // ── Journal des événements
  journal: [],
  // entry shape: { id, timestamp, text, type }

  // ── Interrogatoire
  activeInterrogationPlayerId: null,

  // ── Pouvoirs persistants
  witchPotions: { life: true, death: true },
  lovers: [],              // ['h-1', 'p-2']
  qaScoringData: {},       // Stockage de la matrice d'audit PNJ
  seenBySeer: [],          // IDs espionnés par la voyante
  ancienLives: 2,          // L'Ancien a 2 vies
  infectUsed: false,       // Le test de l'infect a-t-il été utilisé ?

  // ── Actions de la Nuit en cours
  // ex: { wolvesVictim: 'p-1', witchHealed: true, witchKilled: 'h-2', seerSeen: 'h-1' }
  nightActions: {},
  nightStepIndex: -1,
  activeNightSteps: [],

  // ── Fin de Partie
  winner: null,      // null | 'village' | 'loups' | 'joueur-flute' | 'loup-blanc' | 'ange' | 'amoureux' | 'aucun'
  charmedIds: [],    // IDs charmés par le Joueur de Flûte
  wildChildModelId: null,
  chienLoupSide: null, // 'village' | 'loup'
  captainId: null,
  successionPendingForId: null, // ID du capitaine mort en attente de successeur
  
  // Étape 3 : Interrogatoire Pro
  trustGauge: 50,
  unlockedClues: [],
}

/* ─── STORE ─────────────────────────────────────────────────── */
export const useGameStore = create((set, get) => ({
  ...initialState,

  /* ── Compteurs ─────────────────────────────────────────────── */
  setHumanCount: (n) =>
    set((s) => {
      const names = [...s.humanNames]
      while (names.length < n) {
        names.push(DEFAULT_HUMAN_NAMES[names.length % DEFAULT_HUMAN_NAMES.length])
      }
      names.length = n
      return { humanCount: n, humanNames: names }
    }),

  setPlushCount: (n) =>
    set((s) => {
      const names = [...s.plushNames]
      while (names.length < n)
        names.push(DEFAULT_PLUSH_NAMES[names.length % DEFAULT_PLUSH_NAMES.length])
      names.length = n
      return { plushCount: n, plushNames: names }
    }),

  /* ── Noms ──────────────────────────────────────────────────── */
  setHumanName: (index, name) =>
    set((s) => {
      const names = [...s.humanNames]
      names[index] = name
      return { humanNames: names }
    }),

  setPlushName: (index, name) =>
    set((s) => {
      const names = [...s.plushNames]
      names[index] = name
      return { plushNames: names }
    }),

  /* ── Rôles ─────────────────────────────────────────────────── */
  setRoleQty: (roleId, qty) =>
    set((s) => ({
      roleSelection: { ...s.roleSelection, [roleId]: qty },
    })),

  /* ── Interrogatoire ───────────────────────────────────────── */
  setTrustGauge: (val) => set({ trustGauge: Math.max(0, Math.min(100, val)) }),
  addUnlockedClue: (clue) => set(state => ({
    unlockedClues: state.unlockedClues.includes(clue) ? state.unlockedClues : [...state.unlockedClues, clue]
  })),

  getTotalRoles: () =>
    Object.values(get().roleSelection).reduce((sum, q) => sum + q, 0),

  getTotalPlayers: () => get().humanCount + get().plushCount,

  isReadyToStart: () => {
    const s = get()
    const totalPlayers = s.humanCount + s.plushCount
    const totalRoles   = Object.values(s.roleSelection).reduce((sum, q) => sum + q, 0)
    return totalPlayers > 0 && totalRoles === totalPlayers
  },

  /* ── Démarrage : distribution aléatoire des rôles ─────────── */
  startGame: () => {
    const s = get()

    // 1. Construire le pool de rôles mélangé
    const rolePool = []
    Object.entries(s.roleSelection).forEach(([roleId, qty]) => {
      for (let i = 0; i < qty; i++) rolePool.push(roleId)
    })
    const shuffledRoles = shuffle(rolePool)
    const players = []

    s.humanNames.forEach((rawName, i) => {
      players.push({
        id:      `h-${i}`,
        name:    rawName.trim() || `Joueur ${i + 1}`,
        isPlush: false,
        roleId:  shuffledRoles[players.length] ?? null,
        isAlive: true,
        isInfected: false,
        isCaptain: false,
        couplePartnerId: null,
      })
    })

    s.plushNames.forEach((rawName, i) => {
      players.push({
        id:      `p-${i}`,
        name:    rawName.trim() || DEFAULT_PLUSH_NAMES[i % DEFAULT_PLUSH_NAMES.length],
        isPlush: true,
        roleId:  shuffledRoles[players.length] ?? null,
        isAlive: true,
        isInfected: false,
        isCaptain: false,
        couplePartnerId: null,
      })
    })

      set({
      players,
      phase:    'preparation',
      dayNumber: 0,
      journal: [{
        id:        Date.now(),
        timestamp: new Date(),
        text:      "Le village va bientôt s'endormir. Vérifiez et organisez les rôles !",
        type:      'narration',
      }],
      witchPotions: { life: true, death: true },
      lovers: [],
      seenBySeer: [],
      ancienLives: 2,
      infectUsed: false,
      nightActions: {},
      nightStepIndex: -1,
      activeNightSteps: [],
      winner: null,
      charmedIds: [],
      wildChildModelId: null, // BUG-03 fix: doit rester null jusqu'au choix explicite la Nuit 1
      chienLoupSide: null,
      captainId: null,
      successionPendingForId: null,
      hasInterrogatedToday: false,
      dayVotes: {},
    })
  },
  
  setActiveNightSteps: (steps) => set({ activeNightSteps: steps }),

  setDayVotes: (votes) => set({ dayVotes: votes }),
  setInterrogatedToday: (val) => set({ hasInterrogatedToday: val }),
  setQAScoringData: (data) => set({ qaScoringData: data }),
  setNightStepIndex: (valOrFn) => set((s) => ({ 
    nightStepIndex: typeof valOrFn === 'function' ? valOrFn(s.nightStepIndex) : valOrFn 
  })),
  setCharmedIds: (ids) => set({ charmedIds: ids }),
  setWildChildModelId: (id) => set({ wildChildModelId: id }),
  setChienLoupSide: (side) => set({ chienLoupSide: side }),

  setCaptain: (playerId) => set((s) => ({
     captainId: playerId,
     players: s.players.map(p => ({ ...p, isCaptain: p.id === playerId }))
  })),

  transferCaptaincy: (newCaptainId) => set((s) => ({
     captainId: newCaptainId,
     successionPendingForId: null,
     players: s.players.map(p => ({ ...p, isCaptain: p.id === newCaptainId }))
  })),

  triggerAncientCurse: () => {
    set((s) => {
      const newPlayers = s.players.map(p => {
        // Tous les rôles spéciaux du village perdent leurs pouvoirs
        if (p.isAlive && ROLE_BY_ID[p.roleId]?.team === 'village' && p.roleId !== 'villageois' && p.roleId !== 'ancien') {
          return { ...p, roleId: 'villageois' };
        }
        return p;
      });
      return {
        players: newPlayers,
        journal: [
          ...s.journal,
          { id: Date.now(), timestamp: new Date(), text: "⚡ La Malédiction de l'Ancien a frappé ! Tous les villageois spéciaux perdent leurs pouvoirs.", type: 'event' }
        ]
      };
    });
  },

  /* ── Détection Fin de Partie ───────────────────────────────── */
  checkGameOver: () => {
    const s = get();
    const alive = s.players.filter(p => p.isAlive);
    if (alive.length === 0) {
       if (s.winner === null) set({ winner: 'aucun' });
       return;
    }

    // 1. ANGE (Victoire instantanée si mort T1)
    if (s.dayNumber === 1 && s.phase !== 'setup' && s.phase !== 'preparation') {
       const deadAnge = s.players.find(p => !p.isAlive && p.roleId === 'ange');
       if (deadAnge && !s.lovers.includes(deadAnge.id)) {
          // L'ange a gagné s'il meurt au T1 (et n'est pas amoureux)
          set({ winner: 'ange' });
          return;
       }
    }

    // Calcul des camps actuels
    const getTeam = (p) => {
       if (p.isInfected) return 'loup';
       if (p.roleId === 'chien-loup' && s.chienLoupSide) return s.chienLoupSide;
       if (p.roleId === 'enfant-sauvage' && s.wildChildModelId) {
          const model = s.players.find(x => x.id === s.wildChildModelId);
          if (model && !model.isAlive) return 'loup';
       }
       return ROLE_BY_ID[p.roleId]?.team || 'village';
    };

    const aliveWolves = alive.filter(p => getTeam(p) === 'loup');
    const aliveVillagers = alive.filter(p => getTeam(p) === 'village');
    const aliveSolitaries = alive.filter(p => getTeam(p) === 'solitaire');
    const alivePiper = alive.filter(p => p.roleId === 'joueur-flute');
    const aliveWhiteWolf = alive.filter(p => p.roleId === 'loup-blanc');

    // 2. JOUEUR DE FLUTE (Victoire instantanée)
    // BUG-01 fix: !s.infectedPlayerId === alivePiper[0].id était une comparaison booléenne incorrecte
    // Un Joueur de Flûte infecté abandonne son objectif de charme (règle Best Of)
    if (alivePiper.length > 0 && !alivePiper[0].isInfected) {
       const othersAlive = alive.filter(p => p.roleId !== 'joueur-flute');
       const allOthersCharmed = othersAlive.every(p => s.charmedIds.includes(p.id));
       if (allOthersCharmed && othersAlive.length > 0) {
          set({ winner: 'joueur-flute' });
          return;
       }
    }

    // 3. AMOUREUX MIXTES (Victoire finale)
    if (alive.length === 2 && s.lovers.length === 2) {
       const l1 = s.players.find(p => p.id === s.lovers[0]);
       const l2 = s.players.find(p => p.id === s.lovers[1]);
       if (l1.isAlive && l2.isAlive) {
          const t1 = getTeam(l1);
          const t2 = getTeam(l2);
          if (t1 !== t2) {
             set({ winner: 'amoureux' });
             return;
          }
       }
    }

    // 4. LOUP BLANC (Seul survivant)
    if (alive.length === 1 && alive[0].roleId === 'loup-blanc') {
       set({ winner: 'loup-blanc' });
       return;
    }

    // 5. VICTOIRE DES LOUPS
    if (aliveVillagers.length === 0 && aliveSolitaries.length === 0) {
       set({ winner: 'loups' });
       return;
    }

    // 6. VICTOIRE DU VILLAGE
    if (aliveWolves.length === 0 && aliveSolitaries.length === 0) {
       set({ winner: 'village' });
       return;
    }
  },

  /* ── Drag & Drop / Échange Rôles ────────────────────────────── */
  swapRoleSwap: (playerId, newRoleId) => set((s) => {
    // Échange de rôle entre un joueur et le premier qui possède le newRoleId
    const p = [...s.players]
    const sIdx = p.findIndex(x => x.id === playerId)
    if (sIdx === -1) return s
    const oldRoleId = p[sIdx].roleId
    if (oldRoleId === newRoleId) return s

    const tIdx = p.findIndex(x => x.roleId === newRoleId && x.id !== playerId)
    if (tIdx !== -1) {
      p[sIdx].roleId = newRoleId
      p[tIdx].roleId = oldRoleId
    }
    return { players: p }
  }),

  swapPlayers: (id1, id2) => set((s) => {
    if (id1 === id2) return s
    const p = [...s.players]
    const idx1 = p.findIndex(x => x.id === id1)
    const idx2 = p.findIndex(x => x.id === id2)
    if (idx1 !== -1 && idx2 !== -1) {
      const temp = p[idx1]
      p[idx1] = p[idx2]
      p[idx2] = temp
    }
    return { players: p }
  }),

  /* ── Joueurs ────────────────────────────────────────────────── */
  eliminatePlayer: (playerId, mode = 'generic') => {
    const s = get();
    const player = s.players.find((p) => p.id === playerId);
    if (!player || !player.isAlive) return;

    // --- LOGIQUE ANCIEN (SURVIE LOUPS) ---
    // Ne survit que face aux attaques de loups (Simple, Infect Pere, Grand Mechant)
    if (player.roleId === 'ancien' && mode === 'wolves' && s.ancienLives > 1) {
       set({ 
         ancienLives: s.ancienLives - 1,
         journal: [
           ...s.journal,
           { id: Date.now(), timestamp: new Date(), text: `🧙 L'Ancien (${player.name}) survit à l'attaque des loups ! (🛡️ 1 vie restante)`, type: 'event' }
         ]
       });
       return;
    }

    let newPlayers = s.players.map(p => p.id === playerId ? { ...p, isAlive: false } : p);
    let newJournal = [
      ...s.journal,
      { id: Date.now(), timestamp: new Date(), text: `${player.name} (${ROLE_BY_ID[player.roleId]?.name}) a été éliminé(e).`, type: 'death' }
    ];

    // --- MALÉDICTION DE L'ANCIEN ---
    // Se déclenche si tué par le Village (Vote, Potion Mort, Chasseur)
    if (player.roleId === 'ancien' && ['vote', 'witch-death', 'hunter'].includes(mode)) {
       set({ players: newPlayers, journal: newJournal });
       get().triggerAncientCurse();
       get().checkGameOver();
       return;
    }

    // --- GESTION AMOUREUX (MORT PAR CHAGRIN) ---
    if (s.lovers.includes(playerId)) {
       const partnerId = s.lovers.find(id => id !== playerId);
       const partner = s.players.find(p => p.id === partnerId);
       if (partner && partner.isAlive) {
          newPlayers = newPlayers.map(p => p.id === partnerId ? { ...p, isAlive: false } : p);
          newJournal.push({ 
            id: Date.now() + 1, 
            timestamp: new Date(), 
            text: `💔 ${partner.name} succombe à son chagrin d'amour pour ${player.name}...`, 
            type: 'death' 
          });
       }
    }

    set({ players: newPlayers, journal: newJournal });

    // --- SUCCESSION CAPITAINE ---
    if (player.id === s.captainId) {
       set({ successionPendingForId: player.id });
    }

    get().checkGameOver();
  },

  /* ── Actions de Nuit & Pouvoirs ─────────────────────────────── */
  setNightAction: (key, val) =>
    set((s) => ({ nightActions: { ...s.nightActions, [key]: val } })),

  pushToJournal: (text, type = 'event') => set((s) => ({
    journal: [...s.journal, { id: Date.now() + Math.random(), timestamp: new Date(), text, type }]
  })),

  commitSeerObservation: (playerId) => set((s) => {
    return {
      seenBySeer: [...s.seenBySeer, playerId],
      nightActions: { ...s.nightActions, seerSeen: playerId },
    }
  }),

  commitWolvesVictim: (playerId) => set((s) => {
    return { nightActions: { ...s.nightActions, wolvesVictim: playerId } }
  }),

  commitWitchLife: (playerId) => set((s) => {
    const p = s.players.find(x => x.id === playerId);
    const isAncien = p?.roleId === 'ancien';
    return {
      witchPotions: { ...s.witchPotions, life: false },
      nightActions: { ...s.nightActions, witchHealed: true },
      ancienLives: isAncien ? 2 : s.ancienLives,
    }
  }),

  commitWitchDeath: (playerId) => set((s) => {
    return {
      witchPotions: { ...s.witchPotions, death: false },
      nightActions: { ...s.nightActions, witchKilled: playerId },
    }
  }),

  commitLovers: (id1, id2) => set((s) => {
    return { lovers: [id1, id2] }
  }),

  commitInfection: (playerId) => set((s) => {
    const p = s.players.find(x => x.id === playerId);
    if (p?.roleId === 'ancien') {
      return { infectUsed: true } // L'Ancien est immunisé
    }
    return {
      infectUsed: true,
      nightActions: { ...s.nightActions, infectedTargetId: playerId }
    }
  }),

  commitWildChildModel: (playerId) => set({ wildChildModelId: playerId }),

  commitGrandMechantVictim: (playerId) => set((s) => ({
    nightActions: { ...s.nightActions, grandMechantVictim: playerId }
  })),

  commitWhiteWolfVictim: (playerId) => set((s) => ({
    nightActions: { ...s.nightActions, whiteWolfVictim: playerId }
  })),

  wakeUpVillage: () => {
    const s = get()
    const nightA = s.nightActions
    const toKill = []

    // 1. Résolution Infection (immédiat pour que eliminatePlayer voit le bon état si besoin)
    if (nightA.wolvesVictim && nightA.infectedTargetId === nightA.wolvesVictim) {
      set((state) => ({
        players: state.players.map(p => 
          p.id === nightA.wolvesVictim ? { ...p, isInfected: true } : p
        ),
        infectUsed: true
      }));
    } else if (nightA.wolvesVictim && !nightA.witchHealed) {
      toKill.push({ id: nightA.wolvesVictim, by: 'wolves' })
    }

    // 2. Autres morts de nuit
    if (nightA.witchKilled) {
      toKill.push({ id: nightA.witchKilled, by: 'witch-death' })
    }
    if (nightA.grandMechantVictim) {
      toKill.push({ id: nightA.grandMechantVictim, by: 'wolves' })
    }
    if (nightA.whiteWolfVictim) {
      toKill.push({ id: nightA.whiteWolfVictim, by: 'wolves' })
    }

    // 3. Exécution des éliminations (met à jour le store séquentiellement)
    toKill.forEach(k => {
      get().eliminatePlayer(k.id, k.by)
    })

    const updatedState = get();

    // 4. LOGIQUE MONTREUR D'OURS (Basé sur le NOUVEL état)
    const bearTamer = updatedState.players.find(p => p.roleId === 'montreur-ours' && p.isAlive);
    if (bearTamer) {
       const alivePlayers = updatedState.players.filter(p => p.isAlive);
       const bearIdx = alivePlayers.findIndex(p => p.id === bearTamer.id);
       const n = alivePlayers.length;
       const leftNeighbor = alivePlayers[(bearIdx - 1 + n) % n];
       const rightNeighbor = alivePlayers[(bearIdx + 1) % n];
       
       const isWolf = (p) => {
          if (p.isInfected) return true;
          return ROLE_BY_ID[p.roleId]?.team === 'loup';
       }

       if (bearTamer.isInfected || isWolf(leftNeighbor) || isWolf(rightNeighbor)) {
          updatedState.pushToJournal("GRRRRR ! L'ours du montreur a senti une présence maléfique...", 'event');
       }
    }

    // 5. Finalisation du réveil (Sans écraser updatedPlayers)
    set({
      phase: 'day',
      nightActions: {},
      hasInterrogatedToday: false,
      dayVotes: {},
      trustGauge: 50,     // Reset interrogatoire
      unlockedClues: [],  // Reset indices
      journal: [
        ...get().journal,
        { id: Date.now(), timestamp: new Date(), text: `Jour ${updatedState.dayNumber} — Le village se réveille.`, type: 'phase' }
      ]
    })
    get().checkGameOver();
  },

  /* ── Phases ─────────────────────────────────────────────────── */
  setPhase: (phase) =>
    set((s) => {
      if (phase === 'night') {
        // Phase de transition depuis Préparation
        if (s.phase === 'preparation') {
           return {
             phase: 'night',
             dayNumber: 1,
             nightActions: {},
             nightStepIndex: -1,
             activeNightSteps: [],
             journal: [...s.journal, { id: Date.now(), timestamp: new Date(), text: `Nuit 1 — Le village s'endort…`, type: 'phase' }]
           }
        }

        const nextDay = s.dayNumber + 1;
        return {
          phase,
          dayNumber: nextDay,
          nightActions: {},
          nightStepIndex: -1,
          activeNightSteps: [],
          journal: [
             ...s.journal, 
             { id: Date.now(), timestamp: new Date(), text: `Nuit ${nextDay} — Le village s'endort…`, type: 'phase' }
          ]
        }
      }
      return { phase }
    }),

  /* ── Interrogatoire ───────────────────────────────────────── */
  startInterrogation: (playerId) =>
    set({ activeInterrogationPlayerId: playerId, phase: 'interrogation' }),

  endInterrogation: () =>
    set({ activeInterrogationPlayerId: null, phase: 'day' }),

  /* ── Journal ────────────────────────────────────────────────── */
  addJournalEntry: (text, type = 'event') =>
    set((s) => ({
      journal: [
        ...s.journal,
        { id: Date.now(), timestamp: new Date(), text, type },
      ],
    })),

  /* ── Sorcière ───────────────────────────────────────────────── */
  useWitchPotion: (type) =>
    set((s) => ({
      witchPotions: { ...s.witchPotions, [type]: false },
    })),

  /* ── Reset ──────────────────────────────────────────────────── */
  resetGame: () => set(initialState),
}))
