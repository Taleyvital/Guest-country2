"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { useAmericainChannel } from "@/games/8-americain/realtime";
import { useAmericainSoundEffects } from "@/games/8-americain/useAmericainSoundEffects";
import { rankOf } from "@/games/8-americain/engine";
import { Hand } from "@/games/8-americain/components/Hand";
import { DiscardPile } from "@/games/8-americain/components/DiscardPile";
import { DrawPile } from "@/games/8-americain/components/DrawPile";
import { ColorPickerModal } from "@/games/8-americain/components/ColorPickerModal";
import { Scoreboard } from "@/games/8-americain/components/Scoreboard";
import { OpponentsRow } from "@/games/8-americain/components/OpponentsRow";
import { RoomHeader } from "@/games/8-americain/components/RoomHeader";
import { TurnBanner } from "@/games/8-americain/components/TurnBanner";
import { RoundEndScreen } from "@/games/8-americain/components/RoundEndScreen";
import type { Card, Suit } from "@/games/8-americain/types";

export default function AmericainRoomPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [gameId, setGameId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingEight, setPendingEight] = useState<Card | null>(null);
  // Dernier événement "manche gagnée" déjà refermé par CE joueur : sans ça,
  // l'écran de recap reviendrait à chaque re-render tant qu'un nouvel event
  // n'est pas arrivé.
  const [dismissedRoundEventId, setDismissedRoundEventId] = useState<string | null>(null);

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

  const { game, players, myHand, lastEvent, onlineUserIds, status, refresh } = useAmericainChannel(
    gameId,
    myPlayerId,
  );

  const me = players.find((p) => p.user_id === userId) ?? null;

  useEffect(() => {
    if (me && me.id !== myPlayerId) setMyPlayerId(me.id);
  }, [me, myPlayerId]);

  useAmericainSoundEffects({ game, players, myHand, myPlayerId });

  const supabase = getSupabaseBrowserClient();
  const isHost = Boolean(me?.is_host);
  const everyoneReady = players.length >= 2 && players.every((p) => p.is_ready);
  const isMyTurn = Boolean(me && game?.current_player_id === me.id);
  const currentPlayer = players.find((p) => p.id === game?.current_player_id) ?? null;

  // "Manche gagnée" en attente d'un recap non encore refermé par ce joueur.
  const roundEndEvent =
    lastEvent && lastEvent.type === "round_won" && lastEvent.id !== dismissedRoundEventId
      ? lastEvent
      : null;

  async function toggleReady() {
    if (!me) return;
    await supabase.from("americain_players").update({ is_ready: !me.is_ready }).eq("id", me.id);
  }

  async function startGame() {
    if (!gameId) return;
    const { error: e } = await supabase.rpc("start_americain_game", { p_game_id: gameId });
    if (e) setError(errorMessage(e));
  }

  // Complète jusqu'à max_players avec des bots déjà prêts.
  async function fillWithBots() {
    if (!gameId) return;
    const { error: e } = await supabase.rpc("fill_americain_lobby_with_bots", {
      p_game_id: gameId,
    });
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
    const ranked = [...players].sort((a, b) => a.penalty_score - b.penalty_score);
    const winner = ranked[0];
    const lastPlace = ranked[ranked.length - 1];

    return (
      <main className="screen flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
        <p className="text-display-lg">{winner?.nickname} gagne !</p>

        {/* Le "prix citron" : distinct du classement, pour que la dernière place
            se voie d'un coup d'oeil, pas juste comme la ligne du bas d'un tableau. */}
        {lastPlace && lastPlace.id !== winner?.id && (
          <p className="inline-flex animate-wobble items-center gap-2 rounded-full bg-danger px-4 py-2 text-label-lg text-white">
            <span className="material-symbols-outlined text-[18px]">military_tech</span>
            {lastPlace.nickname} termine dernier
          </p>
        )}

        <Scoreboard players={players} threshold={game.penalty_threshold} myUserId={userId} />
        <button onClick={() => router.push("/games/8-americain")} className="btn-primary rounded-full">
          Rejouer
        </button>
      </main>
    );
  }

  if (game?.status === "playing") {
    return (
      <main className="screen flex min-h-dvh flex-col gap-8 bg-surface-container-low pb-8">
        <RoomHeader code={code} round={game.round} onRefresh={refresh} />

        <OpponentsRow
          players={players}
          currentPlayerId={game.current_player_id}
          onlineUserIds={onlineUserIds}
          myUserId={userId}
        />

        <div className="flex flex-1 items-center justify-center gap-8">
          <DiscardPile topCard={game.top_card} currentColor={game.current_color} />
          <DrawPile count={game.deck_count} canDraw={isMyTurn} onDraw={draw} />
        </div>

        <TurnBanner isMyTurn={isMyTurn} currentName={currentPlayer?.nickname ?? "…"} />

        <Hand
          cards={myHand}
          isMyTurn={isMyTurn}
          currentColor={game.current_color}
          topCard={game.top_card}
          onPlay={(card) => playCard(card)}
        />

        {error && (
          <p role="alert" className="text-center text-body-md text-danger">
            {error}
          </p>
        )}

        {pendingEight && <ColorPickerModal onPick={(suit) => playCard(pendingEight, suit)} />}

        {roundEndEvent && (
          <RoundEndScreen
            event={roundEndEvent}
            players={players}
            onClose={() => setDismissedRoundEventId(roundEndEvent.id)}
          />
        )}
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
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {players.map((p) => {
          const online = onlineUserIds.includes(p.user_id);
          return (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-white p-4 shadow-card"
            >
              <span className="flex items-center gap-2 text-body-lg">
                <span
                  className={`h-2 w-2 rounded-full ${online ? "bg-success" : "bg-tile"}`}
                  title={online ? "Connecté" : "Déconnecté"}
                />
                {p.nickname}
                {p.is_host && (
                  <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-label-md text-on-primary-fixed">
                    Hôte
                  </span>
                )}
                {p.is_bot && (
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-md text-on-surface-variant">
                    Bot
                  </span>
                )}
              </span>
              <span className={p.is_ready ? "text-label-lg text-success" : "text-label-lg text-on-surface-variant"}>
                {p.is_ready ? "Prêt" : "En attente…"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-3">
        {isHost && players.length < (game?.max_players ?? 6) && (
          <button
            type="button"
            onClick={fillWithBots}
            className="w-full rounded-full border-2 border-dashed border-outline-variant py-3 text-label-lg text-on-surface-variant active:scale-95"
          >
            Compléter avec des bots
          </button>
        )}

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

      {error && (
        <p role="alert" className="text-center text-body-md text-danger">
          {error}
        </p>
      )}
    </main>
  );
}
