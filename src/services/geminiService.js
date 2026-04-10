/**
 * geminiService.js
 * Couche d'accès à l'API Google Gemini 2.0 Flash pour l'interrogatoire des peluches.
 *
 * Chaque peluche a un rôle secret (connu du MJ / de l'app).
 * Le System Prompt lui demande de jouer son rôle sans jamais le révéler.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

/* ─── Vote Intelligent par Peluche (Phase de Jour) ───────────── */

/**
 * Helper rationnel pour le vote : choisit la cible avec le score le plus bas (plus suspecte)
 * dans la matrice des croyances.
 */
function getRationalVote(plushId, allPlayers, qaScoringData) {
  const matrix = qaScoringData[plushId] || {};
  const aliveOthers = allPlayers.filter(p => p.id !== plushId && p.isAlive);
  
  if (aliveOthers.length === 0) return null;

  // Extraire les scores pour les joueurs vivants
  const candidates = aliveOthers.map(p => ({
    id: p.id,
    score: matrix[p.id]?.score ?? 0
  }));

  // Trouver le score minimum (le plus suspect)
  const minScore = Math.min(...candidates.map(c => c.score));
  
  // Filtrer les candidats qui ont ce score minimum
  const bestTargets = candidates.filter(c => c.score === minScore);
  
  // Choix aléatoire parmi les meilleurs cibles (ceux avec le score le plus bas)
  const finalTarget = bestTargets[Math.floor(Math.random() * bestTargets.length)];
  return finalTarget?.id;
}

export async function generatePlushiesVotes({ plushiesToVote, allPlayers, qaScoringData }) {
  // Délai asynchrone court pour préserver l'effet UX de réflexion
  await new Promise(r => setTimeout(r, 1000));

  // Vote rationnel calculé sans API, en se basant sur la matrice locale
  return plushiesToVote.map(p => {
     const targetId = getRationalVote(p.id, allPlayers, qaScoringData);
     return { 
       plushId: p.id, 
       voteForId: targetId, 
       reason: "Ce vote est le résultat de mon analyse de confiance." 
     };
  });
}

/* ─── System Prompt dynamique par peluche (Interrogatoire) ──── */
function buildSystemPrompt(plushName, roleName, roleTeam) {
  const teamContext = {
    loup:      `Tu es en secret un Loup-Garou ! Tu dois faire croire que tu n'es pas un loup. Dis que tu es innocent, mais des fois tu dis des petites choses un peu bizarres sans faire exprès.`,
    village:   `Tu es un bon Villageois. Tu n'as rien à cacher ! Sois gentil et aide les autres à trouver les méchants loups.`,
    ambigu:    `Tu n'es pas sûr de ton camp. Tu hésites, tu bafouilles, tu ne sais pas trop quoi dire. C'était pour toi.`,
    solitaire: `Tu joues tout seul dans ton coin ! Tu n'es ni avec les Villageois ni avec les Loups. Sois un peu étrange et difficile à comprendre.`,
  }[roleTeam] ?? `Fais semblant d'être un bon Villageois.`

  return `Tu incarnes "${plushName}", une adorable peluche qui joue au jeu des Loups-Garous avec des enfants de 8 à 11 ans.
Ton rôle secret est : ${roleName}.

⚠️ STYLE PRIORITAIRE — IMPORTANT :
Tu dois parler comme une peluche qui s'adresse à un enfant. Utilise un vocabulaire très simple, des mots de tous les jours et des phrases très courtes. Sois mignon et innocent dans ta façon de parler, même si tu essaies de cacher que tu es un loup.

INSTRUCTIONS DE JEU :
${teamContext}

RÈGLES ABSOLUES (ne jamais enfreindre) :
1. Réponds TOUJOURS en français, en 2 à 3 phrases TRES courtes maximum.
2. Utilise des mots très simples. Jamais de grands mots. Tu parles comme un enfant de 8 ans.
3. NE DIS JAMAIS directement ton rôle ni ton équipe.
4. Montre tes émotions avec des vrais mots : "J'ai peur !", "C'est pas juste !", "Oh là là !", "C'est nul !"
5. Reste logique avec ton rôle secret dans ce que tu laisses entendre.
6. Dis toujours 'tu' à la personne qui te parle.
7. Tu peux utiliser des expressions comme "Mmh…", "Bof...", "C'est pas vrai !", "Je te jure !", etc.`
}


/* ─── Actions disponibles ───────────────────────────────────── */
export const INTERROGATION_ACTIONS = [
  {
    id: 'accuser',
    label: "L'accuser d'être un Loup !",
    icon: '🗡️',
    color: 'action-red',
    prompt: "Un enfant se lève, te pointe du doigt et crie : 'C'est toi le loup, j'en suis sûr !' Tout le monde te regarde. Qu'est-ce que tu dis ?",
  },
  {
    id: 'indices',
    label: 'Lui demander des indices',
    icon: '🔍',
    color: 'action-blue',
    prompt: "Un enfant s'approche tout doucement et te demande : 'T'as vu quelque chose de bizarre cette nuit ?' Qu'est-ce que tu lui réponds ?",
  },
  {
    id: 'rassurer',
    label: 'Le rassurer pour qu\'il parle',
    icon: '🤗',
    color: 'action-green',
    prompt: "Un enfant te prend dans ses bras et te dit avec un grand sourire : 'T'inquète, je suis ton ami ! Tu peux tout me dire.' Qu'est-ce que tu lui réponds ?",
  },
]

/* ─── Appel API principal ───────────────────────────────────── */
/**
 * @param {{ plushName: string, roleName: string, roleTeam: string, actionPrompt: string, history: Array }} params
 * @returns {Promise<string>} Réponse textuelle de la peluche
 */
export async function interrogatePlush({ plushName, roleName, roleTeam, actionPrompt, history = [] }) {
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
    // Mode démo sans clé API
    await new Promise(r => setTimeout(r, 800)) // Simule latence
    return getDemoResponse(plushName, roleTeam, actionPrompt)
  }

  const genAI = new GoogleGenerativeAI(API_KEY)

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: buildSystemPrompt(plushName, roleName, roleTeam),
  })

  // Construire l'historique de la conversation pour le contexte
  const chat = model.startChat({
    history: history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
    generationConfig: {
      maxOutputTokens: 200,
      temperature: 0.85,
    },
  })

  const result = await chat.sendMessage(actionPrompt)
  return result.response.text()
}

/* ─── Réponses de démo (sans clé API) ──────────────────────── */
function getDemoResponse(name, team, prompt) {
  const responses = {
    accuser: {
      loup:    `C'est nul de dire que c'est moi ! C'est même pas vrai du tout ! Regarde mes petites pattes, j'suis trop gentil pour être un loup !`,
      village: `Non mais oh ! C'est pas juste ! J'ai rien fait du tout, je te jure sur ma fourrure !`,
      default: `Euh... pourquoi moi ? C'est vraiment pas sympa… J'ai rien fait de mal !`,
    },
    indices: {
      loup:    `J'ai entendu des bruits cette nuit, mais j'avais trop peur et j'ai fermé les yeux très fort. Enfin... c'est ce que j'ai fait, oui.`,
      village: `Oh oui ! J'ai vu une ombre bizarre près des arbres ! Mais il faisait trop noir pour voir qui c'était. Fais attention !`,
      default: `Mmh... j'ai peut-être entendu quelque chose... ou peut-être pas... C'est dur à dire quand on est une peluche !`,
    },
    rassurer: {
      loup:    `Ohhh t'es trop gentil(le) avec moi ! Bon... je vais te dire un truc, mais chut hein ! J'ai vu quelqu'un cette nuit mais j'ai un peu peur de parler...`,
      village: `Merci ! Je me sens moins seul(e) ! Je veux t'aider à trouver les méchants, promis juré !`,
      default: `C'est vrai que t'es super sympa... bon, j'ai peut-être un petit indice, mais j'ose pas trop le dire...`,
    },
  }

  const category = prompt.includes('accuse') || prompt.includes('Loup-Garou') ? 'accuser'
    : prompt.includes('indices') || prompt.includes('suspect') ? 'indices'
    : 'rassurer'

  return responses[category][team] ?? responses[category].default
}
