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
          <li key={p.id} className="flex flex-col items-center gap-1.5">
            <div className="relative">
              <span
                className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface-container text-[32px] ${
                  isTurn ? "ring-4 ring-accent" : ""
                } ${online ? "" : "grayscale opacity-60"}`}
              >
                {isPhoto(p.avatar) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar!} alt="" className="h-full w-full object-cover" />
                ) : (
                  p.avatar ?? "🙂"
                )}
              </span>
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-label-md text-white shadow-card">
                {p.hand_count} cartes
              </span>
            </div>

            <span className="mt-1 text-body-md font-bold">{p.nickname}</span>

            {/* Éventail décoratif : combien de cartes, jamais lesquelles. */}
            <div className="flex" aria-hidden>
              {Array.from({ length: Math.min(p.hand_count, 5) }).map((_, i) => (
                <span
                  key={i}
                  className="h-8 w-6 rounded-md bg-accent shadow-card"
                  style={{
                    marginLeft: i === 0 ? 0 : "-1rem",
                    backgroundImage:
                      "radial-gradient(circle, rgb(255 255 255 / 0.25) 1px, transparent 1px)",
                    backgroundSize: "6px 6px",
                  }}
                />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
