"use client";

import { effectIcon, rankOf, suitOf } from "../engine";
import type { Card } from "../types";

/** Identifiants du sprite public/cards/svg-cards.svg (SVG-cards de David
 *  Bellot) : chaque carte y est un groupe nommé `${couleur}_${valeur}`,
 *  normalisé à l'origine — référençable directement via <use>. */
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
  const rank = rankOf(card);
  return `${SUIT_NAME[suitOf(card)]}_${RANK_NAME[rank] ?? rank}`;
}

/** Une carte, dessinée une seule fois pour la main, la défausse et les
 *  aperçus : vraie face de jeu de cartes classique (sprite SVG), avec en plus
 *  un petit badge en haut à droite sur les cartes à effet (8, 10, Valet, As,
 *  2) pour les repérer d'un coup d'oeil — comme sur un jeu type Uno. */
export function PlayingCard({
  card,
  size = "md",
  faded = false,
}: {
  card: Card;
  size?: "sm" | "md" | "lg";
  faded?: boolean;
}) {
  const icon = effectIcon(card);

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

      {icon ? (
        <span className="absolute right-1 top-1 flex h-[1.05em] w-[1.05em] items-center justify-center rounded-full bg-accent text-white shadow-sm">
          <span className="material-symbols-outlined text-[0.7em] leading-none">{icon}</span>
        </span>
      ) : null}
    </div>
  );
}
