"use client";

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
    <ul className="flex flex-wrap justify-center gap-3">
      {others.map((p) => {
        const online = onlineUserIds.includes(p.user_id);
        const isTurn = p.id === currentPlayerId;
        return (
          <li
            key={p.id}
            className={`flex flex-col items-center gap-1 rounded-xl p-2 ${
              isTurn ? "bg-accent/10 ring-2 ring-accent" : ""
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${online ? "bg-success" : "bg-tile"}`}
              title={online ? "Connecté" : "Déconnecté"}
            />
            <span className="text-body-md">{p.nickname}</span>
            <span className="text-label-md text-on-surface-variant">{p.hand_count} cartes</span>
          </li>
        );
      })}
    </ul>
  );
}
