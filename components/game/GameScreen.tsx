"use client";

import { useState } from "react";
import type { CountryTile, GamePlayer, LastAction } from "@/lib/game/types";
import { PlayerRail } from "./PlayerRail";
import { CountryTiles } from "./CountryTiles";
import { LastActionCard } from "./LastActionCard";
import { ActionBar } from "./ActionBar";
import { AskLetterModal } from "./AskLetterModal";
import { GuessCountryModal } from "./GuessCountryModal";
import { SoundToggle } from "./SoundToggle";

export type GameScreenProps = {
  /** Joueur dont c'est le tour. `null` = partie en pause / transition. */
  currentTurnPlayer: GamePlayer | null;
  players: GamePlayer[];
  /** MON pays, tel que les autres l'ont découvert. Je le regarde s'éventer. */
  myCountryTiles: CountryTile[];
  /** Objet unique — jamais un tableau d'historique. */
  lastAction: LastAction | null;

  roomCode?: string;
  round?: number;
  totalRounds?: number;
  /** La région de MON pays (que j'ai choisi — donc aucun secret pour moi). */
  regionHint?: string;
  /** Le nom complet de MON pays — je l'ai choisi, ce n'est pas un secret pour moi. */
  myCountry?: string;
  letterCost?: number;

  onAskLetter?: (targetId: string, letter: string) => void;
  onGuessCountry?: (targetId: string, guess: string) => void;
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
  myCountry,
  letterCost = 50,
  onAskLetter,
  onGuessCountry,
  onBack,
}: GameScreenProps) {
  const [askOpen, setAskOpen] = useState(false);
  const [guessOpen, setGuessOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);

  const me = players.find((p) => p.isMe) ?? null;

  // Le tour vient d'une seule source : la prop. Aucun état local ne le duplique,
  // sinon deux téléphones pourraient se croire simultanément en tour.
  const isMyTurn = Boolean(me && currentTurnPlayer && me.id === currentTurnPlayer.id);
  const canPlay = isMyTurn && !me?.isEliminated;

  const target = players.find((p) => p.id === targetId) ?? null;
  // Une cible périmée (pays trouvé entre-temps) ne doit pas rester sélectionnée.
  const validTarget = target && !target.isCracked && !target.isMe ? target : null;

  const uncracked = players.filter((p) => !p.isCracked && !p.isMe).length;

  return (
    <div className="min-h-dvh bg-canvas text-on-surface">
      <header
        className="fixed top-0 z-50 w-full bg-canvas shadow-sm"
        // Fixé au viewport : le padding du body ne s'y applique pas, il passerait
        // sous la barre d'état.
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
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
          <SoundToggle />
        </div>
      </header>

      <main className="mx-auto flex min-h-dvh max-w-container flex-col gap-6 px-4 pb-44 pt-20">
        {/* Le seul repère de "c'est à qui" quand il n'y a pas d'écran commun. */}
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

        <PlayerRail
          players={players}
          currentTurnPlayerId={currentTurnPlayer?.id ?? null}
          selectedTargetId={validTarget?.id ?? null}
          onSelectTarget={setTargetId}
          canSelect={canPlay}
        />

        {/* Mon propre pays : je le connais, je le regarde se faire découvrir.
            Le bouton "œil" permet de le revoir à tout moment (voir CountryTiles). */}
        <CountryTiles
          tiles={myCountryTiles}
          hint={regionHint}
          title="Ton pays (ce que les autres ont trouvé)"
          fullCountry={myCountry}
        />

        <LastActionCard action={lastAction} />
      </main>

      <ActionBar
        isMyTurn={canPlay}
        hasTarget={Boolean(validTarget)}
        targetName={validTarget?.name}
        turnOwnerName={currentTurnPlayer && !isMyTurn ? currentTurnPlayer.name : undefined}
        outOfLetters={canPlay && (me?.lettersLeft ?? 0) <= 0}
        onAskLetter={() => setAskOpen(true)}
        onGuessCountry={() => setGuessOpen(true)}
      />

      {validTarget && (
        <>
          <AskLetterModal
            open={askOpen}
            targetName={validTarget.name}
            usedLetters={validTarget.askedLetters ?? []}
            cost={letterCost}
            onClose={() => setAskOpen(false)}
            onConfirm={(letter) => {
              setAskOpen(false);
              onAskLetter?.(validTarget.id, letter);
            }}
          />

          <GuessCountryModal
            open={guessOpen}
            targetName={validTarget.name}
            targetRegion={validTarget.region ?? undefined}
            tiles={(validTarget.masked ?? "").split("").map((ch) => ({
              letter: ch === "_" ? null : ch,
            }))}
            playersLeft={uncracked}
            onClose={() => setGuessOpen(false)}
            onConfirm={(guess) => {
              setGuessOpen(false);
              onGuessCountry?.(validTarget.id, guess);
            }}
          />
        </>
      )}
    </div>
  );
}
