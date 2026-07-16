"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useGameChannel } from "@/lib/realtime/useGameChannel";
import { errorMessage } from "@/lib/errors";
import { CountryPicker } from "@/components/game/CountryPicker";
import { LeaveDialog } from "@/components/game/LeaveDialog";
import { PushPermission } from "@/components/PushPermission";
import { DiceRoll } from "@/components/game/DiceRoll";
import type { Country } from "@/lib/game/types";

export default function RoomPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [gameId, setGameId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [myCountry, setMyCountry] = useState<string>("");
  const [picking, setPicking] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  // L'URL ne porte que le code (dictable) ; le channel Realtime s'abonne sur l'id.
  useEffect(() => {
    (async () => {
      try {
        const session = await ensureAnonymousSession();
        setUserId(session?.user.id ?? null);

        const supabase = getSupabaseBrowserClient();
        const [game, pool] = await Promise.all([
          supabase.from("games").select("id").eq("code", code).single(),
          supabase.from("countries").select("name, region").order("name"),
        ]);

        if (game.error || !game.data) throw new Error("Partie introuvable.");
        const id = game.data.id as string;
        setGameId(id);

        // Relire SON pays après une reconnexion. Scopé à la partie : sans ça, un
        // joueur présent dans plusieurs parties récupérait le pays d'une autre.
        const mine = await supabase.rpc("my_country", { p_game_id: id });

        // Une erreur ici (table absente, RLS) laissait le picker vide sans un mot :
        // on croyait la recherche cassée alors que le pool n'était jamais arrivé.
        if (pool.error) throw new Error(`Pool de pays indisponible : ${pool.error.message}`);
        setCountries((pool.data as Country[]) ?? []);
        if (mine.data) {
          setMyCountry(mine.data as string);
          setPicking(mine.data as string);
        }
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [code]);

  const { game, players, status, onlineUserIds } = useGameChannel(gameId);

  const me = players.find((p) => p.user_id === userId) ?? null;
  const isHost = Boolean(me?.is_host);

  // Le dé n'apparaît qu'une fois tout le monde prêt : ça matérialise l'ordre des
  // étapes (pays -> prêt -> dé -> lancement) sans surcharger le salon dès l'arrivée.
  const everyoneReady =
    players.length > 1 && players.every((p) => p.is_ready && p.has_picked);
  const canStart = everyoneReady && players.every((p) => p.dice_roll !== null);

  const supabase = getSupabaseBrowserClient();

  async function pickCountry(name: string) {
    if (!gameId) return;
    const { error: e } = await supabase.rpc("pick_country", {
      p_game_id: gameId,
      p_country: name,
    });
    if (e) return setError(errorMessage(e));
    setMyCountry(name);
    setError(null);
  }

  async function toggleReady() {
    if (!me) return;
    // Se déclarer prêt sans pays choisi n'a pas de sens : il n'y aurait rien à deviner.
    if (!me.has_picked) return setError("Choisis ton pays d’abord.");
    await supabase.from("players").update({ is_ready: !me.is_ready }).eq("id", me.id);
  }

  async function rollDice() {
    const { error: e } = await supabase.rpc("roll_dice", { p_game_id: gameId });
    if (e) setError(errorMessage(e));
  }

  async function leaveGame() {
    if (!gameId) return;
    const { error: e } = await supabase.rpc("leave_game", { p_game_id: gameId });
    if (e) return setError(errorMessage(e));
    router.push("/");
  }

  async function startGame() {
    if (!game) return;
    const { error: e } = await supabase.rpc("start_game", { p_game_id: game.id });
    if (e) setError(errorMessage(e));
  }

  // Remplit les places manquantes avec des bots déjà prêts à jouer (pays
  // choisi, dé lancé) : pas besoin d'attendre qu'ils cliquent quoi que ce soit.
  async function fillWithBots() {
    if (!gameId) return;
    const target = Math.max(players.length + 1, 4);
    const { error: e } = await supabase.rpc("fill_lobby_with_bots", {
      p_game_id: gameId,
      p_target_players: target,
    });
    if (e) setError(errorMessage(e));
  }

  // Tous les téléphones basculent ensemble : c'est le `status` en base qui déclenche
  // la navigation, pas le clic de l'hôte. L'intermission (entre deux manches) se vit
  // aussi sur l'écran de jeu, pas ici.
  useEffect(() => {
    if (game?.status === "playing" || game?.intermission) {
      router.push(`/room/${code}/play`);
    }
  }, [game?.status, game?.intermission, code, router]);

  if (error && !gameId) {
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
    <main className="screen flex min-h-dvh flex-col gap-6 py-6">
      {/* Quitter un salon libère sa place (et transfère l'hôte si c'est lui qui part) :
          ce n'est pas un simple retour arrière, on demande donc confirmation. */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setLeaveOpen(true)}
          aria-label="Quitter le salon"
          className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
      </div>

      <header className="text-center">
        <p className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          Code de la partie
        </p>
        <p className="text-display-lg tracking-widest text-accent">{code}</p>
        <p className="text-body-md text-on-surface-variant">
          {status === "live" ? `${players.length} joueur(s)` : "Connexion…"}
          {game && game.round > 1 ? ` · Manche ${game.round}/${game.total_rounds}` : ""}
        </p>
      </header>

      {/* Choix du pays : c'est LUI que les autres devront deviner. */}
      <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card">
        <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          Ton pays
        </h2>
        <p className="text-body-md text-on-surface-variant">
          Choisis le pays que les autres devront deviner.
        </p>

        <CountryPicker countries={countries} value={picking} onChange={setPicking} />

        <button
          type="button"
          disabled={!picking || picking === myCountry}
          onClick={() => pickCountry(picking)}
          className="rounded-full bg-accent px-6 py-3 text-label-lg text-white shadow-btn-3d disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
        >
          {picking && picking === myCountry
            ? "Pays validé"
            : myCountry
              ? `Changer pour ${picking || "…"}`
              : `Valider ${picking || ""}`}
        </button>

        {myCountry && (
          <p className="text-body-md text-success">
            Ton pays : <span className="font-bold">{myCountry}</span> — les autres n’en
            voient que la longueur et la région.
          </p>
        )}
      </section>

      {/* Permission notifications proposée ICI : on vient de rejoindre, être prévenu
          de son tour prend tout son sens. Se masque seule si refusée/non supportée. */}
      <PushPermission />

      {/* Le dé n'apparaît qu'une fois tout le monde prêt : c'est la dernière étape
          avant le lancement. */}
      {everyoneReady && (
        <DiceRoll players={players} myUserId={userId} onRoll={rollDice} />
      )}

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
              <span className="flex items-center gap-2 text-label-lg">
                {/* Le pays des autres n'est jamais affiché — seulement le fait qu'ils
                    en aient choisi un. */}
                <span className={p.has_picked ? "text-success" : "text-on-surface-variant"}>
                  {p.has_picked ? "Pays ✓" : "Sans pays"}
                </span>
                <span className={p.is_ready ? "text-success" : "text-on-surface-variant"}>
                  {p.is_ready ? "Prêt" : "En attente…"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="text-center text-body-md text-danger">
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <button
          type="button"
          onClick={toggleReady}
          disabled={!me}
          className="w-full rounded-full border-2 border-accent bg-white py-4 text-label-lg text-accent active:scale-95 disabled:border-tile disabled:text-outline"
        >
          {me?.is_ready ? "Plus prêt" : "Je suis prêt"}
        </button>

        {isHost && players.length < 8 && (
          <button
            type="button"
            onClick={fillWithBots}
            className="w-full rounded-full border-2 border-dashed border-outline-variant py-3 text-label-lg text-on-surface-variant active:scale-95"
          >
            Compléter avec des bots
          </button>
        )}

        {isHost && (
          <button
            type="button"
            onClick={startGame}
            disabled={!canStart}
            className="btn-primary w-full rounded-full disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
          >
            {canStart
              ? "Lancer la partie"
              : players.length < 2
                ? "Il faut au moins 2 joueurs"
                : !everyoneReady
                  ? "Tout le monde doit choisir un pays et être prêt"
                  : "Tout le monde doit lancer le dé"}
          </button>
        )}
      </div>

      <LeaveDialog
        open={leaveOpen}
        isPlaying={false}
        onClose={() => setLeaveOpen(false)}
        // Garder sa place : on quitte l'écran, pas le salon. L'accueil proposera
        // de reprendre.
        onKeepSeat={() => router.push("/")}
        onLeave={leaveGame}
      />
    </main>
  );
}
