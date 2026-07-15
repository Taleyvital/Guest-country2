"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useGameChannel } from "@/lib/realtime/useGameChannel";
import { errorMessage } from "@/lib/errors";
import type { Player } from "@/lib/supabase/types";
import { isPhoto } from "@/lib/game/avatar";

export default function ResultsPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [gameId, setGameId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await ensureAnonymousSession();
      setUserId(session?.user.id ?? null);

      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.from("games").select("id").eq("code", code).single();
      if (data) setGameId(data.id as string);
    })();
  }, [code]);

  const { players } = useGameChannel(gameId);
  const ranking = [...players].sort((a, b) => b.score - a.score);

  // Le podium de la maquette est ordonné 2 – 1 – 3 : le vainqueur au centre, surélevé.
  const [first, second, third] = ranking;
  const podium = [second, first, third].filter(Boolean);

  const me = ranking.find((p) => p.user_id === userId);
  const myRank = me ? ranking.indexOf(me) + 1 : null;

  return (
    <main className="screen flex min-h-dvh flex-col gap-6 py-10">
      <header className="text-center">
        <h1 className="text-headline-lg-mobile">Résultats</h1>
        <p className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          #{code}
        </p>
      </header>

      {podium.length > 0 && (
        <section className="flex items-end justify-center gap-3">
          {podium.map((p) => {
            const rank = ranking.indexOf(p) + 1;
            const isFirst = rank === 1;
            return (
              <div key={p.id} className="flex flex-1 flex-col items-center gap-2">
                {isPhoto(p.avatar) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatar!}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-[32px]">{p.avatar ?? "🌍"}</span>
                )}
                <span className="max-w-full truncate text-label-lg">{p.nickname}</span>
                <div
                  className={[
                    "flex w-full flex-col items-center justify-end rounded-t-xl px-2 pb-3 pt-2",
                    isFirst
                      ? "h-32 bg-success text-white"
                      : "h-24 bg-surface-container-high text-on-surface",
                  ].join(" ")}
                >
                  {isFirst && (
                    <span className="material-symbols-outlined">emoji_events</span>
                  )}
                  <span className="text-headline-md">{rank}</span>
                  <span className="text-label-md">{p.score} pts</span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          Classement complet
        </h2>
        <ol className="flex flex-col gap-2">
          {ranking.map((p, i) => (
            <RankRow key={p.id} player={p} rank={i + 1} isMe={p.user_id === userId} />
          ))}
        </ol>
      </section>

      {myRank && myRank > 3 && (
        <p className="text-center text-body-md text-on-surface-variant">
          {myRank}ᵉ sur {ranking.length}. Ça se joue à quelques déductions.
        </p>
      )}

      <SaveProfileCard />

      <div className="mt-auto flex gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-accent bg-white py-4 text-label-lg text-accent active:scale-95"
        >
          <span className="material-symbols-outlined">meeting_room</span>
          Accueil
        </button>
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-full"
        >
          <span className="material-symbols-outlined">stars</span>
          Mon profil
        </button>
      </div>
    </main>
  );
}

function RankRow({ player, rank, isMe }: { player: Player; rank: number; isMe: boolean }) {
  return (
    <li
      className={[
        "flex items-center justify-between rounded-lg p-4 shadow-card",
        isMe ? "border-2 border-accent bg-white" : "bg-white",
      ].join(" ")}
    >
      <span className="flex items-center gap-3">
        <span className="w-6 text-label-lg text-on-surface-variant">{rank}</span>
        {isPhoto(player.avatar) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.avatar!} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="text-[20px]">{player.avatar ?? "🌍"}</span>
        )}
        <span className="text-body-lg">{player.nickname}</span>
        {isMe && (
          <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-label-md text-on-primary-fixed">
            Toi
          </span>
        )}
      </span>
      <span className="text-headline-md">{player.score} pts</span>
    </li>
  );
}

/**
 * Proposer un compte MAINTENANT, et pas avant : il y a enfin quelque chose à
 * sauvegarder. `updateUser({ email })` convertit la session anonyme en compte
 * permanent EN CONSERVANT le même auth.uid() — stats et découvertes suivent.
 */
function SaveProfileCard() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function link() {
    if (!email.includes("@")) return;
    setState("sending");

    const supabase = getSupabaseBrowserClient();
    // Le lien de confirmation revient sur le domaine COURANT (Vercel en prod,
    // localhost en dev), pas sur un Site URL figé. Ce domaine doit tout de même
    // figurer dans Supabase > Auth > URL Configuration > Redirect URLs.
    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: window.location.origin },
    );

    if (error) {
      setState("error");
      setMessage(errorMessage(error));
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="rounded-lg bg-secondary-container p-4 text-center text-body-md text-on-secondary-container">
        Vérifie tes mails : un lien de confirmation t’attend. Ton profil est conservé.
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card">
      <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
        Garder ta progression
      </h2>
      <p className="text-body-md text-on-surface-variant">
        Ton profil ne vit que sur ce téléphone. Ajoute un e-mail pour le retrouver
        ailleurs — facultatif.
      </p>

      <div className="flex gap-2">
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ton@email.com"
          className="flex-1 rounded-lg border-2 border-tile bg-white px-3 py-3 text-body-lg outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={!email.includes("@") || state === "sending"}
          onClick={link}
          className="rounded-full bg-accent px-5 py-3 text-label-lg text-white shadow-btn-3d disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
        >
          {state === "sending" ? "…" : "Lier"}
        </button>
      </div>

      {state === "error" && message && (
        <p role="alert" className="text-body-md text-danger">
          {message}
        </p>
      )}
    </section>
  );
}
