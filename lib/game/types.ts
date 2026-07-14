/** Types de la couche présentation. Découplés des rows Supabase à dessein :
 *  les composants doivent rester montables avec des données de mock. */

export type GamePlayer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  lettersLeft: number;
  isMe?: boolean;
  isEliminated?: boolean;
};

/** Une case du mot à deviner. `letter` est null tant que la lettre n'est pas révélée —
 *  le client ne reçoit jamais les lettres cachées, sinon la réponse fuiterait dans le DOM. */
export type CountryTile = {
  letter: string | null;
  state?: "hidden" | "revealed" | "correct" | "wrong";
};

export type LastActionType = "ask_letter" | "guess" | "eliminated" | "turn_skipped";

/**
 * UN SEUL événement à la fois, jamais une liste.
 * `id` sert uniquement à rejouer l'animation quand l'action change.
 */
export type LastAction = {
  id: string;
  type: LastActionType;
  actorName: string;
  /** Cible de l'action. `targetIsMe` permet d'écrire "asked you" plutôt que "asked Yao". */
  targetName?: string | null;
  targetIsMe?: boolean;
  letter?: string | null;
  found?: boolean;
  guess?: string | null;
  correct?: boolean;
};
