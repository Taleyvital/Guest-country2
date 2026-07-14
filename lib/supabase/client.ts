"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Client Supabase navigateur (singleton).
 * Singleton volontaire : chaque instance ouvre sa propre socket Realtime,
 * et on veut UNE socket par téléphone, pas une par composant monté.
 */
export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}

/**
 * Chaque joueur est une session anonyme : pas de compte à créer avant de rejoindre
 * une partie, mais un auth.uid() stable sur lequel les policies RLS peuvent s'appuyer.
 * Prérequis : activer "Anonymous sign-ins" dans Auth > Providers.
 */
export async function ensureAnonymousSession() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signed.session;
}
