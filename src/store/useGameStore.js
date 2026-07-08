/**
 * useGameStore — Zustand store central du Grimoire du Village
 * Gère : joueurs, rôles choisis, phase de jeu, journal d'événements
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/* Numéro de schéma des sauvegardes — incrémenter à chaque changement de forme
   de l'état persisté, afin que les migrations puissent combler les champs
   manquants sur d'anciennes sauvegardes. */
export const SAVE_SCHEMA_VERSION = 1

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
  { id: 'renard',        name: 'Renard',                      team: 'village',   maxQty: 1, icon: '🦊' },
  { id: 'chevalier',     name: "Chevalier à l'Épée Rouillée", team: 'village',   maxQty: 1, icon: '⚔️' },
  { id: 'ancien',        name: 'Ancien',                      team: 'village',   maxQty: 1, icon: '🧙' },
  { id: 'sorciere',      name: 'Sorcière',                    team: 'village',   maxQty: 1, icon: '🧪' },
  { id: 'montreur-ours', name: "Montreur d'Ours",             team: 'village',   maxQty: 1, icon: '🐻' },
  { id: 'chasseur',      name: 'Chasseur',                    team: 'village',   maxQty: 1, icon: '🏹' },
  { id: 'corbeau',       name: 'Corbeau',                     team: 'village',   maxQty: 1, icon: '🐦' },
  // ── Ambigus
  { id: 'enfant-sauvage',name: 'Enfant Sauvage',              team: 'ambigu',    maxQty: 1, icon: '🌿' },
  { id: 'chien-loup',    name: 'Chien-Loup',                  team: 'ambigu',    maxQty: 1, icon: '🐕' },
  // ── Solitaires
  { id: 'loup-blanc',    name: 'Loup-Garou Blanc',            team: 'solitaire', maxQty: 1, icon: '🤍' },
  { id: 'joueur-flute',  name: 'Joueur de Flûte',             team: 'solitaire', maxQty: 1, icon: '🎶' },
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
  'Timéo', 'Lise', 'Léonie', 'Papa', 'Maman'
]

/* ─── UTILITAIRE : identifiant unique pour les entrées de journal ─────
   Date.now() peut produire des doublons quand plusieurs entrées sont
   poussées dans le même tick (ex. cascade de morts), ce qui casse les
   `key` React (rendu dupliqué/omis) et l'égalité des entrées. */
function newId() {
  return crypto.randomUUID()
}

/* ─── UTILITAIRE : Fisher-Yates shuffle ────────────────────── */
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ─── UTILITAIRES DE CAMP ────────────────────────────────────── */
export const getPlayerTeam = (player, players, state) => {
  if (!player) return 'village';
  if (player.isInfected) return 'loup';
  if (player.roleId === 'soeurs') return 'village';
  if (player.roleId === 'chien-loup' && state.chienLoupSide) return state.chienLoupSide;
  if (player.roleId === 'enfant-sauvage' && state.wildChildModelId) {
    const model = players.find(x => x.id === state.wildChildModelId);
    if (model && !model.isAlive) return 'loup';
  }
  return ROLE_BY_ID[player.roleId]?.team || 'village';
};

/**
 * Détecte si un joueur appartient à la meute des Loups (dynamique)
 * Inclut : Loups de base, Infectés, Chien-Loup rallié, Enfant Sauvage muté, Loup Blanc (pourtant solitaire)
 */
export const isPlayerWolf = (player, players, state) => {
  if (!player) return false;
  return getPlayerTeam(player, players, state) === 'loup' || player.roleId === 'loup-blanc';
};

/* ─── ÉTAT INITIAL ─────────────────────────────────────────── */
const initialState = {
  // ── Configuration
  activeSaveId:  null, // ID de la sauvegarde active
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



  // ── Pouvoirs persistants
  witchPotions: { life: true, death: true },
  witchSavedPlayerIds: [], // Liste persistante des IDs sauvés par la sorcière
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
  nightHistorySnapshot: null, // Sauvegarde de l'état précédent la nuit


  // ── Fin de Partie
  winner: null,      // null | 'village' | 'loups' | 'joueur-flute' | 'loup-blanc' | 'amoureux' | 'aucun'
  charmedIds: [],    // IDs charmés par le Joueur de Flûte
  wildChildModelId: null,
  chienLoupSide: null, // 'village' | 'loup'
  captainId: null,
  successionPendingForId: null, // ID du capitaine mort en attente de successeur
  hunterPendingId: null, // ID du Chasseur mort en attente de son tir

  // ── Historique global pour l'annulation
  pastStates: [],



  // ── Tribunal
  dayVotes: {},        // { [voterId]: targetId }
  isVoting: false,
  tribunalLocked: false,
  condemnedPlayerId: null,

  // ── Chevalier à l'Épée Rouillée
  chevalierContaminatedWolfId: null,
  chevalierContaminationDay: null,
  chevalierDeadWolfRevealId: null,
  chevalierRevengeData: null, // { chevalierId, wolfId }
  corbeauTargetId: null,      // Cible désignée par le corbeau
  foxPowerLost: false,        // Le renard a-t-il perdu son pouvoir ?
  foxHistory: [],             // Historique des flairs du Renard : [{ centralId, hasWolf, groupIds }]
  hasWhiteWolfKilledWolf: false, // Le Loup Blanc a-t-il déjà trahi sa meute ?
}

/* ─── STORE ─────────────────────────────────────────────────── */
export const useGameStore = create(persist((set, get) => ({
  ...initialState,

  /* ── Compteurs ─────────────────────────────────────────────── */
  setHumanCount: (n) =>
    set((s) => {
      const names = [...s.humanNames]
      while (names.length < n) {
        const nextIndex = names.length;
        if (nextIndex < DEFAULT_HUMAN_NAMES.length) {
          names.push(DEFAULT_HUMAN_NAMES[nextIndex]);
        } else {
          names.push(`Joueur ${nextIndex + 1}`);
        }
      }
      names.length = n
      return { humanCount: n, humanNames: names }
    }),

  setPlushCount: (n) =>
    set((s) => {
      const names = [...s.plushNames]
      while (names.length < n) {
        const nextIndex = names.length;
        if (nextIndex < DEFAULT_PLUSH_NAMES.length) {
          names.push(DEFAULT_PLUSH_NAMES[nextIndex]);
        } else {
          names.push(`Peluche numéro ${nextIndex + 1}`);
        }
      }
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

  renamePlayer: (playerId, newName) =>
    set((s) => {
      const cleanName = newName.trim();
      if (!cleanName) return {};

      // 1. Update players array
      const oldName = s.players.find(p => p.id === playerId)?.name || '';
      if (!oldName || oldName === cleanName) return {};

      const newPlayers = s.players.map(p =>
        p.id === playerId ? { ...p, name: cleanName } : p
      );

      // 2. Update humanNames or plushNames if applicable
      const newHumanNames = [...s.humanNames];
      const newPlushNames = [...s.plushNames];
      if (playerId.startsWith('h-')) {
        const index = parseInt(playerId.substring(2), 10);
        if (index >= 0 && index < newHumanNames.length) {
          newHumanNames[index] = cleanName;
        }
      } else if (playerId.startsWith('p-')) {
        const index = parseInt(playerId.substring(2), 10);
        if (index >= 0 && index < newPlushNames.length) {
          newPlushNames[index] = cleanName;
        }
      }

      // 3. Update journal entries (replace historical occurrences of oldName with cleanName)
      const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedOldName = escapeRegExp(oldName);
      const oldNameRegex = new RegExp(`(?<![a-zA-Z0-9À-ÿ-])${escapedOldName}(?![a-zA-Z0-9À-ÿ-])`, 'g');

      const newJournal = s.journal.map(entry => {
        if (entry.text && entry.text.includes(oldName)) {
          return {
            ...entry,
            text: entry.text.replace(oldNameRegex, cleanName)
          };
        }
        return entry;
      });

      return {
        players: newPlayers,
        humanNames: newHumanNames,
        plushNames: newPlushNames,
        journal: newJournal
      };
    }),

  /* ── Rôles ─────────────────────────────────────────────────── */
  setRoleQty: (roleId, qty) =>
    set((s) => ({
      roleSelection: { ...s.roleSelection, [roleId]: qty },
    })),



  getTotalRoles: () =>
    Object.values(get().roleSelection).reduce((sum, q) => sum + q, 0),

  getTotalPlayers: () => get().humanCount + get().plushCount,

  isReadyToStart: () => {
    const s = get()
    const totalPlayers = s.humanCount + s.plushCount
    const totalRoles   = Object.values(s.roleSelection).reduce((sum, q) => sum + q, 0)
    // Bloquer si les Sœurs sont à 1 (elles doivent être 0 ou 2)
    const soeurQty = s.roleSelection['soeurs'] ?? 0
    if (soeurQty === 1) return false
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
        isBearSuspected: false,
      })
    })

    s.plushNames.forEach((rawName, i) => {
      let finalName = rawName.trim();
      if (!finalName) {
        if (i < DEFAULT_PLUSH_NAMES.length) {
          finalName = DEFAULT_PLUSH_NAMES[i];
        } else {
          finalName = `Peluche numéro ${i + 1}`;
        }
      }
      players.push({
        id:      `p-${i}`,
        name:    finalName,
        isPlush: true,
        roleId:  shuffledRoles[players.length] ?? null,
        isAlive: true,
        isInfected: false,
        isCaptain: false,
        couplePartnerId: null,
        isBearSuspected: false,
      })
    })

    // Repartir de l'état initial pour TOUS les champs de partie (pouvoirs, journal,
    // tribunal, historique...), à l'exception des champs de configuration du Setup
    // (humanCount, plushCount, noms, sélection de rôles, sauvegarde active) qu'on
    // conserve tels quels. Ainsi tout nouveau champ ajouté à initialState est
    // automatiquement réinitialisé au démarrage, sans risque d'oubli.
    const {
      humanCount: _humanCount, plushCount: _plushCount,
      humanNames: _humanNames, plushNames: _plushNames,
      roleSelection: _roleSelection, activeSaveId: _activeSaveId,
      ...resetFields
    } = initialState

    set({
      ...resetFields,
      players,
      phase:    'preparation',
      dayNumber: 0,
      journal: [{
        id: newId(),
        timestamp: new Date(),
        text:      "Le village va bientôt s'endormir. Vérifiez et organisez les rôles !",
        type:      'narration',
      }],
    })
  },
  
  setActiveNightSteps: (steps) => set({ activeNightSteps: steps }),

  setDayVotes: (votes) => set({ dayVotes: votes }),

  setQAScoringData: (data) => set({ qaScoringData: data }),
  setNightStepIndex: (valOrFn) => set((s) => {
    const newIndex = typeof valOrFn === 'function' ? valOrFn(s.nightStepIndex) : valOrFn;
    return { nightStepIndex: newIndex };
  }),

  saveHistory: () => set((s) => {
    const snapshot = { ...s };
    delete snapshot.pastStates;
    // Garder seulement les 20 derniers états
    const newPastStates = [...(s.pastStates || []), snapshot].slice(-20);
    return { pastStates: newPastStates };
  }),

  undoAction: () => set((s) => {
    if (!s.pastStates || s.pastStates.length === 0) return {};
    const previousState = s.pastStates[s.pastStates.length - 1];
    return {
      ...previousState,
      pastStates: s.pastStates.slice(0, -1)
    };
  }),

  setCharmedIds: (ids) => set({ charmedIds: ids }),
  setWildChildModelId: (id) => set({ wildChildModelId: id }),
  setChienLoupSide: (side) => set({ chienLoupSide: side }),
  setIsVoting: (val) => set({ isVoting: val }),
  setTribunalLocked: (val) => set({ tribunalLocked: val }),

  setCaptain: (playerId) => set((s) => ({
     captainId: playerId,
     players: s.players.map(p => ({ ...p, isCaptain: p.id === playerId }))
  })),

  transferCaptaincy: (newCaptainId) => set((s) => ({
     captainId: newCaptainId,
     successionPendingForId: null,
     players: s.players.map(p => ({ ...p, isCaptain: p.id === newCaptainId }))
  })),

  // Referme la fenêtre de tir du Chasseur (qu'il ait tiré ou raté sa cible)
  resolveHunterPending: () => set({ hunterPendingId: null }),

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
          { id: newId(), timestamp: new Date(), text: "⚡ La Malédiction de l'Ancien a frappé ! Tous les villageois spéciaux perdent leurs pouvoirs.", type: 'event' }
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

    const loversAlive = s.lovers.length === 2 && 
                        s.players.find(p => p.id === s.lovers[0])?.isAlive && 
                        s.players.find(p => p.id === s.lovers[1])?.isAlive;

    // Calcul des camps actuels
    const getTeam = (p) => getPlayerTeam(p, s.players, s);

    // getPlayerTeam ne résout dynamiquement le camp 'loup' des ambigus (Enfant
    // Sauvage muté, Chien-Loup rallié) que dans certains cas ; tant qu'un ambigu
    // n'a pas basculé, il retombe sur le libellé catalogue 'ambigu', invisible
    // des calculs de victoire ci-dessous. On résout donc explicitement son camp
    // effectif pour les conditions de fin de partie :
    // - Chien-Loup indécis (n'a pas encore choisi son camp) : bloque toute
    //   victoire tant qu'il est vivant, son allégeance finale n'étant pas fixée.
    // - Tout autre ambigu non basculé (ex. Enfant Sauvage dont le modèle est
    //   encore vivant) se comporte comme un villageois tant qu'il n'est pas loup.
    const resolveVictoryTeam = (p) => {
      const team = getTeam(p);
      if (team !== 'ambigu') return team;
      if (p.roleId === 'chien-loup') return 'undecided';
      return 'village';
    };

    const aliveWolves = alive.filter(p => resolveVictoryTeam(p) === 'loup' || p.roleId === 'loup-blanc');
    const aliveVillagers = alive.filter(p => resolveVictoryTeam(p) === 'village');
    const aliveSolitaries = alive.filter(p => resolveVictoryTeam(p) === 'solitaire');
    const aliveUndecided = alive.filter(p => resolveVictoryTeam(p) === 'undecided');
    const alivePiper = alive.filter(p => p.roleId === 'joueur-flute');

    // 2. JOUEUR DE FLUTE (Victoire instantanée)
    // Un Joueur de Flûte infecté abandonne son objectif de charme (règle Best Of)
    if (alivePiper.length > 0 && !alivePiper[0].isInfected) {
       const othersAlive = alive.filter(p => p.roleId !== 'joueur-flute');
       const allOthersCharmed = othersAlive.every(p => s.charmedIds.includes(p.id));
       if (allOthersCharmed && othersAlive.length > 0) {
          set({ winner: 'joueur-flute' });
          return;
       }
    }

    // 3. AMOUREUX (Victoire finale)
    // S'ils sont désignés par Cupidon, ils gagnent s'ils sont les deux derniers du village.
    if (loversAlive && alive.length === 2) {
       set({ winner: 'amoureux' });
       return;
    }

    // 4. LOUP BLANC (Seul survivant)
    if (alive.length === 1 && alive[0].roleId === 'loup-blanc') {
       set({ winner: 'loup-blanc' });
       return;
    }

    // 5. VICTOIRE DES LOUPS
    // On ne vérifie la victoire des loups que si les amoureux sont morts ou n'existent pas
    // car des amoureux pourraient être dans le camp des loups mais vouloir gagner seuls.
    if (!loversAlive && aliveUndecided.length === 0 && aliveVillagers.length === 0 && aliveSolitaries.length === 0) {
       set({ winner: 'loups' });
       return;
    }

    // 6. VICTOIRE DU VILLAGE
    // Idem pour le village
    if (!loversAlive && aliveUndecided.length === 0 && aliveWolves.length === 0 && aliveSolitaries.length === 0) {
       set({ winner: 'village' });
       return;
    }
  },

  /* ── Drag & Drop / Échange Rôles ────────────────────────────── */
  swapRoleSwap: (playerId, newRoleId) => set((s) => {
    // Échange de rôle entre un joueur et le premier qui possède le newRoleId.
    // Immutable : on ne mute jamais les objets joueurs existants (ils peuvent
    // être partagés par des snapshots dans pastStates pour l'annulation).
    const sIdx = s.players.findIndex(x => x.id === playerId)
    if (sIdx === -1) return {}
    const oldRoleId = s.players[sIdx].roleId
    if (oldRoleId === newRoleId) return {}

    const tIdx = s.players.findIndex(x => x.roleId === newRoleId && x.id !== playerId)
    if (tIdx === -1) return {}

    const newPlayers = s.players.map((p, idx) => {
      if (idx === sIdx) return { ...p, roleId: newRoleId }
      if (idx === tIdx) return { ...p, roleId: oldRoleId }
      return p
    })
    return { players: newPlayers }
  }),

  swapPlayers: (id1, id2) => set((s) => {
    if (id1 === id2) return {}
    const idx1 = s.players.findIndex(x => x.id === id1)
    const idx2 = s.players.findIndex(x => x.id === id2)
    if (idx1 === -1 || idx2 === -1) return {}
    const newPlayers = [...s.players]
    const temp = newPlayers[idx1]
    newPlayers[idx1] = newPlayers[idx2]
    newPlayers[idx2] = temp
    return { players: newPlayers }
  }),

  /* ── Joueurs ────────────────────────────────────────────────── */
  // Point d'entrée public : élimine un joueur et traite en cascade toutes les
  // morts induites (chagrin d'amour, lien des Sœurs), chacune redéclenchant
  // à son tour succession du Capitaine, malédiction de l'Ancien, vengeance du
  // Chevalier et tir du Chasseur — plus seulement la mort initiale.
  eliminatePlayer: (playerId, mode = 'generic') => {
    get()._processDeaths([{ id: playerId, mode }], new Set());
  },

  // Traite une file de morts (FIFO) en cascade, jusqu'à ce qu'aucune mort
  // induite ne reste à traiter. `processedIds` évite de retraiter deux fois
  // un même joueur si plusieurs cascades se recoupent (ex. sœur + amoureuse).
  _processDeaths: (queue, processedIds) => {
    if (queue.length === 0) {
      get().checkGameOver();
      return;
    }

    const [{ id: playerId, mode }, ...rest] = queue;

    if (processedIds.has(playerId)) {
      get()._processDeaths(rest, processedIds);
      return;
    }

    const s = get();
    const player = s.players.find((p) => p.id === playerId);
    if (!player || !player.isAlive) {
      get()._processDeaths(rest, processedIds);
      return;
    }

    // --- LOGIQUE ANCIEN (SURVIE LOUPS) ---
    // Ne survit que face aux attaques de loups (Simple, Infect Pere, Grand Mechant, Loup Blanc)
    if (player.roleId === 'ancien' && (mode === 'wolves' || mode === 'white-wolf') && s.ancienLives > 1) {
       set({
         ancienLives: s.ancienLives - 1,
         journal: [
           ...s.journal,
           { id: newId(), timestamp: new Date(), text: `🧙 L'Ancien (${player.name}) survit à l'attaque des loups ! (🛡️ 1 vie restante)`, type: 'event' }
         ]
       });
       get()._processDeaths(rest, processedIds);
       return;
    }

    processedIds.add(playerId);

    let newPlayers = s.players.map(p => p.id === playerId ? { ...p, isAlive: false, deathCause: mode } : p);
    let newJournal = [
      ...s.journal,
      { id: newId(), timestamp: new Date(), text: `${player.name} (${ROLE_BY_ID[player.roleId]?.name}) a été éliminé(e).`, type: 'death' }
    ];

    // Morts induites par CETTE mort, réinjectées dans la file pour être
    // traitées avec exactement la même logique (succession, malédiction,
    // chevalier, chasseur...) que n'importe quelle mort directe.
    const inducedDeaths = [];

    // --- GESTION AMOUREUX (MORT PAR CHAGRIN) ---
    if (s.lovers.includes(playerId)) {
       const partnerId = s.lovers.find(id => id !== playerId);
       const partner = s.players.find(p => p.id === partnerId);
       if (partner && partner.isAlive && !processedIds.has(partnerId)) {
          newJournal.push({
            id: newId(),
            timestamp: new Date(),
            text: `💔 ${partner.name} succombe à son chagrin d'amour pour ${player.name}...`,
            type: 'death'
          });
          inducedDeaths.push({ id: partnerId, mode: 'heartbreak' });
       }
    }

    // --- GESTION DES DEUX SŒURS (LIEN DE SANG) ---
    // Quand l'une meurt, l'autre meurt aussi — sauf si c'est déjà la mort de la deuxième
    if (player.roleId === 'soeurs') {
       const sister = s.players.find(p => p.roleId === 'soeurs' && p.id !== playerId && p.isAlive);
       if (sister && !processedIds.has(sister.id)) {
          newJournal.push({
            id: newId(),
            timestamp: new Date(),
            text: `👯 ${sister.name} ne peut survivre sans sa sœur ${player.name}... Elle s'effondre à son tour.`,
            type: 'death'
          });
          inducedDeaths.push({ id: sister.id, mode: 'sister-bond' });
       }
    }

    // --- SUCCESSION DU CAPITAINE ---
    let successionId = s.successionPendingForId;
    if (player.isCaptain) {
      successionId = player.id;
      newJournal.push({
        id: newId(),
        text: `🎖️ Le Capitaine ${player.name} est tombé ! Il doit nommer un successeur.`,
        type: 'event'
      });
    }

    // --- MORT DU JOUEUR DE FLÛTE ---
    // Vide les charmés et retire ses étapes de nuit
    const isPiper = player.roleId === 'joueur-flute';
    const piperPatch = isPiper ? {
      charmedIds: [],
      activeNightSteps: s.activeNightSteps.filter(st => st.id !== 'joueur-flute' && st.id !== 'joueurs-charmes'),
    } : {};

    // --- MORT DU CHASSEUR ---
    // Ouvre la fenêtre de tir en attente, pilotée depuis le store (et non plus
    // détectée côté UI par un useEffect qui comparait l'état précédent).
    const isHunter = player.roleId === 'chasseur';
    const hunterPatch = isHunter ? { hunterPendingId: playerId } : {};

    set({
      players: newPlayers,
      journal: newJournal,
      condemnedPlayerId: mode === 'vote' ? playerId : s.condemnedPlayerId,
      successionPendingForId: successionId,
      ...piperPatch,
      ...hunterPatch,
    });

    // --- MALÉDICTION DE L'ANCIEN ---
    // Se déclenche si tué par le Village (Vote, Potion Mort, Chasseur), y compris
    // si sa mort provient d'une cascade (ex. chagrin d'amour suite à un vote).
    if (player.roleId === 'ancien' && ['vote', 'witch-death', 'hunter'].includes(mode)) {
       get().triggerAncientCurse();
    }

    // --- LOGIQUE CHEVALIER (Vengeance épée rouillée) ---
    // Se déclenche lors d'une attaque de loups (classique ou Loup Blanc), s'il n'est pas lui-même loup
    if (player.roleId === 'chevalier' && !player.isInfected && (mode === 'wolves' || mode === 'white-wolf')) {
      const allPlayers = s.players;
      const index = allPlayers.findIndex(p => p.id === playerId);

      // Chercher le premier loup vivant à gauche (SENS HORAIRE / CLOCKWISE)
      let contaminatedId = null;
      for (let i = 1; i < allPlayers.length; i++) {
        const targetIdx = (index + i) % allPlayers.length;
        const target = allPlayers[targetIdx];
        if (target.isAlive && isPlayerWolf(target, allPlayers, s)) {
          contaminatedId = target.id;
          break;
        }
      }

      if (contaminatedId) {
        set({
          chevalierContaminatedWolfId: contaminatedId,
          chevalierContaminationDay: s.dayNumber,
          journal: [
            ...get().journal,
            { id: newId(), timestamp: new Date(), text: `⚔️ Le Chevalier a blessé l'un de ses agresseurs avec son épée rouillée avant de sombrer...`, type: 'event' }
          ]
        });
      }
    }

    get()._processDeaths([...rest, ...inducedDeaths], processedIds);
  },

  /* ── Actions de Nuit & Pouvoirs ─────────────────────────────── */
  setNightAction: (key, val) =>
    set((s) => ({ nightActions: { ...s.nightActions, [key]: val } })),

  pushToJournal: (text, type = 'event') => set((s) => ({
    journal: [...s.journal, { id: newId(), timestamp: new Date(), text, type }]
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
      witchSavedPlayerIds: [...s.witchSavedPlayerIds, playerId],
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

  commitLovers: (id1, id2) => set(() => {
    return { lovers: [id1, id2] }
  }),

  commitInfection: (playerId) => set((s) => {
    const p = s.players.find(x => x.id === playerId);
    if (p?.roleId === 'ancien') {
      // L'Ancien est immunisé à l'infection — le pouvoir est consumé mais sans effet
      return {
        infectUsed: true,
        journal: [
          ...s.journal,
          { id: newId(), timestamp: new Date(), text: `☣️ L'Infect Père tente d'infecter ${p.name}... mais l'Ancien est immunisé ! Le pouvoir est perdu.`, type: 'event' }
        ]
      }
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
    nightActions: { ...s.nightActions, whiteWolfVictim: playerId },
    hasWhiteWolfKilledWolf: true
  })),

  commitCorbeauTarget: (playerId) => set((s) => ({
    corbeauTargetId: playerId,
    nightActions: { ...s.nightActions, corbeauTargetId: playerId }
  })),

  commitFoxAction: (centralId, hasWolf, groupIds) => set((s) => {
    return {
      foxPowerLost: !hasWolf,
      foxHistory: [...s.foxHistory, { centralId, hasWolf, groupIds }],
      nightActions: { ...s.nightActions, foxCentralId: centralId, foxHasWolf: hasWolf }
    }
  }),

  wakeUpVillage: () => {
    const s = get()
    const nightA = s.nightActions
    const toKill = []

    // 1. Résolution Infection (immédiat pour que eliminatePlayer voit le bon état si besoin)
    if (nightA.infectedTargetId) {
      const infected = s.players.find(p => p.id === nightA.infectedTargetId);
      set((state) => {
        const infected = state.players.find(p => p.id === nightA.infectedTargetId);
        const isPiper = infected?.roleId === 'joueur-flute';
        return {
          players: state.players.map(p => 
            p.id === nightA.infectedTargetId ? { ...p, isInfected: true } : p
          ),
          infectUsed: true,
          activeNightSteps: isPiper ? state.activeNightSteps.filter(st => st.id !== 'joueur-flute' && st.id !== 'joueurs-charmes') : state.activeNightSteps
        };
      });
      if (nightA.infectedTargetId === nightA.wolvesVictim) {
        s.pushToJournal(`L'infection a réussi ! ${infected?.name} a survécu à l'attaque et rejoint la meute.`);
      } else {
        s.pushToJournal(`L'infection a réussi ! ${infected?.name} rejoint secrètement la meute.`);
      }
    }

    if (nightA.wolvesVictim && !nightA.witchHealed && nightA.wolvesVictim !== nightA.infectedTargetId) {
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
      toKill.push({ id: nightA.whiteWolfVictim, by: 'white-wolf' })
    }

    // 3. Exécution des éliminations
    toKill.forEach(k => {
      get().eliminatePlayer(k.id, k.by)
    })

    const stateAfterKills = get();

    // 5. Montreur d'Ours
    // On vérifie s'il est en vie ET qu'il ne vient pas d'être tué durant cette nuit précise (toKill)
    // Immutable : on calcule un nouveau tableau de joueurs et un message optionnel,
    // sans jamais muter l'état courant hors d'un set().
    const montreur = stateAfterKills.players.find(p => p.roleId === 'montreur-ours' && p.isAlive && !toKill.some(k => k.id === p.id));
    let playersAfterBear = stateAfterKills.players;
    let bearGrowlMessage = null;

    if (montreur) {
      const alivePlayers = stateAfterKills.players.filter(p => p.isAlive);
      const idx = alivePlayers.findIndex(p => p.id === montreur.id);
      const left = alivePlayers[(idx - 1 + alivePlayers.length) % alivePlayers.length];
      const right = alivePlayers[(idx + 1) % alivePlayers.length];

      // Le montreur grogne si un voisin est loup, OU s'il est lui-même devenu un loup (infecté)
      if (isPlayerWolf(left, stateAfterKills.players, stateAfterKills) || isPlayerWolf(right, stateAfterKills.players, stateAfterKills) || isPlayerWolf(montreur, stateAfterKills.players, stateAfterKills)) {
        bearGrowlMessage = { id: newId(), timestamp: new Date(), text: `🐻 L'ours du Montreur grogne !`, type: 'event' };

        // On marque le montreur comme grognant ET on marque les voisins historiques comme suspects
        playersAfterBear = stateAfterKills.players.map(p => {
          if (p.id === montreur.id) return { ...p, isGroaning: true, hasBearGrowled: true };
          if (p.id === left.id || p.id === right.id) return { ...p, isBearSuspected: true };
          return p;
        });
      }
    }

    const toKillMessages = toKill.map(k => ({
      id: newId(),
      timestamp: new Date(),
      text: `${stateAfterKills.players.find(p => p.id === k.id)?.name} a été éliminé(e) durant la nuit.`,
      type: 'death'
    }));

    set({
      phase: 'day',
      nightActions: {},
      players: playersAfterBear,

      dayVotes: {},
      isVoting: false,
      tribunalLocked: false,
      condemnedPlayerId: null,

      journal: [
        ...stateAfterKills.journal,
        ...(bearGrowlMessage ? [bearGrowlMessage] : []),
        { id: newId(), timestamp: new Date(), text: `Jour ${stateAfterKills.dayNumber} : Le village se réveille.`, type: 'phase' },
        ...toKillMessages
      ]
    })

    // Révélation Chevalier
    const stateAfterWake = get();
    if (stateAfterWake.chevalierDeadWolfRevealId) {
      const deadWolf = stateAfterWake.players.find(p => p.id === stateAfterWake.chevalierDeadWolfRevealId);
      const chevalier = stateAfterWake.players.find(p => p.roleId === 'chevalier'); // Le défunt

      if (deadWolf) {
        get().pushToJournal(`🤢 Le Loup-Garou ${deadWolf.name} a succombé à la maladie provoquée par la rouille !`, 'death');
        get().pushToJournal(`💡 Les villageois en déduisent que tous ceux situés entre l'ancien Chevalier et ce Loup sont d'innocents villageois.`, 'narration');

        // Fixer les données de déduction de manière permanente
        set({
          chevalierRevengeData: { chevalierId: chevalier?.id, wolfId: deadWolf.id },
          chevalierDeadWolfRevealId: null
        });
      }
    }

    // Révélation Corbeau
    const sCur = get();
    if (sCur.corbeauTargetId) {
      const target = sCur.players.find(p => p.id === sCur.corbeauTargetId);
      if (target && target.isAlive) {
        get().pushToJournal(`🐦 Des traces de corbeau ont été aperçues devant la maison de ${target.name}. Il aura 2 voix contre lui au tribunal !`, 'narration');
      }
    }

    get().checkGameOver();
  },

  /* ── Phases ─────────────────────────────────────────────────── */
  setPhase: (phase) =>
    set((s) => {
      if (phase === 'night') {
        // Phase de transition depuis Préparation
        if (s.phase === 'preparation') {
           return {
             players: s.players.map(p => ({ ...p, isGroaning: false })),
             phase: 'night',
             dayNumber: 1,
             nightActions: {},
             nightStepIndex: -1,
             activeNightSteps: [],
             journal: [...s.journal, { id: newId(), timestamp: new Date(), text: `Nuit 1 — Le village s'endort…`, type: 'phase' }]
           }
        }

        const nextDay = s.dayNumber + 1;

        let revealId = s.chevalierDeadWolfRevealId;
        let contaminatedId = s.chevalierContaminatedWolfId;
        let contaminationDay = s.chevalierContaminationDay;

        if (s.chevalierContaminatedWolfId && s.dayNumber >= s.chevalierContaminationDay) {
          const wolfId = s.chevalierContaminatedWolfId;
          const wolf = s.players.find(p => p.id === wolfId);
          if (wolf && wolf.isAlive) {
            get().eliminatePlayer(wolfId, 'chevalier-rust');
            revealId = wolfId;
          }
          contaminatedId = null;
          contaminationDay = null;
        }

        return {
          phase,
          players: s.players.map(p => ({ ...p, isGroaning: false })), // Toujours reset le grognement la nuit
          dayNumber: nextDay,
          nightActions: {},
          corbeauTargetId: null,
          nightStepIndex: -1,
          activeNightSteps: [],
          condemnedPlayerId: null,
          chevalierContaminatedWolfId: contaminatedId,
          chevalierContaminationDay: contaminationDay,
          chevalierDeadWolfRevealId: revealId,
          journal: [
             ...s.journal, 
             { id: newId(), timestamp: new Date(), text: `Nuit ${nextDay} — Le village s'endort…`, type: 'phase' }
          ]
        }
      }
      return { phase }
    }),



  /* ── Journal ────────────────────────────────────────────────── */
  addJournalEntry: (text, type = 'event') =>
    set((s) => ({
      journal: [
        ...s.journal,
        { id: newId(), timestamp: new Date(), text, type },
      ],
    })),

  /* ── Sorcière ───────────────────────────────────────────────── */
  useWitchPotion: (type) =>
    set((s) => ({
      witchPotions: { ...s.witchPotions, [type]: false },
    })),

  /* ── Sauvegarde ─────────────────────────────────────────────── */
  // Retourne true en cas de succès, false en cas d'échec (ex. quota localStorage
  // plein) afin que l'UI puisse informer le MJ plutôt que d'afficher un succès
  // silencieusement faux.
  saveGameToLocalStorage: () => {
    const state = get();
    const serializableState = {};
    Object.keys(state).forEach(key => {
      if (typeof state[key] !== 'function') {
        serializableState[key] = state[key];
      }
    });

    try {
      const savesStr = localStorage.getItem('loup_garou_saved_games');
      let saves = [];
      if (savesStr) {
        saves = JSON.parse(savesStr);
      }

      const date = new Date();
      const formattedDate = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' à ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const saveName = `Partie du ${formattedDate} (Jour ${state.dayNumber} - ${state.players.length} joueurs)`;

      let currentSaveId = state.activeSaveId;
      if (currentSaveId) {
        const index = saves.findIndex(s => s.id === currentSaveId);
        if (index !== -1) {
          saves[index] = {
            id: currentSaveId,
            name: saveName,
            timestamp: Date.now(),
            state: { ...serializableState, activeSaveId: currentSaveId, schemaVersion: SAVE_SCHEMA_VERSION }
          };
        } else {
          currentSaveId = Date.now();
          saves.push({
            id: currentSaveId,
            name: saveName,
            timestamp: Date.now(),
            state: { ...serializableState, activeSaveId: currentSaveId, schemaVersion: SAVE_SCHEMA_VERSION }
          });
        }
      } else {
        currentSaveId = Date.now();
        saves.push({
          id: currentSaveId,
          name: saveName,
          timestamp: Date.now(),
          state: { ...serializableState, activeSaveId: currentSaveId, schemaVersion: SAVE_SCHEMA_VERSION }
        });
      }

      localStorage.setItem('loup_garou_saved_games', JSON.stringify(saves));
      localStorage.setItem('loup_garou_saved_game', JSON.stringify({ ...serializableState, activeSaveId: currentSaveId, schemaVersion: SAVE_SCHEMA_VERSION }));
      set({ activeSaveId: currentSaveId });
      return true;
    } catch (e) {
      console.error("Failed to save game to localStorage:", e);
      return false;
    }
  },

  loadGameFromLocalStorage: (id = null) => {
    // Comble les champs manquants (ancienne version de la sauvegarde) avec les
    // valeurs par défaut actuelles, et reconvertit les timestamps du journal.
    const reviveSave = (parsed) => {
      if (!parsed.schemaVersion || parsed.schemaVersion < SAVE_SCHEMA_VERSION) {
        console.warn(`Sauvegarde d'un ancien schéma (v${parsed.schemaVersion ?? 0}) — migration vers v${SAVE_SCHEMA_VERSION}.`);
      }
      const merged = { ...initialState, ...parsed };
      if (merged.journal) {
        merged.journal = merged.journal.map(entry => ({
          ...entry,
          timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date()
        }));
      }
      return merged;
    };

    try {
      if (id) {
        const savesStr = localStorage.getItem('loup_garou_saved_games');
        if (savesStr) {
          const saves = JSON.parse(savesStr);
          const save = saves.find(s => s.id === id);
          if (save) {
            const merged = reviveSave(save.state);
            set({ ...merged, activeSaveId: id });
            return true;
          }
        }
      } else {
        const saved = localStorage.getItem('loup_garou_saved_game');
        if (saved) {
          const merged = reviveSave(JSON.parse(saved));
          set(merged);
          return true;
        }
      }
    } catch (e) {
      console.error("Failed to load game from localStorage:", e);
    }
    return false;
  },

  deleteSavedGameFromLocalStorage: (id) => {
    try {
      const savesStr = localStorage.getItem('loup_garou_saved_games');
      if (savesStr) {
        let saves = JSON.parse(savesStr);
        saves = saves.filter(s => s.id !== id);
        localStorage.setItem('loup_garou_saved_games', JSON.stringify(saves));
      }
      
      const legacySave = localStorage.getItem('loup_garou_saved_game');
      if (legacySave) {
        const parsed = JSON.parse(legacySave);
        if (parsed.activeSaveId === id) {
          localStorage.removeItem('loup_garou_saved_game');
        }
      }
    } catch (e) {
      console.error("Failed to delete saved game:", e);
    }
  },

  /* ── Reset ──────────────────────────────────────────────────── */
  resetGame: () => {
    set(initialState);
  },
}),
{
  name: 'loup_garou_autosave',
  version: SAVE_SCHEMA_VERSION,
  storage: createJSONStorage(() => localStorage),
  // On ne persiste jamais l'historique d'annulation (lourd, et sans intérêt
  // après un rechargement de page) ni les fonctions du store.
  partialize: (state) => {
    const { pastStates: _pastStates, ...rest } = state
    return Object.fromEntries(
      Object.entries(rest).filter(([, value]) => typeof value !== 'function')
    )
  },
  // Comble tout champ manquant d'une ancienne version de l'état persisté
  // avec les valeurs par défaut actuelles, pour éviter les crashs après une
  // mise à jour de l'app.
  migrate: (persistedState) => ({ ...initialState, ...persistedState }),
  // Les timestamps du journal sont sérialisés en string JSON — on les
  // reconvertit en objets Date après réhydratation.
  onRehydrateStorage: () => (state) => {
    if (state?.journal?.length) {
      state.journal = state.journal.map((entry) => ({
        ...entry,
        timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
      }))
    }
  },
}
))
