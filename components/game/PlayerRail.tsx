"use client";

import type { GamePlayer } from "@/lib/game/types";
import { isPhoto } from "@/lib/game/avatar";

/**
 * Rail des joueurs — et sélecteur de cible.
 *
 * C'est ici qu'on choisit QUI on interroge : la lettre demandée est cherchée dans le
 * pays de la cible. On y montre donc le mot de chacun en cours de révélation, sinon
 * on choisirait à l'aveugle.
 */
function PlayerCard({
  player,
  isActive,
  isSelected,
  selectable,
  onSelect,
}: {
  player: GamePlayer;
  isActive: boolean;
  isSelected: boolean;
  selectable: boolean;
  onSelect: () => void;
}) {
  const masked = player.masked ?? "";

  return (
    <button
      type="button"
      onClick={selectable ? onSelect : undefined}
      disabled={!selectable}
      aria-pressed={isSelected}
      className={[
        "flex w-36 flex-shrink-0 flex-col items-center gap-2 rounded-xl bg-white p-3 text-center transition-transform",
        isSelected
          ? "border-4 border-accent shadow-card"
          : isActive
            ? "border-4 border-accent/30 shadow-card"
            : "border-4 border-transparent shadow-card",
        player.isEliminated ? "opacity-40 grayscale" : "",
        selectable ? "active:scale-95" : "cursor-default",
      ].join(" ")}
    >
      <div className="relative">
        {/* L'avatar est soit une URL de photo, soit un emoji : sans ce test, un
            emoji atterrissait dans un src d'image et affichait une icône cassée. */}
        {isPhoto(player.avatarUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.avatarUrl!} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tile text-[24px]">
            {player.avatarUrl || player.name.charAt(0).toUpperCase()}
          </div>
        )}
        {isActive && (
          <div className="absolute -bottom-1 -right-1 rounded-full bg-accent p-1 text-white">
            <span className="material-symbols-outlined text-[14px] leading-none">
              hourglass_top
            </span>
          </div>
        )}
      </div>

      <span className="max-w-full truncate text-label-lg">
        {player.isMe ? "Toi" : player.name}
      </span>

      {/* Le pays en cours de révélation : c'est l'information de jeu, pas un ornement. */}
      {masked && (
        <span
          className={[
            "font-mono text-label-lg tracking-[0.2em]",
            player.isCracked ? "text-success" : "text-on-surface",
          ].join(" ")}
        >
          {masked}
        </span>
      )}

      {player.region && (
        <span className="text-label-md text-on-surface-variant">{player.region}</span>
      )}

      <span
        className={[
          "rounded-full px-2 py-0.5 text-label-md",
          player.isCracked
            ? "bg-secondary-container text-on-secondary-container"
            : isSelected
              ? "bg-primary-fixed text-on-primary-fixed"
              : "bg-surface-container-high text-on-surface-variant",
        ].join(" ")}
      >
        {player.isCracked
          ? "Trouvé"
          : player.isEliminated
            ? "Éliminé"
            : `${player.lettersLeft} lettre${player.lettersLeft > 1 ? "s" : ""}`}
      </span>
    </button>
  );
}

export function PlayerRail({
  players,
  currentTurnPlayerId,
  selectedTargetId,
  onSelectTarget,
  canSelect,
}: {
  players: GamePlayer[];
  currentTurnPlayerId: string | null;
  selectedTargetId: string | null;
  onSelectTarget: (id: string) => void;
  /** On ne choisit une cible que pendant son tour. */
  canSelect: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="ml-1 text-label-lg uppercase tracking-widest text-on-surface-variant">
        {canSelect ? "Qui veux-tu interroger ?" : "Joueurs"}
      </h3>
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {players.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            isActive={p.id === currentTurnPlayerId}
            isSelected={p.id === selectedTargetId}
            // On ne se vise pas soi-même, et un pays déjà trouvé n'est plus une cible.
            selectable={canSelect && !p.isMe && !p.isCracked}
            onSelect={() => onSelectTarget(p.id)}
          />
        ))}
      </div>
    </section>
  );
}
