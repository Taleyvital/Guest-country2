"use client";

import { useEffect, useState } from "react";
import { enablePush, isPushSupported, pushPermission, type PushState } from "@/lib/push/pushClient";
import { IosInstallHint } from "./IosInstallHint";

/**
 * Demande de permission notifications — CONTEXTUELLE.
 *
 * Affichée dans le salon, au moment où l'on rejoint une partie : c'est là que
 * « te prévenir quand c'est ton tour » a un sens. Jamais au chargement initial, où la
 * demande arriverait sans contexte et serait refusée par réflexe.
 *
 * Ne bloque jamais le jeu : un refus masque simplement la carte.
 */
export function PushPermission() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setState(pushPermission());
  }, []);

  if (state === null || dismissed) return null;

  // Déjà accordé, ou définitivement refusé : plus rien à proposer.
  if (state === "granted" || state === "denied") return null;

  // iOS non installé : les push sont impossibles tant que l'app n'est pas sur
  // l'écran d'accueil. On explique l'installation plutôt que de proposer un bouton
  // qui échouerait.
  if (!isPushSupported()) {
    return <IosInstallHint />;
  }

  // VAPID non configuré côté déploiement : inutile de proposer, ça ne marcherait pas.
  if (state === "no-vapid") return null;

  async function turnOn() {
    setBusy(true);
    const result = await enablePush();
    setState(result);
    setBusy(false);
    if (result !== "granted") setDismissed(true); // refus : on n'insiste pas
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-card">
      <span className="material-symbols-outlined text-accent">notifications_active</span>
      <div className="flex-1">
        <p className="text-body-lg font-bold">Être prévenu de ton tour</p>
        <p className="text-body-md text-on-surface-variant">
          Reçois une alerte quand c’est à toi, même app fermée.
        </p>
      </div>
      <button
        type="button"
        onClick={turnOn}
        disabled={busy}
        className="rounded-full bg-accent px-4 py-2 text-label-lg text-white shadow-btn-3d disabled:bg-tile disabled:text-outline disabled:shadow-none"
      >
        {busy ? "…" : "Activer"}
      </button>
    </div>
  );
}
