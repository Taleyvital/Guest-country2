"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadProfile } from "@/lib/game/profile";
import { errorMessage } from "@/lib/errors";
import type { AmericainGame, DrawMode } from "@/games/8-americain/types";

export default function AmericainHome() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [drawMode, setDrawMode] = useState<DrawMode>("unlimited");
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
          ? await supabase.rpc("create_americain_game", {
              p_nickname: profile.nickname,
              p_max_players: maxPlayers,
              p_draw_mode: drawMode,
            })
          : await supabase.rpc("join_americain_game", {
              p_code: code.trim().toUpperCase(),
              p_nickname: profile.nickname,
            });

      if (rpcError) throw rpcError;

      const game = data as unknown as AmericainGame;

      // L'avatar (emoji ou photo) n'est pas posé par la RPC : il vient du profil
      // local, pas du salon. Sans ça, OpponentsRow n'aurait rien à afficher.
      // La policy "update own row" (user_id = auth.uid()) suffit à scoper l'update
      // à SA propre ligne, comme pour le jeu principal.
      await supabase.from("americain_players").update({ avatar: profile.avatar }).eq("game_id", game.id);

      router.push(`/games/8-americain/${game.code}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  return (
    <main className="screen flex min-h-dvh flex-col items-center justify-center gap-8 py-10 text-center">
      <h1 className="text-display-lg">8 Américain</h1>
      <p className="-mt-4 text-body-md text-on-surface-variant">
        2 à 6 joueurs. Défausse-toi de toutes tes cartes avant les autres.
      </p>

      <div className="flex w-full flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-xl bg-white p-4 text-left shadow-card">
          <label className="text-label-lg uppercase tracking-widest text-on-surface-variant">
            Joueurs max
          </label>
          <input
            type="number"
            min={2}
            max={6}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Math.min(6, Math.max(2, Number(e.target.value))))}
            className="rounded-lg border-2 border-tile bg-canvas p-2 text-center"
          />
          <label className="text-label-lg uppercase tracking-widest text-on-surface-variant">
            Pioche
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDrawMode("unlimited")}
              className={`flex-1 rounded-full py-2 text-label-md ${drawMode === "unlimited" ? "btn-primary" : "border-2 border-tile"}`}
            >
              Illimitée
            </button>
            <button
              type="button"
              onClick={() => setDrawMode("single")}
              className={`flex-1 rounded-full py-2 text-label-md ${drawMode === "single" ? "btn-primary" : "border-2 border-tile"}`}
            >
              Unique
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("create")}
          className="btn-primary w-full rounded-full disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
        >
          {busy === "create" ? "Création…" : "Créer une partie"}
        </button>

        {!joining ? (
          <button
            type="button"
            onClick={() => setJoining(true)}
            className="w-full rounded-full border-2 border-accent bg-white py-4 text-label-lg text-accent active:scale-95"
          >
            Rejoindre une partie
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
