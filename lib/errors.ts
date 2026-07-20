/**
 * Les erreurs Supabase (PostgrestError, AuthError) ne sont PAS des instances d'Error :
 * ce sont des objets nus `{ message, code, details, hint }`. Un `String(e)` les rend
 * donc en "[object Object]" — ce qu'on affichait à l'utilisateur.
 *
 * Traduit au passage les erreurs levées par nos RPC en messages lisibles.
 */
const FALLBACK = "Une erreur est survenue.";

export function errorMessage(e: unknown): string {
  let raw =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e !== null && "message" in e
        ? String((e as { message: unknown }).message)
        : typeof e === "string"
          ? e
          : FALLBACK;

  // Un message vide, "{}" ou "[object Object]" ne veut rien dire pour
  // l'utilisateur : ça arrive quand le serveur répond avec un corps JSON
  // vide/malformé et que le SDK finit par stringifier l'objet brut plutôt
  // que d'extraire un vrai message.
  if (!raw.trim() || raw === "{}" || raw === "[object Object]") {
    raw = FALLBACK;
  }

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
    "Signups not allowed for otp": "Aucun compte n’existe avec cet e-mail.",
    "Token has expired or is invalid": "Ce code a expiré ou est invalide. Redemandes-en un.",
    "A user with this email address has already been registered":
      "Cet e-mail est déjà lié à un autre compte.",

    // --- James ---
    "table full": "Cette table est complète.",
    "james needs exactly 4 players": "James se joue à exactement 4 joueurs.",
    "everyone must be ready": "Tout le monde doit être prêt.",
    "card not in hand": "Cette carte n’est pas dans ta main.",
    "no four of a kind": "Tu n’as pas encore 4 cartes de la même couleur.",
    "call not found": "Cet appel n’existe plus.",
    "not your call to confirm": "Ce n’est pas à toi de confirmer cet appel.",

    // --- 8 Américain ---
    "card not playable": "Cette carte ne peut pas être jouée maintenant.",
    "must choose a color for the 8": "Choisis une couleur pour le 8.",
    "no cards left to draw": "Plus aucune carte à piocher.",

    // --- Bots ---
    "only the host can fill with bots": "Seul l’hôte peut compléter avec des bots.",
    "invalid player count": "Nombre de joueurs invalide.",
  };

  for (const [needle, message] of Object.entries(known)) {
    if (raw.includes(needle)) return message;
  }

  return raw;
}
