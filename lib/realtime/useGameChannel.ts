"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Game, GameEvent, Player } from "@/lib/supabase/types";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "error";

export type GameState = {
  game: Game | null;
  players: Player[];
  /** Dernière action affichée dans le bandeau. Éphémère : purgée côté DB. */
  lastAction: GameEvent | null;
  /** user_id des joueurs actuellement connectés (presence) — pour griser les déconnectés. */
  onlineUserIds: string[];
  status: ConnectionStatus;
};

const bySeat = (a: Player, b: Player) => a.seat - b.seat;

/**
 * Un channel Realtime par partie : `game:<game_id>`.
 *
 * Il n'y a pas d'écran commun — chaque téléphone est un client autonome qui doit
 * voir la même vérité au même moment. On s'abonne donc aux changements Postgres
 * plutôt que de diffuser des messages entre clients : la DB reste l'unique source
 * de vérité, et un téléphone qui se reconnecte retrouve l'état exact sans rejouer
 * l'historique.
 */
export function useGameChannel(gameId: string | null) {
  const [state, setState] = useState<GameState>({
    game: null,
    players: [],
    lastAction: null,
    onlineUserIds: [],
    status: "connecting",
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

  /** Snapshot initial : Realtime ne livre que les deltas, il faut l'état de départ. */
  const hydrate = useCallback(async (id: string) => {
    const supabase = getSupabaseBrowserClient();

    const [game, players, events] = await Promise.all([
      supabase.from("games").select("*").eq("id", id).single(),
      supabase.from("players").select("*").eq("game_id", id).order("seat"),
      supabase
        .from("game_events")
        .select("*")
        .eq("game_id", id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    setState((s) => ({
      ...s,
      game: (game.data as Game) ?? null,
      players: (players.data as Player[]) ?? [],
      lastAction: ((events.data as GameEvent[]) ?? [])[0] ?? null,
    }));
  }, []);

  useEffect(() => {
    if (!gameId) return;

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    const channel = supabase.channel(`game:${gameId}`, {
      config: { presence: { key: "" } }, // rempli avec l'user_id au subscribe
    });
    channelRef.current = channel;

    // --- Tour, round, status : le champ que tous les téléphones surveillent.
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
      ({ new: game }) => setState((s) => ({ ...s, game: game as Game })),
    );

    // --- Joueurs : arrivées au lobby, ready, score, élimination.
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` },
      (payload) => {
        setState((s) => {
          if (payload.eventType === "DELETE") {
            const goneId = (payload.old as Partial<Player>).id;
            return { ...s, players: s.players.filter((p) => p.id !== goneId) };
          }
          const player = payload.new as Player;
          const others = s.players.filter((p) => p.id !== player.id);
          return { ...s, players: [...others, player].sort(bySeat) };
        });
      },
    );

    // --- Last action. On n'écoute que les INSERT : les DELETE viennent du trigger
    // de purge et ne doivent pas effacer le bandeau à l'écran.
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
      ({ new: event }) => setState((s) => ({ ...s, lastAction: event as GameEvent })),
    );

    // --- Presence : qui a encore l'app ouverte (téléphone verrouillé, tunnel, batterie).
    channel.on("presence", { event: "sync" }, () => {
      const online = Object.values(channel.presenceState<{ user_id: string }>())
        .flat()
        .map((p) => p.user_id);
      setState((s) => ({ ...s, onlineUserIds: [...new Set(online)] }));
    });

    channel.subscribe(async (status) => {
      if (cancelled) return;

      if (status === "SUBSCRIBED") {
        // Hydrater APRÈS l'abonnement : dans l'autre sens, une action survenue entre
        // le fetch et le subscribe serait perdue par tous les téléphones.
        await hydrate(gameId);

        const { data } = await supabase.auth.getUser();
        if (data.user) await channel.track({ user_id: data.user.id });

        setState((s) => ({ ...s, status: "live" }));
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setState((s) => ({ ...s, status: "reconnecting" }));
      } else if (status === "CLOSED") {
        setState((s) => ({ ...s, status: "error" }));
      }
    });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [gameId, hydrate]);

  /** Pratique pour l'UI : est-ce mon tour ? */
  const isMyTurn = useCallback(
    (myPlayerId: string | null) =>
      Boolean(myPlayerId && state.game?.current_player_id === myPlayerId),
    [state.game?.current_player_id],
  );

  return { ...state, isMyTurn, refresh: () => (gameId ? hydrate(gameId) : undefined) };
}
