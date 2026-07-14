import { getSupabaseBrowserClient, ensureAnonymousSession } from "@/lib/supabase/client";

/**
 * Un avatar est SOIT un emoji, SOIT une URL de photo. La colonne `players.avatar` est
 * un simple texte diffusé à toute la table : c'est ce test qui décide si l'UI affiche
 * une <img> ou un caractère. Sans lui, un emoji finit dans un src d'image et donne une
 * icône cassée.
 */
export function isPhoto(avatar?: string | null): boolean {
  return Boolean(avatar && /^https?:\/\//.test(avatar));
}

/**
 * Redimensionne et recadre en carré 256px, sortie JPEG qualité 0.85.
 *
 * Fait AVANT l'envoi : une photo d'iPhone pèse 3 à 5 Mo, alors qu'elle est affichée
 * dans une pastille de 48px. Sans ça, on ferait payer un upload de plusieurs Mo à
 * quelqu'un en 4G autour d'une table, pour rien.
 */
async function toSquareJpeg(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  // Recadrage centré : on prend le plus grand carré possible, sans déformer.
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de préparer l’image.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Impossible de compresser l’image.");
  return blob;
}

/** Envoie la photo et renvoie son URL publique. */
export async function uploadAvatar(file: File): Promise<string> {
  const session = await ensureAnonymousSession();
  if (!session) throw new Error("Session indisponible.");

  const supabase = getSupabaseBrowserClient();
  const blob = await toSquareJpeg(file);

  // Chemin imposé par la policy : <uid>/photo.jpg. Toujours le même nom, donc
  // changer de photo écrase l'ancienne au lieu d'empiler des fichiers orphelins.
  const path = `${session.user.id}/photo.jpg`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);

  // Le nom de fichier est stable, donc le CDN servirait l'ancienne image après un
  // changement : le cache-buster force le rafraîchissement.
  return `${data.publicUrl}?v=${Date.now()}`;
}
