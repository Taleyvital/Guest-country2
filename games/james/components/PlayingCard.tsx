"use client";

import type { Card } from "../types";

/** Identifiants du sprite public/cards/svg-cards.svg (SVG-cards de David
 *  Bellot) : chaque carte y est un groupe nommé `${couleur}_${valeur}`,
 *  normalisé à l'origine — référençable directement via <use>. Même sprite
 *  et même rendu que le jeu 8 Américain, pour une identité visuelle commune. */
const SUIT_NAME: Record<string, string> = {
  S: "spade",
  H: "heart",
  D: "diamond",
  C: "club",
};

const RANK_NAME: Record<string, string> = {
  A: "1",
  J: "jack",
  Q: "queen",
  K: "king",
};

function spriteId(card: Card): string {
  if (card === "JOKER") return "joker";
  const [suit, rank] = card.split(":");
  return `${SUIT_NAME[suit]}_${RANK_NAME[rank] ?? rank}`;
}

/** Une carte de la main du joueur, dessinée comme sur 8 Américain : vraie
 *  face de jeu de cartes classique (sprite SVG) plutôt qu'un simple symbole
 *  texte. */
export function PlayingCard({
  card,
  size = "md",
  faded = false,
}: {
  card: Card;
  size?: "sm" | "md" | "lg";
  faded?: boolean;
}) {
  // L'arrondi suit le rayon dessiné dans le sprite (~6.9 unités pour 169 de
  // large) : un arrondi plus fort rognerait le liseré noir des coins.
  const dims =
    size === "lg"
      ? "h-44 w-32 rounded-[5px] text-3xl"
      : size === "sm"
        ? "h-24 w-[4.25rem] rounded-[3px] text-base"
        : "h-32 w-[5.75rem] rounded-[4px] text-xl";

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-white shadow-card ${dims} ${
        faded ? "grayscale" : ""
      }`}
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 169.075 244.64"
        preserveAspectRatio="none"
        aria-hidden
      >
        <use href={`/cards/svg-cards.svg#${spriteId(card)}`} />
      </svg>
    </div>
  );
}
