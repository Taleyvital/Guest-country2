"use client";

import { isPlayable } from "../engine";
import { PlayingCard } from "./PlayingCard";
import type { Card, Suit } from "../types";

/** Éventail de cartes en main, en overlap. Les cartes jouables se détachent
 *  (légèrement soulevées, halo violet) ; les autres restent au ras, grisées —
 *  pas besoin de les griser une à une au clic, l'oeil comprend tout de suite
 *  ce qui est disponible. */
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
  const mid = (cards.length - 1) / 2;

  return (
    <div className="flex justify-center">
      <div className="flex" style={{ paddingInline: "1.5rem" }}>
        {cards.map((card, i) => {
          const playable = isMyTurn && isPlayable(card, currentColor, topCard);
          const angle = (i - mid) * 6;

          return (
            <button
              key={card}
              type="button"
              disabled={!playable}
              onClick={() => onPlay(card)}
              aria-label={`Jouer ${card}`}
              className="transition-transform duration-150 ease-out"
              style={{
                marginLeft: i === 0 ? 0 : "-2.25rem",
                transform: `rotate(${angle}deg) translateY(${playable ? "-10px" : "0"})`,
                filter: playable ? "drop-shadow(0 0 10px rgb(108 92 231 / 0.55))" : "none",
                zIndex: i,
              }}
            >
              <PlayingCard card={card} faded={!playable} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
