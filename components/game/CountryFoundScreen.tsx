"use client";

/**
 * Écran vu par le joueur DONT LE PAYS VIENT D'ÊTRE DEVINÉ.
 *
 * À distinguer de l'EliminatedScreen (là, c'est TA propre réponse qui était fausse).
 * Ici, un adversaire a percé ton pays : tu le découvres en grand, avec qui l'a trouvé.
 *
 * Rendu au-dessus de tout (même de l'intermission) car, à 2 joueurs, un pays trouvé
 * termine la manche aussitôt : sans cet écran, tu passerais direct aux scores sans
 * comprendre ce qui vient de se passer.
 */
export function CountryFoundScreen({
  byName,
  country,
  stillPlaying,
  onClose,
}: {
  /** Qui a deviné ton pays. */
  byName: string;
  /** Ton pays, désormais révélé à tous. */
  country: string;
  /** La manche continue-t-elle pour toi (tu peux encore deviner les autres) ? */
  stillPlaying: boolean;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-on-background/70 p-4 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-container flex-col items-center gap-6 rounded-[2rem] bg-canvas p-8 text-center shadow-modal animate-slide-up">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-tertiary text-white">
          <span className="material-symbols-outlined text-[40px]">gps_fixed</span>
        </div>

        <div>
          <h2 className="text-headline-lg-mobile text-tertiary">Pays découvert !</h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            <span className="font-bold text-on-surface">{byName}</span> a deviné ton pays.
          </p>
        </div>

        {/* Le mot révélé, façon récompense inversée : c'était ça. */}
        <div className="flex flex-wrap justify-center gap-2">
          {country.split("").map((ch, i) => (
            <div
              key={i}
              style={{ animationDelay: `${i * 50}ms` }}
              className={[
                "flex h-14 w-12 items-center justify-center rounded-lg text-headline-md shadow-tile",
                ch === " "
                  ? "w-4 bg-transparent shadow-none"
                  : "animate-tile-pop bg-tertiary text-white",
              ].join(" ")}
            >
              {ch === " " ? "" : ch}
            </div>
          ))}
        </div>

        <p className="rounded-lg bg-surface-container-low px-4 py-3 text-body-md text-on-surface-variant">
          {stillPlaying
            ? "Tu ne peux plus être ciblé, mais tu peux encore deviner les pays des autres."
            : "La manche est terminée."}
        </p>

        <button type="button" onClick={onClose} className="btn-primary w-full rounded-full">
          {stillPlaying ? "Continuer à jouer" : "Voir la suite"}
        </button>
      </div>
    </div>
  );
}
