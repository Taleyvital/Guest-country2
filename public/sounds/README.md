# Sons du jeu

Fichiers `.mp3` **courts (< 800 ms)**, chargés par `lib/hooks/useGameSounds.ts`.
Les fichiers actuels sont des placeholders vides — remplace-les par les vrais.

| Fichier              | Événement                                    |
| -------------------- | -------------------------------------------- |
| `your-turn.mp3`      | C'est mon tour (`current_player_id` = moi)   |
| `letter-found.mp3`   | Lettre demandée présente dans le pays visé   |
| `letter-missed.mp3`  | Lettre demandée absente                      |
| `elimination.mp3`    | Je viens d'être éliminé de la manche         |
| `victory.mp3`        | Je termine la partie en tête                 |

Le chargement est tolérant : un fichier manquant ou vide n'empêche jamais de jouer,
il ne produit simplement aucun son (voir `onloaderror`).
