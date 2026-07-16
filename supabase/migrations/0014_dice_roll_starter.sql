-- Qui commence la partie ? On tire au dé, plutôt que de toujours donner la main au
-- créateur du salon (seat 0). Le dé est lancé PAR LE SERVEUR — un joueur ne peut pas
-- relancer chez lui jusqu'à tomber sur un 6.
--
-- Les égalités sont résolues par un second nombre aléatoire, invisible, tiré EN MÊME
-- TEMPS que le dé : pas besoin d'un écran de "relance entre les ex-æquo", le gagnant
-- est déterminable dès que tout le monde a lancé.

alter table players add column dice_roll     int;               -- 1 à 6, visible
alter table players add column dice_tiebreak double precision;  -- départage, invisible

-- Le joueur qui a gagné le lancer : sert de point de départ à la rotation des tours
-- d'une manche à l'autre (voir pick_country plus bas).
alter table games add column starter_player_id uuid references players(id) on delete set null;

create or replace function roll_dice(p_game_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   players;
  v_game games;
  v_roll int;
begin
  select * into v_me from players where game_id = p_game_id and user_id = auth.uid();
  if v_me.id is null then
    raise exception 'you are not in this game' using errcode = '42501';
  end if;

  select * into v_game from games where id = p_game_id;
  -- Le dé ne se lance qu'avant le tout premier lancement de la partie. started_at
  -- n'est posé qu'une fois (coalesce dans start_game), jamais réinitialisé entre les
  -- manches : c'est le bon marqueur, contrairement à status qui reste 'lobby' aussi
  -- pendant l'intermission.
  if v_game.started_at is not null then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  if v_me.dice_roll is not null then
    raise exception 'already rolled' using errcode = 'P0001';
  end if;

  v_roll := floor(random() * 6)::int + 1;

  update players set dice_roll = v_roll, dice_tiebreak = random() where id = v_me.id;

  return v_roll;
end;
$$;

grant execute on function roll_dice(uuid) to authenticated;

-- start_game : exige que tout le monde ait lancé le dé, et démarre avec le gagnant.
create or replace function start_game(p_game_id uuid)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game    games;
  v_starter uuid;
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

  if exists (select 1 from players where game_id = p_game_id and dice_roll is null) then
    raise exception 'everyone must roll the dice' using errcode = 'P0001';
  end if;

  select id into v_starter
  from players
  where game_id = p_game_id
  order by dice_roll desc, dice_tiebreak desc
  limit 1;

  update games set
    status             = 'playing',
    started_at         = coalesce(started_at, now()),
    starter_player_id  = v_starter,
    current_player_id  = v_starter
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

-- pick_country : la rotation "un joueur différent ouvre chaque manche" se calcule
-- maintenant depuis starter_player_id (le gagnant du dé), pas depuis le seat 0.
-- On prend son rang parmi les joueurs triés par seat, et on avance de (round-1) rangs.
drop function if exists pick_country(uuid, text);

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
    with ordered as (
      select id, row_number() over (order by seat) - 1 as rn, count(*) over () as n
      from players where game_id = p_game_id
    )
    select o.id into v_starter
    from ordered o
    where o.rn = (
      coalesce((select rn from ordered where id = v_game.starter_player_id), 0)
      + (v_game.round - 1)
    ) % (select n from ordered limit 1);

    update games set status = 'playing', intermission = false, current_player_id = v_starter
      where id = p_game_id;
  end if;
end;
$$;

grant execute on function pick_country(uuid, text) to authenticated;
