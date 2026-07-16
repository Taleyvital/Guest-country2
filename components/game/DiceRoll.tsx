"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";
import type { Player } from "@/lib/supabase/types";

const FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

/**
 * Tirage au dé pour désigner qui ouvre la partie.
 *
 * Le dé est lancé PAR LE SERVEUR (roll_dice) : aucun joueur ne peut relancer chez lui
 * jusqu'à tomber sur un 6, et les égalités sont déjà départagées en interne (voir
 * migration 0014) — pas d'écran de "relance entre ex-æquo" à gérer ici.
 */
export function DiceRoll({
  players,
  myUserId,
  onRoll,
}: {
  players: Player[];
  myUserId: string | null;
  onRoll: () => Promise<void>;
}) {
  const [rolling, setRolling] = useState(false);
  const me = players.find((p) => p.user_id === myUserId) ?? null;
  const rolledCount = players.filter((p) => p.dice_roll !== null).length;
  const allRolled = players.length > 0 && rolledCount === players.length;

  // Le meneur actuel, à titre indicatif seulement — le vrai départage (avec le
  // tie-break invisible) n'a lieu que côté serveur, au lancement de la partie.
  const leader = allRolled
    ? [...players].sort((a, b) => (b.dice_roll ?? 0) - (a.dice_roll ?? 0))[0]
    : null;

  async function roll() {
    setRolling(true);
    try {
      await onRoll();
    } finally {
      setRolling(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card">
      <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
        Qui commence ?
      </h2>
      <p className="text-body-md text-on-surface-variant">
        Chacun lance le dé, le plus gros score ouvre la partie.
      </p>

      <ul className="flex flex-col gap-2">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-lg bg-surface-container-low p-3"
          >
            <Avatar player={p} size={28} />
            <span className="flex-1 text-body-lg">{p.nickname}</span>
            <span
              className={[
                "text-[28px] leading-none",
                p.dice_roll === null ? "text-outline" : "text-accent",
              ].join(" ")}
            >
              {p.dice_roll === null ? "🎲" : FACES[p.dice_roll]}
            </span>
          </li>
        ))}
      </ul>

      {me && me.dice_roll === null ? (
        <button
          type="button"
          onClick={roll}
          disabled={rolling}
          className="btn-primary w-full rounded-full disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
        >
          {rolling ? "…" : "🎲 Lancer le dé"}
        </button>
      ) : (
        <p className="text-center text-body-md text-on-surface-variant">
          {allRolled
            ? `${leader?.nickname} ouvre la partie !`
            : `En attente des autres… ${rolledCount}/${players.length}`}
        </p>
      )}
    </section>
  );
}
