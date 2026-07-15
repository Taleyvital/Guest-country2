"use client";

import { useEffect, useRef } from "react";
import { useGameSounds } from "./useGameSounds";
import type { Game, GameEvent, Player } from "@/lib/supabase/types";

/**
 * Branche les sons sur les transitions d'état Realtime.
 *
 * Découplé de useGameChannel à dessein : ce hook ne fait qu'OBSERVER l'état déjà
 * fourni et détecter les transitions (avant → après) via des refs. Il ne s'abonne à
 * rien lui-même, donc il n'y a qu'UNE seule socket Realtime (celle de useGameChannel).
 *
 * Adaptation au schéma réel : la spec parle de `current_turn` / "réponse reçue" /
 * "last player standing" ; on mappe respectivement sur `games.current_player_id`, les
 * `game_events` de type ask_letter, et "finir la partie en tête".
 */
export function useGameSoundEffects({
  game,
  players,
  lastAction,
  myPlayerId,
}: {
  game: Game | null;
  players: Player[];
  lastAction: GameEvent | null;
  myPlayerId: string | null;
}) {
  const sounds = useGameSounds();

  // Valeurs précédentes : on ne joue un son que sur un CHANGEMENT, pas à chaque render.
  const prevTurn = useRef<string | null>(null);
  const prevActionId = useRef<string | null>(null);
  const prevEliminated = useRef<boolean | null>(null);
  const prevFinished = useRef(false);

  const me = players.find((p) => p.id === myPlayerId) ?? null;

  // --- C'est mon tour ---
  useEffect(() => {
    const turn = game?.current_player_id ?? null;
    if (turn !== prevTurn.current) {
      // On ne sonne pas au tout premier rendu (prevTurn === null) sauf si c'est
      // réellement mon tour dès l'arrivée.
      if (myPlayerId && turn === myPlayerId && prevTurn.current !== turn) {
        sounds.playYourTurn();
      }
      prevTurn.current = turn;
    }
  }, [game?.current_player_id, myPlayerId, sounds]);

  // --- Réponse à MA demande de lettre (found / missed) ---
  useEffect(() => {
    if (!lastAction || lastAction.id === prevActionId.current) return;
    prevActionId.current = lastAction.id;

    // Seuls MES coups déclenchent le retour "trouvé/absent" : c'est ma réponse reçue.
    if (lastAction.type === "ask_letter" && lastAction.actor_id === myPlayerId) {
      const found = (lastAction.payload as { found?: boolean }).found;
      if (found) sounds.playLetterFound();
      else sounds.playLetterMissed();
    }
  }, [lastAction, myPlayerId, sounds]);

  // --- Je viens d'être éliminé ---
  useEffect(() => {
    const elim = me?.is_eliminated ?? null;
    if (prevEliminated.current === false && elim === true) {
      sounds.playElimination();
    }
    prevEliminated.current = elim;
  }, [me?.is_eliminated, sounds]);

  // --- Partie terminée : je finis en tête ---
  useEffect(() => {
    const finished = game?.status === "finished";
    if (finished && !prevFinished.current && me) {
      const top = players.reduce((m, p) => Math.max(m, p.score), -Infinity);
      if (me.score === top) sounds.playVictory();
    }
    prevFinished.current = finished;
  }, [game?.status, players, me, sounds]);
}
