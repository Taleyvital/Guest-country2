"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Country } from "@/lib/game/types";

type Discovery = { country: string; times: number; last_at: string };

/**
 * Carnet de découvertes.
 *
 * Un pays y entre quand on l'a DEVINÉ chez un adversaire — pas quand on l'a vu passer.
 * Les pays non découverts restent affichés en "???" : c'est le vide qui donne envie de
 * rejouer, une grille à moitié pleine motive plus qu'une liste de trophées.
 */
export default function DiscoveriesPage() {
  const router = useRouter();

  const [countries, setCountries] = useState<Country[]>([]);
  const [found, setFound] = useState<Record<string, Discovery>>({});
  const [region, setRegion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await ensureAnonymousSession();
      const supabase = getSupabaseBrowserClient();

      const [pool, mine] = await Promise.all([
        supabase.from("countries").select("name, region").order("name"),
        // La RLS restreint déjà aux siennes : pas de filtre user_id à écrire.
        supabase.from("discoveries").select("country, times, last_at"),
      ]);

      setCountries((pool.data as Country[]) ?? []);
      setFound(
        Object.fromEntries(
          ((mine.data as Discovery[]) ?? []).map((d) => [d.country, d]),
        ),
      );
      setLoading(false);
    })();
  }, []);

  const regions = useMemo(
    () => Array.from(new Set(countries.map((c) => c.region))).sort(),
    [countries],
  );

  const visible = region ? countries.filter((c) => c.region === region) : countries;
  const discovered = Object.keys(found).length;

  return (
    <main className="screen flex min-h-dvh flex-col gap-6 py-6">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Retour"
          className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-headline-md">Carnet de découvertes</h1>
      </header>

      <section className="rounded-xl bg-accent p-6 text-center text-white shadow-card">
        <span className="text-label-lg uppercase tracking-widest opacity-90">
          Explorateur
        </span>
        <p className="text-display-lg">
          {discovered}
          <span className="text-headline-md opacity-80"> / {countries.length}</span>
        </p>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{
              width: countries.length ? `${(discovered / countries.length) * 100}%` : "0%",
            }}
          />
        </div>
      </section>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        <Chip label="Tous" active={region === null} onClick={() => setRegion(null)} />
        {regions.map((r) => (
          <Chip
            key={r}
            label={r}
            active={region === r}
            onClick={() => setRegion(region === r ? null : r)}
          />
        ))}
      </div>

      {loading ? (
        <p className="text-center text-body-md text-on-surface-variant">Chargement…</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {visible.map((c, i) => {
            const d = found[c.name];
            return (
              <li
                key={c.name}
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                className={[
                  "flex animate-slide-up flex-col gap-1 rounded-xl p-4 shadow-card",
                  d ? "bg-white" : "bg-surface-container",
                ].join(" ")}
              >
                {d ? (
                  <>
                    <span className="material-symbols-outlined text-success">verified</span>
                    <span className="text-body-lg font-bold">{c.name}</span>
                    <span className="text-label-md text-on-surface-variant">
                      {c.region}
                    </span>
                    <span className="mt-1 w-fit rounded-full bg-secondary-container px-2 py-0.5 text-label-md text-on-secondary-container">
                      {d.times} fois
                    </span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-outline">
                      question_mark
                    </span>
                    <span className="text-body-lg font-bold text-outline">???</span>
                    {/* La région reste visible : c'est l'indice, pas le secret. */}
                    <span className="text-label-md text-on-surface-variant">
                      {c.region}
                    </span>
                    <span className="mt-1 text-label-md text-on-surface-variant">
                      {c.name.length} lettres
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-shrink-0 rounded-full px-3 py-1.5 text-label-md transition-colors",
        active
          ? "bg-accent text-white"
          : "bg-surface-container-high text-on-surface-variant active:bg-surface-container",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
