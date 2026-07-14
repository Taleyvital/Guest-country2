"use client";

import { useEffect, useState } from "react";
import type { CountryTile } from "@/lib/game/types";

export function GuessCountryModal({
  open,
  tiles,
  playersLeft,
  onClose,
  onConfirm,
}: {
  open: boolean;
  tiles: CountryTile[];
  playersLeft?: number;
  onClose: () => void;
  onConfirm: (guess: string) => void;
}) {
  const [guess, setGuess] = useState("");

  useEffect(() => {
    if (open) setGuess("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guess the country"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-on-background/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-container flex-col gap-6 rounded-t-[2rem] bg-canvas p-6 pb-10 shadow-modal animate-slide-up sm:rounded-[2rem] sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-surface-container sm:hidden" />
          <h2 className="text-headline-md text-on-surface">Guess the Country</h2>
        </div>

        {/* Le coup est irréversible : on le dit avant, pas après. */}
        <div className="flex items-start gap-3 rounded-lg bg-error-container p-4 text-on-error-container">
          <span className="material-symbols-outlined">warning</span>
          <p className="text-body-md">
            <span className="font-bold">Warning:</span> an incorrect guess will eliminate you from
            this round. Think carefully.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-label-lg uppercase tracking-widest text-on-surface-variant">
            Current clue
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {tiles.map((tile, i) => (
              <div
                key={i}
                className={[
                  "flex h-14 w-12 items-center justify-center rounded-lg text-headline-md shadow-tile",
                  tile.letter
                    ? "border-2 border-surface-variant bg-white text-on-surface"
                    : "bg-tile",
                ].join(" ")}
              >
                {tile.letter}
              </div>
            ))}
          </div>
        </div>

        <input
          autoFocus
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && guess.trim() && onConfirm(guess.trim())}
          placeholder="Type a country…"
          className="w-full border-b-4 border-tile bg-transparent py-3 text-center text-headline-md text-on-surface outline-none transition-colors focus:border-accent"
        />

        {playersLeft !== undefined && (
          <p className="text-center text-label-md text-on-surface-variant">
            {playersLeft} players are still in this round
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border-2 border-outline-variant bg-white py-4 text-label-lg text-on-surface-variant active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!guess.trim()}
            onClick={() => onConfirm(guess.trim())}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent py-4 text-label-lg text-white shadow-btn-3d transition-all active:translate-y-[3px] active:shadow-[0_1px_0_0_#4029ba] disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none disabled:active:translate-y-0"
          >
            Submit Guess
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
