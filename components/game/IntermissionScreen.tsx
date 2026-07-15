"use client";

import { useState } from "react";
import { CountryPicker } from "./CountryPicker";
import { Avatar } from "./Avatar";
import type { Country } from "@/lib/game/types";
import type { Player } from "@/lib/supabase/types";

/**
 * Entre-manches : on reste dans l'écran de jeu, pas de retour au salon.
 *
 * Scores de la manche + choix du pays suivant. Dès que tout le monde a choisi, le
 * serveur démarre la manche suivante (pick_country auto-start) et l'écran bascule tout
 * seul vers le jeu via le Realtime — ce composant n'a rien à déclencher.
 */
export function IntermissionScreen({
  round,
  totalRounds,
  players,
  myUserId,
  countries,
  onPick,
}: {
  /** Numéro de la manche À VENIR (close_round a déjà incrémenté). */
  round: number;
  totalRounds: number;
  players: Player[];
  myUserId: string | null;
  countries: Country[];
  onPick: (country: string) => Promise<void>;
}) {
  const [picking, setPicking] = useState("");
  const [busy, setBusy] = useState(false);

  const me = players.find((p) => p.user_id === myUserId) ?? null;
  const ranking = [...players].sort((a, b) => b.score - a.score);
  const pickedCount = players.filter((p) => p.has_picked).length;

  async function confirm() {
    if (!picking) return;
    setBusy(true);
    await onPick(picking);
    setBusy(false);
  }

  return (
    <main
      className="screen flex min-h-dvh flex-col gap-6 py-8"
      style={{ paddingTop: "calc(2rem + env(safe-area-inset-top))" }}
    >
      <header className="text-center">
        <p className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          Manche {round - 1} terminée
        </p>
        <h1 className="text-headline-lg-mobile">Manche suivante</h1>
        <p className="text-label-md text-on-surface-variant">
          Manche {round} / {totalRounds}
        </p>
      </header>

      {/* Scores en cours : on veut voir où on en est avant de repartir. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          Scores
        </h2>
        <ul className="flex flex-col gap-2">
          {ranking.map((p, i) => (
            <li
              key={p.id}
              className={[
                "flex items-center gap-3 rounded-lg p-3 shadow-card",
                p.user_id === myUserId ? "border-2 border-accent bg-white" : "bg-white",
              ].join(" ")}
            >
              <span className="w-5 text-center text-label-lg text-on-surface-variant">
                {i + 1}
              </span>
              <Avatar player={p} size={28} />
              <span className="flex-1 text-body-lg">{p.nickname}</span>
              <span className="text-headline-md">{p.score}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Choix du pays de la manche à venir. */}
      {me?.has_picked ? (
        <section className="flex flex-col items-center gap-2 rounded-xl bg-secondary-container p-6 text-center text-on-secondary-container">
          <span className="material-symbols-outlined text-[32px]">check_circle</span>
          <p className="text-body-lg font-bold">Ton pays est choisi</p>
          <p className="text-body-md">
            En attente des autres… {pickedCount}/{players.length} prêts
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card">
          <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
            Ton nouveau pays
          </h2>
          <p className="text-body-md text-on-surface-variant">
            Choisis le pays que les autres devront deviner cette manche.
          </p>
          <CountryPicker countries={countries} value={picking} onChange={setPicking} />
          <button
            type="button"
            disabled={!picking || busy}
            onClick={confirm}
            className="btn-primary w-full rounded-full disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
          >
            {busy ? "…" : picking ? `Valider ${picking}` : "Choisis un pays"}
          </button>
        </section>
      )}
    </main>
  );
}
