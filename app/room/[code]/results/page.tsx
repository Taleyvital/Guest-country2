"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useGameChannel } from "@/lib/realtime/useGameChannel";
import { errorMessage } from "@/lib/errors";

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

  // Une égalité en tête est possible (deux joueurs au même score) : on annonce
  // "ex æquo" plutôt que de couronner arbitrairement le premier du tri.
  const top = ranking[0]?.score;
  const winners = ranking.filter((p) => p.score === top);

  return (
    <main className="screen flex min-h-dvh flex-col gap-6 py-10">
      <header className="text-center">
        <h1 className="text-headline-lg-mobile">Résultats</h1>
        <p className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          #{code}
        </p>
      </header>

      {winners.length > 0 && (
        <section className="rounded-xl bg-success p-6 text-center text-white shadow-card">
          <span className="text-label-lg uppercase tracking-widest opacity-90">
            {winners.length > 1 ? "Ex æquo" : "Vainqueur"}
          </span>
          <p className="text-headline-lg-mobile">
            🏆 {winners.map((w) => w.nickname).join(" & ")}
          </p>
          <p className="text-body-md opacity-90">{top} points</p>
        </section>
      )}

      <ol className="flex flex-col gap-2">
        {ranking.map((p, i) => (
          <li
            key={p.id}
            className={[
              "flex items-center justify-between rounded-lg p-4 shadow-card",
              i === 0 ? "bg-secondary-container" : "bg-white",
            ].join(" ")}
          >
            <span className="flex items-center gap-3 text-body-lg">
              <span className="w-6 text-label-lg text-on-surface-variant">{i + 1}</span>
              {p.nickname}
              {p.user_id === userId && (
                <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-label-md text-on-primary-fixed">
                  Toi
                </span>
              )}
            </span>
            <span className="text-headline-md">{p.score} pts</span>
          </li>
        ))}
      </ol>

      <SaveProfileCard />

      <button
        type="button"
        onClick={() => router.push("/")}
        className="btn-primary mt-auto w-full rounded-full"
      >
        Retour à l’accueil
      </button>
    </main>
  );
}

/**
 * Proposer un compte MAINTENANT, et pas avant : il y a enfin quelque chose à
 * sauvegarder (un score, un historique). Demander un e-mail pour entrer dans une
 * partie aurait fait fuir la moitié de la table.
 *
 * `updateUser({ email })` sur une session anonyme envoie un lien de confirmation et
 * convertit le compte anonyme en compte permanent — le même `auth.uid()` est conservé,
 * donc les lignes `players` déjà créées restent rattachées au joueur.
 */
function SaveProfileCard() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function link() {
    if (!email.includes("@")) return;
    setState("sending");

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ email: email.trim() });

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
        Vérifie tes mails : un lien de confirmation t’attend. Ton score est conservé.
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card">
      <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
        Garder ton score
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
