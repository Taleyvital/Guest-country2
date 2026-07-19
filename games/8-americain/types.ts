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
  /** Nombre de manches avant la fin forcée de la partie (le seuil de pénalité peut aussi y mettre fin plus tôt). */
  max_rounds: number;
  /** +1 horaire, -1 anti-horaire. Basculé par le 10. */
  direction: 1 | -1;
  current_player_id: string | null;
  /** Couleur demandée en ce moment (celle de top_card, ou choisie via un 8). */
  current_color: Suit | null;
  top_card: string | null;
  /** Cartes restantes dans la pioche : public, jamais leur ordre (americain_state). */
  deck_count: number;
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
  /** Joueur artificiel : ses coups sont joués côté serveur (resolve-bot-turn). */
  is_bot: boolean;
};

export type AmericainHand = {
  player_id: string;
  cards: Card[];
};

export type AmericainEventType = "round_won" | "game_won";

export type AmericainEvent = {
  id: string;
  game_id: string;
  type: AmericainEventType;
  /** Le gagnant : de la manche (round_won), ou de la partie au global (game_won). */
  actor_id: string | null;
  /** Dernière place au global — uniquement sur game_won. */
  target_id: string | null;
  payload: { penalties?: Record<string, number> };
  created_at: string;
};
