"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { useJamesChannel } from "@/games/james/realtime";
import { hasFourOfAKind } from "@/games/james/engine";
import { HandView } from "@/games/james/components/HandView";
import { JamesButton } from "@/games/james/components/JamesButton";
import { ConfirmCallModal } from "@/games/james/components/ConfirmCallModal";
import { ScoreBoard } from "@/games/james/components/ScoreBoard";
import { PlayerCircle } from "@/games/james/components/PlayerCircle";

export default function JamesRoomPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [gameId, setGameId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const session = await ensureAnonymousSession();
        setUserId(session?.user.id ?? null);

        const supabase = getSupabaseBrowserClient();
        const game = await supabase.from("james_games").select("id").eq("code", code).single();
        if (game.error || !game.data) throw new Error("Table introuvable.");
        setGameId(game.data.id as string);
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [code]);

  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  const { game, players, myHand, pendingCall, onlineUserIds, status } = useJamesChannel(
    gameId,
    myPlayerId,
  );

  const me = players.find((p) => p.user_id === userId) ?? null;

  useEffect(() => {
    if (me && me.id !== myPlayerId) setMyPlayerId(me.id);
  }, [me, myPlayerId]);

  const supabase = getSupabaseBrowserClient();
  const isHost = Boolean(me?.is_host);
  const everyoneReady = players.length === 4 && players.every((p) => p.is_ready);
  const canPass = Boolean(me && game?.current_holder_id === me.id);
  const fourSuit = hasFourOfAKind(myHand);

  // Un appel me visant, lancé par quelqu'un d'autre que moi : c'est MA confirmation
  // qui est attendue. Un appel que j'ai lancé moi-même ne m'affiche rien de plus
  // qu'une attente — pas de modale, je sais déjà que je viens d'appuyer.
  const incomingCall =
    pendingCall && pendingCall.target_partner_id === me?.id && pendingCall.caller_id !== me?.id
      ? pendingCall
      : null;

  async function toggleReady() {
    if (!me) return;
    await supabase.from("james_players").update({ is_ready: !me.is_ready }).eq("id", me.id);
  }

  async function startGame() {
    if (!gameId) return;
    const { error: e } = await supabase.rpc("start_james_game", { p_game_id: gameId });
    if (e) setError(errorMessage(e));
  }

  async function passCard(card: string) {
    if (!gameId) return;
    const { error: e } = await supabase.rpc("pass_card", { p_game_id: gameId, p_card: card });
    if (e) setError(errorMessage(e));
  }

  async function callJames() {
    if (!gameId) return;
    const { error: e } = await supabase.rpc("call_james", { p_game_id: gameId });
    if (e) setError(errorMessage(e));
  }

  async function confirmCall() {
    if (!incomingCall) return;
    const { error: e } = await supabase.rpc("confirm_james", { p_call_id: incomingCall.id });
    if (e) setError(errorMessage(e));
  }

  if (error && !gameId) {
    return (
      <main className="screen flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
        <p className="text-headline-md">{error}</p>
        <button onClick={() => router.push("/games/james")} className="btn-primary rounded-full">
          Retour
        </button>
      </main>
    );
  }

  if (game?.status === "finished") {
    return (
      <main className="screen flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
        <p className="text-display-lg">
          Équipe {game.team_a_score >= 10 ? "A" : "B"} gagne !
        </p>
        <ScoreBoard teamA={game.team_a_score} teamB={game.team_b_score} />
        <button onClick={() => router.push("/games/james")} className="btn-primary rounded-full">
          Rejouer
        </button>
      </main>
    );
  }

  return (
    <main className="screen flex min-h-dvh flex-col gap-6 py-6">
      <header className="text-center">
        <p className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          Table James
        </p>
        <p className="text-display-lg tracking-widest text-accent">{code}</p>
        <p className="text-body-md text-on-surface-variant">
          {status === "live" ? `${players.length}/4 joueurs` : "Connexion…"}
        </p>
      </header>

      {game?.status === "playing" && (
        <ScoreBoard teamA={game.team_a_score} teamB={game.team_b_score} />
      )}

      <PlayerCircle
        players={players}
        holderId={game?.current_holder_id ?? null}
        onlineUserIds={onlineUserIds}
        myUserId={userId}
      />

      {game?.status === "playing" && (
        <>
          <HandView cards={myHand} canPass={canPass} onPass={passCard} />

          {fourSuit && (
            <div className="flex justify-center">
              <JamesButton onCall={callJames} />
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
                : players.length < 4
                  ? `Il faut 4 joueurs (${players.length}/4)`
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

      {incomingCall && <ConfirmCallModal call={incomingCall} onConfirm={confirmCall} />}
    </main>
  );
}
