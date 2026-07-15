-- Enchaînement des manches SANS repasser par le salon.
--
-- Avant : la fin d'une manche remettait la partie en 'lobby', ce qui renvoyait tous
-- les joueurs à l'écran de salon (re-choisir un pays, re-cliquer "prêt", l'hôte
-- re-"lancer"). Repasser par "choisis ton pays" ressemblait à une partie qui
-- recommence ou se termine.
--
-- Après : une fin de manche (hors dernière) passe la partie en INTERMISSION. Les
-- joueurs restent sur l'écran de jeu, voient les scores, rechoisissent un pays ; dès
-- que tout le monde a choisi, la manche suivante démarre automatiquement.

-- Marqueur d'intermission : distingue "entre deux manches" du salon initial.
-- (Plutôt qu'une nouvelle valeur d'enum : pas de risque de migration d'enum.)
alter table games add column intermission boolean not null default false;

-- close_round : la branche "manche suivante" bascule en intermission au lieu de
-- renvoyer au salon. La branche "fin de partie" est inchangée.
create or replace function close_round(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games;
  v_top  int;
begin
  select * into v_game from games where id = p_game_id;

  if v_game.round >= v_game.total_rounds then
    update games
      set status = 'finished', ended_at = now(), current_player_id = null,
          intermission = false
      where id = p_game_id;

    select max(score) into v_top from players where game_id = p_game_id;

    insert into player_stats (user_id, games_played, wins, total_points)
    select p.user_id, 1, case when p.score = v_top then 1 else 0 end, p.score
    from players p
    where p.game_id = p_game_id
    on conflict (user_id) do update set
      games_played = player_stats.games_played + 1,
      wins         = player_stats.wins + excluded.wins,
      total_points = player_stats.total_points + excluded.total_points;
  else
    -- On réinitialise l'état de MANCHE (pas les compteurs de PARTIE found/guess/letters).
    update players set
      masked = '', region = null, asked_letters = '{}', revealed_letters = '{}',
      is_cracked = false, is_eliminated = false, letters_left = 6,
      has_picked = false, is_ready = false
    where game_id = p_game_id;

    delete from player_secrets
    where player_id in (select id from players where game_id = p_game_id);

    -- INTERMISSION : on ne repasse pas par le salon. status reste 'lobby' (pour que
    -- pick_country fonctionne) mais intermission=true signale "entre deux manches".
    update games
      set round = round + 1, status = 'lobby', current_player_id = null,
          intermission = true
      where id = p_game_id;
  end if;
end;
$$;

-- pick_country : autorisé pendant le salon initial ET l'intermission. En intermission,
-- une fois que TOUT LE MONDE a choisi, la manche suivante démarre automatiquement —
-- plus besoin de "prêt" ni de l'hôte.
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
  v_count   int;
  v_starter uuid;
begin
  select * into v_me from players
  where game_id = p_game_id and user_id = auth.uid();

  if v_me.id is null then
    raise exception 'you are not in this game' using errcode = '42501';
  end if;

  select * into v_game from games where id = p_game_id;
  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  select * into v_country from countries where name = upper(trim(p_country));
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

  -- Démarrage automatique de la manche suivante : uniquement en intermission (le
  -- salon initial garde son "prêt" + lancement par l'hôte), et seulement quand tous
  -- ont choisi.
  if v_game.intermission
     and not exists (
       select 1 from players where game_id = p_game_id and not has_picked
     ) then
    select count(*) into v_count from players where game_id = p_game_id;

    -- Le premier joueur tourne à chaque manche, pour que ce ne soit pas toujours le
    -- même qui ouvre. On saute d'un siège par manche.
    select id into v_starter
    from players
    where game_id = p_game_id
    order by seat
    offset ((v_game.round - 1) % v_count)
    limit 1;

    update games
      set status = 'playing', intermission = false, current_player_id = v_starter
      where id = p_game_id;
  end if;
end;
$$;

grant execute on function pick_country(uuid, text) to authenticated;
