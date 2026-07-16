"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadProfile } from "@/lib/game/profile";
import { errorMessage } from "@/lib/errors";
import type { JamesGame } from "@/games/james/types";

/** Écran de création/jonction, indépendant du reste de la plateforme : James se
 *  lance et se teste seul depuis /games/james. */
export default function JamesHome() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "create" | "join") {
    const profile = loadProfile();
    if (!profile) return router.push("/onboarding");
    if (action === "join" && code.trim().length < 4) return setError("Entre le code de la partie.");

    setBusy(action);
    setError(null);

    try {
      await ensureAnonymousSession();
      const supabase = getSupabaseBrowserClient();

      const { data, error: rpcError } =
        action === "create"
          ? await supabase.rpc("create_james_game", { p_nickname: profile.nickname })
          : await supabase.rpc("join_james_game", {
              p_code: code.trim().toUpperCase(),
              p_nickname: profile.nickname,
            });

      if (rpcError) throw rpcError;

      const game = data as unknown as JamesGame;
      router.push(`/games/james/${game.code}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  return (
    <main className="screen flex min-h-dvh flex-col items-center justify-center gap-8 py-10 text-center">
      <h1 className="text-display-lg">James</h1>
      <p className="-mt-4 text-body-md text-on-surface-variant">
        4 joueurs, 2 équipes face-à-face. Réunis 4 cartes de la même couleur, puis
        signale-le discrètement à ton partenaire.
      </p>

      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("create")}
          className="btn-primary w-full rounded-full disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
        >
          {busy === "create" ? "Création…" : "Créer une table"}
        </button>

        {!joining ? (
          <button
            type="button"
            onClick={() => setJoining(true)}
            className="w-full rounded-full border-2 border-accent bg-white py-4 text-label-lg text-accent active:scale-95"
          >
            Rejoindre une table
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card">
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && run("join")}
              maxLength={4}
              placeholder="XJ82"
              className="w-full rounded-lg border-2 border-tile bg-canvas py-4 text-center text-display-lg uppercase tracking-[0.3em] outline-none focus:border-accent"
            />
            <button
              type="button"
              disabled={busy !== null || code.trim().length < 4}
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
    </main>
  );
}
