"use client";

export function RoomHeader({
  code,
  round,
  onRefresh,
}: {
  code: string;
  round: number;
  onRefresh: () => void;
}) {
  return (
    <header className="flex items-center justify-between rounded-b-2xl bg-white px-4 py-4 shadow-card">
      <p className="text-body-md">
        Code : <span className="text-headline-md font-extrabold text-accent">#{code}</span>
      </p>

      <button
        type="button"
        onClick={onRefresh}
        aria-label="Actualiser"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant active:scale-95"
      >
        <span className="material-symbols-outlined">refresh</span>
      </button>

      <span className="rounded-full bg-accent px-4 py-2 text-label-lg text-white shadow-btn-3d">
        Manche {round}
      </span>
    </header>
  );
}
