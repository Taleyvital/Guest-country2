"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadProfile, type Profile } from "@/lib/game/profile";
import { isPhoto } from "@/lib/game/avatar";
import { AppTitle } from "@/components/AppTitle";
import { errorMessage } from "@/lib/errors";
import type { Game } from "@/lib/supabase/types";

/** Une partie où ce téléphone a déjà une place. */
type ActiveGame = { code: string; status: string; round: number };

export default function Home() {
  const router = useRouter();
  const configured = isSupabaseConfigured();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveGame | null>(null);
  // Le champ code ne s'affiche qu'une fois "Rejoindre" choisi : l'accueil reste
  // lisible pour le cas le plus fréquent (créer), et ne demande pas un code qu'on
  // n'a pas encore reçu.
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    // Pas de profil = premier lancement : on le crée avant toute chose. Le pseudo
    // ne sera plus jamais redemandé ensuite.
    const p = loadProfile();
    if (!p) {
      router.replace("/onboarding");
      return;
    }
    setProfile(p);

    if (!configured) return;

    (async () => {
      try {
        const session = await ensureAnonymousSession();
        if (!session) return;
        const supabase = getSupabaseBrowserClient();

        // La session anonyme est stable : après un "retour", la place en partie
        // existe toujours. Sans ce rappel, il faudrait retaper un code de room
        // qu'on n'a peut-être plus sous les yeux.
        //
        // Le filtre user_id est indispensable : la RLS m'autorise à lire TOUS les
        // joueurs des parties où je suis (il faut bien voir ses adversaires), donc
        // sans lui je récupérerais la ligne d'un autre.
        const { data } = await supabase
          .from("players")
          .select("games(code, status, round)")
          .eq("user_id", session.user.id)
          .order("joined_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const game = (data as { games?: ActiveGame } | null)?.games;
        if (game && game.status !== "finished") setActive(game);
      } catch {
        // Pas de session, pas de partie en cours : l'accueil normal suffit.
      }
    })();
  }, [configured, router]);

  async function run(action: "create" | "join") {
    if (!profile) return;
    if (action === "join" && !code.trim()) return setError("Entre le code de la partie.");

    setBusy(action);
    setError(null);

    try {
      await ensureAnonymousSession();
      const supabase = getSupabaseBrowserClient();

      const { data, error: rpcError } =
        action === "create"
          ? await supabase.rpc("create_game", { p_nickname: profile.nickname })
          : await supabase.rpc("join_game", {
              p_code: code.trim().toUpperCase(),
              p_nickname: profile.nickname,
            });

      if (rpcError) throw rpcError;

      const game = data as unknown as Game;

      // L'avatar est une colonne que le joueur a le droit d'écrire (grant update),
      // contrairement au score ou à l'élimination.
      await supabase
        .from("players")
        .update({ avatar: profile.avatar })
        .eq("game_id", game.id);

      router.push(`/room/${game.code}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  // Le profil vit dans localStorage : il n'est lisible qu'après montage. Plutôt que
  // de renvoyer null (écran blanc, puis apparition brutale), on affiche déjà le titre —
  // c'est le même à l'arrivée, donc rien ne saute.
  if (!profile) {
    return (
      <main className="screen flex min-h-dvh flex-col items-center justify-center gap-8 pb-28">
        <AppTitle />
      </main>
    );
  }

  return (
    <main className="screen flex min-h-dvh flex-col items-center justify-center gap-8 py-10 pb-28 text-center">
      <AppTitle />
      <p className="-mt-4 text-body-md text-on-surface-variant">
        Un téléphone par joueur. Pas d&apos;écran commun.
      </p>

      {!configured && (
        <div className="w-full rounded-lg bg-error-container p-4 text-left text-body-md text-on-error-container">
          <span className="font-bold">Supabase n&apos;est pas configuré.</span> Renseigne{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> dans <code>.env.local</code>, applique
          les migrations, puis relance <code>npm run dev</code>.
        </div>
      )}

      {/* Une place reste ouverte : on y ramène en un geste, avant même de proposer
          d'en créer une nouvelle. */}
      {active && (
        <button
          type="button"
          onClick={() =>
            router.push(
              active.status === "playing"
                ? `/room/${active.code}/play`
                : `/room/${active.code}`,
            )
          }
          className="w-full animate-slide-up rounded-lg bg-secondary-container p-4 text-left text-on-secondary-container active:scale-[0.99]"
        >
          <span className="text-label-md uppercase tracking-widest">Partie en cours</span>
          <p className="text-body-lg">
            Reprendre <span className="font-bold">#{active.code}</span>
            {active.status === "playing" ? ` · manche ${active.round}` : " · en attente"}
          </p>
        </button>
      )}

      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          disabled={!configured || busy !== null}
          onClick={() => run("create")}
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-full disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
        >
          <span className="material-symbols-outlined">add_circle</span>
          {busy === "create" ? "Création…" : "Créer une partie"}
        </button>

        {!joining ? (
          <button
            type="button"
            disabled={!configured}
            onClick={() => setJoining(true)}
            className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-accent bg-white py-4 text-label-lg text-accent active:scale-95 disabled:border-tile disabled:text-outline"
          >
            <span className="material-symbols-outlined">login</span>
            Rejoindre une partie
          </button>
        ) : (
          <div className="flex animate-slide-up flex-col gap-3 rounded-xl bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-label-lg uppercase tracking-widest text-on-surface-variant">
                Code de la partie
              </span>
              <button
                type="button"
                onClick={() => {
                  setJoining(false);
                  setCode("");
                  setError(null);
                }}
                aria-label="Annuler"
                className="text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && code.trim() && run("join")}
              maxLength={4}
              inputMode="text"
              autoCapitalize="characters"
              placeholder="XJ82"
              className="w-full rounded-lg border-2 border-tile bg-canvas py-4 text-center text-display-lg uppercase tracking-[0.3em] outline-none focus:border-accent"
            />

            <button
              type="button"
              disabled={!configured || busy !== null || code.trim().length < 4}
              onClick={() => run("join")}
              className="btn-primary w-full rounded-full disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
            >
              {busy === "join" ? "Connexion…" : "Rejoindre"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-body-md text-danger">
          {error}
        </p>
      )}

      {/* Le profil passe en bas : c'est une destination secondaire, pas une action. */}
      <button
        type="button"
        onClick={() => router.push("/profile")}
        className="flex w-full items-center gap-3 rounded-lg bg-white p-3 text-left shadow-card active:scale-[0.99]"
      >
        <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-surface-container text-[24px]">
          {isPhoto(profile.avatar) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            profile.avatar
          )}
        </span>
        <span className="flex-1">
          <span className="block text-body-lg font-bold">{profile.nickname}</span>
          <span className="block text-label-md text-on-surface-variant">
            Voir mon profil et mes découvertes
          </span>
        </span>
        <span className="material-symbols-outlined text-on-surface-variant">
          chevron_right
        </span>
      </button>
    </main>
  );

}
