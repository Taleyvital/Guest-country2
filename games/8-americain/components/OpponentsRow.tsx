"use client";

import { isPhoto } from "@/lib/game/avatar";
import type { AmericainPlayer } from "../types";

export function OpponentsRow({
  players,
  currentPlayerId,
  onlineUserIds,
  myUserId,
}: {
  players: AmericainPlayer[];
  currentPlayerId: string | null;
  onlineUserIds: string[];
  myUserId: string | null;
}) {
  const others = players.filter((p) => p.user_id !== myUserId);

  return (
    <ul className="flex flex-wrap justify-center gap-6">
      {others.map((p) => {
        const online = onlineUserIds.includes(p.user_id);
        const isTurn = p.id === currentPlayerId;
        return (
          <li key={p.id} className="flex flex-col items-center">
            {/* pb-3 réserve la place que le badge (absolu) prend sous l'avatar :
                sans ça, le nom passe dessous et les deux se chevauchent. */}
            <div className="relative pb-3">
              <span
                className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface-container text-[32px] ${
                  isTurn ? "ring-4 ring-accent" : ""
                } ${online ? "" : "grayscale opacity-60"}`}
              >
                {isPhoto(p.avatar) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar!} alt="" className="h-full w-full object-cover" />
                ) : (
                  p.avatar ?? (p.is_bot ? "🤖" : "🙂")
                )}
              </span>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-label-md text-white shadow-card">
                {p.hand_count} cartes
              </span>
            </div>

            <span className="flex items-center gap-1 text-body-md font-bold">
              {p.nickname}
              {p.is_bot && (
                <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                  Bot
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
