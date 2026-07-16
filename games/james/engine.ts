/** Logique pure de James — utilisée côté client pour l'affichage (activer/
 *  désactiver un bouton, prévisualiser un état). L'arbitrage réel (transferts
 *  de cartes, validité d'un appel "James", qui gagne le point) vit dans les
 *  RPC Postgres de 0015_james.sql : ce fichier ne doit jamais être traité
 *  comme une source de vérité, seulement comme un miroir pour l'UI. */

import type { Card, Suit, Team } from "./types";

export const SUITS: Suit[] = ["S", "H", "D", "C"];

export function suitOf(card: Card): Suit | null {
  if (card === "JOKER") return null;
  return card.split(":")[0] as Suit;
}

export function teamOf(position: number): Team {
  return position % 2 === 0 ? "A" : "B";
}

/** Position du partenaire : face-à-face, jamais adjacent (+2 mod 4). */
export function partnerPosition(position: number): number {
  return (position + 2) % 4;
}

/** Position du voisin immédiat, destinataire d'un passage (sens horaire). */
export function nextPosition(position: number): number {
  return (position + 1) % 4;
}

/** A-t-on 4 cartes (ou plus) de la même couleur en main ? Le Joker ne compte
 *  jamais dans un motif : il ne fait qu'occuper une place dans le paquet. */
export function hasFourOfAKind(hand: Card[]): Suit | null {
  const counts = new Map<Suit, number>();
  for (const card of hand) {
    const suit = suitOf(card);
    if (!suit) continue;
    counts.set(suit, (counts.get(suit) ?? 0) + 1);
  }
  for (const [suit, count] of counts) {
    if (count >= 4) return suit;
  }
  return null;
}

export const JAMES_CALL_WINDOW_MS = 3000;

export function callTimeRemainingMs(expiresAt: string, now: Date = new Date()): number {
  return Math.max(0, new Date(expiresAt).getTime() - now.getTime());
}
