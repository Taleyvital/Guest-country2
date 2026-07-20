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
 */
export function AccountLinkSection() {
  const [mode, setMode] = useState<"link" | "signin">("link");

  return (
    <div className="flex flex-col gap-2">
      {mode === "link" ? <LinkEmailCard /> : <SignInCard />}

      <button
        type="button"
        onClick={() => setMode(mode === "link" ? "signin" : "link")}
        className="self-center text-label-md text-accent underline"
      >
        {mode === "link" ? "J’ai déjà un compte" : "Créer un lien pour ce téléphone"}
      </button>
    </div>
  );
}
