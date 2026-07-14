// Types miroir du schéma (supabase/migrations/0001_init.sql).
// À terme, remplaçable par `supabase gen types typescript`.

export type GameStatus = "lobby" | "playing" | "finished";

/** Types d'action affichables dans le bandeau "Last Action". */
export type GameEventType = "ask_letter" | "guess" | "eliminated" | "turn_skipped";

export type Game = {
  id: string;
  code: string; // "XJ82" — code de room partagé à l'oral
  status: GameStatus;
  round: number;
  total_rounds: number;
  /** Joueur dont c'est le tour. Source de vérité du tour : le serveur, pas le téléphone. */
  current_player_id: string | null;
  host_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type Player = {
  id: string;
  game_id: string;
  /** auth.uid() du joueur (session anonyme Supabase). */
  user_id: string;
  nickname: string;
  avatar: string | null;
  is_host: boolean;
  is_ready: boolean;
  is_eliminated: boolean;
  score: number;
  /** Ordre de passage dans le tour de table. */
  seat: number;
  joined_at: string;
};

export type GameEvent = {
  id: string;
  game_id: string;
  type: GameEventType;
  /** Qui agit. */
  actor_id: string | null;
  /** Qui subit l'action (ex. "Yao asked YOU for 'E'"). Null si l'action ne vise personne. */
  target_id: string | null;
  /** Payload libre : { letter: "E", found: false } | { guess: "ARGENTINA", correct: false } */
  payload: Record<string, unknown>;
  created_at: string;
};

/** Le "last action" affiché : l'event enrichi des pseudos, pour éviter un join côté UI. */
export type LastAction = GameEvent & {
  actor_nickname: string | null;
  target_nickname: string | null;
};
