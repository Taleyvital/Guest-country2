"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useGameChannel } from "@/lib/realtime/useGameChannel";

export default function RoomPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [gameId, setGameId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // L'URL ne porte que le code (lisible, dictable) ; le channel Realtime, lui,
  // s'abonne sur l'id. On résout l'un vers l'autre au montage.
  useEffect(() => {
    (async () => {
      try {
        const session = await ensureAnonymousSession();
        setUserId(session?.user.id ?? null);

        const supabase = getSupabaseBrowserClient();
        const { data, error: e } = await supabase
          .from("games")
          .select("id")
          .eq("code", code)
          .single();

        if (e || !data) throw new Error("Partie introuvable.");
        setGameId(data.id as string);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [code]);

  const { game, players, status, onlineUserIds } = useGameChannel(gameId);

  const me = players.find((p) => p.user_id === userId) ?? null;
  const isHost = Boolean(me?.is_host);
  const everyoneReady = players.length > 1 && players.every((p) => p.is_ready);

  async function toggleReady() {
    if (!me) return;
    const supabase = getSupabaseBrowserClient();
    await supabase.from("players").update({ is_ready: !me.is_ready }).eq("id", me.id);
  }

  async function startGame() {
    if (!game || !isHost) return;
    const supabase = getSupabaseBrowserClient();
    await supabase
      .from("games")
      .update({ status: "playing", started_at: new Date().toISOString() })
      .eq("id", game.id);
  }

  // Tous les téléphones basculent ensemble : c'est le changement de `status` en
  // base qui déclenche la navigation, pas le clic de l'hôte.
  useEffect(() => {
    if (game?.status === "playing") router.push(`/room/${code}/play`);
  }, [game?.status, code, router]);

  if (error) {
    return (
      <main className="screen flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
        <p className="text-headline-md">{error}</p>
        <button onClick={() => router.push("/")} className="btn-primary rounded-full">
          Retour
        </button>
      </main>
    );
  }

  return (
    <main className="screen flex min-h-dvh flex-col gap-6 py-10">
      <header className="text-center">
        <h1 className="text-headline-lg-mobile">En attente des joueurs…</h1>
        <p className="mt-2 text-label-lg uppercase tracking-widest text-on-surface-variant">
          Code de la partie
        </p>
        <p className="text-display-lg tracking-widest text-accent">{code}</p>
        <p className="text-body-md text-on-surface-variant">
          {status === "live" ? `${players.length} joueur(s)` : "Connexion…"}
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
              </span>
              <span
                className={`text-label-lg ${p.is_ready ? "text-success" : "text-on-surface-variant"}`}
              >
                {p.is_ready ? "Prêt" : "En attente…"}
              </span>
            </li>
          );
        })}
      </ul>

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
                : "En attente des joueurs…"}
          </button>
        )}
      </div>
    </main>
  );
}
