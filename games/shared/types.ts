/** Concepts communs au lobby, partagés par tous les jeux de la plateforme.
 *  Chaque jeu a ses propres tables Supabase (isolation totale) mais s'accorde
 *  sur ce vocabulaire pour que l'UI de salon (code, hôte, joueurs prêts) se
 *  ressemble d'un jeu à l'autre. Ne pas dupliquer ces champs dans les types
 *  de chaque jeu : les étendre. */

export type GameStatus = "lobby" | "playing" | "finished";

/** Un joueur tel que le lobby le voit, avant toute logique de jeu. */
export type LobbyPlayer = {
  id: string;
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  isHost: boolean;
  isReady: boolean;
  seat: number;
};

/** Un salon générique : code dictable, statut, hôte. */
export type LobbyRoom = {
  id: string;
  code: string;
  status: GameStatus;
  hostId: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
};
