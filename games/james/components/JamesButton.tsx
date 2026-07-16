"use client";

/** N'apparaît QUE sur l'écran du joueur qui a 4 cartes de la même couleur — le
 *  serveur revérifie la prétention dans call_james, ce bouton n'est qu'un
 *  raccourci d'UI, jamais une source de vérité. */
export function JamesButton({ onCall }: { onCall: () => void }) {
  return (
    <button
      type="button"
      onClick={onCall}
      className="btn-primary animate-pulse rounded-full px-8 py-4 text-label-lg shadow-btn-3d active:scale-95"
    >
      James !
    </button>
  );
}
