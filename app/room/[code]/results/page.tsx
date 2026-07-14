"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useGameChannel } from "@/lib/realtime/useGameChannel";

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

  return (
    <main className="screen flex min-h-dvh flex-col gap-6 py-10">
      <header className="text-center">
        <h1 className="text-headline-lg-mobile">Résultats</h1>
        <p className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          #{code}
        </p>
      </header>

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
