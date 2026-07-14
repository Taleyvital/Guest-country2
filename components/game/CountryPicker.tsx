"use client";

import { useMemo, useState } from "react";
import type { Country } from "@/lib/game/types";

/**
 * "brésil", "BRESIL", "Brésil " -> "BRESIL".
 *
 * Le pool est stocké sans accents (BRESIL, PEROU, GRECE) mais un joueur tape ce qu'il
 * lit : "Brésil", "Pérou". Sans normalisation, la recherche ne rendrait rien et — pire —
 * un guess correct serait compté FAUX, ce qui élimine de la manche. On aplatit donc les
 * deux côtés avant de comparer.
 */
export function normalizeCountry(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // enlève les diacritiques laissés par NFD
    .replace(/[-'’]/g, " ")
    .replace(/\s+/g, " ");
}

export function CountryPicker({
  countries,
  value,
  onChange,
  placeholder = "Chercher un pays…",
  autoFocus,
}: {
  countries: Country[];
  /** Nom exact (tel qu'en base) du pays sélectionné, ou "". */
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string | null>(null);

  const regions = useMemo(
    () => Array.from(new Set(countries.map((c) => c.region))).sort(),
    [countries],
  );

  const results = useMemo(() => {
    const q = normalizeCountry(query);

    return countries
      .filter((c) => (region ? c.region === region : true))
      .filter((c) => (q ? normalizeCountry(c.name).includes(q) : true))
      .sort((a, b) => {
        // Ce qui COMMENCE par la recherche remonte avant ce qui la contient :
        // taper "MA" doit proposer MAROC avant ALLEMAGNE.
        if (!q) return a.name.localeCompare(b.name);
        const aStarts = normalizeCountry(a.name).startsWith(q) ? 0 : 1;
        const bStarts = normalizeCountry(b.name).startsWith(q) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      });
  }, [countries, query, region]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg border-2 border-tile bg-white px-3 focus-within:border-accent">
        <span className="material-symbols-outlined text-on-surface-variant">search</span>
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-3 text-body-lg outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Effacer la recherche"
            className="text-on-surface-variant"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      {/* Filtres par région : le continent est l'indice public, c'est le premier
          réflexe de recherche. */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
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

      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {results.map((c) => {
          const selected = c.name === value;
          return (
            <li key={c.name}>
              <button
                type="button"
                onClick={() => onChange(c.name)}
                aria-pressed={selected}
                className={[
                  "flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition-colors",
                  selected
                    ? "bg-accent text-white"
                    : "bg-white text-on-surface active:bg-surface-container",
                ].join(" ")}
              >
                <span className="text-body-lg">{c.name}</span>
                <span
                  className={[
                    "text-label-md",
                    selected ? "text-white/80" : "text-on-surface-variant",
                  ].join(" ")}
                >
                  {c.region}
                </span>
              </button>
            </li>
          );
        })}

        {results.length === 0 && (
          <li className="py-6 text-center text-body-md text-on-surface-variant">
            Aucun pays ne correspond.
          </li>
        )}
      </ul>
    </div>
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
