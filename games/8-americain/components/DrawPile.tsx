"use client";

/** La pioche : dos de carte + compteur public (jamais l'ordre — voir
 *  americain_state, sans policy RLS). Cliquable directement pendant son tour :
 *  pas besoin d'un bouton séparé, la pile EST le bouton. */
export function DrawPile({
  count,
  canDraw,
  onDraw,
}: {
  count: number;
  canDraw: boolean;
  onDraw: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!canDraw}
      onClick={onDraw}
      aria-label="Piocher"
      className={`relative flex h-32 w-24 items-center justify-center rounded-xl bg-accent shadow-card transition-transform ${
        canDraw ? "active:scale-95" : "opacity-60"
      }`}
      style={{
        backgroundImage:
          "radial-gradient(circle, rgb(255 255 255 / 0.25) 1.5px, transparent 1.5px)",
        backgroundSize: "10px 10px",
      }}
    >
      <span className="absolute -right-2 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-1.5 text-label-md text-accent shadow-card">
        {count}
      </span>
    </button>
  );
}
