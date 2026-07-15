"use client";

import { useEffect, useState } from "react";
import type { CountryTile } from "@/lib/game/types";

/**
 * Deviner le pays d'un adversaire — EN SAISIE LIBRE.
 *
 * Plus de liste à choisir : on tape le pays de mémoire, à partir de la région et des
 * lettres déjà révélées. La validation est faite côté serveur, de façon tolérante aux
 * accents / à la casse / aux tirets (voir migration 0013), donc "Brésil", "bresil" ou
 * "BRESIL" sont tous acceptés — seule une VRAIE erreur de pays élimine.
 */
export function GuessCountryModal({
  open,
  targetName,
  targetRegion,
  tiles,
  playersLeft,
  onClose,
  onConfirm,
}: {
  open: boolean;
  targetName: string;
  targetRegion?: string;
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

  const value = guess.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Deviner le pays"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-on-background/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-container flex-col gap-6 rounded-t-[2rem] bg-canvas p-6 pb-10 shadow-modal animate-slide-up sm:rounded-[2rem] sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-surface-container sm:hidden" />
          <h2 className="text-headline-md text-on-surface">Le pays de {targetName}</h2>
          {targetRegion && (
            <span className="mt-2 inline-block rounded-full bg-primary-fixed px-3 py-1 text-label-md text-accent">
              {targetRegion}
            </span>
          )}
        </div>

        {/* Le coup est irréversible : on le dit avant, pas après. */}
        <div className="flex items-start gap-3 rounded-lg bg-error-container p-4 text-on-error-container">
          <span className="material-symbols-outlined">warning</span>
          <p className="text-body-md">
            <span className="font-bold">Attention :</span> une mauvaise réponse t’élimine de
            cette manche. Réfléchis bien.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-label-lg uppercase tracking-widest text-on-surface-variant">
            Ce que tu sais
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
          onKeyDown={(e) => e.key === "Enter" && value && onConfirm(value)}
          placeholder="Écris le nom du pays…"
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full border-b-4 border-tile bg-transparent py-3 text-center text-headline-md uppercase text-on-surface outline-none transition-colors focus:border-accent"
        />

        {playersLeft !== undefined && (
          <p className="text-center text-label-md text-on-surface-variant">
            {playersLeft} pays encore à trouver
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border-2 border-outline-variant bg-white py-4 text-label-lg text-on-surface-variant active:scale-95"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!value}
            onClick={() => onConfirm(value)}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent py-4 text-label-lg text-white shadow-btn-3d transition-all active:translate-y-[3px] active:shadow-[0_1px_0_0_#4029ba] disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none disabled:active:translate-y-0"
          >
            Valider
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
