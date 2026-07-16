/** Types miroir du schéma (supabase/migrations/0016_americain.sql). */

import type { GameStatus } from "@/games/shared/types";

export type AmericainStatus = GameStatus;
export type DrawMode = "unlimited" | "single";
export type Suit = "S" | "H" | "D" | "C";

/** "H:10" (couleur:valeur). */
export type Card = string;

export type AmericainGame = {
  id: string;
  code: string;
  status: AmericainStatus;
  host_id: string | null;
  max_players: number;
  draw_mode: DrawMode;
  penalty_threshold: number;
  /** +1 horaire, -1 anti-horaire. Basculé par le 10. */
  direction: 1 | -1;
  current_player_id: string | null;
  /** Couleur demandée en ce moment (celle de top_card, ou choisie via un 8). */
  current_color: Suit | null;
  top_card: string | null;
  round: number;
  next_dealer_seat: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type AmericainPlayer = {
  id: string;
  game_id: string;
  user_id: string;
  nickname: string;
  avatar: string | null;
  is_host: boolean;
  is_ready: boolean;
  seat: number;
  /** Combien de cartes il a en main : public. Jamais lesquelles. */
  hand_count: number;
  /** Pénalité cumulée sur toute la partie. Le plus bas gagne. */
  penalty_score: number;
  joined_at: string;
};

export type AmericainHand = {
  player_id: string;
  cards: Card[];
};
