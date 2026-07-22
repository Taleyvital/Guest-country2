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
  /** Début du tour en cours — sert de base au décompte de 20s côté client. */
  turn_started_at: string | null;
  /** Entre deux manches : chacun rechoisit son pays, la manche suivante démarre seule. */
  intermission: boolean;
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

  /**
   * MON pays, tel que les autres l'ont découvert : "BRA___". C'est la SEULE
   * représentation du pays qui descend jusqu'au client — le mot complet vit dans
   * `player_secrets`, table sans aucune policy RLS, inaccessible au navigateur.
   */
  masked: string;
  /** Indice public : "Amérique du Sud". */
  region: string | null;
  /** Lettres déjà demandées SUR ce pays, par n'importe qui. Public. */
  asked_letters: string[];
  revealed_letters: string[];
  /** Mon pays a été trouvé : je ne suis plus une cible valide. */
  is_cracked: boolean;
  /** Mon budget de questions pour la manche. */
  letters_left: number;
  /** A choisi son pays : condition pour lancer la partie. */
  has_picked: boolean;
  /** Joueur artificiel (mode "compléter avec des bots") : ses coups sont joués
   *  côté serveur par l'Edge Function resolve-bot-turn. */
  is_bot: boolean;
  /** Résultat du dé (1-6) qui décide qui commence la partie. Null tant qu'il n'a pas lancé. */
  dice_roll: number | null;

  // --- Compteurs de partie (cumulés sur toutes les manches, pour le résumé). ---
  /** Pays devinés durant cette partie. */
  found_count: number;
  /** Tentatives d'identification (justes + ratées). */
  guess_count: number;
  /** Lettres demandées durant cette partie. */
  letters_count: number;
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
