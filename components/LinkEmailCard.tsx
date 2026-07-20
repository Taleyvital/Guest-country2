"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";

/**
 * `updateUser({ email })` convertit la session anonyme en compte permanent EN
 * CONSERVANT le même auth.uid() — stats et découvertes suivent. Réutilisé sur
 * l'écran de résultats (juste après une partie) et sur Mon profil (à tout moment).
 *
 * Code à 6 chiffres plutôt que lien cliquable : un PWA installé (icône sur
 * l'écran d'accueil) a un stockage isolé de celui du navigateur qui ouvre le
 * lien depuis l'appli mail — cliquer confirmait l'email dans Safari/Chrome,
 * jamais dans le PWA lui-même, qui restait bloqué en session anonyme. Le code
 * se saisit dans l'appli déjà ouverte : tout se passe dans le même contexte.
 * Le template d'email doit inclure {{ .Token }} côté Supabase (Auth > Email
 * Templates > Confirm change of email address).
 */
export function LinkEmailCard() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [state, setState] = useState<"idle" | "loading" | "confirmed" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function sendCode() {
    if (!email.includes("@")) return;
    setState("loading");
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ email: email.trim() });

    if (error) {
      setState("error");
      setMessage(errorMessage(error));
      return;
    }
    setState("idle");
    setStep("code");
  }

  async function confirmCode() {
    if (code.trim().length < 6) return;
    setState("loading");
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email_change",
    });

    if (error) {
      setState("error");
      setMessage(errorMessage(error));
      return;
    }
    setState("confirmed");
  }

  if (state === "confirmed") {
    return (
      <div className="rounded-lg bg-secondary-container p-4 text-center text-body-md text-on-secondary-container">
        Email confirmé — ton profil est désormais lié et sera conservé.
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card">
      <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
        Garder ta progression
      </h2>

      {step === "email" ? (
        <>
          <p className="text-body-md text-on-surface-variant">
            Ton profil ne vit que sur ce téléphone. Ajoute un e-mail pour le
            retrouver ailleurs — facultatif.
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
              disabled={!email.includes("@") || state === "loading"}
              onClick={sendCode}
              className="rounded-full bg-accent px-5 py-3 text-label-lg text-white shadow-btn-3d disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
            >
              {state === "loading" ? "…" : "Recevoir un code"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-body-md text-on-surface-variant">
            Un code à 6 chiffres a été envoyé à <span className="font-bold">{email}</span> —
            regarde aussi tes spams. Saisis-le ici, dans l’appli.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="flex-1 rounded-lg border-2 border-tile bg-white px-3 py-3 text-center text-body-lg tracking-[0.3em] outline-none focus:border-accent"
            />
            <button
              type="button"
              disabled={code.trim().length < 6 || state === "loading"}
              onClick={confirmCode}
              className="rounded-full bg-accent px-5 py-3 text-label-lg text-white shadow-btn-3d disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
            >
              {state === "loading" ? "…" : "Confirmer"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setState("idle");
              setMessage(null);
            }}
            className="text-label-md text-accent underline"
          >
            Mauvaise adresse ? Recommencer
          </button>
        </>
      )}

      {state === "error" && message && (
        <p role="alert" className="text-body-md text-danger">
          {message}
        </p>
      )}
    </section>
  );
}
