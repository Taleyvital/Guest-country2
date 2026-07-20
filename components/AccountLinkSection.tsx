"use client";

import { useState } from "react";
import { LinkEmailCard } from "./LinkEmailCard";
import { SignInCard } from "./SignInCard";

/**
 * Regroupe les deux parcours liés au compte, mutuellement exclusifs :
 * "je n'ai pas encore de compte" (LinkEmailCard, convertit la session
 * anonyme courante) vs "j'ai déjà un compte" (SignInCard, se connecte à un
 * compte existant — utile quand la session anonyme du téléphone a changé et
 * qu'on veut retrouver l'ancien historique).
 *
 * `hasEmail` ne doit PAS cacher l'option de connexion : un compte déjà lié
 * n'est pas forcément le BON compte (ex. une session anonyme neuve liée par
 * erreur pendant qu'un vieux compte, avec le vrai historique, existe encore
 * ailleurs). Seul `LinkEmailCard` perd son sens une fois un email lié.
 */
export function AccountLinkSection({ hasEmail }: { hasEmail: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"link" | "signin">(hasEmail ? "signin" : "link");

  if (hasEmail && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-center text-label-md text-accent underline"
      >
        Se connecter à un autre compte
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {mode === "link" ? <LinkEmailCard /> : <SignInCard />}

      {!hasEmail && (
        <button
          type="button"
          onClick={() => setMode(mode === "link" ? "signin" : "link")}
          className="self-center text-label-md text-accent underline"
        >
          {mode === "link" ? "J’ai déjà un compte" : "Créer un lien pour ce téléphone"}
        </button>
      )}
    </div>
  );
}
