import { isPhoto } from "@/lib/game/avatar";
import type { Player } from "@/lib/supabase/types";

/** Pastille avatar : photo (URL) ou emoji, selon ce que porte players.avatar. */
export function Avatar({ player, size = 40 }: { player: Player; size?: number }) {
  const s = `${size}px`;
  if (isPhoto(player.avatar)) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={player.avatar!}
        alt=""
        style={{ width: s, height: s }}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <span style={{ fontSize: `${size * 0.7}px`, lineHeight: 1 }}>{player.avatar ?? "🌍"}</span>
  );
}
