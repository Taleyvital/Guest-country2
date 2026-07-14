const KEY = "guess-country:profile";

export type Profile = {
  nickname: string;
  /** Un emoji : pas d'upload, pas de stockage, pas de modération. */
  avatar: string;
};

export const AVATARS = [
  "🦊", "🐼", "🦁", "🐨", "🐸", "🦉", "🐙", "🦩",
  "🐳", "🦄", "🐝", "🦖", "🐧", "🦔", "🐢", "🦥",
];

/**
 * Le profil vit sur le téléphone (localStorage), pas dans un compte : on veut jouer
 * en dix secondes autour d'une table, sans inscription. La ligne `players` porte le
 * pseudo faisant foi une fois en partie ; ceci n'est que la valeur par défaut.
 *
 * Un compte (e-mail) n'est proposé qu'APRÈS une partie, pour conserver ses scores —
 * jamais comme préalable à jouer.
 */
export function loadProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    if (!parsed.nickname) return null;
    return { nickname: parsed.nickname, avatar: parsed.avatar || AVATARS[0] };
  } catch {
    // localStorage indisponible (Safari privé) ou JSON corrompu : on repart de zéro
    // plutôt que de planter l'accueil.
    return null;
  }
}

export function saveProfile(profile: Profile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* voir ci-dessus */
  }
}
