"use client";

import { useEffect, useState } from "react";
import { isSoundEnabled, setSoundEnabled, unlockAudio } from "@/lib/hooks/useGameSounds";

/**
 * Bouton discret son on/off, persisté en localStorage.
 *
 * L'état initial est lu dans un effet (pas au premier rendu) pour éviter une
 * divergence d'hydratation : le serveur ne connaît pas localStorage.
 */
export function SoundToggle({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(isSoundEnabled());
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    setSoundEnabled(next);
    // Réactiver le son est un geste utilisateur : profitons-en pour débloquer
    // l'audio si ce n'était pas déjà fait.
    if (next) unlockAudio();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Couper le son" : "Activer le son"}
      className={[
        "rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low",
        className,
      ].join(" ")}
    >
      <span className="material-symbols-outlined">{on ? "volume_up" : "volume_off"}</span>
    </button>
  );
}
