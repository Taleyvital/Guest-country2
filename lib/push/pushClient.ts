"use client";

import { ensureAnonymousSession, getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Client de notifications push. Système INDÉPENDANT du son.
 *
 * Toutes les fonctions sont défensives : les push sont un bonus. Un refus, un
 * navigateur non compatible ou une clé VAPID absente ne lèvent pas — ils renvoient un
 * état, jamais une exception qui remonterait dans le jeu.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushState = "unsupported" | "denied" | "granted" | "default" | "no-vapid";

/** Le navigateur sait-il faire des push web ? (iOS < 16.4 et non installé : non.) */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): PushState {
  if (!isPushSupported()) return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "no-vapid";
  return Notification.permission as PushState;
}

// La clé VAPID publique est en base64url ; l'API Push attend un Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Demande la permission puis enregistre l'abonnement en base. Idempotent : ré-appelé,
 * il réutilise l'abonnement existant. Renvoie l'état final, sans jamais throw.
 */
export async function enablePush(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "no-vapid";

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return permission as PushState;

    // Le SW doit être actif avant de s'abonner.
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // cast via unknown : selon la version de lib.dom, Uint8Array<ArrayBufferLike>
        // n'unifie pas avec BufferSource. La valeur runtime est un Uint8Array valide.
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      }));

    const session = await ensureAnonymousSession();
    if (!session) return "granted";

    const json = subscription.toJSON();
    const supabase = getSupabaseBrowserClient();
    // upsert sur endpoint (PK) : ré-abonner le même appareil met à jour, n'empile pas.
    await supabase.from("push_subscriptions").upsert(
      {
        endpoint: json.endpoint!,
        user_id: session.user.id,
        subscription: json,
      },
      { onConflict: "endpoint" },
    );

    return "granted";
  } catch {
    // Compatibilité, réseau, VAPID invalide : on renvoie l'état courant sans casser.
    return pushPermission();
  }
}
