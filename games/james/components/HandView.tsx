"use client";

import type { Card } from "../types";

const SUIT_SYMBOL: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_COLOR: Record<string, string> = {
  S: "text-black",
  C: "text-black",
  H: "text-danger",
  D: "text-danger",
};

function label(card: Card): { rank: string; symbol: string; colorClass: string } {
  if (card === "JOKER") return { rank: "JOKER", symbol: "★", colorClass: "text-accent" };
  const [suit, rank] = card.split(":");
  return { rank, symbol: SUIT_SYMBOL[suit] ?? "?", colorClass: SUIT_COLOR[suit] ?? "text-black" };
}

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
      {cards.map((card) => {
        const { rank, symbol, colorClass } = label(card);
        return (
          <li key={card}>
            <button
              type="button"
              disabled={!canPass}
              onClick={() => onPass(card)}
              className={`flex h-20 w-14 flex-col items-center justify-center rounded-lg bg-white shadow-card ${colorClass} ${
                canPass ? "active:scale-95" : "opacity-60"
              }`}
              aria-label={`Passer ${rank} ${symbol}`}
            >
              <span className="text-label-lg font-bold">{rank}</span>
              <span className="text-headline-md">{symbol}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
