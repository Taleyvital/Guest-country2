"use client";

/** Dos de carte : même silhouette que PlayingCard (mêmes tailles, mêmes coins
 *  arrondis) pour que pioche et main s'accordent visuellement. Le motif est
 *  purement décoratif — jamais d'information de jeu ne transite par un dos de
 *  carte. */
export function CardBack({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims =
    size === "lg" ? "h-44 w-32" : size === "sm" ? "h-24 w-[4.25rem]" : "h-32 w-[5.75rem]";

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-danger shadow-card ${dims}`}
    >
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgb(255 255 255 / 0.35) 0, rgb(255 255 255 / 0.35) 2px, transparent 2px, transparent 8px), " +
            "repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.35) 0, rgb(255 255 255 / 0.35) 2px, transparent 2px, transparent 8px)",
        }}
      />
      <div className="absolute inset-2 rounded-lg border border-white/60" />
      <span className="absolute inset-0 flex items-center justify-center text-[1.4em] text-white">
        ✦
      </span>
    </div>
  );
}
