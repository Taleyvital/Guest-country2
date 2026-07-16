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
