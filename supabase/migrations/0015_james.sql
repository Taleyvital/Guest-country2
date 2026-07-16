-- Jeu "James" — moteur isolé, tables séparées de celles de Guess the Country.
-- Réutilise uniquement le VOCABULAIRE de salon (code, hôte, prêt), pas les tables :
-- james_games/james_players sont autonomes, pour que ce jeu se lance et se teste
-- sans dépendre du reste de la plateforme.
--
-- 4 joueurs, 2 équipes face-à-face : position 0/2 = équipe A, position 1/3 = équipe B.
-- Paquet de 17 cartes (4 couleurs x 4 + 1 Joker), mains 4/4/4/5. Le joueur à 5 cartes
-- passe une carte à son voisin horaire, qui passe à 5 et rejoue : un seul "porteur"
-- à la fois, calculé serveur (current_holder_id), jamais choisi par un client.
--
-- Le coeur du jeu — l'appel "James" — est arbitré exclusivement côté serveur :
-- le gagnant du point est celui dont la CONFIRMATION arrive en premier au serveur
-- (timestamp Postgres, jamais un timestamp client), verrouillé par un lock de ligne
-- sur james_games pour sérialiser les confirmations concurrentes des deux équipes.
--
-- Non géré dans cette version (comme pour 8 Américain) : un joueur qui quitte une
-- partie EN COURS. La table exige exactement 4 joueurs pour démarrer ; en repartir
-- n'est pas re-siégé.

create type james_status as enum ('lobby', 'playing', 'finished');

create table james_games (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  status              james_status not null default 'lobby',
  host_id             uuid,                      -- FK ajoutée après players (cycle)
  team_a_score        int not null default 0,
  team_b_score        int not null default 0,
  round               int not null default 1,
  -- Rotation de la donne : siège qui reçoit les 5 cartes à la PROCHAINE distribution.
  next_dealer_seat    int not null default 0 check (next_dealer_seat between 0 and 3),
  -- Le joueur qui a 5 cartes EN CE MOMENT : lui seul peut passer une carte.
  current_holder_id   uuid,
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  ended_at            timestamptz
);

create or replace function generate_james_code()
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
    exit when not exists (select 1 from james_games where code = candidate and status <> 'finished');
  end loop;
  return candidate;
end;
$$;

alter table james_games alter column code set default generate_james_code();

create table james_players (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references james_games(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 24),
  avatar     text,
  is_host    boolean not null default false,
  is_ready   boolean not null default false,
  -- Position 0..3 autour de la table. Les partenaires sont face-à-face, jamais
  -- adjacents : équipe déductible de la parité, pas besoin d'une colonne à tenir à jour.
  position   int not null check (position between 0 and 3),
  team       text generated always as (case when position % 2 = 0 then 'A' else 'B' end) stored,
  joined_at  timestamptz not null default now(),

  unique (game_id, user_id),
  unique (game_id, position)
);

create index james_players_game_id_idx on james_players (game_id);

alter table james_games
  add constraint james_games_host_fk
  foreign key (host_id) references james_players(id) on delete set null;

alter table james_games
  add constraint james_games_holder_fk
  foreign key (current_holder_id) references james_players(id) on delete set null;

-- ---------------------------------------------------------------------------
-- james_hands — PRIVÉ. Aucune policy select : seul le propriétaire (via la
-- policy ci-dessous) ou une fonction security definer peut lire une main.
-- Sinon l'équipe adverse verrait vos cartes dans le payload Realtime.
-- ---------------------------------------------------------------------------
create table james_hands (
  player_id uuid primary key references james_players(id) on delete cascade,
  cards     jsonb not null default '[]'::jsonb   -- ex. ["S:A","H:K","JOKER"]
);

-- ---------------------------------------------------------------------------
-- james_events — bandeau "dernière action", ÉPHÉMÈRE (même pattern que
-- game_events du jeu principal). On n'y met JAMAIS la carte passée : seul le
-- fait qu'un passage ait eu lieu est public, pas son contenu.
-- ---------------------------------------------------------------------------
create type james_event_type as enum ('card_passed', 'point_scored', 'new_deal');

create table james_events (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references james_games(id) on delete cascade,
  type       james_event_type not null,
  actor_id   uuid references james_players(id) on delete set null,
  target_id  uuid references james_players(id) on delete set null,
  payload    jsonb not null default '{}'::jsonb,   -- { team, score } pour point_scored
  created_at timestamptz not null default now()
);

create index james_events_game_recent_idx on james_events (game_id, created_at desc);

create or replace function prune_james_events()
returns trigger
language plpgsql
as $$
begin
  delete from james_events e
  where e.game_id = new.game_id
    and e.id not in (
      select id from james_events where game_id = new.game_id
      order by created_at desc limit 5
    );
  return null;
end;
$$;

create trigger prune_james_events_after_insert
after insert on james_events
for each row execute function prune_james_events();

-- ---------------------------------------------------------------------------
-- james_calls — l'appel "James" et son arbitrage.
-- ---------------------------------------------------------------------------
create table james_calls (
  id                uuid primary key default gen_random_uuid(),
  game_id           uuid not null references james_games(id) on delete cascade,
  round             int not null,
  caller_id         uuid not null references james_players(id) on delete cascade,
  team              text not null check (team in ('A', 'B')),
  target_partner_id uuid not null references james_players(id) on delete cascade,
  called_at         timestamptz not null default now(),
  expires_at        timestamptz not null,
  confirmed_at      timestamptz,
  status            text not null default 'pending'
                     check (status in ('pending', 'confirmed', 'expired', 'superseded'))
);

create index james_calls_game_round_idx on james_calls (game_id, round);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table james_games  enable row level security;
alter table james_players enable row level security;
alter table james_hands  enable row level security;
alter table james_events enable row level security;
alter table james_calls  enable row level security;

create or replace function is_james_player(p_game_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from james_players where game_id = p_game_id and user_id = auth.uid()
  );
$$;

create policy "james_games readable by authenticated"
  on james_games for select to authenticated
  using (true);

create policy "james_games created by authenticated"
  on james_games for insert to authenticated
  with check (true);

create policy "james_players readable by table"
  on james_players for select to authenticated
  using (is_james_player(game_id));

create policy "james_players join as themselves"
  on james_players for insert to authenticated
  with check (user_id = auth.uid());

create policy "james_players update own row"
  on james_players for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Une main n'est lisible que par son propriétaire : jamais par un coéquipier,
-- jamais par un adversaire. Écriture réservée aux RPC security definer.
create policy "james_hands readable by owner"
  on james_hands for select to authenticated
  using (exists (
    select 1 from james_players p
    where p.id = james_hands.player_id and p.user_id = auth.uid()
  ));

create policy "james_events readable by table"
  on james_events for select to authenticated
  using (is_james_player(game_id));

-- Un appel "James" n'est visible que par son auteur et le partenaire ciblé :
-- c'est ce qui garantit "aucun indice visuel chez les 2 adversaires" — la policy
-- RLS s'applique aussi aux payloads Realtime, donc les deux adversaires ne
-- reçoivent même pas l'INSERT.
create policy "james_calls readable by participants"
  on james_calls for select to authenticated
  using (exists (
    select 1 from james_players p
    where p.game_id = james_calls.game_id
      and p.user_id = auth.uid()
      and p.id in (james_calls.caller_id, james_calls.target_partner_id)
  ));

alter table james_games  replica identity full;
alter table james_players replica identity full;
alter table james_hands  replica identity full;
alter table james_events replica identity full;
alter table james_calls  replica identity full;

alter publication supabase_realtime add table james_games;
alter publication supabase_realtime add table james_players;
alter publication supabase_realtime add table james_hands;
alter publication supabase_realtime add table james_events;
alter publication supabase_realtime add table james_calls;

-- ---------------------------------------------------------------------------
-- Lobby : créer / rejoindre / prêt. Même raisonnement que create_game/join_game
-- du jeu principal (atomicité, siège sans course).
-- ---------------------------------------------------------------------------
create or replace function james_next_position(p_game_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pos int;
begin
  perform 1 from james_games where id = p_game_id for update;
  select coalesce(max(position) + 1, 0) into v_pos from james_players where game_id = p_game_id;
  if v_pos > 3 then
    raise exception 'table full' using errcode = 'P0001';
  end if;
  return v_pos;
end;
$$;

create or replace function create_james_game(p_nickname text)
returns james_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game   james_games;
  v_player james_players;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  insert into james_games default values returning * into v_game;

  insert into james_players (game_id, user_id, nickname, is_host, position)
  values (v_game.id, auth.uid(), p_nickname, true, 0)
  returning * into v_player;

  update james_games set host_id = v_player.id where id = v_game.id returning * into v_game;

  return v_game;
end;
$$;

create or replace function join_james_game(p_code text, p_nickname text)
returns james_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game james_games;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  select * into v_game from james_games where code = upper(p_code);
  if v_game.id is null then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from james_players where game_id = v_game.id and user_id = auth.uid()) then
    return v_game;
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  insert into james_players (game_id, user_id, nickname, position)
  values (v_game.id, auth.uid(), p_nickname, james_next_position(v_game.id));

  return v_game;
end;
$$;

-- ---------------------------------------------------------------------------
-- Distribution : 17 cartes (4 couleurs x 4 + Joker), mains 4/4/4/5.
-- Le siège `next_dealer_seat` reçoit la main de 5 et devient current_holder_id.
-- ---------------------------------------------------------------------------
create or replace function james_deal(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game  james_games;
  v_deck  text[];
  v_players uuid[]; -- ids ordonnés par position, en partant de next_dealer_seat
  v_holder_id uuid;
  i int;
  v_hand jsonb;
begin
  select * into v_game from james_games where id = p_game_id for update;

  v_deck := array[
    'S:A','S:K','S:Q','S:J', 'H:A','H:K','H:Q','H:J',
    'D:A','D:K','D:Q','D:J', 'C:A','C:K','C:Q','C:J', 'JOKER'
  ];
  -- Mélange Fisher-Yates via un ordre aléatoire : suffisant, la partie n'a pas
  -- besoin d'un mélange cryptographique.
  select array_agg(c order by random()) into v_deck from unnest(v_deck) as c;

  select array_agg(id order by ((position - v_game.next_dealer_seat + 4) % 4))
    into v_players
  from james_players where game_id = p_game_id;

  -- v_players[1] est maintenant le porteur (5 cartes), les 3 suivants ont 4 cartes.
  v_holder_id := v_players[1];

  select jsonb_agg(c) into v_hand from unnest(v_deck[1:5]) as c;
  insert into james_hands (player_id, cards) values (v_holder_id, v_hand)
    on conflict (player_id) do update set cards = excluded.cards;

  i := 6;
  for idx in 2..4 loop
    select jsonb_agg(c) into v_hand from unnest(v_deck[i:i+3]) as c;
    insert into james_hands (player_id, cards) values (v_players[idx], v_hand)
      on conflict (player_id) do update set cards = excluded.cards;
    i := i + 4;
  end loop;

  update james_games set
    current_holder_id = v_holder_id,
    next_dealer_seat  = (v_game.next_dealer_seat + 1) % 4
  where id = p_game_id;

  insert into james_events (game_id, type) values (p_game_id, 'new_deal');
end;
$$;

create or replace function start_james_game(p_game_id uuid)
returns james_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game james_games;
begin
  select * into v_game from james_games where id = p_game_id;

  if v_game.id is null then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from james_players where id = v_game.host_id and user_id = auth.uid()) then
    raise exception 'only the host can start the game' using errcode = '42501';
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  if (select count(*) from james_players where game_id = p_game_id) <> 4 then
    raise exception 'james needs exactly 4 players' using errcode = 'P0001';
  end if;

  if exists (select 1 from james_players where game_id = p_game_id and not is_ready) then
    raise exception 'everyone must be ready' using errcode = 'P0001';
  end if;

  perform james_deal(p_game_id);

  update james_games set status = 'playing', started_at = now()
    where id = p_game_id returning * into v_game;

  return v_game;
end;
$$;

-- ---------------------------------------------------------------------------
-- Passage de carte : seul le porteur actuel (5 cartes) peut agir. Flux continu,
-- asynchrone — pas de tour figé, juste "qui porte les 5 cartes en ce moment".
-- ---------------------------------------------------------------------------
create or replace function pass_card(p_game_id uuid, p_card text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       james_players;
  v_game     james_games;
  v_next     james_players;
  v_my_cards jsonb;
  v_next_cards jsonb;
begin
  select * into v_me from james_players where game_id = p_game_id and user_id = auth.uid();
  if v_me.id is null then
    raise exception 'you are not in this game' using errcode = '42501';
  end if;

  select * into v_game from james_games where id = p_game_id for update;
  if v_game.status <> 'playing' then
    raise exception 'game not started' using errcode = 'P0001';
  end if;

  if v_game.current_holder_id <> v_me.id then
    raise exception 'not your turn' using errcode = 'P0001';
  end if;

  select cards into v_my_cards from james_hands where player_id = v_me.id;
  if not (v_my_cards @> to_jsonb(p_card)) then
    raise exception 'card not in hand' using errcode = 'P0001';
  end if;

  select * into v_next from james_players
  where game_id = p_game_id and position = (v_me.position + 1) % 4;

  -- Chaque carte du paquet de 17 n'existe qu'en un seul exemplaire : un simple
  -- filtre par valeur suffit, pas besoin de ne retirer qu'une "première occurrence".
  select coalesce(jsonb_agg(c), '[]'::jsonb) into v_my_cards
  from jsonb_array_elements(v_my_cards) as c
  where c <> to_jsonb(p_card);

  update james_hands set cards = v_my_cards where player_id = v_me.id;

  select cards into v_next_cards from james_hands where player_id = v_next.id;
  update james_hands set cards = coalesce(v_next_cards, '[]'::jsonb) || to_jsonb(p_card)
    where player_id = v_next.id;

  update james_games set current_holder_id = v_next.id where id = p_game_id;

  insert into james_events (game_id, type, actor_id, target_id)
  values (p_game_id, 'card_passed', v_me.id, v_next.id);
end;
$$;

grant execute on function pass_card(uuid, text) to authenticated;
grant execute on function create_james_game(text) to authenticated;
grant execute on function join_james_game(text, text) to authenticated;
grant execute on function start_james_game(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Appel "James" — le point du jeu.
-- ---------------------------------------------------------------------------
create or replace function call_james(p_game_id uuid)
returns james_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me      james_players;
  v_game    james_games;
  v_partner james_players;
  v_cards   jsonb;
  v_suits   text[];
  v_call    james_calls;
begin
  select * into v_me from james_players where game_id = p_game_id and user_id = auth.uid();
  if v_me.id is null then
    raise exception 'you are not in this game' using errcode = '42501';
  end if;

  select * into v_game from james_games where id = p_game_id;
  if v_game.status <> 'playing' then
    raise exception 'game not started' using errcode = 'P0001';
  end if;

  select cards into v_cards from james_hands where player_id = v_me.id;

  -- Recalcul serveur de la prétention "4 cartes du même motif" : ne jamais faire
  -- confiance au client, sinon n'importe qui pourrait déclencher un appel bidon.
  select array_agg(split_part(c #>> '{}', ':', 1))
    into v_suits
  from jsonb_array_elements(v_cards) as c
  where c #>> '{}' <> 'JOKER';

  if (
    select count(*) from unnest(v_suits) as s
    group by s having count(*) >= 4
  ) is null then
    raise exception 'no four of a kind' using errcode = 'P0001';
  end if;

  select * into v_partner from james_players
  where game_id = p_game_id and team = v_me.team and id <> v_me.id;

  insert into james_calls (game_id, round, caller_id, team, target_partner_id, expires_at)
  values (p_game_id, v_game.round, v_me.id, v_me.team, v_partner.id, now() + interval '3 seconds')
  returning * into v_call;

  return v_call;
end;
$$;

create or replace function confirm_james(p_call_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call james_calls;
  v_me   james_players;
  v_game james_games;
begin
  select * into v_call from james_calls where id = p_call_id;
  if v_call.id is null then
    raise exception 'call not found' using errcode = 'P0002';
  end if;

  select * into v_me from james_players where id = v_call.target_partner_id and user_id = auth.uid();
  if v_me.id is null then
    raise exception 'not your call to confirm' using errcode = '42501';
  end if;

  -- Verrou sur la partie : sérialise les confirmations concurrentes des deux
  -- équipes, c'est ce qui rend l'arbitrage "premier arrivé" fiable malgré la
  -- course. Sans ce lock, deux confirmations simultanées pourraient toutes les
  -- deux se croire gagnantes.
  select * into v_game from james_games where id = v_call.game_id for update;

  if v_call.status <> 'pending' then
    return jsonb_build_object('won', false, 'reason', 'already resolved');
  end if;

  if now() > v_call.expires_at then
    update james_calls set status = 'expired' where id = p_call_id;
    return jsonb_build_object('won', false, 'reason', 'expired');
  end if;

  -- Le round a déjà été tranché par un appel concurrent pendant qu'on attendait
  -- le lock : on arrive après la bataille, pas de vol de point possible.
  if v_call.round < v_game.round then
    update james_calls set status = 'superseded' where id = p_call_id;
    return jsonb_build_object('won', false, 'reason', 'too late');
  end if;

  update james_calls set confirmed_at = now(), status = 'confirmed' where id = p_call_id;

  -- Toute autre tentative pendante de la même manche perd désormais la course.
  update james_calls set status = 'superseded'
  where game_id = v_call.game_id and round = v_call.round and id <> p_call_id and status = 'pending';

  if v_call.team = 'A' then
    update james_games set team_a_score = team_a_score + 1, round = round + 1 where id = v_call.game_id;
  else
    update james_games set team_b_score = team_b_score + 1, round = round + 1 where id = v_call.game_id;
  end if;

  select * into v_game from james_games where id = v_call.game_id;

  insert into james_events (game_id, type, actor_id, payload)
  values (v_call.game_id, 'point_scored', v_call.caller_id,
          jsonb_build_object('team', v_call.team,
                              'team_a_score', v_game.team_a_score,
                              'team_b_score', v_game.team_b_score));

  if v_game.team_a_score >= 10 or v_game.team_b_score >= 10 then
    update james_games set status = 'finished', ended_at = now() where id = v_call.game_id;
  else
    perform james_deal(v_call.game_id);
  end if;

  return jsonb_build_object('won', true, 'team', v_call.team);
end;
$$;

grant execute on function call_james(uuid) to authenticated;
grant execute on function confirm_james(uuid) to authenticated;
