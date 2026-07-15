"use client";

import { useEffect } from "react";
import { unlockAudio } from "@/lib/hooks/useGameSounds";

/**
 * Débloque le contexte audio au tout premier geste de la session.
 *
 * iOS et Android suspendent l'AudioContext jusqu'à une interaction utilisateur : sans
 * cette reprise, le premier `play()` est silencieux. On écoute donc le premier
 * pointerdown/touchend au niveau document, une seule fois, puis on se retire.
 *
 * Monté une fois dans le layout racine. Ne rend rien.
 */
export function AudioUnlock() {
  useEffect(() => {
    const handler = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("touchend", handler);
      window.removeEventListener("keydown", handler);
    };

    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("touchend", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("touchend", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  return null;
}
