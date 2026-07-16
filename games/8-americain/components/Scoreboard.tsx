"use client";

import type { AmericainPlayer } from "../types";

export function Scoreboard({
  players,
  threshold,
  myUserId,
}: {
  players: AmericainPlayer[];
  threshold: number;
  myUserId: string | null;
}) {
  const ranked = [...players].sort((a, b) => a.penalty_score - b.penalty_score);

  return (
    <ul className="flex flex-col gap-1 rounded-xl bg-white p-3 shadow-card">
      {ranked.map((p) => (
        <li key={p.id} className="flex items-center justify-between text-body-md">
          <span>
            {p.nickname}
            {p.user_id === myUserId ? " (toi)" : ""}
          </span>
          <span className={p.penalty_score >= threshold ? "text-danger" : ""}>
            {p.penalty_score} pts
          </span>
        </li>
      ))}
    </ul>
  );
}
