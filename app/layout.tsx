import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { AudioUnlock } from "@/components/AudioUnlock";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Guess the Country",
  description: "Jeu de devinettes multijoueur, un téléphone par joueur.",

  // Le déclencheur du mode standalone sur iOS. Le `display: "standalone"` du
  // manifeste ne suffit pas sur toutes les versions : sans cette meta, l'app
  // ajoutée à l'écran d'accueil se rouvre dans une vue Safari, avec la barre d'URL
  // en haut et la barre d'outils en bas par-dessus la navigation.
  appleWebApp: {
    capable: true,
    title: "Guess Country",
    statusBarStyle: "default",
  },

  // iOS n'utilise PAS les icônes du manifeste : il lui faut un apple-touch-icon,
  // sinon il colle une capture d'écran de la page sur l'écran d'accueil.
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// Jeu tenu en main : pas de zoom, on respecte les safe areas iOS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#FAFAF8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={jakarta.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
        />
      </head>
      <body className="min-h-dvh font-sans">
        {children}
        <BottomNav />
        <AudioUnlock />

        {/* Affiché uniquement en paysage sur mobile (voir globals.css). */}
        <div
          id="rotate-device"
          className="fixed inset-0 z-[100] hidden flex-col items-center justify-center gap-4 bg-canvas p-6 text-center"
        >
          <span className="material-symbols-outlined text-[48px] text-accent">
            screen_rotation
          </span>
          <p className="text-headline-md text-on-surface">Tourne ton téléphone</p>
          <p className="text-body-md text-on-surface-variant">
            Le jeu se joue en mode portrait.
          </p>
        </div>
      </body>
    </html>
  );
}
