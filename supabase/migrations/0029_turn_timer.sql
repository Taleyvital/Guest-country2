-- 20 secondes par tour : passé ce délai, n'importe quel téléphone de la partie peut
-- forcer le passage au joueur suivant. Pas de cron/pg_net : chaque client compte le
-- temps localement (depuis `turn_started_at`) et appelle `skip_turn_if_expired` une
-- fois à zéro — le serveur revalide le délai, donc un appel prématuré ou en double
-- ne fait rien (le second arrivé retombe sur un tour déjà avancé).
alter table games add column turn_started_at timestamptz;

-- ---------------------------------------------------------------------------
-- advance_turn : pose `turn_started_at` à chaque bascule de tour, y compris
-- quand il n'y a plus personne (v_next_id null -> la manche se ferme ailleurs).
-- ---------------------------------------------------------------------------
create or replace function advance_turn(p_game_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_seat int;
  v_next_id      uuid;
begin
  select p.seat into v_current_seat
  from games g join players p on p.id = g.current_player_id
  where g.id = p_game_id;

  select p.id into v_next_id
  from players p
  where p.game_id = p_game_id
    and not p.is_eliminated
    and exists (
      select 1 from players t
      where t.game_id = p_game_id and t.id <> p.id and not t.is_cracked
    )
  order by (p.seat > coalesce(v_current_seat, -1)) desc, p.seat
  limit 1;

  update games
    set current_player_id = v_next_id,
        turn_started_at   = case when v_next_id is not null then now() else null end
    where id = p_game_id;

  return v_next_id is not null;
end;
$$;

-- start_game : pose le chrono du tout premier tour de la manche.
create or replace function start_game(p_game_id uuid)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games;
begin
  select * into v_game from games where id = p_game_id;

  if v_game.id is null then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from players where id = v_game.host_id and user_id = auth.uid()
  ) then
    raise exception 'only the host can start the game' using errcode = '42501';
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  if (select count(*) from players where game_id = p_game_id) < 2 then
    raise exception 'need at least 2 players' using errcode = 'P0001';
  end if;

  if exists (select 1 from players where game_id = p_game_id and not has_picked) then
    raise exception 'everyone must pick a country' using errcode = 'P0001';
  end if;

  update games set
    status            = 'playing',
    started_at        = coalesce(started_at, now()),
    current_player_id = (select id from players where game_id = p_game_id order by seat limit 1),
    turn_started_at    = now()
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

-- ---------------------------------------------------------------------------
-- Passe la main si le joueur courant a dépassé son délai. Appelable par
-- n'importe quel joueur DE LA PARTIE (pas juste le joueur actif) : c'est
-- justement lui qui ne répond pas, il ne faut pas dépendre de son téléphone.
-- ---------------------------------------------------------------------------
create or replace function skip_turn_if_expired(p_game_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game    games;
  v_current players;
begin
  if not exists (
    select 1 from players where game_id = p_game_id and user_id = auth.uid()
  ) then
    raise exception 'you are not in this game' using errcode = '42501';
  end if;

  select * into v_game from games where id = p_game_id;
  if v_game.id is null or v_game.status <> 'playing' or v_game.current_player_id is null then
    return false;
  end if;

  -- Marge de 20s : un appel un peu tôt (horloges client désynchronisées) est un
  -- no-op plutôt qu'un tour volé.
  if v_game.turn_started_at is null or now() - v_game.turn_started_at < interval '20 seconds' then
    return false;
  end if;

  select * into v_current from players where id = v_game.current_player_id;

  insert into game_events (game_id, type, actor_id, target_id, payload)
  values (p_game_id, 'turn_skipped', v_current.id, null, '{}'::jsonb);

  if not advance_turn(p_game_id) then
    perform close_round(p_game_id);
  end if;

  return true;
end;
$$;

grant execute on function skip_turn_if_expired(uuid) to authenticated;

-- pick_country : redéfinie pour poser aussi turn_started_at quand l'intermission
-- se termine et que la manche suivante démarre (sinon le tout premier tour de la
-- manche n'aurait pas de chrono).
create or replace function pick_country(p_game_id uuid, p_country text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me      players;
  v_game    games;
  v_country countries;
  v_count   int;
  v_starter uuid;
begin
  select * into v_me from players where game_id = p_game_id and user_id = auth.uid();
  if v_me.id is null then
    raise exception 'you are not in this game' using errcode = '42501';
  end if;

  select * into v_game from games where id = p_game_id;
  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  select * into v_country from countries
  where norm_country(name) = norm_country(p_country)
  limit 1;
  if v_country.name is null then
    raise exception 'unknown country' using errcode = 'P0002';
  end if;

  insert into player_secrets (player_id, country, region)
  values (v_me.id, v_country.name, v_country.region)
  on conflict (player_id) do update
    set country = excluded.country, region = excluded.region;

  update players set
    masked           = mask_country(v_country.name, '{}'),
    region           = v_country.region,
    revealed_letters = '{}',
    asked_letters    = '{}',
    has_picked       = true
  where id = v_me.id;

  if v_game.intermission
     and not exists (select 1 from players where game_id = p_game_id and not has_picked) then
    select count(*) into v_count from players where game_id = p_game_id;
    select id into v_starter from players where game_id = p_game_id
      order by seat offset ((v_game.round - 1) % v_count) limit 1;
    update games set
      status = 'playing', intermission = false,
      current_player_id = v_starter, turn_started_at = now()
      where id = p_game_id;
  end if;
end;
$$;

grant execute on function pick_country(uuid, text) to authenticated;
