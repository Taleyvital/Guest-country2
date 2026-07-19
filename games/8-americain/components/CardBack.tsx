"use client";

/** Dos de carte : même silhouette que PlayingCard (mêmes tailles, mêmes coins
 *  arrondis) pour que pioche et main s'accordent visuellement. Le motif bleu
 *  vient du même sprite SVG que les faces (groupe `back`) — jamais
 *  d'information de jeu ne transite par un dos de carte. */
export function CardBack({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims =
    size === "lg"
      ? "h-44 w-32 rounded-[5px]"
      : size === "sm"
        ? "h-24 w-[4.25rem] rounded-[3px]"
        : "h-32 w-[5.75rem] rounded-[4px]";

  return (
    <div className={`relative shrink-0 overflow-hidden bg-white shadow-card ${dims}`}>
      <svg
        className="h-full w-full"
        viewBox="0 0 169.075 244.64"
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* Le motif du dos hérite du fill du <use> (noir par défaut dans le sprite). */}
        <use href="/cards/svg-cards.svg#back" fill="#2b63c0" />
      </svg>
    </div>
  );
}
