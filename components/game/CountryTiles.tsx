import type { CountryTile } from "@/lib/game/types";

/**
 * Le mot à deviner, façon Wordle. Une tuile cachée est un simple bloc #DFE6E9 :
 * elle ne porte AUCUNE lettre dans le DOM, sinon la réponse se lirait à l'inspecteur.
 */
export function CountryTiles({
  tiles,
  hint,
  title = "Ton pays",
}: {
  tiles: CountryTile[];
  hint?: string;
  title?: string;
}) {
  return (
    <section className="rounded-xl border-b-2 border-surface-container-highest bg-white p-6 shadow-card">
      <div className="mb-4 flex items-end justify-between gap-2">
        <h3 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          {title}
        </h3>
        {hint && (
          <span className="rounded-full bg-primary-fixed px-3 py-1 text-label-md text-accent">
            {hint}
          </span>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {tiles.map((tile, i) => {
          const revealed = tile.letter !== null;

          const tone =
            tile.state === "correct"
              ? "bg-success text-white border-2 border-success"
              : tile.state === "wrong"
                ? "bg-danger text-white border-2 border-danger"
                : revealed
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
                revealed ? "animate-tile-pop" : "",
              ].join(" ")}
              aria-label={revealed ? `Lettre ${tile.letter} révélée` : "Lettre cachée"}
            >
              {tile.letter}
            </div>
          );
        })}
      </div>
    </section>
  );
}
