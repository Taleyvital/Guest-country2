"use client";

/**
 * Zone d'action fixe en bas d'écran.
 *
 * `disabled` n'est pas cosmétique : hors de son tour, un joueur ne doit pas pouvoir
 * déclencher l'action, même en tapant vite pendant la bascule de tour. L'attribut
 * `disabled` du <button> bloque le clic ET le focus clavier — un `pointer-events-none`
 * ne ferait que le premier. Le serveur revalide de toute façon (`not your turn`) :
 * ceci est la première barrière, pas la seule.
 */
export function ActionBar({
  isMyTurn,
  hasTarget,
  targetName,
  turnOwnerName,
  outOfLetters,
  onAskLetter,
  onGuessCountry,
}: {
  isMyTurn: boolean;
  /** Une action vise toujours un adversaire : sans cible, rien n'est jouable. */
  hasTarget: boolean;
  targetName?: string;
  turnOwnerName?: string;
  outOfLetters?: boolean;
  onAskLetter: () => void;
  onGuessCountry: () => void;
}) {
  const blocked = !isMyTurn || !hasTarget;

  const hint = !isMyTurn
    ? turnOwnerName
      ? `Au tour de ${turnOwnerName}`
      : "Ce n’est pas ton tour"
    : !hasTarget
      ? "Choisis un joueur à interroger"
      : `Cible : ${targetName}`;

  return (
    <nav
      className="fixed bottom-0 left-0 z-50 w-full bg-canvas px-4 pb-8 pt-4 shadow-[0_-8px_16px_-4px_rgba(0,0,0,0.05)]"
      style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-container flex-col gap-2">
        <p
          className={[
            "text-center text-label-md uppercase tracking-wide",
            isMyTurn && hasTarget ? "text-accent" : "text-on-surface-variant",
          ].join(" ")}
        >
          {hint}
        </p>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onAskLetter}
            // Le budget de lettres épuisé n'interdit pas de deviner : on peut encore
            // tenter le pays, c'est même tout l'intérêt de la fin de manche.
            disabled={blocked || outOfLetters}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 text-label-lg text-white shadow-btn-3d transition-all active:translate-y-[3px] active:shadow-[0_1px_0_0_#4029ba] disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none disabled:active:translate-y-0"
          >
            <span className="material-symbols-outlined">contact_support</span>
            {outOfLetters && isMyTurn ? "Plus de lettres" : "Demander une lettre"}
          </button>

          <button
            type="button"
            onClick={onGuessCountry}
            disabled={blocked}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-accent bg-white px-6 py-4 text-label-lg text-accent transition-all active:scale-95 disabled:cursor-not-allowed disabled:border-tile disabled:bg-white disabled:text-outline disabled:active:scale-100"
          >
            <span className="material-symbols-outlined">public</span>
            Deviner le pays
          </button>
        </div>
      </div>
    </nav>
  );
}
