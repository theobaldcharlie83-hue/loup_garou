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
export async function generatePlushiesVotes({ plushiesToVote, allPlayers, journalHistory, qaScoringData }) {
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
    await new Promise(r => setTimeout(r, 1000));
    // Simulation
    return plushiesToVote.map(p => {
       const others = allPlayers.filter(x => x.id !== p.id && x.isAlive);
       const target = others[Math.floor(Math.random() * others.length)];
       return { plushId: p.id, voteForId: target?.id, reason: "Il me fait un peu peur depuis hier." };
    });
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Simplification visuelle du matrix (scores et raisons)
  let scoringContext = "MATRICE DES CROYANCES (Hard Rules):\n";
  plushiesToVote.forEach(p => {
     const matrix = qaScoringData[p.id];
     if (matrix) {
        scoringContext += `Peluche ${p.name} (${p.roleName}):\n`;
        Object.entries(matrix).forEach(([targetId, info]) => {
           const tName = allPlayers.find(x => x.id === targetId)?.name;
           if (tName && info.score !== 0) {
              scoringContext += `  -> Envers ${tName}: Score de ${info.score} (${info.breakdown[info.breakdown.length - 1]?.reason})\n`;
           }
        });
     }
  });

  // Explication de la situation et du contexte
  const systemPrompt = `Tu simules l'ensemble des votes de peluches lors d'une partie de Loups-Garous.
Voici la liste des événements publics (Journal du village) qui se sont déroulés jusqu'ici :
${journalHistory.map(j => `- [${j.type}] ${j.text}`).join('\n')}

Voici la situation interne et intime de chaque peluche en ce moment :
${scoringContext}

Voici la liste des joueurs vivants sur lesquels on peut voter :
${allPlayers.filter(p => p.isAlive).map(p => `- ID: ${p.id} | Nom: ${p.name}`).join('\n')}

Voici les peluches qui doivent voter :
${plushiesToVote.map(p => `- ID: ${p.id} | Nom: ${p.name} | Rôle secret: ${p.roleName}`).join('\n')}

INSTRUCTIONS:
1. RÈGLE D'OR : Consulte la Matrice des croyances. Si une peluche a attribué une note de +1000 à quelqu'un, elle NE DOIT JAMAIS voter contre ! Si elle a attribué une cible avec un score autour de -1000, elle DOIT OBLIGATOIREMENT voter contre en priorité absolue ! SI PLUSIEURS JOUEURS ONT UN SCORE DE -1000, ELLE DOIT CHOISIR ALÉATOIREMENT PARMI EUX.
2. Pour les autres cas ou scores faibles (neutre, -10, etc.), les peluches loups essaieront de suivre la masse, les villageois chercheront un motif textuel dans l'historique public.
3. Tu DOIS renvoyer la réponse STRICTEMENT ET UNIQUEMENT sous forme de JSON valide : un tableau d'objets. Aucun autre texte. Ne mets pas de markdown \`\`\`json.
Format attendu:
[
  { "plushId": "l'ID de la peluche", "voteForId": "l'ID de sa cible", "reason": "Justification enfantine et mignonne de 1 phrase reprenant un indice ou le score absolu" }
]`;

  try {
    const result = await model.generateContent(systemPrompt);
    let txt = result.response.text().trim();
    if (txt.startsWith('\`\`\`json')) txt = txt.replace(/\`\`\`json/, '');
    if (txt.startsWith('\`\`\`')) txt = txt.replace(/\`\`\`/, '');
    if (txt.endsWith('\`\`\`')) txt = txt.slice(0, -3);
    const parsed = JSON.parse(txt);
    return parsed;
  } catch (err) {
    console.error("Erreur API Gemini (Votes):", err);
    // Fallback pseudo aléatoire
    return plushiesToVote.map(p => {
       const others = allPlayers.filter(x => x.id !== p.id && x.isAlive);
       const target = others[Math.floor(Math.random() * others.length)];
       return { plushId: p.id, voteForId: target?.id ?? null, reason: "Je ne sais plus quoi penser..." };
    });
  }
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
