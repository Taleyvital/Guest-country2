"use client";

import { useState } from "react";
import type { CountryTile, GamePlayer, LastAction } from "@/lib/game/types";
import { PlayerRail } from "./PlayerRail";
import { CountryTiles } from "./CountryTiles";
import { LastActionCard } from "./LastActionCard";
import { ActionBar } from "./ActionBar";
import { AskLetterModal } from "./AskLetterModal";
import { GuessCountryModal } from "./GuessCountryModal";

export type GameScreenProps = {
  /** Joueur dont c'est le tour. `null` = partie en pause / transition. */
  currentTurnPlayer: GamePlayer | null;
  players: GamePlayer[];
  myCountryTiles: CountryTile[];
  /** Objet unique — jamais un tableau d'historique. */
  lastAction: LastAction | null;

  roomCode?: string;
  round?: number;
  totalRounds?: number;
  regionHint?: string;
  usedLetters?: string[];
  letterCost?: number;

  onAskLetter?: (letter: string) => void;
  onGuessCountry?: (guess: string) => void;
  onBack?: () => void;
};

export function GameScreen({
  currentTurnPlayer,
  players,
  myCountryTiles,
  lastAction,
  roomCode,
  round,
  totalRounds,
  regionHint,
  usedLetters = [],
  letterCost = 50,
  onAskLetter,
  onGuessCountry,
  onBack,
}: GameScreenProps) {
  const [askOpen, setAskOpen] = useState(false);
  const [guessOpen, setGuessOpen] = useState(false);

  const me = players.find((p) => p.isMe) ?? null;

  // Le tour se déduit d'une seule source : la prop. Aucun état local ne le duplique,
  // sinon deux téléphones pourraient se croire simultanément en tour.
  const isMyTurn = Boolean(me && currentTurnPlayer && me.id === currentTurnPlayer.id);
  const canPlay = isMyTurn && !me?.isEliminated;

  const playersLeft = players.filter((p) => !p.isEliminated).length;

  return (
    <div className="min-h-dvh bg-canvas text-on-surface">
      <header className="fixed top-0 z-50 w-full bg-canvas shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-container items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="Retour"
              className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            {roomCode && <span className="text-label-lg text-accent">#{roomCode}</span>}
          </div>
          {round && totalRounds && (
            <h1 className="text-headline-md text-accent">
              Manche {round}/{totalRounds}
            </h1>
          )}
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto flex min-h-dvh max-w-container flex-col gap-6 px-4 pb-44 pt-20">
        {/* Turn banner : le seul repère de "c'est à qui" quand il n'y a pas d'écran commun. */}
        <section>
          <div
            className={[
              "flex items-center justify-center rounded-xl px-6 py-4 shadow-card",
              isMyTurn
                ? "border-b-4 border-[#00876a] bg-success"
                : "border-b-4 border-accent-edge bg-accent",
            ].join(" ")}
          >
            <span className="text-center text-headline-md text-white">
              {currentTurnPlayer
                ? isMyTurn
                  ? "🎯 À toi de jouer"
                  : `🎯 Au tour de ${currentTurnPlayer.name}`
                : "⏳ En attente…"}
            </span>
          </div>
        </section>

        <PlayerRail players={players} currentTurnPlayerId={currentTurnPlayer?.id ?? null} />

        <CountryTiles tiles={myCountryTiles} hint={regionHint} />

        <LastActionCard action={lastAction} />
      </main>

      <ActionBar
        isMyTurn={canPlay}
        turnOwnerName={currentTurnPlayer && !isMyTurn ? currentTurnPlayer.name : undefined}
        onAskLetter={() => setAskOpen(true)}
        onGuessCountry={() => setGuessOpen(true)}
      />

      <AskLetterModal
        open={askOpen}
        usedLetters={usedLetters}
        cost={letterCost}
        onClose={() => setAskOpen(false)}
        onConfirm={(letter) => {
          setAskOpen(false);
          onAskLetter?.(letter);
        }}
      />

      <GuessCountryModal
        open={guessOpen}
        tiles={myCountryTiles}
        playersLeft={playersLeft}
        onClose={() => setGuessOpen(false)}
        onConfirm={(guess) => {
          setGuessOpen(false);
          onGuessCountry?.(guess);
        }}
      />
    </div>
  );
}
