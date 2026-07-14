import type { LastAction } from "@/lib/game/types";

/**
 * Bandeau "Last Action".
 *
 * Ce composant est SANS ÉTAT et ne reçoit qu'un objet unique : il n'y a nulle part
 * où un historique pourrait s'accumuler. Pas de useState, pas de tableau, pas de
 * `setActions(prev => [...prev, next])`. Une nouvelle action écrase la précédente.
 *
 * Le `key={action.id}` sur la racine force React à remonter le noeud à chaque
 * changement d'action : l'animation d'entrée rejoue, sans empiler de DOM.
 */
export function LastActionCard({ action }: { action: LastAction | null }) {
  // Aucune action encore survenue : on réserve la place plutôt que de faire sauter
  // la mise en page au premier événement.
  if (!action) {
    return (
      <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
        <span className="text-label-md uppercase text-on-surface-variant">Dernière action</span>
        <p className="text-body-md text-on-surface-variant">En attente du premier coup…</p>
      </section>
    );
  }

  return (
    <section key={action.id} className="animate-slide-up">
      <div
        aria-live="polite"
        className="flex items-start gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4"
      >
        <div className="rounded-lg bg-white p-2 shadow-sm">
          <span className="material-symbols-outlined text-danger">history</span>
        </div>
        <div className="flex flex-col">
          <span className="mb-0.5 text-label-md uppercase text-on-surface-variant">
            Dernière action
          </span>
          <p className="text-body-md text-on-surface">
            <ActionSentence action={action} />
          </p>
        </div>
      </div>
    </section>
  );
}

function ActionSentence({ action }: { action: LastAction }) {
  const actor = <span className="font-bold">{action.actorName}</span>;

  // "t’a demandé" quand c'est moi la cible, "a demandé à Yao" sinon : la préposition
  // change avec la personne, on ne peut pas se contenter de substituer un nom.
  const askedWhom = action.targetIsMe ? <>t’a demandé</> : <>a demandé à {action.targetName}</>;

  switch (action.type) {
    case "ask_letter":
      return (
        <>
          {actor} {askedWhom} la lettre{" "}
          <span className="font-bold text-accent">«&nbsp;{action.letter}&nbsp;»</span> →{" "}
          {action.found ? (
            <span className="font-bold text-success">Trouvée</span>
          ) : (
            <span className="font-bold text-danger">Absente</span>
          )}
        </>
      );

    case "guess":
      return (
        <>
          {actor} a proposé <span className="font-bold text-accent">{action.guess}</span> →{" "}
          {action.correct ? (
            <span className="font-bold text-success">Correct</span>
          ) : (
            <span className="font-bold text-danger">Faux</span>
          )}
        </>
      );

    case "eliminated":
      return (
        <>
          {actor} a proposé <span className="font-bold">{action.guess}</span> et a été{" "}
          <span className="font-bold text-danger">éliminé</span>
        </>
      );

    case "turn_skipped":
      return (
        <>
          {actor} <span className="font-bold text-on-surface-variant">a passé son tour</span>
        </>
      );
  }
}
