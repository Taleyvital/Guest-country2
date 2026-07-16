-- Jeu "8 Américain" — moteur isolé, tables séparées de James et de Guess the
-- Country. 2 à 6 joueurs, jeu de 52 cartes classique.
--
-- La pioche (americain_state.deck) est un état neutre, pas la propriété d'un
-- joueur : elle vit dans une table SANS AUCUNE policy select, comme
-- player_secrets dans le jeu principal, pour qu'aucun client ne puisse en
-- lire l'ordre et anticiper son prochain tirage.
--
-- ASSOMPTIONS DE RÈGLES non précisées par la spec, documentées ici plutôt que
-- silencieusement codées en dur :
--   - Un Valet et un As/2 "sautent" le joueur suivant de la même façon : le tour
--     passe à celui d'après. Pour l'As/2, le joueur sauté pioche AVANT d'être sauté.
--   - Le 10 (inversion) ne "saute" personne : à 2 joueurs, inverser le sens ne
--     change rien à qui joue ensuite (il n'y a que deux joueurs), le comportement
--     est donc déjà correct sans cas particulier.
--   - En pioche illimitée, chaque appel à draw_card ne tire qu'UNE carte et NE
--     PASSE PAS le tour : le joueur reste actif et peut retirer jusqu'à obtenir
--     une carte jouable (ou décider de la jouer). En pioche unique, un seul
--     tirage est autorisé et le tour passe immédiatement, jouable ou non.
--   - Un joueur qui quitte une partie EN COURS n'est pas re-siégé (pas de
--     renumérotation de seat) : cas non géré dans cette version, comme pour
--     James.

create type americain_status as enum ('lobby', 'playing', 'finished');
create type americain_draw_mode as enum ('unlimited', 'single');

create table americain_games (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  status             americain_status not null default 'lobby',
  host_id            uuid,
  max_players        int not null default 6 check (max_players between 2 and 6),
  draw_mode          americain_draw_mode not null default 'unlimited',
  penalty_threshold  int not null default 100 check (penalty_threshold > 0),
  -- +1 = sens horaire, -1 = sens inverse. Le 10 bascule ce signe.
  direction          int not null default 1 check (direction in (1, -1)),
  current_player_id  uuid,
  -- Couleur demandée courante : celle de la dernière carte posée, ou celle
  -- choisie par le joueur du 8 (le 8 est un joker de couleur).
  current_color      text check (current_color in ('S', 'H', 'D', 'C')),
  top_card           text,          -- dernière carte posée, publique (ex. "H-10")
  round              int not null default 1,
  next_dealer_seat   int not null default 0,
  created_at         timestamptz not null default now(),
  started_at         timestamptz,
  ended_at           timestamptz
);

create or replace function generate_americain_code()
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
    exit when not exists (select 1 from americain_games where code = candidate and status <> 'finished');
  end loop;
  return candidate;
end;
$$;

alter table americain_games alter column code set default generate_americain_code();

create table americain_players (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references americain_games(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  nickname      text not null check (char_length(nickname) between 1 and 24),
  avatar        text,
  is_host       boolean not null default false,
  is_ready      boolean not null default false,
  seat          int not null,
  -- Nombre de cartes en main : PUBLIC (les autres voient "combien", jamais
  -- "lesquelles"). Sert à afficher les mains adverses en dos de carte.
  hand_count    int not null default 0,
  -- Pénalité cumulée sur toute la partie (plusieurs manches). Le plus bas gagne.
  penalty_score int not null default 0,
  joined_at     timestamptz not null default now(),

  unique (game_id, user_id),
  unique (game_id, seat)
);

create index americain_players_game_id_idx on americain_players (game_id);

alter table americain_games
  add constraint americain_games_host_fk
  foreign key (host_id) references americain_players(id) on delete set null;

alter table americain_games
  add constraint americain_games_current_player_fk
  foreign key (current_player_id) references americain_players(id) on delete set null;

-- ---------------------------------------------------------------------------
-- americain_hands — PRIVÉ, comme james_hands : seul le propriétaire peut lire
-- sa propre main.
-- ---------------------------------------------------------------------------
create table americain_hands (
  player_id uuid primary key references americain_players(id) on delete cascade,
  cards     jsonb not null default '[]'::jsonb   -- ex. ["H:10","S:8","D:A"]
);

-- ---------------------------------------------------------------------------
-- americain_state — la pioche et la défausse complète. AUCUNE policy RLS :
-- ni select ni insert pour authenticated, seules les fonctions security
-- definer y touchent. Si un client pouvait lire `deck`, il connaîtrait
-- l'ordre exact des prochains tirages de tout le monde.
-- ---------------------------------------------------------------------------
create table americain_state (
  game_id uuid primary key references americain_games(id) on delete cascade,
  deck    jsonb not null default '[]'::jsonb,
  discard jsonb not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table americain_games  enable row level security;
alter table americain_players enable row level security;
alter table americain_hands  enable row level security;
alter table americain_state  enable row level security;

create or replace function is_americain_player(p_game_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from americain_players where game_id = p_game_id and user_id = auth.uid()
  );
$$;

create policy "americain_games readable by authenticated"
  on americain_games for select to authenticated
  using (true);

create policy "americain_games created by authenticated"
  on americain_games for insert to authenticated
  with check (true);

create policy "americain_players readable by table"
  on americain_players for select to authenticated
  using (is_americain_player(game_id));

create policy "americain_players join as themselves"
  on americain_players for insert to authenticated
  with check (user_id = auth.uid());

create policy "americain_players update own row"
  on americain_players for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "americain_hands readable by owner"
  on americain_hands for select to authenticated
  using (exists (
    select 1 from americain_players p
    where p.id = americain_hands.player_id and p.user_id = auth.uid()
  ));

-- Pas de policy sur americain_state : table inaccessible aux clients, y
-- compris en lecture (RLS activée + zéro policy = zéro accès).

alter table americain_games   replica identity full;
alter table americain_players replica identity full;
alter table americain_hands   replica identity full;

alter publication supabase_realtime add table americain_games;
alter publication supabase_realtime add table americain_players;
alter publication supabase_realtime add table americain_hands;

-- ---------------------------------------------------------------------------
-- Lobby
-- ---------------------------------------------------------------------------
create or replace function americain_next_seat(p_game_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat int;
  v_max  int;
begin
  perform 1 from americain_games where id = p_game_id for update;
  select max_players into v_max from americain_games where id = p_game_id;
  select coalesce(max(seat) + 1, 0) into v_seat from americain_players where game_id = p_game_id;
  if v_seat >= v_max then
    raise exception 'table full' using errcode = 'P0001';
  end if;
  return v_seat;
end;
$$;

create or replace function create_americain_game(
  p_nickname text,
  p_max_players int default 6,
  p_draw_mode americain_draw_mode default 'unlimited',
  p_penalty_threshold int default 100
)
returns americain_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game   americain_games;
  v_player americain_players;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  insert into americain_games (max_players, draw_mode, penalty_threshold)
  values (p_max_players, p_draw_mode, p_penalty_threshold)
  returning * into v_game;

  insert into americain_players (game_id, user_id, nickname, is_host, seat)
  values (v_game.id, auth.uid(), p_nickname, true, 0)
  returning * into v_player;

  update americain_games set host_id = v_player.id where id = v_game.id returning * into v_game;

  return v_game;
end;
$$;

create or replace function join_americain_game(p_code text, p_nickname text)
returns americain_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game americain_games;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  select * into v_game from americain_games where code = upper(p_code);
  if v_game.id is null then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from americain_players where game_id = v_game.id and user_id = auth.uid()) then
    return v_game;
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  insert into americain_players (game_id, user_id, nickname, seat)
  values (v_game.id, auth.uid(), p_nickname, americain_next_seat(v_game.id));

  return v_game;
end;
$$;

-- ---------------------------------------------------------------------------
-- Paquet, mélange, pioche.
-- ---------------------------------------------------------------------------
create or replace function americain_fresh_deck()
returns jsonb
language sql
as $$
  select jsonb_agg(c order by random())
  from (
    select suit || ':' || rank as c
    from unnest(array['S','H','D','C']) as suit
    cross join unnest(array['2','3','4','5','6','7','8','9','10','J','Q','K','A']) as rank
  ) cards;
$$;

-- Tire UNE carte du paquet ; si le paquet est vide, remélange la défausse
-- (sauf la carte du dessus, qui reste en jeu) pour reconstituer une pioche.
create or replace function americain_draw_one(p_game_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state americain_state;
  v_game  americain_games;
  v_card  text;
  v_rest  jsonb;
begin
  select * into v_state from americain_state where game_id = p_game_id for update;
  select * into v_game from americain_games where id = p_game_id;

  if jsonb_array_length(v_state.deck) = 0 then
    if jsonb_array_length(v_state.discard) <= 1 then
      raise exception 'no cards left to draw' using errcode = 'P0001';
    end if;
    -- Toutes les cartes défaussées SAUF la dernière (le top_card, encore en jeu).
    select jsonb_agg(c order by random()) into v_state.deck
    from jsonb_array_elements_text(v_state.discard) with ordinality as t(c, ord)
    where ord < jsonb_array_length(v_state.discard);

    select jsonb_build_array(v_state.discard -> (jsonb_array_length(v_state.discard) - 1))
      into v_state.discard;
  end if;

  v_card := v_state.deck ->> 0;
  select coalesce(jsonb_agg(c), '[]'::jsonb) into v_rest
  from jsonb_array_elements_text(v_state.deck) with ordinality as t(c, ord)
  where ord > 1;

  update americain_state set deck = v_rest, discard = v_state.discard where game_id = p_game_id;

  return v_card;
end;
$$;

create or replace function americain_deal(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game    americain_games;
  v_deck    jsonb;
  v_players uuid[];
  v_hand    jsonb;
  v_starter text;
  i int;
begin
  select * into v_game from americain_games where id = p_game_id for update;

  v_deck := americain_fresh_deck();

  select array_agg(id order by ((seat - v_game.next_dealer_seat + 100) % 100))
    into v_players
  from americain_players where game_id = p_game_id;

  i := 1;
  for idx in 1..array_length(v_players, 1) loop
    select jsonb_agg(c) into v_hand from unnest((
      select array_agg(e) from jsonb_array_elements_text(v_deck) with ordinality as t(e, ord)
      where ord between i and i + 4
    )) as c;

    insert into americain_hands (player_id, cards) values (v_players[idx], v_hand)
      on conflict (player_id) do update set cards = excluded.cards;
    update americain_players set hand_count = 5 where id = v_players[idx];
    i := i + 5;
  end loop;

  -- Carte retournée qui lance la pile. Si c'est un 8 (joker), la couleur de
  -- départ est tirée au hasard plutôt que de bloquer sur un choix : personne
  -- n'a encore de tour pour la choisir.
  select e into v_starter
  from jsonb_array_elements_text(v_deck) with ordinality as t(e, ord)
  where ord = i;

  update americain_state set
    deck    = (select coalesce(jsonb_agg(e), '[]'::jsonb)
               from jsonb_array_elements_text(v_deck) with ordinality as t(e, ord)
               where ord > i),
    discard = jsonb_build_array(v_starter)
  where game_id = p_game_id;

  update americain_games set
    top_card          = v_starter,
    current_color     = case
                           when split_part(v_starter, ':', 2) = '8'
                             then (array['S','H','D','C'])[1 + floor(random() * 4)::int]
                           else split_part(v_starter, ':', 1)
                         end,
    current_player_id = v_players[1],
    next_dealer_seat  = (v_game.next_dealer_seat + 1) % (select count(*) from americain_players where game_id = p_game_id),
    direction          = 1
  where id = p_game_id;
end;
$$;

create or replace function start_americain_game(p_game_id uuid)
returns americain_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game americain_games;
begin
  select * into v_game from americain_games where id = p_game_id;

  if v_game.id is null then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from americain_players where id = v_game.host_id and user_id = auth.uid()) then
    raise exception 'only the host can start the game' using errcode = '42501';
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  if (select count(*) from americain_players where game_id = p_game_id) < 2 then
    raise exception 'need at least 2 players' using errcode = 'P0001';
  end if;

  if exists (select 1 from americain_players where game_id = p_game_id and not is_ready) then
    raise exception 'everyone must be ready' using errcode = 'P0001';
  end if;

  insert into americain_state (game_id) values (p_game_id)
    on conflict (game_id) do nothing;

  perform americain_deal(p_game_id);

  update americain_games set status = 'playing', started_at = now()
    where id = p_game_id returning * into v_game;

  return v_game;
end;
$$;

grant execute on function create_americain_game(text, int, americain_draw_mode, int) to authenticated;
grant execute on function join_americain_game(text, text) to authenticated;
grant execute on function start_americain_game(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Fin de manche : les cartes restantes des perdants deviennent leur pénalité,
-- puis nouvelle donne automatique (ou fin de partie si le seuil est atteint).
-- ---------------------------------------------------------------------------
create or replace function americain_end_round(p_game_id uuid, p_winner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game americain_games;
  v_over boolean;
begin
  update americain_players p set penalty_score = penalty_score + p.hand_count
  where p.game_id = p_game_id and p.id <> p_winner_id;

  select exists (
    select 1 from americain_players
    where game_id = p_game_id
      and penalty_score >= (select penalty_threshold from americain_games where id = p_game_id)
  ) into v_over;

  if v_over then
    update americain_games set status = 'finished', ended_at = now(), current_player_id = null
      where id = p_game_id;
  else
    update americain_games set round = round + 1 where id = p_game_id;
    perform americain_deal(p_game_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Jouer une carte.
-- ---------------------------------------------------------------------------
create or replace function play_card(p_game_id uuid, p_card text, p_chosen_color text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       americain_players;
  v_game     americain_games;
  v_cards    jsonb;
  v_suit     text;
  v_rank     text;
  v_n        int;
  v_seats    uuid[];    -- joueurs ordonnés par seat
  v_my_idx   int;
  v_step     int;
  v_target_idx int;
  v_target   uuid;
  v_penalty  int;
  v_drawn    text;
begin
  select * into v_me from americain_players where game_id = p_game_id and user_id = auth.uid();
  if v_me.id is null then
    raise exception 'you are not in this game' using errcode = '42501';
  end if;

  select * into v_game from americain_games where id = p_game_id for update;
  if v_game.status <> 'playing' then
    raise exception 'game not started' using errcode = 'P0001';
  end if;

  if v_game.current_player_id <> v_me.id then
    raise exception 'not your turn' using errcode = 'P0001';
  end if;

  select cards into v_cards from americain_hands where player_id = v_me.id;
  if not (v_cards @> to_jsonb(p_card)) then
    raise exception 'card not in hand' using errcode = 'P0001';
  end if;

  v_suit := split_part(p_card, ':', 1);
  v_rank := split_part(p_card, ':', 2);

  if v_rank <> '8'
     and v_suit <> v_game.current_color
     and v_rank <> split_part(v_game.top_card, ':', 2) then
    raise exception 'card not playable' using errcode = 'P0001';
  end if;

  if v_rank = '8' and (p_chosen_color is null or p_chosen_color not in ('S','H','D','C')) then
    raise exception 'must choose a color for the 8' using errcode = 'P0001';
  end if;

  -- Retire la carte de la main (chaque carte du paquet de 52 est unique).
  select coalesce(jsonb_agg(c), '[]'::jsonb) into v_cards
  from jsonb_array_elements(v_cards) as c
  where c <> to_jsonb(p_card);

  update americain_hands set cards = v_cards where player_id = v_me.id;
  update americain_players set hand_count = hand_count - 1 where id = v_me.id;

  update americain_state set discard = discard || to_jsonb(p_card) where game_id = p_game_id;

  update americain_games set
    top_card      = p_card,
    current_color = case when v_rank = '8' then p_chosen_color else v_suit end
  where id = p_game_id;

  -- Victoire de la manche : plus aucune carte en main.
  if (select hand_count from americain_players where id = v_me.id) = 0 then
    perform americain_end_round(p_game_id, v_me.id);
    return;
  end if;

  select array_agg(id order by seat) into v_seats from americain_players where game_id = p_game_id;
  v_n := array_length(v_seats, 1);
  select array_position(v_seats, v_me.id) into v_my_idx;

  if v_rank = '10' then
    update americain_games set direction = -direction where id = p_game_id;
  end if;

  select direction into v_step from americain_games where id = p_game_id;

  -- Valet, As, 2 : le joueur suivant est sauté. Pour As/2, il pioche d'abord.
  if v_rank in ('J', 'A', '2') then
    v_target_idx := ((v_my_idx - 1 + v_step) % v_n + v_n) % v_n + 1;
    v_target := v_seats[v_target_idx];

    if v_rank = 'A' then v_penalty := 1; end if;
    if v_rank = '2' then v_penalty := 3; end if;

    if v_penalty is not null then
      for i in 1..v_penalty loop
        v_drawn := americain_draw_one(p_game_id);
        update americain_hands set cards = coalesce(cards, '[]'::jsonb) || to_jsonb(v_drawn)
          where player_id = v_target;
      end loop;
      update americain_players set hand_count = hand_count + v_penalty where id = v_target;
    end if;

    v_target_idx := ((v_my_idx - 1 + 2 * v_step) % v_n + v_n) % v_n + 1;
  else
    v_target_idx := ((v_my_idx - 1 + v_step) % v_n + v_n) % v_n + 1;
  end if;

  update americain_games set current_player_id = v_seats[v_target_idx] where id = p_game_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Piocher. Voir l'assomption en tête de fichier pour la différence de
-- comportement pioche illimitée / pioche unique.
-- ---------------------------------------------------------------------------
create or replace function draw_card(p_game_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    americain_players;
  v_game  americain_games;
  v_card  text;
  v_seats uuid[];
  v_n     int;
  v_my_idx int;
  v_next_idx int;
begin
  select * into v_me from americain_players where game_id = p_game_id and user_id = auth.uid();
  if v_me.id is null then
    raise exception 'you are not in this game' using errcode = '42501';
  end if;

  select * into v_game from americain_games where id = p_game_id for update;
  if v_game.status <> 'playing' then
    raise exception 'game not started' using errcode = 'P0001';
  end if;
  if v_game.current_player_id <> v_me.id then
    raise exception 'not your turn' using errcode = 'P0001';
  end if;

  v_card := americain_draw_one(p_game_id);
  update americain_hands set cards = coalesce(cards, '[]'::jsonb) || to_jsonb(v_card)
    where player_id = v_me.id;
  update americain_players set hand_count = hand_count + 1 where id = v_me.id;

  if v_game.draw_mode = 'single' then
    select array_agg(id order by seat) into v_seats from americain_players where game_id = p_game_id;
    v_n := array_length(v_seats, 1);
    select array_position(v_seats, v_me.id) into v_my_idx;
    v_next_idx := ((v_my_idx - 1 + v_game.direction) % v_n + v_n) % v_n + 1;
    update americain_games set current_player_id = v_seats[v_next_idx] where id = p_game_id;
  end if;

  return v_card;
end;
$$;

grant execute on function play_card(uuid, text, text) to authenticated;
grant execute on function draw_card(uuid) to authenticated;
