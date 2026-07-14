import type { MetadataRoute } from "next";

/**
 * Manifeste PWA.
 *
 * `display: "standalone"` est le point clé : sans lui, iOS ajoute bien l'app à
 * l'écran d'accueil mais la rouvre dans une vue Safari — barre d'URL en haut, barre
 * d'outils en bas, qui recouvre la navigation du jeu.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Guess the Country",
    short_name: "Guess Country",
    description: "Jeu de devinettes multijoueur. Un téléphone par joueur.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAFAF8",
    theme_color: "#FAFAF8",
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
