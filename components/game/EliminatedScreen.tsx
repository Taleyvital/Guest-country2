"use client";

import type { GuessResult } from "./SuccessCelebration";

/**
 * Écran d'élimination : je viens de proposer un mauvais pays.
 *
 * Différence assumée avec la maquette Stitch : on ne révèle PAS le bon pays. Ici on
 * devine celui d'un adversaire encore en jeu ; l'afficher à l'éliminé — qui devient
 * spectateur, souvent à la même table — reviendrait à spoiler la cible pour tous les
 * autres. Le mot reste caché, la manche garde son intérêt.
 */
export function EliminatedScreen({
  result,
  guess,
  targetName,
  playersLeft,
  onSpectate,
  onLeave,
}: {
  result: GuessResult | null;
  /** Ce que J'AI proposé (le client le connaît, ce n'est pas un secret). */
  guess: string;
  targetName?: string;
  /** Adversaires encore à trouver, pour "il en reste N". */
  playersLeft?: number;
  onSpectate: () => void;
  onLeave: () => void;
}) {
  // Ne s'affiche que sur MON échec. Une bonne réponse passe par SuccessCelebration.
  if (!result || result.correct) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-on-background/70 p-4 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-container flex-col items-center gap-6 rounded-[2rem] bg-canvas p-8 text-center shadow-modal animate-slide-up">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-danger text-white">
          <span className="material-symbols-outlined text-[40px]">heart_broken</span>
        </div>

        <div>
          <h2 className="text-headline-lg-mobile text-danger">Éliminé !</h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Tu as proposé <span className="font-bold text-on-surface">{guess}</span>
            {targetName ? (
              <>
                {" "}
                pour le pays de <span className="font-bold">{targetName}</span>
              </>
            ) : null}
            . Ce n’était pas ça.
          </p>
        </div>

        {/* On ne dévoile pas le bon pays : d'autres le cherchent encore. */}
        <p className="rounded-lg bg-surface-container-low px-4 py-3 text-label-md text-on-surface-variant">
          🤫 Le pays reste secret — les autres joueurs le cherchent toujours.
        </p>

        <div className="grid w-full grid-cols-2 gap-3">
          <Stat icon="trending_down" value={`${result.points}`} label="Points perdus" />
          <Stat icon="spellcheck" value={`${result.letters_used}/6`} label="Questions posées" />
        </div>

        {/* Éliminé de la MANCHE, pas de la partie : on peut rester regarder, puis
            rejouer à la manche suivante. */}
        <div className="w-full rounded-xl bg-white p-4 text-left shadow-card">
          <div className="flex items-center gap-2 text-on-surface">
            <span className="material-symbols-outlined text-accent">visibility</span>
            <span className="text-body-lg font-bold">Rester spectateur ?</span>
          </div>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Tu peux regarder la manche se terminer
            {playersLeft !== undefined ? ` — ${playersLeft} pays encore à trouver` : ""}, puis
            rejouer à la suivante.
          </p>
        </div>

        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={onLeave}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-outline-variant bg-white py-4 text-label-lg text-on-surface-variant active:scale-95"
          >
            <span className="material-symbols-outlined">meeting_room</span>
            Quitter
          </button>
          <button
            type="button"
            onClick={onSpectate}
            className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-full"
          >
            <span className="material-symbols-outlined">visibility</span>
            Regarder
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-white p-4 shadow-card">
      <span className="material-symbols-outlined text-danger">{icon}</span>
      <span className="text-headline-md text-danger">{value}</span>
      <span className="text-center text-label-md uppercase text-on-surface-variant">
        {label}
      </span>
    </div>
  );
}
