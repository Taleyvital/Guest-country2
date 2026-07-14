"use client";

import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/", icon: "videogame_asset", label: "Jouer" },
  { href: "/discoveries", icon: "travel_explore", label: "Carnet" },
  { href: "/profile", icon: "person", label: "Profil" },
];

/**
 * Barre de navigation basse.
 *
 * Absente des écrans de partie (`/room/...`), volontairement : le bas de l'écran y est
 * occupé par les actions de jeu, et la maquette Stitch la supprime pour la même raison
 * ("suppressed on this task-focused screen to prioritize game controls"). Une nav
 * permanente y ferait aussi quitter une partie en cours d'un pouce distrait.
 *
 * Absente aussi de l'onboarding : tant qu'il n'y a pas de profil, il n'y a nulle part
 * où naviguer.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const hidden = pathname.startsWith("/room") || pathname.startsWith("/onboarding");
  if (hidden) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 z-40 w-full border-t border-outline-variant/20 bg-canvas"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-container">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => router.push(tab.href)}
              aria-current={active ? "page" : undefined}
              className={[
                "flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors",
                active ? "text-accent" : "text-on-surface-variant",
              ].join(" ")}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontVariationSettings: active
                    ? "'FILL' 1, 'wght' 500"
                    : "'FILL' 0, 'wght' 400",
                }}
              >
                {tab.icon}
              </span>
              <span className="text-label-md">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
