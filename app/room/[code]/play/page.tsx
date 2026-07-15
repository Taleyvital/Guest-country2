"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useGameChannel } from "@/lib/realtime/useGameChannel";
import { errorMessage } from "@/lib/errors";
import { GameScreen } from "@/components/game/GameScreen";
import { LeaveDialog } from "@/components/game/LeaveDialog";
import { SuccessCelebration, type GuessResult } from "@/components/game/SuccessCelebration";
import { EliminatedScreen } from "@/components/game/EliminatedScreen";
import { IntermissionScreen } from "@/components/game/IntermissionScreen";
import { useGameSoundEffects } from "@/lib/hooks/useGameSoundEffects";
import { tilesFromMask, type Country, type GamePlayer, type LastAction } from "@/lib/game/types";

export default function PlayPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [gameId, setGameId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [guessResult, setGuessResult] = useState<GuessResult | null>(null);
  const [guessedName, setGuessedName] = useState<string>();
  // Le serveur ne renvoie pas le guess sur un échec (il tairait le bon pays) : on
  // garde donc ce que le joueur a proposé pour l'afficher sur l'écran d'élimination.
  const [lastGuess, setLastGuess] = useState("");

  useEffect(() => {
    (async () => {
      const session = await ensureAnonymousSession();
      setUserId(session?.user.id ?? null);

      const supabase = getSupabaseBrowserClient();
      const [game, pool] = await Promise.all([
        supabase.from("games").select("id").eq("code", code).single(),
        supabase.from("countries").select("name, region").order("name"),
      ]);

      if (game.data) setGameId(game.data.id as string);
      setCountries((pool.data as Country[]) ?? []);
    })();
  }, [code]);

  const { game, players, lastAction } = useGameChannel(gameId);

  // Rows Supabase -> props de présentation. `masked` est la seule vue du pays qui
  // existe côté client : le mot complet n'a jamais quitté le serveur.
  const viewPlayers: GamePlayer[] = players.map((p) => ({
    id: p.id,
    name: p.nickname,
    avatarUrl: p.avatar,
    lettersLeft: p.letters_left,
    isMe: p.user_id === userId,
    isEliminated: p.is_eliminated,
    masked: p.masked,
    region: p.region,
    askedLetters: p.asked_letters,
    isCracked: p.is_cracked,
  }));

  const me = viewPlayers.find((p) => p.isMe) ?? null;
  const myPlayerId = me?.id ?? null;
  const currentTurnPlayer = viewPlayers.find((p) => p.id === game?.current_player_id) ?? null;

  // Sons de jeu, branchés sur les transitions Realtime. Observe l'état, ne s'abonne
  // à rien (une seule socket, celle de useGameChannel).
  useGameSoundEffects({ game, players, lastAction, myPlayerId });

  const nameOf = (playerId?: string | null) =>
    players.find((p) => p.id === playerId)?.nickname ?? "?";

  // Un seul objet, reconstruit depuis le dernier event : rien ne s'accumule.
  const viewLastAction: LastAction | null = lastAction
    ? {
        id: lastAction.id,
        type: lastAction.type,
        actorName: nameOf(lastAction.actor_id),
        targetName: nameOf(lastAction.target_id),
        targetIsMe: Boolean(lastAction.target_id && lastAction.target_id === myPlayerId),
        letter: (lastAction.payload as { letter?: string }).letter ?? null,
        found: (lastAction.payload as { found?: boolean }).found,
        guess: (lastAction.payload as { guess?: string }).guess ?? null,
        correct: (lastAction.payload as { correct?: boolean }).correct,
      }
    : null;

  const call = useCallback(async (fn: string, args: Record<string, unknown>) => {
    const supabase = getSupabaseBrowserClient();
    const { error: e } = await supabase.rpc(fn, args);

    // Le serveur est l'arbitre : s'il refuse (tour passé entre-temps, lettre déjà
    // demandée), on le dit plutôt que de laisser l'UI mentir.
    if (e) setError(errorMessage(e));
  }, []);

  const intermission = Boolean(game?.intermission);

  // La partie a basculé : tous les téléphones suivent l'état en base. On ne renvoie au
  // salon QUE si ce n'est pas une intermission (sinon on reste ici pour l'enchaînement).
  useEffect(() => {
    if (game?.status === "finished") router.push(`/room/${code}/results`);
    else if (game?.status === "lobby" && !game.intermission) router.push(`/room/${code}`);
  }, [game?.status, game?.intermission, code, router]);

  if (!game || !me) {
    return (
      <main className="screen flex min-h-dvh items-center justify-center">
        <p className="text-body-lg text-on-surface-variant">Chargement de la partie…</p>
      </main>
    );
  }

  // Entre deux manches : scores + choix du pays, sans quitter l'écran de jeu. La manche
  // suivante démarre seule (le serveur bascule status -> playing quand tous ont choisi).
  if (intermission) {
    return (
      <IntermissionScreen
        round={game.round}
        totalRounds={game.total_rounds}
        players={players}
        myUserId={userId}
        countries={countries}
        onPick={(country) =>
          call("pick_country", { p_game_id: game.id, p_country: country })
        }
      />
    );
  }

  return (
    <>
      <GameScreen
        currentTurnPlayer={currentTurnPlayer}
        players={viewPlayers}
        myCountryTiles={tilesFromMask(me.masked ?? "")}
        lastAction={viewLastAction}
        roomCode={code}
        round={game.round}
        totalRounds={game.total_rounds}
        regionHint={me.region ?? undefined}
        onBack={() => setLeaveOpen(true)}
        onAskLetter={(targetId, letter) =>
          call("ask_letter", { p_target_player_id: targetId, p_letter: letter })
        }
        onGuessCountry={async (targetId, guess) => {
          const supabase = getSupabaseBrowserClient();
          const { data, error: e } = await supabase.rpc("submit_guess", {
            p_target_player_id: targetId,
            p_guess: guess,
          });
          if (e) return setError(errorMessage(e));

          // Les chiffres viennent du serveur : le client ne recalcule pas le barème,
          // il l'afficherait faux à la première évolution.
          setGuessedName(viewPlayers.find((p) => p.id === targetId)?.name);
          setLastGuess(guess);
          setGuessResult(data as GuessResult);
        }}
      />

      <SuccessCelebration
        result={guessResult}
        targetName={guessedName}
        onClose={() => setGuessResult(null)}
      />

      <EliminatedScreen
        result={guessResult}
        guess={lastGuess}
        targetName={guessedName}
        playersLeft={viewPlayers.filter((p) => !p.isCracked && !p.isMe).length}
        // Rester regarder : on ferme l'overlay, on reste sur l'écran de jeu.
        onSpectate={() => setGuessResult(null)}
        onLeave={async () => {
          await call("leave_game", { p_game_id: game.id });
          router.push("/");
        }}
      />

      <LeaveDialog
        open={leaveOpen}
        isPlaying={game.status === "playing"}
        onClose={() => setLeaveOpen(false)}
        // Garder sa place : on quitte l'écran, pas la partie. La ligne players reste,
        // et l'accueil proposera de reprendre.
        onKeepSeat={() => router.push("/")}
        onLeave={async () => {
          await call("leave_game", { p_game_id: game.id });
          router.push("/");
        }}
      />

      {error && (
        <div
          role="alert"
          onClick={() => setError(null)}
          className="fixed bottom-36 left-1/2 z-[70] w-[90%] max-w-container -translate-x-1/2 rounded-lg bg-error-container p-4 text-center text-body-md text-on-error-container shadow-modal"
        >
          {error}
        </div>
      )}
    </>
  );
}
