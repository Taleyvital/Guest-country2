"use client";

import { useState } from "react";
import { GameScreen } from "@/components/game/GameScreen";
import { tilesFromMask, type GamePlayer, type LastAction } from "@/lib/game/types";

const POOL = ["BRESIL", "ITALIE", "JAPON", "MAROC", "CANADA", "SUEDE"];

/** Démo locale de GameScreen, sans Supabase : sert à valider le rendu et le flux. */
export default function GameDemoPage() {
  const [players, setPlayers] = useState<GamePlayer[]>([
    { id: "p1", name: "Marie", lettersLeft: 6, masked: "______", region: "Europe", askedLetters: [] },
    { id: "p2", name: "Yao", lettersLeft: 6, masked: "_____", region: "Asie", askedLetters: [] },
    { id: "p3", name: "Alex", lettersLeft: 6, isMe: true, masked: "BRA___", region: "Amérique du Sud", askedLetters: ["B", "R", "A", "E"] },
  ]);
  const [turnIndex, setTurnIndex] = useState(2); // c'est mon tour, pour tester les actions
  const [lastAction, setLastAction] = useState<LastAction | null>(null);

  // Le "vrai" pays de chaque joueur ne vit ici que parce qu'on est en démo :
  // en production il est dans player_secrets et ne descend jamais au client.
  const SECRETS: Record<string, string> = { p1: "ITALIE", p2: "JAPON", p3: "BRESIL" };

  const me = players.find((p) => p.isMe)!;
  const currentTurnPlayer = players[turnIndex];

  const nextTurn = () => setTurnIndex((i) => (i + 1) % players.length);

  const askLetter = (targetId: string, letter: string) => {
    const secret = SECRETS[targetId];
    const found = secret.includes(letter);

    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const revealed = [...(p.askedLetters ?? []), letter].filter((l) => secret.includes(l));
          return {
            ...p,
            askedLetters: [...(p.askedLetters ?? []), letter],
            masked: secret
              .split("")
              .map((ch) => (revealed.includes(ch) ? ch : "_"))
              .join(""),
          };
        }
        if (p.isMe) return { ...p, lettersLeft: p.lettersLeft - 1 };
        return p;
      }),
    );

    // Remplacement, pas empilement : setLastAction reçoit un objet, jamais un spread
    // du précédent. C'est ici qu'un historique se serait accumulé.
    setLastAction({
      id: `${performance.now()}`,
      type: "ask_letter",
      actorName: me.name,
      targetName: players.find((p) => p.id === targetId)?.name,
      letter,
      found,
    });
    nextTurn();
  };

  const guess = (targetId: string, value: string) => {
    const correct = value === SECRETS[targetId];
    const targetName = players.find((p) => p.id === targetId)?.name;

    if (correct) {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === targetId ? { ...p, isCracked: true, masked: SECRETS[targetId] } : p,
        ),
      );
    } else {
      setPlayers((prev) => prev.map((p) => (p.isMe ? { ...p, isEliminated: true } : p)));
    }

    setLastAction({
      id: `${performance.now()}`,
      type: correct ? "guess" : "eliminated",
      actorName: me.name,
      targetName,
      guess: value,
      correct,
    });
    nextTurn();
  };

  return (
    <>
      <GameScreen
        currentTurnPlayer={currentTurnPlayer}
        players={players}
        myCountryTiles={tilesFromMask(me.masked ?? "")}
        lastAction={lastAction}
        roomCode="XJ82"
        round={3}
        totalRounds={5}
        regionHint={me.region ?? undefined}
        countries={POOL}
        onAskLetter={askLetter}
        onGuessCountry={guess}
      />

      <button
        type="button"
        onClick={nextTurn}
        className="fixed right-3 top-20 z-[70] rounded-full bg-inverse-surface px-3 py-1 text-label-md text-inverse-on-surface opacity-70"
      >
        dev: tour suivant
      </button>
    </>
  );
}
