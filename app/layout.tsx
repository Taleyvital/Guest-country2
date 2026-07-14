import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Guess the Country",
  description: "Jeu de devinettes multijoueur, un téléphone par joueur.",
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
