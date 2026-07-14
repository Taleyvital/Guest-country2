/**
 * Un .env.local non rempli est le cas d'échec le plus courant au démarrage, et le
 * plus opaque : le bouton "ne fait rien". On préfère le dire à l'écran.
 */
export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return Boolean(
    url &&
      key &&
      !url.includes("your-project") &&
      !key.includes("your-anon-key"),
  );
}
