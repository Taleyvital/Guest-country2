"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AmericainGame, AmericainPlayer } from "./types";

export type AmericainConnectionStatus = "connecting" | "live" | "reconnecting" | "error";

export type AmericainState = {
  game: AmericainGame | null;
  players: AmericainPlayer[];
  /** RLS ne renvoie que MA main. */
  myHand: string[];
  onlineUserIds: string[];
  status: AmericainConnectionStatus;
};

const bySeat = (a: AmericainPlayer, b: AmericainPlayer) => a.seat - b.seat;

export function useAmericainChannel(gameId: string | null, myPlayerId: string | null) {
  const [state, setState] = useState<AmericainState>({
    game: null,
    players: [],
    myHand: [],
    onlineUserIds: [],
    status: "connecting",
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

  const hydrate = useCallback(async (id: string, playerId: string | null) => {
    const supabase = getSupabaseBrowserClient();

    const [game, players, hand] = await Promise.all([
      supabase.from("americain_games").select("*").eq("id", id).single(),
      supabase.from("americain_players").select("*").eq("game_id", id).order("seat"),
      playerId
        ? supabase.from("americain_hands").select("*").eq("player_id", playerId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setState((s) => ({
      ...s,
      game: (game.data as AmericainGame) ?? null,
      players: (players.data as AmericainPlayer[]) ?? [],
      myHand: ((hand.data as { cards: string[] } | null)?.cards) ?? [],
    }));
  }, []);

  useEffect(() => {
    if (!gameId) return;

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    const channel = supabase.channel(`americain:${gameId}`, {
      config: { presence: { key: "" } },
    });
    channelRef.current = channel;

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "americain_games", filter: `id=eq.${gameId}` },
      ({ new: game }) => setState((s) => ({ ...s, game: game as AmericainGame })),
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "americain_players", filter: `game_id=eq.${gameId}` },
      (payload) => {
        setState((s) => {
          if (payload.eventType === "DELETE") {
            const goneId = (payload.old as Partial<AmericainPlayer>).id;
            return { ...s, players: s.players.filter((p) => p.id !== goneId) };
          }
          const player = payload.new as AmericainPlayer;
          const others = s.players.filter((p) => p.id !== player.id);
          return { ...s, players: [...others, player].sort(bySeat) };
        });
      },
    );

    // Filtré par RLS : seule MA ligne de americain_hands peut arriver ici.
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "americain_hands" },
      (payload) => {
        const row = payload.new as { player_id: string; cards: string[] } | undefined;
        if (!row || row.player_id !== myPlayerId) return;
        setState((s) => ({ ...s, myHand: row.cards }));
      },
    );

    channel.on("presence", { event: "sync" }, () => {
      const online = Object.values(channel.presenceState<{ user_id: string }>())
        .flat()
        .map((p) => p.user_id);
      setState((s) => ({ ...s, onlineUserIds: [...new Set(online)] }));
    });

    channel.subscribe(async (status) => {
      if (cancelled) return;

      if (status === "SUBSCRIBED") {
        await hydrate(gameId, myPlayerId);
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
  }, [gameId, myPlayerId, hydrate]);

  return { ...state, refresh: () => (gameId ? hydrate(gameId, myPlayerId) : undefined) };
}
