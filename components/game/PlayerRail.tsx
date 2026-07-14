import type { GamePlayer } from "@/lib/game/types";

function PlayerCard({ player, isActive }: { player: GamePlayer; isActive: boolean }) {
  return (
    <div
      className={[
        "flex w-32 flex-shrink-0 flex-col items-center gap-2 rounded-xl bg-white p-3 transition-transform",
        isActive
          ? "border-4 border-accent shadow-card"
          : "border-4 border-transparent shadow-card",
        player.isEliminated ? "opacity-40 grayscale" : "",
      ].join(" ")}
    >
      <div className="relative">
        {player.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.avatarUrl}
            alt=""
            className={[
              "h-14 w-14 rounded-full object-cover",
              isActive ? "border-2 border-accent" : "",
            ].join(" ")}
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tile text-headline-md text-on-surface-variant">
            {player.name.charAt(0).toUpperCase()}
          </div>
        )}
        {isActive && (
          <div className="absolute -bottom-1 -right-1 rounded-full bg-accent p-1 text-white">
            <span className="material-symbols-outlined text-[14px] leading-none">edit</span>
          </div>
        )}
      </div>

      <span className="max-w-full truncate text-label-lg">
        {player.isMe ? "You" : player.name}
      </span>

      <span
        className={[
          "rounded-full px-2 py-0.5 text-label-md",
          isActive
            ? "bg-primary-fixed text-on-primary-fixed"
            : "bg-surface-container-high text-on-surface-variant",
        ].join(" ")}
      >
        {player.lettersLeft} letters left
      </span>
    </div>
  );
}

export function PlayerRail({
  players,
  currentTurnPlayerId,
}: {
  players: GamePlayer[];
  currentTurnPlayerId: string | null;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="ml-1 text-label-lg uppercase tracking-widest text-on-surface-variant">
        Players
      </h3>
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {players.map((p) => (
          <PlayerCard key={p.id} player={p} isActive={p.id === currentTurnPlayerId} />
        ))}
      </div>
    </section>
  );
}
