"use client";

import type { Card } from "../types";
import { PlayingCard } from "./PlayingCard";

export function HandView({
  cards,
  canPass,
  onPass,
}: {
  cards: Card[];
  /** Seul le porteur (5 cartes) peut passer — les autres voient leur main figée. */
  canPass: boolean;
  onPass: (card: Card) => void;
}) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {cards.map((card, index) => (
        <li key={`${card}-${index}`}>
          <button
            type="button"
            disabled={!canPass}
            onClick={() => onPass(card)}
            className={canPass ? "active:scale-95" : "opacity-60"}
            aria-label={`Passer ${card === "JOKER" ? "le Joker" : card}`}
          >
            <PlayingCard card={card} size="sm" />
          </button>
        </li>
      ))}
    </ul>
  );
}
