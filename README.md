# Guess the Country

Jeu de devinettes multijoueur en soirée : **un téléphone par joueur, pas d'écran commun**.
Chaque joueur voit son propre état sur son écran, synchronisé en temps réel.

Stack : Next.js 14 (App Router) · Tailwind · Supabase (Postgres + Realtime + auth anonyme).

## Démarrer

```bash
npm install
cp .env.local.example .env.local   # puis renseigner URL + clés du projet Supabase
npm run dev
```

### Supabase — deux étapes obligatoires

1. **Appliquer les migrations**, dans l'ordre, via le SQL Editor :
   `supabase/migrations/0001_init.sql` puis `0002_create_join_rpc.sql`
   (le 0002 corrige une policy créée par le 0001).
2. **Activer les sessions anonymes** : Authentication → Sign In / Providers → Anonymous sign-ins.
   Chaque joueur est une session anonyme — pas de compte à créer pour rejoindre une partie,
   mais un `auth.uid()` stable sur lequel s'appuient les policies RLS.

## Tester à plusieurs

```bash
npm run dev -- -H 0.0.0.0
ipconfig getifaddr en0        # IP locale, ex. 192.168.1.42
```

Le téléphone rejoint `http://<ip-locale>:3000` sur le même Wi-Fi.

⚠️ Deux onglets du même navigateur partagent le `localStorage`, donc la même session anonyme,
donc **le même joueur**. Pour simuler deux joueurs sur une machine : une fenêtre normale
**plus** une fenêtre privée (ou deux profils).

## Architecture

| Chemin | Rôle |
| --- | --- |
| `app/page.tsx` | Accueil : créer / rejoindre une partie |
| `app/room/[code]/` | Lobby temps réel (joueurs, ready, lancement synchronisé) |
| `app/room/[code]/play/` | Écran de jeu branché sur le Realtime |
| `app/game/` | Démo statique de `GameScreen`, sans Supabase |
| `components/game/` | Composants d'écran, pilotés uniquement par leurs props |
| `lib/realtime/useGameChannel.ts` | Un channel Realtime par `game_id` |
| `supabase/migrations/` | Schéma + RPC |

### Partis pris

- **La base est l'unique source de vérité.** Les téléphones s'abonnent aux changements Postgres
  plutôt que de se diffuser des messages entre eux : un joueur qui se reconnecte retrouve
  l'état exact sans rejouer d'historique. Aucun client ne décide de son propre tour.
- **`game_events` est éphémère par construction**, pas par convention : un trigger purge à chaque
  insert et ne garde que les derniers events. Ce n'est pas un journal, c'est le bandeau
  "Last Action". La table ne grossit jamais.
- **Les lettres cachées ne sont jamais envoyées au client.** Une tuile non révélée ne porte
  aucune lettre dans le DOM, sinon la réponse se lirait à l'inspecteur.

## État actuel

Fonctionnel : création, jointure par code, lobby temps réel, lancement synchronisé,
composants de jeu (tuiles, rail joueurs, last action, modals).

**Non tranché :** qui possède le pays secret et qui le devine (chacun ignore le sien /
chacun devine celui d'un adversaire / un pays commun par manche). Tant que ce choix n'est pas
fait, le schéma ne stocke ni le mot ni les lettres révélées, et l'écran de jeu affiche un mot
vide. Le schéma actuel (`actor_id` + `target_id` sur les events) supporte les trois lectures.

## Design

Les maquettes sources (export Stitch) sont dans `stitch_country_guess_mobile_game/`.
Palette : `#FAFAF8` fond · `#6C5CE7` accent · `#00B894` succès · `#FF6B6B` danger ·
`#DFE6E9` tuile cachée.
