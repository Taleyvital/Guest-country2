"use client";

import { useEffect, useState } from "react";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function AskLetterModal({
  open,
  usedLetters,
  cost = 50,
  onClose,
  onConfirm,
}: {
  open: boolean;
  /** Lettres déjà demandées ce round : barrées et non re-cliquables. */
  usedLetters: string[];
  cost?: number;
  onClose: () => void;
  onConfirm: (letter: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  // Repartir vierge à chaque ouverture, sinon la lettre du tour précédent
  // resterait pré-sélectionnée.
  useEffect(() => {
    if (open) setSelected(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const used = new Set(usedLetters.map((l) => l.toUpperCase()));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Demander une lettre"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-on-background/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-container flex-col gap-6 rounded-t-[2rem] bg-canvas p-6 pb-10 shadow-modal animate-slide-up sm:rounded-[2rem] sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-surface-container sm:hidden" />
          <h2 className="mb-2 text-headline-md text-on-surface">Demander une lettre</h2>
          <p className="px-4 text-body-md text-on-surface-variant">
            Choisis une lettre à révéler. Chaque lettre coûte{" "}
            <span className="font-bold text-accent">{cost} points</span>.
          </p>
        </div>

        <div className="grid grid-cols-6 gap-2 px-1 sm:grid-cols-7 sm:gap-3">
          {ALPHABET.map((letter) => {
            const isUsed = used.has(letter);
            const isSelected = selected === letter;

            return (
              <button
                key={letter}
                type="button"
                disabled={isUsed}
                onClick={() => setSelected(letter)}
                className={[
                  "flex aspect-square w-full items-center justify-center rounded-lg text-headline-md transition-transform",
                  isUsed
                    ? "cursor-not-allowed bg-surface-container-highest text-outline line-through decoration-2 opacity-50"
                    : isSelected
                      ? "scale-105 bg-accent text-white shadow-card"
                      : "bg-white text-on-surface shadow-sm active:scale-95",
                ].join(" ")}
              >
                {letter}
              </button>
            );
          })}
        </div>

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
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
            className="flex-1 rounded-full bg-accent py-4 text-label-lg text-white shadow-btn-3d transition-all active:translate-y-[3px] active:shadow-[0_1px_0_0_#4029ba] disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none disabled:active:translate-y-0"
          >
            {selected ? `Demander « ${selected} »` : "Choisis une lettre"}
          </button>
        </div>
      </div>
    </div>
  );
}
