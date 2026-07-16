// Edge Function : joue le coup d'un bot, pour Country Guess ET 8 Américain.
//
// Déclenchée par un trigger DB (voir 0021_bots_country_guess.sql /
// 0022_bots_americain.sql) dès que `current_player_id` change ET que ce joueur
// est un bot. Poste { game_type, game_id }.
//
// PRINCIPE CENTRAL : ce fichier ne fait JAMAIS bouger l'état du jeu lui-même —
// il choisit un coup PARMI CEUX QU'UN CLIENT HUMAIN POURRAIT TENTER, puis
// appelle exactement la même RPC (ask_letter / play_card / draw_card), avec
// la clé de service. C'est effective_uid() côté DB qui accepte alors
// `p_actor_user_id` à la place de auth.uid() — jamais une logique de jeu
// dupliquée ici.
//
// Déploiement :
//   supabase functions deploy resolve-bot-turn --no-verify-jwt
//   alter database postgres set app.bot_url = 'https://<ref>.supabase.co/functions/v1/resolve-bot-turn';
//   alter database postgres set app.bot_key = '<SERVICE_ROLE_KEY>';
//
// (--no-verify-jwt : c'est le trigger DB, avec la clé de service, qui appelle.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Délai volontaire : minime, juste assez pour qu'un coup ne soit pas instantané.
// La lenteur observée en prod (jusqu'à ~12s sur certains appels) ne vient PAS
// de ce délai (300-900ms max) mais de l'exécution elle-même — voir REQUEST_TIMEOUT_MS
// ci-dessous, qui borne chaque aller-retour réseau pour empêcher un appel lent de
// faire traîner tout le tour.
const MIN_DELAY_MS = 200;
const MAX_DELAY_MS = 500;
const MAX_ATTEMPTS = 3;
// Aucun appel réseau individuel (une requête PostgREST/RPC) ne doit dépasser ça :
// mieux vaut un coup raté proprement qu'un tour qui traîne en longueur.
const REQUEST_TIMEOUT_MS = 2500;

function randomDelay(): number {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Borne un appel Supabase à REQUEST_TIMEOUT_MS : un aller-retour anormalement
 *  lent (connexion froide, souci réseau ponctuel) ne doit jamais faire traîner
 *  tout le tour du bot. */
function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout: ${label}`)),
      REQUEST_TIMEOUT_MS,
    );
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SUITS = ["S", "H", "D", "C"];

Deno.serve(async (req) => {
  try {
    const { game_type, game_id } = (await req.json()) as {
      game_type?: "country_guess" | "americain";
      game_id?: string;
    };

    if (!game_type || !game_id) {
      return new Response("missing game_type/game_id", { status: 200 });
    }

    // Le délai n'est pas qu'un effet de style : sans lui, un coup instantané
    // trahirait immédiatement le bot, et masquerait la latence normale d'un
    // vrai joueur qui réfléchit.
    await sleep(randomDelay());

    if (game_type === "country_guess") {
      await resolveCountryGuessTurn(game_id);
    } else {
      await resolveAmericainTurn(game_id);
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    // Un bot qui rate son tour ne doit jamais faire "réessayer" pg_net en boucle :
    // on journalise et on répond 200 dans tous les cas.
    console.error("resolve-bot-turn:", e);
    return new Response("error", { status: 200 });
  }
});

// ---------------------------------------------------------------------------
// Country Guess : demande une lettre à un adversaire vivant au hasard.
//
// Volontairement PAS de filtre sur les lettres déjà posées (voir la consigne :
// un bot "basique" peut reposer une lettre déjà testée, comme un joueur
// distrait). En contrepartie, ask_letter peut échouer sur ce cas précis — on
// retente alors avec un autre tirage plutôt que de laisser la partie bloquée
// sur un tour qui ne peut plus avancer.
// ---------------------------------------------------------------------------
async function resolveCountryGuessTurn(gameId: string) {
  const { data: game } = await withTimeout(
    supabase.from("games").select("id, current_player_id, status").eq("id", gameId).single(),
    "fetch game",
  );

  if (!game || game.status !== "playing" || !game.current_player_id) return;

  const { data: bot } = await withTimeout(
    supabase.from("players").select("id, user_id, is_bot").eq("id", game.current_player_id).single(),
    "fetch bot",
  );

  // Re-vérifié APRÈS le délai : le tour a pu changer entre-temps (un autre
  // joueur a quitté, une manche s'est terminée...).
  if (!bot || !bot.is_bot) return;

  const { data: candidates } = await withTimeout(
    supabase.from("players").select("id").eq("game_id", gameId).eq("is_cracked", false).neq("id", bot.id),
    "fetch candidates",
  );

  if (!candidates || candidates.length === 0) return;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const target = pickRandom(candidates);
    const letter = pickRandom(ALPHABET);
    if (!target || !letter) return;

    const { error } = await withTimeout(
      supabase.rpc("ask_letter", {
        p_target_player_id: target.id,
        p_letter: letter,
        p_actor_user_id: bot.user_id,
      }),
      "ask_letter",
    ).catch((e) => ({ error: e as Error }));

    if (!error) return;

    // Un timeout réseau ponctuel ne doit pas non plus faire insister : on
    // s'arrête, le prochain changement de tour redéclenchera le trigger.
    if (error.message.startsWith("timeout:")) return;

    // "Ce n'est plus mon tour" (ou la partie a changé de statut entre-temps) :
    // inutile d'insister, un autre événement a déjà tranché.
    if (error.message.includes("not your turn") || error.message.includes("game is not running")) {
      return;
    }
    // Sinon (lettre déjà posée, pays déjà trouvé...) : on retente un autre tirage.
  }
}

// ---------------------------------------------------------------------------
// 8 Américain : joue une carte jouable au hasard, ou pioche s'il n'en a aucune.
// ---------------------------------------------------------------------------
function isPlayable(card: string, currentColor: string | null, topCard: string | null): boolean {
  const [suit, rank] = card.split(":");
  if (rank === "8") return true;
  if (suit === currentColor) return true;
  if (topCard && rank === topCard.split(":")[1]) return true;
  return false;
}

async function resolveAmericainTurn(gameId: string) {
  const { data: game } = await withTimeout(
    supabase
      .from("americain_games")
      .select("id, current_player_id, status, current_color, top_card")
      .eq("id", gameId)
      .single(),
    "fetch game",
  );

  if (!game || game.status !== "playing" || !game.current_player_id) return;

  const { data: bot } = await withTimeout(
    supabase
      .from("americain_players")
      .select("id, user_id, is_bot")
      .eq("id", game.current_player_id)
      .single(),
    "fetch bot",
  );

  if (!bot || !bot.is_bot) return;

  const { data: hand } = await withTimeout(
    supabase.from("americain_hands").select("cards").eq("player_id", bot.id).single(),
    "fetch hand",
  );

  const cards = (hand?.cards as string[] | undefined) ?? [];
  const playable = cards.filter((c) => isPlayable(c, game.current_color, game.top_card));

  const rpc = (name: string, params: Record<string, unknown>) =>
    withTimeout(supabase.rpc(name, { ...params, p_actor_user_id: bot.user_id }), name);

  const chosen = pickRandom(playable);
  if (chosen) {
    const rank = chosen.split(":")[1];
    const chosenColor = rank === "8" ? pickRandom(SUITS) : null;
    await rpc("play_card", { p_game_id: gameId, p_card: chosen, p_chosen_color: chosenColor });
  } else {
    await rpc("draw_card", { p_game_id: gameId });
  }
}
