"use client";

import { useEffect } from "react";
import type { AmericainEvent, AmericainPlayer } from "../types";

const AUTO_DISMISS_MS = 4500;

/**
 * Écran de fin de manche : s'affiche à CHAQUE manche gagnée (round_won), pas
 * seulement à la fin de la partie. La manche suivante est déjà distribuée
 * côté serveur au moment où cet écran apparaît (americain_end_round redistribue
 * dans la même transaction) — fermer l'écran ne fait qu'y révéler l'état déjà
 * là, ça ne met rien en pause pour les autres joueurs.
 */
export function RoundEndScreen({
  event,
  players,
  onClose,
}: {
  event: AmericainEvent;
  players: AmericainPlayer[];
  onClose: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const winner = players.find((p) => p.id === event.actor_id);
  const penalties = Object.entries(event.payload.penalties ?? {});

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-on-background/70 p-4 backdrop-blur-sm"
    >
      <div
        key={event.id}
        className="flex w-full max-w-container flex-col items-center gap-6 rounded-[2rem] bg-canvas p-8 text-center shadow-modal animate-slide-up"
      >
        <div className="flex h-20 w-20 animate-tile-pop items-center justify-center rounded-full bg-accent text-white">
          <span className="material-symbols-outlined text-[40px]">celebration</span>
        </div>

        <div>
          <h2 className="text-headline-lg-mobile text-accent">Manche terminée !</h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            <span className="font-bold text-on-surface">{winner?.nickname ?? "Un joueur"}</span> a
            vidé sa main en premier.
          </p>
        </div>

        {penalties.length > 0 && (
          <ul className="flex w-full flex-col gap-2">
            {penalties.map(([playerId, points], i) => {
              const p = players.find((pl) => pl.id === playerId);
              return (
                <li
                  key={playerId}
                  style={{ animationDelay: `${i * 80}ms` }}
                  className="flex animate-slide-up items-center justify-between rounded-xl bg-white px-4 py-3 shadow-card"
                >
                  <span className="text-body-md">{p?.nickname ?? "Joueur"}</span>
                  <span className="text-label-lg text-danger">+{points}</span>
                </li>
              );
            })}
          </ul>
        )}

        <button type="button" onClick={onClose} className="btn-primary w-full rounded-full">
          Continuer
        </button>
      </div>
    </div>
  );
}
