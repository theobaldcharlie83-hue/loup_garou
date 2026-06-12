/**
 * Constantes de réglage des comportements IA des peluches (PNJ).
 * Centralisées ici pour pouvoir équilibrer le jeu sans fouiller le JSX.
 */

// Probabilité qu'une peluche-Sorcière décide d'utiliser une potion.
// Croît avec l'avancée de la partie : N1 ≈ 20 %, N2 ≈ 30 %, N3 ≈ 40 %…
export const witchPotionProbability = (dayNumber) => 0.1 + dayNumber * 0.1

// À partir de ce nombre de survivants (ou moins), les IA Loups passent en
// « stratégie de fin de partie » et ciblent le Capitaine en priorité.
export const ENDGAME_CAPTAIN_THRESHOLD = 4
