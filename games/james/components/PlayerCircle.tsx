"use client";

import type { JamesPlayer } from "../types";

/** Disposition face-à-face : position 0 en bas, 1 à droite, 2 en haut, 3 à
 *  gauche — les partenaires (0/2, 1/3) se retrouvent bien face à face. */
const LAYOUT: Record<number, string> = {
  0: "col-start-2 row-start-3",
  1: "col-start-3 row-start-2",
  2: "col-start-2 row-start-1",
  3: "col-start-1 row-start-2",
};

export function PlayerCircle({
  players,
  holderId,
  onlineUserIds,
  myUserId,
}: {
  players: JamesPlayer[];
  holderId: string | null;
  onlineUserIds: string[];
  myUserId: string | null;
}) {
  return (
    <div className="grid aspect-square w-full max-w-xs grid-cols-3 grid-rows-3 place-items-center gap-2">
      {players.map((p) => {
        const online = onlineUserIds.includes(p.user_id);
        const isHolder = p.id === holderId;
        const isMe = p.user_id === myUserId;
        return (
          <div
            key={p.id}
            className={`${LAYOUT[p.position]} flex flex-col items-center gap-1 rounded-xl p-2 ${
              isHolder ? "bg-accent/10 ring-2 ring-accent" : ""
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${online ? "bg-success" : "bg-tile"}`}
              title={online ? "Connecté" : "Déconnecté"}
            />
            <span className="text-body-md">
              {p.nickname}
              {isMe ? " (toi)" : ""}
            </span>
            <span className="text-label-md text-on-surface-variant">
              Équipe {p.team}
              {isHolder ? " · porte les cartes" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
