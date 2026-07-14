"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useGameChannel } from "@/lib/realtime/useGameChannel";
import { GameScreen } from "@/components/game/GameScreen";
import type { CountryTile, GamePlayer, LastAction } from "@/lib/game/types";

export default function PlayPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [gameId, setGameId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await ensureAnonymousSession();
      setUserId(session?.user.id ?? null);

      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.from("games").select("id").eq("code", code).single();
      if (data) setGameId(data.id as string);
    })();
  }, [code]);

  const { game, players, lastAction } = useGameChannel(gameId);

  // Adaptation rows Supabase -> props de présentation.
  const viewPlayers: GamePlayer[] = players.map((p) => ({
    id: p.id,
    name: p.nickname,
    avatarUrl: p.avatar,
    lettersLeft: 6,
    isMe: p.user_id === userId,
    isEliminated: p.is_eliminated,
  }));

  const currentTurnPlayer =
    viewPlayers.find((p) => p.id === game?.current_player_id) ?? null;

  const nameOf = (playerId?: string | null) =>
    players.find((p) => p.id === playerId)?.nickname ?? "?";

  const myPlayerId = players.find((p) => p.user_id === userId)?.id ?? null;

  // Un seul objet, construit depuis le dernier event : rien ne s'accumule.
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

  // Les tuiles ne peuvent pas encore venir de la base : la mécanique (qui possède
  // le pays secret) n'est pas tranchée, donc le schéma ne stocke ni le mot ni les
  // lettres révélées. L'écran s'affiche, le mot reste vide jusque-là.
  const myCountryTiles: CountryTile[] = [];

  if (!game) {
    return (
      <main className="screen flex min-h-dvh items-center justify-center">
        <p className="text-body-lg text-on-surface-variant">Chargement de la partie…</p>
      </main>
    );
  }

  return (
    <GameScreen
      currentTurnPlayer={currentTurnPlayer}
      players={viewPlayers}
      myCountryTiles={myCountryTiles}
      lastAction={viewLastAction}
      roomCode={code}
      round={game.round}
      totalRounds={game.total_rounds}
      onBack={() => router.push("/")}
      onAskLetter={(letter) => console.log("ask", letter)}
      onGuessCountry={(guess) => console.log("guess", guess)}
    />
  );
}
