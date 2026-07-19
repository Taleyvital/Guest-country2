"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { isPlayable } from "../engine";
import { PlayingCard } from "./PlayingCard";
import type { Card, Suit } from "../types";

/** Éventail de cartes en main, en overlap avec un léger arc (les cartes du
 *  centre remontent un peu plus que celles des bords, comme un vrai jeu tenu
 *  en main). Les cartes jouables se détachent (soulevées, halo violet) ; les
 *  autres restent au ras, grisées — pas besoin de les griser une à une au
 *  clic, l'oeil comprend tout de suite ce qui est disponible.
 *
 *  L'ordre des cartes n'a AUCUN sens de jeu (c'est juste l'ordre où elles sont
 *  arrivées côté serveur) : on laisse chacun ranger sa main comme il veut par
 *  glisser-déposer, comme avec de vraies cartes. Purement client, persisté en
 *  local par joueur+partie. */
export function Hand({
  cards,
  isMyTurn,
  currentColor,
  topCard,
  onPlay,
  storageKey,
}: {
  cards: Card[];
  isMyTurn: boolean;
  currentColor: Suit | null;
  topCard: string | null;
  onPlay: (card: Card) => void;
  /** Clé de persistance de l'ordre perso (ex. `${gameId}:${playerId}`). */
  storageKey?: string;
}) {
  const [order, setOrder] = useState<Card[]>(cards);

  // Reconcilie avec le serveur (carte jouée disparaît, carte piochée arrive)
  // sans jamais perdre le rangement perso des cartes qui restent.
  useEffect(() => {
    setOrder((prev) => {
      const kept = prev.filter((c) => cards.includes(c));
      const added = cards.filter((c) => !prev.includes(c));
      return [...kept, ...added];
    });
  }, [cards]);

  // Rangement sauvegardé, rechargé une fois au montage.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Card[];
      setOrder((prev) => {
        const kept = saved.filter((c) => prev.includes(c));
        const rest = prev.filter((c) => !kept.includes(c));
        return [...kept, ...rest];
      });
    } catch {
      // localStorage indisponible / corrompu : tant pis, ordre par défaut.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(order));
    } catch {
      // quota / navigation privée : tant pis, juste pas persisté.
    }
  }, [order, storageKey]);

  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const drag = useRef<{ index: number; startX: number; startY: number; moved: boolean } | null>(
    null,
  );
  const justDragged = useRef(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const mid = (order.length - 1) / 2;

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, index: number) {
    drag.current = { index, startX: e.clientX, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 6) d.moved = true;
    if (!d.moved) return;

    setDragIndex(d.index);
    setDragOffset(dx);

    // Réordonne en direct : la carte glissée prend la place d'une autre carte
    // uniquement quand le doigt a FRANCHI le centre de celle-ci (jamais "la
    // plus proche" : la carte glissée suit déjà le doigt, et sa voisine serait
    // sinon toujours élue au moindre pixel — swaps en boucle). Le franchissement
    // donne une hystérésis naturelle : pas de retour en arrière tant qu'on ne
    // re-croise pas un centre.
    let target = d.index;
    let bestDist = Infinity;
    cardRefs.current.forEach((el, i) => {
      if (!el || i === d.index || i >= order.length) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const crossed = i > d.index ? e.clientX > centerX : e.clientX < centerX;
      if (!crossed) return;
      const dist = Math.abs(centerX - e.clientX);
      if (dist < bestDist) {
        bestDist = dist;
        target = i;
      }
    });

    if (target !== d.index) {
      // Capture l'index AVANT de le réassigner : l'updater de setOrder ne
      // s'exécute qu'au render suivant, et lirait sinon le d.index déjà mis à
      // jour — splice(target) + insert(target), soit aucun déplacement.
      const from = d.index;
      setOrder((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(target, 0, moved);
        return next;
      });
      d.index = target;
      d.startX = e.clientX;
      setDragOffset(0);
    }
  }

  function onPointerUp() {
    if (drag.current) justDragged.current = drag.current.moved;
    drag.current = null;
    setDragIndex(null);
    setDragOffset(0);
  }

  return (
    <div className="flex justify-center pb-2 pt-4">
      <div className="flex items-end" style={{ paddingInline: "1.5rem" }}>
        {order.map((card, i) => {
          const playable = isMyTurn && isPlayable(card, currentColor, topCard);
          const offset = i - mid;
          const angle = offset * 8;
          // Arc : le milieu de la main remonte, les bords retombent un peu.
          const arc = Math.abs(offset) * Math.abs(offset) * 2;
          const isDragging = dragIndex === i;

          return (
            <div
              key={card}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              role="button"
              aria-label={`${card}, ${playable ? "jouable" : "glisser pour ranger"}`}
              aria-disabled={!playable}
              onPointerDown={(e) => onPointerDown(e, i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={() => {
                if (justDragged.current) {
                  justDragged.current = false;
                  return;
                }
                if (playable) onPlay(card);
              }}
              className="origin-bottom cursor-grab touch-none select-none active:cursor-grabbing"
              style={{
                marginLeft: i === 0 ? 0 : "-3.5rem",
                transform: `translateX(${isDragging ? dragOffset : 0}px) rotate(${angle}deg) translateY(${
                  arc - (playable ? 14 : 0)
                }px)`,
                filter: playable ? "drop-shadow(0 0 10px rgb(108 92 231 / 0.55))" : "none",
                zIndex: isDragging ? 50 : i,
                transition: isDragging ? "none" : "transform 150ms ease-out",
              }}
            >
              <PlayingCard card={card} faded={!playable} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
