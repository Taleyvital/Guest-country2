"use client";

import { isPlayable } from "../engine";
import { PlayingCard } from "./PlayingCard";
import type { Card, Suit } from "../types";

/** Éventail de cartes en main, en overlap avec un léger arc (les cartes du
 *  centre remontent un peu plus que celles des bords, comme un vrai jeu tenu
 *  en main). Les cartes jouables se détachent (soulevées, halo violet) ; les
 *  autres restent au ras, grisées — pas besoin de les griser une à une au
 *  clic, l'oeil comprend tout de suite ce qui est disponible. */
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
    <div className="flex justify-center pb-2 pt-4">
      <div className="flex items-end" style={{ paddingInline: "1.5rem" }}>
        {cards.map((card, i) => {
          const playable = isMyTurn && isPlayable(card, currentColor, topCard);
          const offset = i - mid;
          const angle = offset * 8;
          // Arc : le milieu de la main remonte, les bords retombent un peu.
          const arc = Math.abs(offset) * Math.abs(offset) * 2;

          return (
            <button
              key={card}
              type="button"
              disabled={!playable}
              onClick={() => onPlay(card)}
              aria-label={`Jouer ${card}`}
              className="origin-bottom transition-transform duration-150 ease-out"
              style={{
                marginLeft: i === 0 ? 0 : "-3.5rem",
                transform: `rotate(${angle}deg) translateY(${arc - (playable ? 14 : 0)}px)`,
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
