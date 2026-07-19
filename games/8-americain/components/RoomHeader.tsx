"use client";

import { SoundToggle } from "@/components/game/SoundToggle";

export function RoomHeader({
  code,
  round,
  onRefresh,
  onShowScores,
}: {
  code: string;
  round: number;
  onRefresh: () => void;
  onShowScores: () => void;
}) {
  return (
    <header className="flex items-center justify-between rounded-b-2xl bg-white px-4 py-4 shadow-card">
      <p className="text-body-md">
        Code : <span className="text-headline-md font-extrabold text-accent">#{code}</span>
      </p>

      <div className="flex items-center gap-1">
        <SoundToggle />

        <button
          type="button"
          onClick={onShowScores}
          aria-label="Voir les scores"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant active:scale-95"
        >
          <span className="material-symbols-outlined">leaderboard</span>
        </button>

        <button
          type="button"
          onClick={onRefresh}
          aria-label="Actualiser"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant active:scale-95"
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>

      <span className="rounded-full bg-accent px-4 py-2 text-label-lg text-white shadow-btn-3d">
        Manche {round}
      </span>
    </header>
  );
}
