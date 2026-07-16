"use client";

import { isPlayable, rankOf, SUIT_LABEL, suitOf } from "../engine";
import type { Card, Suit } from "../types";

const SUIT_COLOR: Record<Suit, string> = {
  S: "text-black",
  C: "text-black",
  H: "text-danger",
  D: "text-danger",
};

export function Hand({
  cards,
  isMyTurn,
  currentColor,
  topCard,
  onPlay,
}: {
  cards: Card[];
  isMyTurn: boolean;
  currentColor: Suit | null;
  topCard: string | null;
  onPlay: (card: Card) => void;
}) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {cards.map((card) => {
        const playable = isMyTurn && isPlayable(card, currentColor, topCard);
        const suit = suitOf(card);
        return (
          <li key={card}>
            <button
              type="button"
              disabled={!playable}
              onClick={() => onPlay(card)}
              className={`flex h-20 w-14 flex-col items-center justify-center rounded-lg bg-white shadow-card ${SUIT_COLOR[suit]} ${
                playable ? "active:scale-95" : "opacity-50"
              }`}
              aria-label={`Jouer ${rankOf(card)} ${SUIT_LABEL[suit]}`}
            >
              <span className="text-label-lg font-bold">{rankOf(card)}</span>
              <span className="text-headline-md">{SUIT_LABEL[suit]}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
