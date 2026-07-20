"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";

/**
 * Connexion à un compte EXISTANT (par opposition à `LinkEmailCard`, qui
 * convertit la session anonyme courante en compte permanent). Nécessaire
 * quand la session anonyme du téléphone a été perdue (cache vidé, PWA
 * réinstallé...) : sans ça, l'historique lié à l'ancien email restait
 * inaccessible pour toujours, remplacé par une session neuve et vierge.
 *
 * `shouldCreateUser: false` : on ne veut PAS créer un compte ici si l'email
 * ne correspond à personne — ce serait le rôle de `LinkEmailCard`, pas de
 * cet écran.
 */
export function SignInCard({ onSignedIn }: { onSignedIn?: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function sendCode() {
    if (!email.includes("@")) return;
    setState("loading");
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

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
      type: "email",
    });

    if (error) {
      setState("error");
      setMessage(errorMessage(error));
      return;
    }
    // Nouvelle session = nouvel auth.uid : tout ce qui a été lu avant (stats,
    // découvertes) est périmé. Le plus sûr est de repartir d'un rendu propre
    // plutôt que de trafiquer l'état local des pages appelantes.
    onSignedIn?.();
    window.location.reload();
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card">
      <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant">
        J’ai déjà un compte
      </h2>

      {step === "email" ? (
        <>
          <p className="text-body-md text-on-surface-variant">
            Retrouve tes stats sur ce téléphone en te connectant avec l’e-mail
            que tu avais lié.
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
