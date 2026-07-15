"use client";

import { useCallback } from "react";
import { Howl, Howler } from "howler";

/**
 * Sons de jeu (premier plan, app ouverte). Système INDÉPENDANT des push.
 *
 * Les Howl sont des singletons de module : un son se charge une fois, pas à chaque
 * montage de composant. L'état "son activé" vit aussi au niveau module, synchronisé
 * avec localStorage — ainsi le toggle et le déclencheur d'effets partagent la même
 * vérité sans passer par un contexte React.
 */

type SoundName = "your-turn" | "letter-found" | "letter-missed" | "elimination" | "victory";

const FILES: Record<SoundName, string> = {
  "your-turn": "/sounds/your-turn.mp3",
  "letter-found": "/sounds/letter-found.mp3",
  "letter-missed": "/sounds/letter-missed.mp3",
  elimination: "/sounds/elimination.mp3",
  victory: "/sounds/victory.mp3",
};

const STORAGE_KEY = "guess-country:sound";

const howls = new Map<SoundName, Howl>();

function getHowl(name: SoundName): Howl {
  let howl = howls.get(name);
  if (!howl) {
    howl = new Howl({
      src: [FILES[name]],
      volume: 0.6,
      // Un fichier manquant/vide ne doit jamais casser le jeu : on avale l'erreur,
      // le son est simplement silencieux.
      onloaderror: () => {},
      onplayerror: () => {},
    });
    howls.set(name, howl);
  }
  return howl;
}

// --- État "activé", partagé au niveau module ----------------------------------

function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    // Activé par défaut : l'absence de préférence = son on.
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

let enabled = readEnabled();

export function isSoundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(next: boolean): void {
  enabled = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    // localStorage indisponible (Safari privé) : la préférence ne survivra pas à la
    // session, mais le son fonctionne quand même pour la session en cours.
  }
}

/**
 * Débloque le contexte audio. iOS/Android suspendent l'AudioContext tant qu'aucun
 * geste utilisateur n'a eu lieu : sans reprise explicite, le premier son est muet.
 * Appelé une fois depuis le layout (voir AudioUnlock).
 */
export function unlockAudio(): void {
  try {
    const ctx = Howler.ctx as AudioContext | undefined;
    if (ctx && ctx.state !== "running") void ctx.resume();
  } catch {
    /* no-op */
  }
}

function play(name: SoundName): void {
  if (!enabled) return;
  try {
    getHowl(name).play();
  } catch {
    /* un son raté n'interrompt jamais le jeu */
  }
}

/**
 * Expose les déclencheurs sonores. Les noms suivent la spec ; en interne ils mappent
 * sur les fichiers de /public/sounds.
 */
export function useGameSounds() {
  const playYourTurn = useCallback(() => play("your-turn"), []);
  const playLetterFound = useCallback(() => play("letter-found"), []);
  const playLetterMissed = useCallback(() => play("letter-missed"), []);
  const playElimination = useCallback(() => play("elimination"), []);
  const playVictory = useCallback(() => play("victory"), []);

  return {
    playYourTurn,
    playLetterFound,
    playLetterMissed,
    playElimination,
    playVictory,
  };
}
