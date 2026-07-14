"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AVATARS, loadProfile, saveProfile } from "@/lib/game/profile";

/**
 * Création du profil — une seule fois, sans compte.
 *
 * On ne demande AUCUN e-mail ici : le jeu se lance autour d'une table, il doit
 * démarrer en quelques secondes. La proposition de créer un compte n'arrive qu'après
 * une partie, quand il y a un score à sauvegarder (voir l'écran de résultats).
 */
export default function OnboardingPage() {
  const router = useRouter();

  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);

  // Modifier son profil = repasser par ici : on pré-remplit avec l'existant.
  useEffect(() => {
    const existing = loadProfile();
    if (existing) {
      setNickname(existing.nickname);
      setAvatar(existing.avatar);
    }
  }, []);

  const valid = nickname.trim().length >= 2;

  function submit() {
    if (!valid) return;
    saveProfile({ nickname: nickname.trim(), avatar });
    router.push("/");
  }

  return (
    <main className="screen flex min-h-dvh flex-col justify-center gap-8 py-10">
      <header className="text-center">
        <h1 className="text-headline-lg-mobile">Ton profil</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Choisis un pseudo et une tête. C&apos;est tout — pas de compte à créer.
        </p>
      </header>

      <div className="flex flex-col items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-[48px] shadow-card">
          {avatar}
        </div>

        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={24}
          autoFocus
          placeholder="Ton pseudo"
          className="w-full border-b-4 border-tile bg-transparent py-3 text-center text-headline-md outline-none transition-colors focus:border-accent"
        />
        {nickname.length > 0 && !valid && (
          <p className="text-label-md text-danger">Au moins 2 caractères.</p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          Ton avatar
        </h2>
        <div className="grid grid-cols-8 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAvatar(a)}
              aria-pressed={a === avatar}
              className={[
                "flex aspect-square items-center justify-center rounded-lg text-[24px] transition-transform",
                a === avatar
                  ? "scale-105 bg-accent shadow-card"
                  : "bg-white active:scale-95",
              ].join(" ")}
            >
              {a}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={submit}
        disabled={!valid}
        className="btn-primary mt-auto w-full rounded-full disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
      >
        C&apos;est parti
      </button>
    </main>
  );
}
