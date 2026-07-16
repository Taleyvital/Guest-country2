/** Types miroir du schéma (supabase/migrations/0015_james.sql). */

import type { GameStatus } from "@/games/shared/types";

export type JamesStatus = GameStatus;

export type Suit = "S" | "H" | "D" | "C";

/** "S:A" (couleur:valeur) ou "JOKER". La valeur n'entre jamais en jeu. */
export type Card = string;

export type Team = "A" | "B";

export type JamesGame = {
  id: string;
  code: string;
  status: JamesStatus;
  host_id: string | null;
  team_a_score: number;
  team_b_score: number;
  round: number;
  next_dealer_seat: number;
  /** Le joueur qui porte les 5 cartes en ce moment : lui seul peut passer. */
  current_holder_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type JamesPlayer = {
  id: string;
  game_id: string;
  user_id: string;
  nickname: string;
  avatar: string | null;
  is_host: boolean;
  is_ready: boolean;
  /** 0..3 autour de la table. 0/2 = équipe A, 1/3 = équipe B, jamais adjacents. */
  position: number;
  team: Team;
  joined_at: string;
};

export type JamesHand = {
  player_id: string;
  cards: Card[];
};

export type JamesEventType = "card_passed" | "point_scored" | "new_deal";

export type JamesEvent = {
  id: string;
  game_id: string;
  type: JamesEventType;
  actor_id: string | null;
  target_id: string | null;
  payload: { team?: Team; team_a_score?: number; team_b_score?: number };
  created_at: string;
};

export type JamesCallStatus = "pending" | "confirmed" | "expired" | "superseded";

/** Un appel "James" — visible UNIQUEMENT par son auteur et le partenaire ciblé
 *  (RLS), jamais par les adversaires : c'est ce qui garantit la discrétion. */
export type JamesCall = {
  id: string;
  game_id: string;
  round: number;
  caller_id: string;
  team: Team;
  target_partner_id: string;
  called_at: string;
  expires_at: string;
  confirmed_at: string | null;
  status: JamesCallStatus;
};
