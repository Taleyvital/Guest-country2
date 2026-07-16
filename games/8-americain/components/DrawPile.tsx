"use client";

import { CardBack } from "./CardBack";

/** La pioche : dos de carte + compteur public (jamais l'ordre — voir
 *  americain_state, sans policy RLS). Cliquable directement pendant son tour :
 *  pas besoin d'un bouton séparé, la pile EST le bouton. */
export function DrawPile({
  count,
  canDraw,
  onDraw,
}: {
  count: number;
  canDraw: boolean;
  onDraw: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!canDraw}
      onClick={onDraw}
      aria-label="Piocher"
      className={`relative transition-transform ${canDraw ? "active:scale-95" : "opacity-60"}`}
    >
      <CardBack size="lg" />
      <span className="absolute -right-2 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-1.5 text-label-md text-accent shadow-card">
        {count}
      </span>
    </button>
  );
}
