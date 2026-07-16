"use client";

import { SUIT_LABEL } from "../engine";
import { PlayingCard } from "./PlayingCard";
import type { Suit } from "../types";

export function DiscardPile({
  topCard,
  currentColor,
}: {
  topCard: string | null;
  currentColor: Suit | null;
}) {
  if (!topCard) return null;
  const isJoker = topCard.endsWith(":8");

  return (
    <div className="flex flex-col items-center gap-1">
      <PlayingCard card={topCard} size="lg" />
      {isJoker && currentColor && (
        <span className="text-label-md text-on-surface-variant">
          Couleur demandée : {SUIT_LABEL[currentColor]}
        </span>
      )}
    </div>
  );
}
