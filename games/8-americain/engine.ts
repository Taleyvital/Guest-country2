/** Logique pure de 8 Américain — reflet côté client pour l'UI (griser une
 *  carte injouable, prévisualiser un effet). L'arbitrage réel vit dans les
 *  RPC Postgres de 0016_americain.sql : en cas de désaccord, le serveur a
 *  toujours raison. Voir ce fichier SQL pour les assomptions de règles non
 *  précisées par la spec (Valet/As/2 qui sautent, comportement du 10 à 2
 *  joueurs, pioche illimitée vs unique). */

import type { Card, Suit } from "./types";

export function suitOf(card: Card): Suit {
  return card.split(":")[0] as Suit;
}

export function rankOf(card: Card): string {
  return card.split(":")[1];
}

export function isPlayable(card: Card, currentColor: Suit | null, topCard: string | null): boolean {
  const rank = rankOf(card);
  if (rank === "8") return true;
  if (suitOf(card) === currentColor) return true;
  if (topCard && rank === rankOf(topCard)) return true;
  return false;
}

export const SUIT_LABEL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

/** Étiquette affichée sur la carte : les figures suivent la convention française
 *  (Valet/Dame/Roi), pas l'anglaise (J/Q/K) — cohérent avec le "8 Américain". */
export const RANK_LABEL: Record<string, string> = {
  J: "V",
  Q: "D",
  K: "R",
  A: "A",
};

export function rankLabel(card: Card): string {
  const rank = rankOf(card);
  return RANK_LABEL[rank] ?? rank;
}

/** Les cartes à effet ont un pictogramme dédié, pour les repérer d'un coup
 *  d'oeil dans la main — comme sur un jeu de type Uno. */
export const EFFECT_ICON: Record<string, string> = {
  "8": "palette",      // joker de couleur
  "10": "sync_alt",    // inverse le sens
  J: "skip_next",      // saute le joueur suivant
  A: "block",          // saute + fait piocher 1
  "2": "bolt",         // saute + fait piocher 3
};

export function effectIcon(card: Card): string | null {
  return EFFECT_ICON[rankOf(card)] ?? null;
}
