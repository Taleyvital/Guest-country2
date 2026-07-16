"use client";

import { useState } from "react";
import type { CountryTile } from "@/lib/game/types";

/**
 * Le mot à deviner, façon Wordle. Une tuile cachée est un simple bloc #DFE6E9 :
 * elle ne porte AUCUNE lettre dans le DOM, sinon la réponse se lirait à l'inspecteur.
 */
export function CountryTiles({
  tiles,
  hint,
  title = "Ton pays",
  fullCountry,
}: {
  tiles: CountryTile[];
  hint?: string;
  title?: string;
  /**
   * Le pays complet — celui que LE JOUEUR LUI-MÊME a choisi. Ce n'est pas un secret
   * pour lui (contrairement aux tuiles, qui montrent ce que les AUTRES ont trouvé) :
   * on lui permet de le revoir à tout moment, sans avoir à s'en souvenir pendant
   * toute la manche. Absent quand ce composant affiche le pays d'un adversaire.
   */
  fullCountry?: string;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <section className="rounded-xl border-b-2 border-surface-container-highest bg-white p-6 shadow-card">
      <div className="mb-4 flex items-end justify-between gap-2">
        <h3 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {hint && (
            <span className="rounded-full bg-primary-fixed px-3 py-1 text-label-md text-accent">
              {hint}
            </span>
          )}
          {fullCountry && (
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              aria-pressed={revealed}
              aria-label={revealed ? "Cacher mon pays" : "Voir mon pays"}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-colors active:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[18px]">
                {revealed ? "visibility_off" : "visibility"}
              </span>
            </button>
          )}
        </div>
      </div>

      {fullCountry && revealed && (
        <p className="mb-4 text-center text-headline-md text-accent">{fullCountry}</p>
      )}

      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {tiles.map((tile, i) => {
          const found = tile.letter !== null;

          const tone =
            tile.state === "correct"
              ? "bg-success text-white border-2 border-success"
              : tile.state === "wrong"
                ? "bg-danger text-white border-2 border-danger"
                : found
                  ? "bg-white text-on-surface border-2 border-surface-variant"
                  : "bg-tile border-2 border-transparent";

          return (
            <div
              key={i}
              className={[
                "flex h-14 w-12 items-center justify-center rounded-lg shadow-tile transition-transform sm:h-20 sm:w-16",
                "text-headline-lg-mobile sm:text-headline-lg",
                tone,
                // "Pop" 1.1x à la révélation, comme spécifié dans le design system.
                found ? "animate-tile-pop" : "",
              ].join(" ")}
              aria-label={found ? `Lettre ${tile.letter} révélée` : "Lettre cachée"}
            >
              {tile.letter}
            </div>
          );
        })}
      </div>
    </section>
  );
}
