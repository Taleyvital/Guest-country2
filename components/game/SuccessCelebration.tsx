"use client";

import { useEffect, useState } from "react";
import { flagEmoji } from "@/lib/game/flags";

export type GuessResult = {
  correct: boolean;
  country: string | null;
  points: number;
  letters_left: number;
  letters_used: number;
};

/**
 * Célébration d'une bonne réponse.
 *
 * Les chiffres viennent du serveur (retour de `submit_guess`), pas d'un calcul local :
 * le client n'a pas à re-deviner combien de points il vient de marquer, il se
 * tromperait à la première évolution du barème.
 */
export function SuccessCelebration({
  result,
  targetName,
  onClose,
}: {
  result: GuessResult | null;
  /** Le joueur dont on vient de percer le pays. */
  targetName?: string;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(Boolean(result?.correct));
  }, [result]);

  if (!result?.correct || !visible) return null;

  const letters = (result.country ?? "").split("");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-on-background/70 p-4 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-container flex-col items-center gap-6 rounded-[2rem] bg-canvas p-8 text-center shadow-modal animate-slide-up">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success text-white">
          {flagEmoji(result.country ?? "") ? (
            <span aria-hidden className="text-[40px] leading-none">
              {flagEmoji(result.country ?? "")}
            </span>
          ) : (
            <span className="material-symbols-outlined text-[40px]">emoji_events</span>
          )}
        </div>

        <div>
          <h2 className="text-headline-lg-mobile text-success">Bien joué !</h2>
          <p className="text-body-md text-on-surface-variant">
            Tu as identifié le pays de <span className="font-bold">{targetName}</span>.
          </p>
        </div>

        {/* Le mot enfin en clair : c'est la récompense, elle mérite d'être lisible. */}
        <div className="flex flex-wrap justify-center gap-2">
          {letters.map((ch, i) => (
            <div
              key={i}
              style={{ animationDelay: `${i * 60}ms` }}
              className="flex h-14 w-12 animate-tile-pop items-center justify-center rounded-lg bg-success text-headline-md text-white shadow-tile"
            >
              {ch}
            </div>
          ))}
        </div>

        <div className="grid w-full grid-cols-2 gap-3">
          <Stat
            icon="add_circle"
            label="Points gagnés"
            value={`+${result.points}`}
            tone="success"
          />
          <Stat
            icon="spellcheck"
            label="Questions posées"
            value={`${result.letters_used}/6`}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onClose();
          }}
          className="btn-primary w-full rounded-full"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-white p-4 shadow-card">
      <span
        className={[
          "material-symbols-outlined",
          tone === "success" ? "text-success" : "text-accent",
        ].join(" ")}
      >
        {icon}
      </span>
      <span
        className={[
          "text-headline-md",
          tone === "success" ? "text-success" : "text-on-surface",
        ].join(" ")}
      >
        {value}
      </span>
      <span className="text-label-md uppercase text-on-surface-variant">{label}</span>
    </div>
  );
}
