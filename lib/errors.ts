/**
 * Les erreurs Supabase (PostgrestError, AuthError) ne sont PAS des instances d'Error :
 * ce sont des objets nus `{ message, code, details, hint }`. Un `String(e)` les rend
 * donc en "[object Object]" — ce qu'on affichait à l'utilisateur.
 *
 * Traduit au passage les erreurs levées par nos RPC en messages lisibles.
 */
export function errorMessage(e: unknown): string {
  const raw =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e !== null && "message" in e
        ? String((e as { message: unknown }).message)
        : typeof e === "string"
          ? e
          : "Une erreur est survenue.";

  const known: Record<string, string> = {
    "game not found": "Aucune partie avec ce code.",
    "game already started": "Cette partie a déjà commencé, tu ne peux plus la rejoindre.",
    "game is over": "Cette partie est terminée.",
    "not your turn": "Ce n’est plus ton tour.",
    "not in a lobby": "Tu n’es dans aucune partie en attente.",
    "unknown country": "Ce pays n’est pas dans la liste jouable.",
    "no letters left": "Tu n’as plus de questions pour cette manche.",
    "letter already asked on this player": "Cette lettre a déjà été demandée sur ce joueur.",
    "this country is already found": "Ce pays a déjà été trouvé.",
    "cannot target yourself": "Tu ne peux pas t’interroger toi-même.",
    "only the host can start the game": "Seul l’hôte peut lancer la partie.",
    "need at least 2 players": "Il faut au moins 2 joueurs.",
    "everyone must pick a country": "Tout le monde doit d’abord choisir un pays.",
    "Anonymous sign-ins are disabled":
      "Active les sessions anonymes dans Supabase (Auth > Providers).",
  };

  for (const [needle, message] of Object.entries(known)) {
    if (raw.includes(needle)) return message;
  }

  return raw;
}
