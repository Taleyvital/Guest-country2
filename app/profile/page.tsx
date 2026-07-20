"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadProfile, type Profile } from "@/lib/game/profile";
import { isPhoto } from "@/lib/game/avatar";
import { LinkEmailCard } from "@/components/LinkEmailCard";

type Stats = {
  games_played: number;
  wins: number;
  guesses: number;
  correct_guesses: number;
  letters_asked: number;
  total_points: number;
};

const EMPTY: Stats = {
  games_played: 0,
  wins: 0,
  guesses: 0,
  correct_guesses: 0,
  letters_asked: 0,
  total_points: 0,
};

/** 1 000 points = 1 niveau. Dérivé, jamais stocké : le barème peut changer sans migration. */
const XP_PER_LEVEL = 1000;

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [discovered, setDiscovered] = useState(0);
  const [totalCountries, setTotalCountries] = useState(0);
  const [hasEmail, setHasEmail] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());

    (async () => {
      const session = await ensureAnonymousSession();
      if (!session) return;
      setHasEmail(Boolean(session.user.email));
      const supabase = getSupabaseBrowserClient();

      // La RLS ne laisse lire QUE ses propres stats : pas de filtre user_id à écrire,
      // et surtout pas moyen d'aller regarder celles d'un adversaire.
      const [s, d, c] = await Promise.all([
        supabase.from("player_stats").select("*").maybeSingle(),
        supabase.from("discoveries").select("country", { count: "exact", head: true }),
        supabase.from("countries").select("name", { count: "exact", head: true }),
      ]);

      if (s.data) setStats(s.data as Stats);
      setDiscovered(d.count ?? 0);
      setTotalCountries(c.count ?? 0);
    })();
  }, []);

  const points = Math.max(0, stats.total_points);
  const level = Math.floor(points / XP_PER_LEVEL) + 1;
  const xp = points % XP_PER_LEVEL;

  // Précision : sur les tentatives d'identification, pas sur les questions. Une
  // division par zéro afficherait "NaN%" à un joueur qui n'a encore rien tenté.
  const accuracy =
    stats.guesses > 0 ? Math.round((stats.correct_guesses / stats.guesses) * 100) : null;

  // Questions posées par pays trouvé : plus c'est bas, plus la déduction est fine.
  const avgLetters =
    stats.correct_guesses > 0
      ? (stats.letters_asked / stats.correct_guesses).toFixed(1)
      : null;

  return (
    <main className="screen flex min-h-dvh flex-col gap-6 py-6 pb-28">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Retour"
          className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-headline-md">Mon profil</h1>
      </header>

      <section className="flex flex-col items-center gap-2 rounded-xl bg-white p-6 shadow-card">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-surface-container text-[48px]">
          {isPhoto(profile?.avatar) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile!.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            (profile?.avatar ?? "🌍")
          )}
        </div>
        <h2 className="text-headline-md">{profile?.nickname ?? "Joueur"}</h2>
        <span className="rounded-full bg-primary-fixed px-3 py-1 text-label-md text-on-primary-fixed">
          {stats.total_points} pts au total
        </span>
        <button
          type="button"
          onClick={() => router.push("/onboarding")}
          className="text-label-md text-accent underline"
        >
          Modifier
        </button>
      </section>

      <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card">
        <div className="flex items-end justify-between">
          <span className="text-label-lg uppercase tracking-widest text-on-surface-variant">
            Progression
          </span>
          <span className="text-headline-md text-accent">Niveau {level}</span>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-tile">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${(xp / XP_PER_LEVEL) * 100}%` }}
          />
        </div>
        <span className="text-label-md text-on-surface-variant">
          {xp} / {XP_PER_LEVEL} XP vers le niveau {level + 1}
        </span>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <StatCard icon="emoji_events" value={String(stats.wins)} label="Victoires" />
        <StatCard
          icon="public"
          value={`${discovered}${totalCountries ? ` / ${totalCountries}` : ""}`}
          label="Pays découverts"
        />
        <StatCard
          icon="target"
          value={accuracy === null ? "—" : `${accuracy}%`}
          label="Précision"
        />
        <StatCard
          icon="query_stats"
          value={avgLetters ?? "—"}
          label="Questions / trouvaille"
        />
      </section>

      <section className="rounded-xl bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <span className="text-label-lg uppercase tracking-widest text-on-surface-variant">
            Parties jouées
          </span>
          <span className="text-headline-md">{stats.games_played}</span>
        </div>
      </section>

      {!hasEmail && <LinkEmailCard />}

      <button
        type="button"
        onClick={() => router.push("/discoveries")}
        className="btn-primary mt-auto flex w-full items-center justify-center gap-2 rounded-full"
      >
        <span className="material-symbols-outlined">travel_explore</span>
        Mon carnet de découvertes
      </button>
    </main>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-white p-4 shadow-card">
      <span className="material-symbols-outlined text-accent">{icon}</span>
      <span className="text-headline-md">{value}</span>
      <span className="text-center text-label-md uppercase text-on-surface-variant">
        {label}
      </span>
    </div>
  );
}
