"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadProfile, type Profile } from "@/lib/game/profile";
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

  if (!profile) return null; // redirection vers /onboarding en cours

  return (
    <main className="screen flex min-h-dvh flex-col items-center justify-center gap-6 py-10 text-center">
      <div>
        <h1 className="text-headline-lg-mobile">Guess the Country</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Un téléphone par joueur. Pas d&apos;écran commun.
        </p>
      </div>

      {!configured && (
        <div className="w-full rounded-lg bg-error-container p-4 text-left text-body-md text-on-error-container">
          <span className="font-bold">Supabase n&apos;est pas configuré.</span> Renseigne{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> et <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
          dans <code>.env.local</code>, applique les migrations, puis relance{" "}
          <code>npm run dev</code>.
        </div>
      )}

      {/* Le pseudo est saisi une fois, à l'onboarding. Ici on ne fait que le rappeler. */}
      <button
        type="button"
        onClick={() => router.push("/onboarding")}
        className="flex w-full items-center gap-3 rounded-lg bg-white p-3 text-left shadow-card active:scale-[0.99]"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-[24px]">
          {profile.avatar}
        </span>
        <span className="flex-1">
          <span className="block text-body-lg font-bold">{profile.nickname}</span>
          <span className="block text-label-md text-on-surface-variant">
            Modifier mon profil
          </span>
        </span>
        <span className="material-symbols-outlined text-on-surface-variant">edit</span>
      </button>

      {/* Une place reste ouverte : on y ramène en un geste. */}
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
          className="w-full rounded-lg bg-secondary-container p-4 text-left text-on-secondary-container active:scale-[0.99]"
        >
          <span className="text-label-md uppercase tracking-widest">Partie en cours</span>
          <p className="text-body-lg">
            Reprendre <span className="font-bold">#{active.code}</span>
            {active.status === "playing" ? ` · manche ${active.round}` : " · en attente"}
          </p>
        </button>
      )}

      <button
        type="button"
        disabled={!configured || busy !== null}
        onClick={() => run("create")}
        className="btn-primary w-full rounded-full disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
      >
        {busy === "create" ? "Création…" : "Créer une partie"}
      </button>

      <div className="flex w-full items-center gap-3 text-label-md uppercase text-on-surface-variant">
        <div className="h-px flex-1 bg-tile" />
        ou
        <div className="h-px flex-1 bg-tile" />
      </div>

      <div className="flex w-full gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={4}
          placeholder="CODE"
          className="w-32 rounded-lg border-2 border-tile bg-white py-3 text-center text-headline-md uppercase tracking-widest outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={!configured || busy !== null}
          onClick={() => run("join")}
          className="flex-1 rounded-full border-2 border-accent bg-white py-4 text-label-lg text-accent active:scale-95 disabled:cursor-not-allowed disabled:border-tile disabled:text-outline"
        >
          {busy === "join" ? "Connexion…" : "Rejoindre"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-body-md text-danger">
          {error}
        </p>
      )}
    </main>
  );
}
