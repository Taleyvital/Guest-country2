"use client";

export function ScoreBoard({ teamA, teamB }: { teamA: number; teamB: number }) {
  return (
    <div className="flex items-center justify-center gap-6 text-headline-md">
      <span className={teamA >= 10 ? "text-success" : ""}>Équipe A · {teamA}</span>
      <span className="text-on-surface-variant">—</span>
      <span className={teamB >= 10 ? "text-success" : ""}>Équipe B · {teamB}</span>
    </div>
  );
}
