"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { JamesCall, JamesEvent, JamesGame, JamesPlayer } from "./types";

export type JamesConnectionStatus = "connecting" | "live" | "reconnecting" | "error";

export type JamesState = {
  game: JamesGame | null;
  players: JamesPlayer[];
  /** RLS ne renvoie que MA main : jamais celle d'un coéquipier ou d'un adversaire. */
  myHand: string[];
  lastEvent: JamesEvent | null;
  /** Un appel "James" me visant (comme cible) ou que j'ai lancé — jamais celui
   *  d'un adversaire, la policy RLS l'exclut du payload Realtime. */
  pendingCall: JamesCall | null;
  onlineUserIds: string[];
  status: JamesConnectionStatus;
};

const byPosition = (a: JamesPlayer, b: JamesPlayer) => a.position - b.position;

/** Un channel Realtime par partie : `james:<game_id>`, même logique que le jeu
 *  principal — la DB reste l'unique source de vérité, le client ne fait que
 *  la refléter. */
export function useJamesChannel(gameId: string | null, myPlayerId: string | null) {
  const [state, setState] = useState<JamesState>({
    game: null,
    players: [],
    myHand: [],
    lastEvent: null,
    pendingCall: null,
    onlineUserIds: [],
    status: "connecting",
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

  const hydrate = useCallback(async (id: string, playerId: string | null) => {
    const supabase = getSupabaseBrowserClient();

    const [game, players, hand, events, calls] = await Promise.all([
      supabase.from("james_games").select("*").eq("id", id).single(),
      supabase.from("james_players").select("*").eq("game_id", id).order("position"),
      playerId
        ? supabase.from("james_hands").select("*").eq("player_id", playerId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("james_events")
        .select("*")
        .eq("game_id", id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("james_calls")
        .select("*")
        .eq("game_id", id)
        .eq("status", "pending")
        .order("called_at", { ascending: false })
        .limit(1),
    ]);

    setState((s) => ({
      ...s,
      game: (game.data as JamesGame) ?? null,
      players: (players.data as JamesPlayer[]) ?? [],
      myHand: ((hand.data as { cards: string[] } | null)?.cards) ?? [],
      lastEvent: ((events.data as JamesEvent[]) ?? [])[0] ?? null,
      pendingCall: ((calls.data as JamesCall[]) ?? [])[0] ?? null,
    }));
  }, []);

  useEffect(() => {
    if (!gameId) return;

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    const channel = supabase.channel(`james:${gameId}`, {
      config: { presence: { key: "" } },
    });
    channelRef.current = channel;

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "james_games", filter: `id=eq.${gameId}` },
      ({ new: game }) => setState((s) => ({ ...s, game: game as JamesGame })),
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "james_players", filter: `game_id=eq.${gameId}` },
      (payload) => {
        setState((s) => {
          if (payload.eventType === "DELETE") {
            const goneId = (payload.old as Partial<JamesPlayer>).id;
            return { ...s, players: s.players.filter((p) => p.id !== goneId) };
          }
          const player = payload.new as JamesPlayer;
          const others = s.players.filter((p) => p.id !== player.id);
          return { ...s, players: [...others, player].sort(byPosition) };
        });
      },
    );

    // Filtré par RLS : seule MA ligne de james_hands peut arriver ici.
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "james_hands" },
      (payload) => {
        const row = payload.new as { player_id: string; cards: string[] } | undefined;
        if (!row || row.player_id !== myPlayerId) return;
        setState((s) => ({ ...s, myHand: row.cards }));
      },
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "james_events", filter: `game_id=eq.${gameId}` },
      ({ new: event }) => setState((s) => ({ ...s, lastEvent: event as JamesEvent }))
    );

    // Filtré par RLS : je ne reçois que les appels où je suis auteur ou cible.
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "james_calls", filter: `game_id=eq.${gameId}` },
      (payload) => {
        const call = payload.new as JamesCall | undefined;
        if (!call) return;
        setState((s) => ({
          ...s,
          pendingCall: call.status === "pending" ? call : (s.pendingCall?.id === call.id ? null : s.pendingCall),
        }));
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
