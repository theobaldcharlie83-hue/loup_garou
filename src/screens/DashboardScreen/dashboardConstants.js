/* Constantes & helpers de présentation du Dashboard (extraits pour alléger l'écran). */

/* Classe CSS par équipe */
export const TEAM_CLASS = {
  loup:      'av-loup',
  village:   'av-village',
  ambigu:    'av-ambigu',
  solitaire: 'av-solitaire',
}

/* Phase labels & icons */
export const PHASE_META = {
  night:         { label: 'Phase de Nuit',    icon: '🌙' },
  day:           { label: 'Phase de Jour',     icon: '☀️' },

}

/* Ordre officiel de nuit — Best Of (règles officielles complètes) */
export const NIGHT_ORDER = [
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

export const getGuidanceMessage = (phase, currentNightStepId, hasChasseurPending, hasSuccessionPending, isVoting, tribunalLocked) => {
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
