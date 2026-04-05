import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

/* ── MOCK DATA POUR TESTS UI ── */
const MOCK_CHOICES = [
  "Pourquoi étais-tu si agité hier soir pendant qu'on dormait ?",
  "J'ai trouvé des poils près du dernier incident... ça s'explique ?",
  "Regarde-moi dans les yeux. Veux-tu vraiment le bien du village ?"
]

const MOCK_RESPONSE = "Moi ?! Oh là là, tu me fais peur avec ces questions ! Je ne suis qu'une pauvre petite peluche ignorante. Je bougeais la nuit dernière parce que je faisais un cauchemar, c'est tout ! Laisse-moi tranquille !"

/**
 * FONCTION 1 : Génération des 3 Choix (Context-Aware)
 */
export async function generateChoices({ dayNumber, deadPlayers, plushieName }) {
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
    await new Promise(r => setTimeout(r, 600)) // Simule la latence
    return MOCK_CHOICES
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY)
    
    // Fallback silencieux vers 2.0-flash ou 1.5-flash si 2.5-flash lève une erreur de modèle inconnu
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Tu es l'assistant d'un jeu de rôle basé sur Les Loups-Garous de Thiercelieux. Nous sommes au ${dayNumber}. Les morts sont : ${deadPlayers}. Le joueur s'apprête à interroger la peluche nommée ${plushieName}. 
Génère 3 options d'interrogatoire pertinentes et variées que le joueur peut choisir pour la cuisiner. Les options doivent tenir compte des morts récentes.
Format requis : Uniquement un tableau JSON de 3 chaînes de caractères courtes. Aucune explication.`

    const result = await model.generateContent(prompt)
    let text = result.response.text()

    // Nettoyage Markdown pour parser le JSON
    text = text.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(text)
  } catch (err) {
    console.error("Erreur de l'API (Génération des choix), passage aux données Mock : ", err)
    return MOCK_CHOICES
  }
}

/**
 * FONCTION 2 : Génération de la Réponse de la Peluche ET des prochains choix
 */
export async function generatePlushieResponse({
  dayNumber,
  deadPlayers,
  plushieName,
  plushiePersonality,
  plushieSecretRole,
  selectedChoice,
  history = [] // format: [{q: '...', a: '...'}, ...]
}) {
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
    await new Promise(r => setTimeout(r, 800)) // Simule la latence
    return {
      response: MOCK_RESPONSE,
      nextChoices: [
        "Tu mens, je le sais !",
        "D'accord, je te crois pour cette fois.",
        "On en reparlera demain."
      ],
      trustScoreChange: Math.floor(Math.random() * 21) - 10,
      clue: Math.random() < 0.3 ? "Une lueur étrange brille dans ses yeux de bouton..." : null
    }
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const historyTxt = history.length > 0 
      ? `Historique de notre conversation actuelle :\n${history.map(m => `- Le joueur: ${m.q}\n- Toi: ${m.a}`).join('\n')}\n`
      : ''

    const prompt = `Tu joues le rôle de ${plushieName}, une peluche dans une partie des Loups-Garous de Thiercelieux. Ton trait de caractère est : ${plushiePersonality}. 
Ton rôle secret est : ${plushieSecretRole}. (ATTENTION : Tu dois ABSOLUMENT garder ce rôle secret. Joue toujours comme si tu étais un simple villageois innocent pour survivre, mais laisse ton caractère transparaître).
Contexte du jeu : Nous sommes au ${dayNumber}. Joueurs éliminés : ${deadPlayers}.
${historyTxt}
Le joueur vient de t'adresser cette phrase/question : '${selectedChoice}'.

Réponds en une ou deux phrases maximum.
Ensuite, génère 3 CHOIX (questions/réactions) logiques que le joueur pourrait dire suite à TA réponse.

IMPORTANT : Tu dois évaluer la situation. Si le joueur te met la pression ou au contraire s'il est gentil, ajuste le "trustScoreChange" (entre -20 et +20). 
Si la confiance est très forte (>80%) ou la tension très grande (<20%), tu peux ajouter un indice cryptique sur ton identité Réelle ou sur tes soupçons dans le champ "clue".

Tu dois retourner UNIQUEMENT un objet JSON valide avec cette structure stricte :
{
  "response": "Ta phrase de réponse à la première personne.",
  "nextChoices": ["Choix 1", "Choix 2", "Choix 3"],
  "trustScoreChange": 5,
  "clue": "optionnel : une phrase d'indice ou null"
}
Aucun texte Markdown autour, JUSTE le JSON.`

    const result = await model.generateContent(prompt)
    let text = result.response.text().trim()
    text = text.replace(/```json/g, '').replace(/```/g, '').trim()
    
    return JSON.parse(text)
  } catch (err) {
    console.error("Erreur de l'API (Génération réponse+choix dynamiques), passage aux données Mock : ", err)
    return {
      response: "(L'esprit de cette peluche semble embrouillé...) " + MOCK_RESPONSE,
      nextChoices: [
        "Reprenons nos esprits.",
        "Tu évites la question.",
        "Je n'ai plus rien à te dire."
      ],
      trustScoreChange: 0,
      clue: null
    }
  }
}
