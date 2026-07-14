"use client";

import { useState } from "react";
import { GameScreen } from "@/components/game/GameScreen";
import type { CountryTile, GamePlayer, LastAction } from "@/lib/game/types";

/**
 * Page de démo : branche GameScreen sur un état local pour valider le rendu et les
 * interactions sans Supabase. À remplacer par les données de useGameChannel.
 */
export default function GameDemoPage() {
  const players: GamePlayer[] = [
    { id: "p1", name: "Marie", lettersLeft: 6 },
    { id: "p2", name: "Yao", lettersLeft: 6 },
    { id: "p3", name: "Alex", lettersLeft: 6, isMe: true },
  ];

  const [turnIndex, setTurnIndex] = useState(0);
  const [tiles, setTiles] = useState<CountryTile[]>([
    { letter: "B" },
    { letter: "R" },
    { letter: "A" },
    { letter: null },
    { letter: null },
    { letter: null },
  ]);
  const [usedLetters, setUsedLetters] = useState(["A", "B", "R", "E"]);
  const [lastAction, setLastAction] = useState<LastAction | null>({
    id: "seed",
    type: "ask_letter",
    actorName: "Yao",
    targetIsMe: true,
    letter: "E",
    found: false,
  });

  const currentTurnPlayer = players[turnIndex];
  const me = players.find((p) => p.isMe)!;
  const secret = "BRAZIL";

  const handleAskLetter = (letter: string) => {
    const found = secret.includes(letter);

    if (found) {
      setTiles((prev) =>
        prev.map((tile, i) =>
          secret[i] === letter ? { letter, state: "correct" as const } : tile,
        ),
      );
    }
    setUsedLetters((prev) => [...prev, letter]);

    // Remplacement, pas empilement : setLastAction reçoit un objet, pas un spread
    // du précédent. C'est ici que l'historique se serait accumulé si on avait
    // utilisé un tableau.
    setLastAction({
      id: `${Date.now()}`,
      type: "ask_letter",
      actorName: me.name,
      targetName: "Marie",
      letter,
      found,
    });

    setTurnIndex((i) => (i + 1) % players.length);
  };

  const handleGuess = (guess: string) => {
    const correct = guess.trim().toUpperCase() === secret;

    setLastAction({
      id: `${Date.now()}`,
      type: correct ? "guess" : "eliminated",
      actorName: me.name,
      guess: guess.trim().toUpperCase(),
      correct,
    });

    if (correct) setTiles(secret.split("").map((l) => ({ letter: l, state: "correct" as const })));
    setTurnIndex((i) => (i + 1) % players.length);
  };

  return (
    <>
      <GameScreen
        currentTurnPlayer={currentTurnPlayer}
        players={players}
        myCountryTiles={tiles}
        lastAction={lastAction}
        roomCode="XJ82"
        round={3}
        totalRounds={5}
        regionHint="South America"
        usedLetters={usedLetters}
        onAskLetter={handleAskLetter}
        onGuessCountry={handleGuess}
      />

      {/* Aide de dev : forcer le tour pour vérifier l'état désactivé des boutons. */}
      <button
        type="button"
        onClick={() => setTurnIndex((i) => (i + 1) % players.length)}
        className="fixed right-3 top-20 z-[70] rounded-full bg-inverse-surface px-3 py-1 text-label-md text-inverse-on-surface opacity-70"
      >
        dev: next turn
      </button>
    </>
  );
}
