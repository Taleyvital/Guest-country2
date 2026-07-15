"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useGameChannel } from "@/lib/realtime/useGameChannel";
import { errorMessage } from "@/lib/errors";
import type { Player } from "@/lib/supabase/types";
import { isPhoto } from "@/lib/game/avatar";

/** Petite pastille avatar réutilisée partout dans le résumé. */
function Avatar({ player, size = 40 }: { player: Player; size?: number }) {
  const s = `${size}px`;
  if (isPhoto(player.avatar)) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={player.avatar!}
        alt=""
        style={{ width: s, height: s }}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <span style={{ fontSize: `${size * 0.7}px`, lineHeight: 1 }}>{player.avatar ?? "🌍"}</span>
  );
}

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

  // Podium ordonné 2 – 1 – 3 : le vainqueur au centre, surélevé.
  const [first, second, third] = ranking;
  const podium = [second, first, third].filter(Boolean);

  const me = ranking.find((p) => p.user_id === userId);
  const myRank = me ? ranking.indexOf(me) + 1 : null;

  const highlights = computeHighlights(players);

  return (
    <main className="screen flex min-h-dvh flex-col gap-6 py-8">
      <header className="text-center">
        <p className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          Partie terminée
        </p>
        <h1 className="text-headline-lg-mobile">Résumé</h1>
        <p className="text-label-md text-on-surface-variant">#{code}</p>
      </header>

      {/* Bandeau vainqueur : la première chose qu'on veut voir. */}
      {first && (
        <section className="flex flex-col items-center gap-2 rounded-2xl bg-success p-6 text-center text-white shadow-card">
          <span className="material-symbols-outlined text-[40px]">emoji_events</span>
          <Avatar player={first} size={56} />
          <span className="text-headline-md">{first.nickname}</span>
          <span className="text-label-lg uppercase tracking-widest opacity-90">
            Vainqueur · {first.score} pts
          </span>
        </section>
      )}

      {podium.length > 1 && (
        <section className="flex items-end justify-center gap-3">
          {podium.map((p) => {
            const rank = ranking.indexOf(p) + 1;
            const isFirst = rank === 1;
            return (
              <div key={p.id} className="flex flex-1 flex-col items-center gap-2">
                <Avatar player={p} size={isFirst ? 44 : 36} />
                <span className="max-w-full truncate text-label-lg">{p.nickname}</span>
                <div
                  className={[
                    "flex w-full flex-col items-center justify-end rounded-t-xl px-2 pb-3 pt-2",
                    isFirst
                      ? "h-28 bg-success text-white"
                      : "h-20 bg-surface-container-high text-on-surface",
                  ].join(" ")}
                >
                  <span className="text-headline-md">{rank}</span>
                  <span className="text-label-md">{p.score} pts</span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Faits marquants : ce qui rend un résumé vivant, au-delà du classement. */}
      {highlights.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
            Faits marquants
          </h2>
          <div className="flex flex-col gap-2">
            {highlights.map((h) => (
              <div
                key={h.key}
                className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-card"
              >
                <span className="text-[24px]">{h.emoji}</span>
                <div className="flex-1">
                  <p className="text-body-lg font-bold">{h.title}</p>
                  <p className="text-label-md text-on-surface-variant">{h.detail}</p>
                </div>
                <Avatar player={h.player} size={32} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Détail par joueur : les chiffres de LA partie (cumul des manches). */}
      <section className="flex flex-col gap-2">
        <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          Détail par joueur
        </h2>
        <ul className="flex flex-col gap-2">
          {ranking.map((p, i) => (
            <PlayerCard key={p.id} player={p} rank={i + 1} isMe={p.user_id === userId} />
          ))}
        </ul>
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

function PlayerCard({ player, rank, isMe }: { player: Player; rank: number; isMe: boolean }) {
  // Précision de la partie : trouvailles sur tentatives. Null si aucune tentative,
  // pour ne pas afficher "0%" à qui n'a jamais osé deviner.
  const accuracy =
    player.guess_count > 0 ? Math.round((player.found_count / player.guess_count) * 100) : null;

  return (
    <li
      className={[
        "flex flex-col gap-2 rounded-xl p-4 shadow-card",
        isMe ? "border-2 border-accent bg-white" : "bg-white",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <span className="w-6 text-center text-label-lg text-on-surface-variant">{rank}</span>
        <Avatar player={player} size={32} />
        <span className="flex-1 text-body-lg font-bold">{player.nickname}</span>
        {isMe && (
          <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-label-md text-on-primary-fixed">
            Toi
          </span>
        )}
        <span className="text-headline-md">{player.score}</span>
      </div>

      <div className="flex gap-2 pl-9 text-label-md text-on-surface-variant">
        <span title="Pays trouvés">🌍 {player.found_count}</span>
        <span title="Questions posées">❓ {player.letters_count}</span>
        {accuracy !== null && <span title="Précision">🎯 {accuracy}%</span>}
      </div>
    </li>
  );
}

type Highlight = { key: string; emoji: string; title: string; detail: string; player: Player };

/** Récompenses honorifiques dérivées des compteurs de partie. */
function computeHighlights(players: Player[]): Highlight[] {
  if (players.length === 0) return [];
  const out: Highlight[] = [];

  // Meilleur limier : le plus de pays trouvés (au moins 1).
  const topFinder = [...players].sort((a, b) => b.found_count - a.found_count)[0];
  if (topFinder && topFinder.found_count > 0) {
    out.push({
      key: "finder",
      emoji: "🔍",
      title: "Meilleur limier",
      detail: `${topFinder.found_count} pays devinés`,
      player: topFinder,
    });
  }

  // Déduction la plus fine : le moins de questions par pays trouvé (min 1 trouvaille).
  const deducers = players.filter((p) => p.found_count > 0);
  if (deducers.length > 0) {
    const sharp = deducers.sort(
      (a, b) => a.letters_count / a.found_count - b.letters_count / b.found_count,
    )[0];
    out.push({
      key: "sharp",
      emoji: "⚡",
      title: "Déduction la plus fine",
      detail: `${(sharp.letters_count / sharp.found_count).toFixed(1)} questions par pays`,
      player: sharp,
    });
  }

  // Casse-cou : le plus de tentatives (osé, quitte à se tromper).
  const bold = [...players].sort((a, b) => b.guess_count - a.guess_count)[0];
  if (bold && bold.guess_count > 1) {
    out.push({
      key: "bold",
      emoji: "🎲",
      title: "Le plus audacieux",
      detail: `${bold.guess_count} tentatives`,
      player: bold,
    });
  }

  return out;
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
