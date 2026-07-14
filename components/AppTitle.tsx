"use client";

const TITLE = "GUESS THE COUNTRY";

/**
 * Titre animé : chaque lettre retombe en place, décalée de 40 ms.
 *
 * Le mot est découpé en <span> pour l'animation, mais reste UN SEUL nœud lisible pour
 * les lecteurs d'écran (`aria-label` sur le h1, `aria-hidden` sur les lettres) —
 * sinon la synthèse vocale épellerait « G, U, E, S, S… ».
 */
export function AppTitle() {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="animate-float text-[56px] leading-none" aria-hidden>
        🌍
      </span>

      <h1
        aria-label="Guess the Country"
        className="text-center text-headline-lg-mobile tracking-tight text-accent sm:text-display-lg"
      >
        {TITLE.split(" ").map((word, w) => (
          // On anime les lettres, mais on ne coupe pas les MOTS : un `inline-block`
          // par mot empêche le titre de se scinder n'importe où en petit écran.
          <span key={w} className="mx-1 inline-block whitespace-nowrap">
            {word.split("").map((ch, i) => (
              <span
                key={i}
                aria-hidden
                className="inline-block animate-letter-in"
                style={{ animationDelay: `${(w * 6 + i) * 40}ms` }}
              >
                {ch}
              </span>
            ))}
          </span>
        ))}
      </h1>
    </div>
  );
}
