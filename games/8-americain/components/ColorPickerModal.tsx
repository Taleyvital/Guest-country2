"use client";

import { SUIT_LABEL } from "../engine";
import type { Suit } from "../types";

const SUITS: Suit[] = ["S", "H", "D", "C"];

/** Le 8 est un joker de couleur : modale immédiate au moment de le poser,
 *  avant même que le serveur valide le coup. Fermer (croix ou clic sur le
 *  fond) annule le coup — le 8 reste en main, rien n'est parti au serveur. */
export function ColorPickerModal({
  onPick,
  onClose,
}: {
  onPick: (suit: Suit) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 text-center shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-headline-md">Choisis la couleur</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant active:scale-95"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {SUITS.map((suit) => (
            <button
              key={suit}
              type="button"
              onClick={() => onPick(suit)}
              className={`flex h-16 items-center justify-center rounded-lg bg-canvas text-3xl shadow-card active:scale-95 ${
                suit === "H" || suit === "D" ? "text-danger" : "text-black"
              }`}
            >
              {SUIT_LABEL[suit]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
