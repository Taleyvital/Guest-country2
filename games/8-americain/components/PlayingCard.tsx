"use client";

import { effectIcon, rankLabel, SUIT_LABEL, suitOf } from "../engine";
import type { Card } from "../types";

const SUIT_COLOR: Record<string, string> = {
  S: "text-on-surface",
  C: "text-on-surface",
  H: "text-danger",
  D: "text-danger",
};

const SUIT_TINT: Record<string, string> = {
  S: "bg-on-surface/10",
  C: "bg-on-surface/10",
  H: "bg-danger/10",
  D: "bg-danger/10",
};

/** Dame et Roi n'ont aucun effet de jeu (contrairement au Valet) : ce sont les
 *  seules "figures" qui affichent un vrai portrait plutôt qu'un simple pictogramme. */
function isCourtCard(rank: string): boolean {
  return rank === "D" || rank === "R";
}

/** Une carte, dessinée une seule fois pour la main, la défausse et les
 *  aperçus : les cartes à effet (8, 10, Valet, As, 2) montrent un pictogramme
 *  au centre à la place du symbole de couleur, pour se repérer d'un coup
 *  d'oeil — comme sur un jeu type Uno. */
export function PlayingCard({
  card,
  size = "md",
  faded = false,
}: {
  card: Card;
  size?: "sm" | "md" | "lg";
  faded?: boolean;
}) {
  const suit = suitOf(card);
  const rank = rankLabel(card);
  const icon = effectIcon(card);
  const colorClass = SUIT_COLOR[suit];
  const court = isCourtCard(rank);

  const dims =
    size === "lg"
      ? "h-32 w-24 text-2xl"
      : size === "sm"
        ? "h-16 w-11 text-sm"
        : "h-24 w-16 text-lg";

  return (
    <div
      className={`relative flex shrink-0 flex-col justify-between overflow-hidden rounded-2xl border-2 border-black/5 bg-white p-1.5 shadow-card ${dims} ${colorClass} ${
        faded ? "opacity-50" : ""
      }`}
    >
      <span className="text-left font-bold leading-none">{rank}</span>

      <span className="absolute inset-0 flex items-center justify-center">
        {icon ? (
          <span className="material-symbols-outlined text-[1.6em]">{icon}</span>
        ) : court ? (
          // Portrait stylisé : losange coloré + petite silhouette, façon figure de
          // jeu de cartes classique, plutôt qu'un simple pique/coeur/carreau/trèfle.
          <span
            className={`flex aspect-square w-[68%] rotate-45 items-center justify-center rounded-md ${SUIT_TINT[suit]}`}
          >
            <span className="material-symbols-outlined -rotate-45 text-[1.3em]">
              {rank === "R" ? "workspace_premium" : "face_4"}
            </span>
          </span>
        ) : (
          <span className="text-[1.8em] leading-none">{SUIT_LABEL[suit]}</span>
        )}
      </span>

      <span className="self-end rotate-180 font-bold leading-none">{rank}</span>
    </div>
  );
}
