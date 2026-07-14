"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadNickname, saveNickname } from "@/lib/game/nickname";
import type { Game } from "@/lib/supabase/types";

/** Une partie en cours où ce téléphone a déjà une place. */
type ActiveGame = { code: string; status: string; round: number };

export default function Home() {
  const router = useRouter();
  const configured = isSupabaseConfigured();

  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveGame | null>(null);

  useEffect(() => {
    // Le pseudo est demandé UNE fois, puis relu à chaque retour sur l'accueil.
    setNickname(loadNickname());

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
        // Le filtre sur user_id est indispensable : la RLS m'autorise à lire TOUS les
        // joueurs des parties où je suis (il faut bien voir ses adversaires), donc
        // sans lui je récupérerais la ligne — et le pseudo — de quelqu'un d'autre.
        const { data } = await supabase
          .from("players")
          .select("nickname, games(code, status, round)")
          .eq("user_id", session.user.id)
          .order("joined_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const game = (data as { games?: ActiveGame } | null)?.games;
        if (game && game.status !== "finished") setActive(game);

        const saved = (data as { nickname?: string } | null)?.nickname;
        if (saved) {
          setNickname(saved);
          saveNickname(saved);
        }
      } catch {
        // Pas de session, pas de partie en cours : l'accueil normal suffit.
      }
    })();
  }, [configured]);

  async function run(action: "create" | "join") {
    const name = nickname.trim();
    if (!name) return setError("Choisis un pseudo d'abord.");
    if (action === "join" && !code.trim()) return setError("Entre le code de la partie.");

    setBusy(action);
    setError(null);

    try {
      await ensureAnonymousSession();
      saveNickname(name);
      const supabase = getSupabaseBrowserClient();

      const { data, error: rpcError } =
        action === "create"
          ? await supabase.rpc("create_game", { p_nickname: name })
          : await supabase.rpc("join_game", {
              p_code: code.trim().toUpperCase(),
              p_nickname: name,
            });

      if (rpcError) throw rpcError;

      const game = data as unknown as Game;
      router.push(`/room/${game.code}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      // Les erreurs Postgres remontent telles quelles : on les traduit.
      setError(
        message.includes("game not found")
          ? "Aucune partie avec ce code."
          : message.includes("already started")
            ? "Cette partie a déjà commencé."
            : message.includes("Anonymous sign-ins are disabled")
              ? "Active les sessions anonymes dans Supabase (Auth > Providers)."
              : message,
      );
      setBusy(null);
    }
  }

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
          <code>NEXT_PUBLIC_SUPABASE_URL</code> et <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> dans{" "}
          <code>.env.local</code>, applique les migrations, puis relance{" "}
          <code>npm run dev</code>.
        </div>
      )}

      {/* Une place est toujours ouverte quelque part : on y ramène en un geste plutôt
          que de faire retaper un code de room. */}
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

      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={24}
        placeholder="Ton pseudo"
        className="w-full border-b-4 border-tile bg-transparent py-3 text-center text-headline-md outline-none transition-colors focus:border-accent"
      />

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
