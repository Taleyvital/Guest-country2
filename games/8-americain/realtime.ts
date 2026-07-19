"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AmericainEvent, AmericainGame, AmericainPlayer } from "./types";

export type AmericainConnectionStatus = "connecting" | "live" | "reconnecting" | "error";

export type AmericainState = {
  game: AmericainGame | null;
  players: AmericainPlayer[];
  /** RLS ne renvoie que MA main. */
  myHand: string[];
  /** Fin de manche / de partie — éphémère, purgée côté DB (voir americain_events). */
  lastEvent: AmericainEvent | null;
  onlineUserIds: string[];
  status: AmericainConnectionStatus;
};

const bySeat = (a: AmericainPlayer, b: AmericainPlayer) => a.seat - b.seat;

export function useAmericainChannel(gameId: string | null, myPlayerId: string | null) {
  const [state, setState] = useState<AmericainState>({
    game: null,
    players: [],
    myHand: [],
    lastEvent: null,
    onlineUserIds: [],
    status: "connecting",
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

  const hydrate = useCallback(async (id: string, playerId: string | null) => {
    const supabase = getSupabaseBrowserClient();

    const [game, players, hand, events] = await Promise.all([
      supabase.from("americain_games").select("*").eq("id", id).single(),
      supabase.from("americain_players").select("*").eq("game_id", id).order("seat"),
      playerId
        ? supabase.from("americain_hands").select("*").eq("player_id", playerId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("americain_events")
        .select("*")
        .eq("game_id", id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    setState((s) => ({
      ...s,
      game: (game.data as AmericainGame) ?? null,
      players: (players.data as AmericainPlayer[]) ?? [],
      myHand: ((hand.data as { cards: string[] } | null)?.cards) ?? [],
      lastEvent: ((events.data as AmericainEvent[]) ?? [])[0] ?? null,
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

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "americain_events", filter: `game_id=eq.${gameId}` },
      ({ new: event }) => setState((s) => ({ ...s, lastEvent: event as AmericainEvent })),
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

    // Filet de sécurité : le websocket peut décrocher silencieusement (verrouillage
    // écran, tunnel réseau) sans que le statut du channel ne le signale. On re-hydrate
    // depuis la DB au retour au premier plan, et périodiquement en tâche de fond, pour
    // ne jamais rester bloqué sur un tour périmé.
    const onVisible = () => {
      if (document.visibilityState === "visible") hydrate(gameId, myPlayerId);
    };
    document.addEventListener("visibilitychange", onVisible);
    const pollId = window.setInterval(() => hydrate(gameId, myPlayerId), 8000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(pollId);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [gameId, myPlayerId, hydrate]);

  // Filet anti-bot-figé : le déclenchement serveur (trigger → pg_net → edge
  // function) perd parfois un coup — pg_net abandonne l'appel à 12s, constaté
  // en prod — et rien côté serveur ne re-déclenche un bot dont le tour n'a pas
  // avancé. La fonction edge revalidant elle-même que c'est le tour d'un bot
  // (et les RPC tranchant en dernier ressort), la re-poster est sans risque :
  // au pire un no-op, même si plusieurs joueurs la re-postent en même temps.
  const kickGameId = state.game?.status === "playing" ? state.game.id : null;
  const currentPlayerId = state.game?.current_player_id ?? null;
  const isBotTurn =
    kickGameId !== null &&
    state.players.some((p) => p.id === currentPlayerId && p.is_bot);

  useEffect(() => {
    if (!isBotTurn || !kickGameId) return;

    const kick = () => {
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resolve-bot-turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_type: "americain", game_id: kickGameId }),
      }).catch(() => {
        // Réseau client indisponible : le poll de re-hydratation couvre déjà ça.
      });
    };

    // Un bot joue normalement en ~1-2s : à 6s sans changement de tour, le
    // déclenchement est considéré perdu. Puis on insiste toutes les 8s — ça
    // couvre aussi le cas du tour qui REVIENT au même bot (Valet à 2 joueurs :
    // current_player_id inchangé, donc trigger serveur jamais re-déclenché).
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      kick();
      intervalId = window.setInterval(kick, 8000);
    }, 6000);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [isBotTurn, kickGameId, currentPlayerId]);

  return { ...state, refresh: () => (gameId ? hydrate(gameId, myPlayerId) : undefined) };
}
