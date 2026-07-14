-- Guess the Country — schéma initial
-- 3 tables : games (la partie), players (les téléphones), game_events (le "last action" éphémère).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------
create type game_status as enum ('lobby', 'playing', 'finished');

create table games (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,          -- "XJ82" : lisible, dictable à voix haute
  status            game_status not null default 'lobby',
  round             int not null default 1,
  total_rounds      int not null default 5,
  -- Source de vérité du tour. Aucun téléphone ne décide de son tour tout seul :
  -- ils lisent tous ce champ, et le serveur est le seul à l'avancer.
  current_player_id uuid,                          -- FK ajoutée après players (cycle)
  host_id           uuid,
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  ended_at          timestamptz
);

-- Code de room : 4 caractères, sans I/O/0/1 pour éviter les confusions à l'oral.
create or replace function generate_game_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..4 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from games where code = candidate and status <> 'finished');
  end loop;
  return candidate;
end;
$$;

alter table games alter column code set default generate_game_code();

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
create table players (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,  -- session anonyme
  nickname      text not null check (char_length(nickname) between 1 and 24),
  avatar        text,
  is_host       boolean not null default false,
  is_ready      boolean not null default false,
  is_eliminated boolean not null default false,
  score         int not null default 0,
  seat          int not null,                       -- ordre du tour de table
  joined_at     timestamptz not null default now(),

  unique (game_id, user_id),   -- un joueur = un téléphone = une place
  unique (game_id, seat)
);

create index players_game_id_idx on players (game_id);

alter table games
  add constraint games_current_player_fk
  foreign key (current_player_id) references players(id) on delete set null;

-- ---------------------------------------------------------------------------
-- game_events — ÉPHÉMÈRE
-- Ce n'est pas un journal de partie : c'est le bandeau "Last Action" que tous les
-- téléphones affichent ("Yao asked you for 'E' → Not found"). On garde une petite
-- fenêtre glissante par partie, purgée à chaque insert. La table ne grossit pas.
-- ---------------------------------------------------------------------------
create type game_event_type as enum ('ask_letter', 'guess', 'eliminated', 'turn_skipped');

create table game_events (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references games(id) on delete cascade,
  type       game_event_type not null,
  actor_id   uuid references players(id) on delete set null,   -- qui agit
  target_id  uuid references players(id) on delete set null,   -- qui subit ("asked YOU")
  payload    jsonb not null default '{}'::jsonb,               -- { letter, found } | { guess, correct }
  created_at timestamptz not null default now()
);

create index game_events_game_recent_idx on game_events (game_id, created_at desc);

-- Fenêtre glissante : on ne conserve que les N derniers events d'une partie.
-- N = 5 pour permettre un petit fil "history" à l'écran ; passer à 1 pour ne garder
-- strictement que la dernière action.
create or replace function prune_game_events()
returns trigger
language plpgsql
as $$
begin
  delete from game_events e
  where e.game_id = new.game_id
    and e.id not in (
      select id from game_events
      where game_id = new.game_id
      order by created_at desc
      limit 5
    );
  return null;
end;
$$;

create trigger prune_game_events_after_insert
after insert on game_events
for each row execute function prune_game_events();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table games       enable row level security;
alter table players     enable row level security;
alter table game_events enable row level security;

-- SECURITY DEFINER : sans ça, la policy de players qui interroge players
-- se rappellerait elle-même (récursion RLS infinie).
create or replace function is_player_in_game(p_game_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from players
    where game_id = p_game_id and user_id = auth.uid()
  );
$$;

-- games : lisible par tout joueur authentifié (il faut pouvoir chercher une partie
-- par son code AVANT d'y être joueur). Le code court fait office de secret d'accès.
create policy "games readable by authenticated"
  on games for select to authenticated
  using (true);

create policy "games created by authenticated"
  on games for insert to authenticated
  with check (true);

-- L'avancement de la partie (tour, round, status) passe par le serveur (service_role),
-- jamais par un téléphone : sinon n'importe quel client pourrait se donner le tour.
create policy "games updated by host only"
  on games for update to authenticated
  using (host_id in (select id from players where user_id = auth.uid()))
  with check (host_id in (select id from players where user_id = auth.uid()));

-- players : on voit tous les joueurs de SA partie.
create policy "players readable by teammates"
  on players for select to authenticated
  using (is_player_in_game(game_id));

create policy "players join as themselves"
  on players for insert to authenticated
  with check (user_id = auth.uid());

-- Un joueur ne modifie que sa propre ligne (pseudo, ready) — pas son score,
-- pas son élimination : ces colonnes-là ne bougent que côté serveur.
create policy "players update own row"
  on players for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- game_events : lecture pour les joueurs de la partie. Écriture réservée au serveur
-- (service_role, qui bypass RLS) : c'est lui qui arbitre "found / not found".
create policy "events readable by players"
  on game_events for select to authenticated
  using (is_player_in_game(game_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- REPLICA IDENTITY FULL : sans ça, les payloads UPDATE n'exposent que la PK
-- et les clients ne verraient pas quel champ a changé (ex. current_player_id).
-- ---------------------------------------------------------------------------
alter table games       replica identity full;
alter table players     replica identity full;
alter table game_events replica identity full;

alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table game_events;
