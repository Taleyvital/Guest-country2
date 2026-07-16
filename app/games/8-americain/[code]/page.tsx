"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { useAmericainChannel } from "@/games/8-americain/realtime";
import { rankOf } from "@/games/8-americain/engine";
import { Hand } from "@/games/8-americain/components/Hand";
import { DiscardPile } from "@/games/8-americain/components/DiscardPile";
import { ColorPickerModal } from "@/games/8-americain/components/ColorPickerModal";
import { Scoreboard } from "@/games/8-americain/components/Scoreboard";
import { OpponentsRow } from "@/games/8-americain/components/OpponentsRow";
import type { Card, Suit } from "@/games/8-americain/types";

export default function AmericainRoomPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [gameId, setGameId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingEight, setPendingEight] = useState<Card | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const session = await ensureAnonymousSession();
        setUserId(session?.user.id ?? null);

        const supabase = getSupabaseBrowserClient();
        const game = await supabase.from("americain_games").select("id").eq("code", code).single();
        if (game.error || !game.data) throw new Error("Partie introuvable.");
        setGameId(game.data.id as string);
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [code]);

  const { game, players, myHand, onlineUserIds, status } = useAmericainChannel(gameId, myPlayerId);

  const me = players.find((p) => p.user_id === userId) ?? null;

  useEffect(() => {
    if (me && me.id !== myPlayerId) setMyPlayerId(me.id);
  }, [me, myPlayerId]);

  const supabase = getSupabaseBrowserClient();
  const isHost = Boolean(me?.is_host);
  const everyoneReady = players.length >= 2 && players.every((p) => p.is_ready);
  const isMyTurn = Boolean(me && game?.current_player_id === me.id);

  async function toggleReady() {
    if (!me) return;
    await supabase.from("americain_players").update({ is_ready: !me.is_ready }).eq("id", me.id);
  }

  async function startGame() {
    if (!gameId) return;
    const { error: e } = await supabase.rpc("start_americain_game", { p_game_id: gameId });
    if (e) setError(errorMessage(e));
  }

  async function playCard(card: Card, chosenColor?: Suit) {
    if (!gameId) return;
    if (rankOf(card) === "8" && !chosenColor) {
      setPendingEight(card);
      return;
    }
    const { error: e } = await supabase.rpc("play_card", {
      p_game_id: gameId,
      p_card: card,
      p_chosen_color: chosenColor ?? null,
    });
    if (e) setError(errorMessage(e));
    setPendingEight(null);
  }

  async function draw() {
    if (!gameId) return;
    const { error: e } = await supabase.rpc("draw_card", { p_game_id: gameId });
    if (e) setError(errorMessage(e));
  }

  if (error && !gameId) {
    return (
      <main className="screen flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
        <p className="text-headline-md">{error}</p>
        <button onClick={() => router.push("/games/8-americain")} className="btn-primary rounded-full">
          Retour
        </button>
      </main>
    );
  }

  if (game?.status === "finished") {
    const winner = [...players].sort((a, b) => a.penalty_score - b.penalty_score)[0];
    return (
      <main className="screen flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
        <p className="text-display-lg">{winner?.nickname} gagne !</p>
        <Scoreboard players={players} threshold={game.penalty_threshold} myUserId={userId} />
        <button onClick={() => router.push("/games/8-americain")} className="btn-primary rounded-full">
          Rejouer
        </button>
      </main>
    );
  }

  return (
    <main className="screen flex min-h-dvh flex-col gap-6 py-6">
      <header className="text-center">
        <p className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          8 Américain
        </p>
        <p className="text-display-lg tracking-widest text-accent">{code}</p>
        <p className="text-body-md text-on-surface-variant">
          {status === "live" ? `${players.length}/${game?.max_players ?? "?"} joueurs` : "Connexion…"}
          {game && game.round > 1 ? ` · Manche ${game.round}` : ""}
        </p>
      </header>

      {game?.status === "playing" && (
        <>
          <Scoreboard players={players} threshold={game.penalty_threshold} myUserId={userId} />

          <OpponentsRow
            players={players}
            currentPlayerId={game.current_player_id}
            onlineUserIds={onlineUserIds}
            myUserId={userId}
          />

          <div className="flex justify-center">
            <DiscardPile topCard={game.top_card} currentColor={game.current_color} />
          </div>

          <Hand
            cards={myHand}
            isMyTurn={isMyTurn}
            currentColor={game.current_color}
            topCard={game.top_card}
            onPlay={(card) => playCard(card)}
          />

          {isMyTurn && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={draw}
                className="rounded-full border-2 border-accent bg-white px-6 py-3 text-label-lg text-accent active:scale-95"
              >
                Piocher
              </button>
            </div>
          )}
        </>
      )}

      {game?.status === "lobby" && (
        <div className="mt-auto flex flex-col gap-3">
          <button
            type="button"
            onClick={toggleReady}
            disabled={!me}
            className="w-full rounded-full border-2 border-accent bg-white py-4 text-label-lg text-accent active:scale-95 disabled:border-tile disabled:text-outline"
          >
            {me?.is_ready ? "Plus prêt" : "Je suis prêt"}
          </button>

          {isHost && (
            <button
              type="button"
              onClick={startGame}
              disabled={!everyoneReady}
              className="btn-primary w-full rounded-full disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
            >
              {everyoneReady
                ? "Lancer la partie"
                : players.length < 2
                  ? "Il faut au moins 2 joueurs"
                  : "Tout le monde doit être prêt"}
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-center text-body-md text-danger">
          {error}
        </p>
      )}

      {pendingEight && (
        <ColorPickerModal
          onPick={(suit) => playCard(pendingEight, suit)}
        />
      )}
    </main>
  );
}
