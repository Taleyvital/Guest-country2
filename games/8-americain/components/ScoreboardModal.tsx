"use client";

import { Scoreboard } from "./Scoreboard";
import type { AmericainPlayer } from "../types";

export function ScoreboardModal({
  players,
  threshold,
  myUserId,
  onClose,
}: {
  players: AmericainPlayer[];
  threshold: number;
  myUserId: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-headline-md">Scores</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant active:scale-95"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="text-body-md text-on-surface-variant">
          Fin de partie à {threshold} points.
        </p>

        <Scoreboard players={players} threshold={threshold} myUserId={myUserId} />
      </div>
    </div>
  );
}
