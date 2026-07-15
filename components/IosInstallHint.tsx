"use client";

import { useEffect, useState } from "react";

/** iOS Safari, pas encore installé sur l'écran d'accueil ? */
function needsInstall(): boolean {
  if (typeof window === "undefined") return false;

  const ua = window.navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  if (!isIOS) return false;

  // `standalone` n'existe que sur iOS Safari ; true = déjà installé.
  const standalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  return !standalone;
}

/**
 * Sur iOS, les push n'existent QUE si l'app est installée via « Ajouter à l'écran
 * d'accueil » (Safari 16.4+). On invite donc explicitement à l'installer, avec les
 * gestes exacts — sinon l'utilisateur ne trouve pas.
 */
export function IosInstallHint() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(needsInstall()), []);
  if (!show) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-primary-fixed p-4 text-on-primary-fixed">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined">ios_share</span>
        <span className="text-body-lg font-bold">Installe l’app pour les alertes</span>
      </div>
      <p className="text-body-md">
        Sur iPhone, les notifications ne marchent qu’une fois l’app ajoutée à l’écran
        d’accueil :
      </p>
      <ol className="flex flex-col gap-1 text-body-md">
        <li>
          1. Touche <span className="font-bold">Partager</span>{" "}
          <span className="material-symbols-outlined align-middle text-[18px]">
            ios_share
          </span>{" "}
          en bas de Safari.
        </li>
        <li>
          2. Choisis <span className="font-bold">« Sur l’écran d’accueil »</span>{" "}
          <span className="material-symbols-outlined align-middle text-[18px]">
            add_box
          </span>
          .
        </li>
        <li>3. Rouvre l’app depuis l’icône, puis réactive les alertes ici.</li>
      </ol>
    </div>
  );
}
