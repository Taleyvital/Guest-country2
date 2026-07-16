"use client";

import { SUIT_LABEL, rankOf, suitOf } from "../engine";
import type { Suit } from "../types";

export function DiscardPile({
  topCard,
  currentColor,
}: {
  topCard: string | null;
  currentColor: Suit | null;
}) {
  if (!topCard) return null;
  const suit = suitOf(topCard);
  const isJoker = rankOf(topCard) === "8";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex h-24 w-16 flex-col items-center justify-center rounded-lg bg-white text-2xl shadow-card ${
          suit === "H" || suit === "D" ? "text-danger" : "text-black"
        }`}
      >
        <span className="text-label-lg font-bold">{rankOf(topCard)}</span>
        <span className="text-headline-md">{SUIT_LABEL[suit]}</span>
      </div>
      {isJoker && currentColor && (
        <span className="text-label-md text-on-surface-variant">
          Couleur demandée : {SUIT_LABEL[currentColor]}
        </span>
      )}
    </div>
  );
}
