const KEY = "guess-country:nickname";

/**
 * Le pseudo se saisit une fois. Il est relu à chaque retour sur l'accueil.
 *
 * localStorage et non un cookie : rien ici n'a besoin d'être connu du serveur — la
 * ligne `players` porte déjà le pseudo faisant foi, et c'est elle qui est diffusée aux
 * autres téléphones. Ceci n'est qu'un confort de saisie.
 */
export function loadNickname(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    // Safari en navigation privée peut lever sur localStorage : un pseudo vide est
    // un inconvénient, pas une panne.
    return "";
  }
}

export function saveNickname(nickname: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, nickname.trim());
  } catch {
    /* idem */
  }
}
