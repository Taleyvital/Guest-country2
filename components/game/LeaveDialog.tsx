"use client";

/**
 * Le bouton "retour" est ambigu dans un jeu multijoueur : est-ce que je mets le jeu
 * en arrière-plan, ou est-ce que j'abandonne mes camarades ? On ne devine pas — on
 * demande. Partir pour de bon libère la place et fait tourner le tour : c'est
 * irréversible, ça ne peut pas être le résultat d'un appui distrait.
 */
export function LeaveDialog({
  open,
  isPlaying,
  onClose,
  onKeepSeat,
  onLeave,
}: {
  open: boolean;
  isPlaying: boolean;
  onClose: () => void;
  onKeepSeat: () => void;
  onLeave: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quitter la partie"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-on-background/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-container flex-col gap-4 rounded-t-[2rem] bg-canvas p-6 pb-10 shadow-modal animate-slide-up sm:rounded-[2rem] sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-12 rounded-full bg-surface-container sm:hidden" />

        <h2 className="text-center text-headline-md">Tu veux faire quoi ?</h2>

        <button
          type="button"
          onClick={onKeepSeat}
          className="flex flex-col gap-1 rounded-lg border-2 border-accent bg-white p-4 text-left active:scale-[0.99]"
        >
          <span className="text-body-lg font-bold text-accent">Revenir à l’accueil</span>
          <span className="text-body-md text-on-surface-variant">
            Tu gardes ta place. Tu pourras reprendre la partie quand tu veux.
          </span>
        </button>

        <button
          type="button"
          onClick={onLeave}
          className="flex flex-col gap-1 rounded-lg bg-error-container p-4 text-left text-on-error-container active:scale-[0.99]"
        >
          <span className="text-body-lg font-bold">Quitter la partie</span>
          <span className="text-body-md">
            {isPlaying
              ? "Tu abandonnes la manche en cours et tu libères ta place. Irréversible."
              : "Tu libères ta place dans le salon."}
          </span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="rounded-full border-2 border-outline-variant bg-white py-3 text-label-lg text-on-surface-variant active:scale-95"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
