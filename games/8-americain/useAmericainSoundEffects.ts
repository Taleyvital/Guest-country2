"use client";

import { useEffect, useRef } from "react";
import { useGameSounds } from "@/lib/hooks/useGameSounds";
import type { AmericainGame, AmericainPlayer } from "./types";

/**
 * Branche les MÊMES sons que Guess the Country (useGameSounds) sur les
 * transitions d'état de 8 Américain. Pas de nouvelle table d'événements :
 * chaque son se déduit de deltas sur l'état déjà synchronisé par
 * useAmericainChannel, avec le même principe que useGameSoundEffects
 * (observer via des refs, ne jamais sonner au premier rendu).
 *
 * Mapping (les noms de sons restent ceux du jeu principal, réinterprétés) :
 *   - your-turn      : la main passe à moi.
 *   - letter-found   : je viens de vider ma main (je gagne la manche).
 *   - letter-missed  : ma main grossit alors que ce n'est PAS mon tour — la
 *                      seule façon d'être touché est de subir un Valet/As/2
 *                      (un tirage volontaire, lui, n'arrive que pendant MON tour).
 *   - victory/elimination : partie terminée, gagnée ou perdue.
 */
export function useAmericainSoundEffects({
  game,
  players,
  myHand,
  myPlayerId,
}: {
  game: AmericainGame | null;
  players: AmericainPlayer[];
  myHand: string[];
  myPlayerId: string | null;
}) {
  const sounds = useGameSounds();

  const prevTurn = useRef<string | null>(null);
  const prevMyHandLength = useRef<number | null>(null);
  const prevMyHandCount = useRef<number | null>(null);
  const prevFinished = useRef(false);

  const me = players.find((p) => p.id === myPlayerId) ?? null;
  const isMyTurn = Boolean(myPlayerId && game?.current_player_id === myPlayerId);

  // --- À moi de jouer ---
  useEffect(() => {
    const turn = game?.current_player_id ?? null;
    if (turn !== prevTurn.current) {
      if (myPlayerId && turn === myPlayerId && prevTurn.current !== null) {
        sounds.playYourTurn();
      }
      prevTurn.current = turn;
    }
  }, [game?.current_player_id, myPlayerId, sounds]);

  // --- Je viens de vider ma main : je gagne la manche ---
  useEffect(() => {
    const len = myHand.length;
    if (
      prevMyHandLength.current !== null &&
      prevMyHandLength.current > 0 &&
      len === 0
    ) {
      sounds.playLetterFound();
    }
    prevMyHandLength.current = len;
  }, [myHand.length, sounds]);

  // --- Ma main grossit hors de mon tour : je subis une attaque (Valet/As/2) ---
  useEffect(() => {
    const count = me?.hand_count ?? null;
    if (
      prevMyHandCount.current !== null &&
      count !== null &&
      count > prevMyHandCount.current &&
      !isMyTurn
    ) {
      sounds.playLetterMissed();
    }
    prevMyHandCount.current = count;
  }, [me?.hand_count, isMyTurn, sounds]);

  // --- Partie terminée : je gagne (pénalité la plus basse) ou je perds ---
  useEffect(() => {
    const finished = game?.status === "finished";
    if (finished && !prevFinished.current && me && players.length > 0) {
      const lowest = players.reduce((m, p) => Math.min(m, p.penalty_score), Infinity);
      if (me.penalty_score === lowest) sounds.playVictory();
      else sounds.playElimination();
    }
    prevFinished.current = finished;
  }, [game?.status, players, me, sounds]);
}
