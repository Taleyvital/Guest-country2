/** Types de la couche présentation. Découplés des rows Supabase à dessein :
 *  les composants doivent rester montables avec des données de mock. */

/** Un pays du pool jouable. La région sert d'indice public et de filtre de recherche. */
export type Country = {
  name: string;
  region: string;
};

export type GamePlayer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** Budget de questions restant à CE joueur. */
  lettersLeft: number;
  isMe?: boolean;
  isEliminated?: boolean;
  isBot?: boolean;

  /** Son pays, tel que la table l'a découvert : "BRA___". */
  masked?: string;
  /** Indice public : "Amérique du Sud". */
  region?: string | null;
  /** Lettres déjà demandées sur SON pays, par n'importe qui. */
  askedLetters?: string[];
  /** Son pays a été trouvé : ce n'est plus une cible valide. */
  isCracked?: boolean;
};

/** Une case du mot à deviner. `letter` est null tant que la lettre n'est pas révélée —
 *  le client ne reçoit jamais les lettres cachées, sinon la réponse fuiterait dans le DOM. */
export type CountryTile = {
  letter: string | null;
  state?: "hidden" | "revealed" | "correct" | "wrong";
};

/** "BRA___" -> tuiles. Les espaces (ex. "COREE DU SUD") ne sont pas à deviner. */
export function tilesFromMask(masked: string): CountryTile[] {
  return masked.split("").map((ch) => ({
    letter: ch === "_" ? null : ch,
    state: ch === "_" ? ("hidden" as const) : ("revealed" as const),
  }));
}

export type LastActionType = "ask_letter" | "guess" | "eliminated" | "turn_skipped";

/**
 * UN SEUL événement à la fois, jamais une liste.
 * `id` sert uniquement à rejouer l'animation quand l'action change.
 */
export type LastAction = {
  id: string;
  type: LastActionType;
  actorName: string;
  /** Cible de l'action — le joueur dont on sonde le pays. */
  targetName?: string | null;
  targetIsMe?: boolean;
  letter?: string | null;
  found?: boolean;
  guess?: string | null;
  correct?: boolean;
};
