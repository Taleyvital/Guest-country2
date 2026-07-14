"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AVATARS, loadProfile, saveProfile } from "@/lib/game/profile";
import { isPhoto, uploadAvatar } from "@/lib/game/avatar";
import { errorMessage } from "@/lib/errors";

/**
 * Création du profil — une seule fois, sans compte.
 *
 * On ne demande AUCUN e-mail ici : le jeu se lance autour d'une table, il doit
 * démarrer en quelques secondes. La proposition de créer un compte n'arrive qu'après
 * une partie, quand il y a un score à sauvegarder.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = loadProfile();
    if (existing) {
      setNickname(existing.nickname);
      setAvatar(existing.avatar);
    }
  }, []);

  const valid = nickname.trim().length >= 2;

  async function onPickPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      // L'URL renvoyée devient l'avatar : la photo prime sur l'emoji sélectionné.
      setAvatar(await uploadAvatar(file));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    if (!valid) return;
    saveProfile({ nickname: nickname.trim(), avatar });
    router.push("/");
  }

  return (
    <main className="screen flex min-h-dvh flex-col justify-center gap-6 py-10">
      <header className="text-center">
        <h1 className="text-headline-lg-mobile">Ton profil</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Un pseudo, une tête. C&apos;est tout — pas de compte à créer.
        </p>
      </header>

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="relative"
          aria-label="Ajouter une photo"
        >
          <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-white text-[52px] shadow-card">
            {isPhoto(avatar) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              avatar
            )}
          </span>
          <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-card">
            <span className="material-symbols-outlined text-[20px]">
              {uploading ? "hourglass_top" : "photo_camera"}
            </span>
          </span>
        </button>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickPhoto(f);
            e.target.value = ""; // permet de re-choisir le même fichier
          }}
        />

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="text-label-lg text-accent underline disabled:text-outline"
        >
          {uploading
            ? "Envoi…"
            : isPhoto(avatar)
              ? "Changer la photo"
              : "Ajouter une photo"}
        </button>

        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={24}
          placeholder="Ton pseudo"
          className="w-full border-b-4 border-tile bg-transparent py-3 text-center text-headline-md outline-none transition-colors focus:border-accent"
        />
        {nickname.length > 0 && !valid && (
          <p className="text-label-md text-danger">Au moins 2 caractères.</p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
          {isPhoto(avatar) ? "Ou choisis un emoji" : "Ton avatar"}
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
                a === avatar ? "scale-105 bg-accent shadow-card" : "bg-white active:scale-95",
              ].join(" ")}
            >
              {a}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="text-center text-body-md text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!valid || uploading}
        className="btn-primary mt-auto w-full rounded-full disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
      >
        C&apos;est parti
      </button>
    </main>
  );
}
