-- Rattacher les RPC à UNE partie.
--
-- Bug : toutes ces fonctions résolvaient l'appelant par
--     select * into v_me from players where user_id = auth.uid() [limit 1]
-- sans préciser DE QUELLE PARTIE. Un joueur qui a plusieurs lignes `players`
-- (parties successives, tests, salons quittés sans leave_game) voyait Postgres en
-- choisir une arbitrairement.
--
-- Conséquences observées :
--   - ask_letter prenait ma place dans une AUTRE partie, où la cible n'existe pas
--     -> "target not in this game", alors que l'UI visait le bon joueur.
--   - leave_game pouvait me sortir de la mauvaise partie (le plus grave).
--   - pick_country pouvait écrire le pays sur le mauvais salon.
--
-- Correctif : la partie devient un paramètre explicite. Pour ask_letter et
-- submit_guess, on la déduit de LA CIBLE — le client n'a rien de plus à envoyer, et
-- l'identité de l'appelant ne peut plus « dériver » vers une autre table.

-- ---------------------------------------------------------------------------
create or replace function ask_letter(p_target_player_id uuid, p_letter text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me     players;
  v_target players;
  v_game   games;
  v_secret player_secrets;
  v_letter text := upper(trim(p_letter));
  v_found  boolean;
begin
  if v_letter !~ '^[A-Z]$' then
    raise exception 'invalid letter' using errcode = 'P0001';
  end if;

  -- LA CIBLE D'ABORD : c'est elle qui détermine la partie concernée.
  select * into v_target from players where id = p_target_player_id;
  if v_target.id is null then
    raise exception 'target not found' using errcode = 'P0002';
  end if;

  -- Puis MOI, dans CETTE partie-là.
  select * into v_me
  from players
  where game_id = v_target.game_id and user_id = auth.uid();

  if v_me.id is null then
    raise exception 'you are not in this game' using errcode = '42501';
  end if;

  select * into v_game from games where id = v_target.game_id;

  if v_game.current_player_id is distinct from v_me.id then
    raise exception 'not your turn' using errcode = '42501';
  end if;
  if v_game.status <> 'playing' then
    raise exception 'game is not running' using errcode = 'P0001';
  end if;
  if v_me.letters_left <= 0 then
    raise exception 'no letters left' using errcode = 'P0001';
  end if;
  if v_target.id = v_me.id then
    raise exception 'cannot target yourself' using errcode = 'P0001';
  end if;
  if v_target.is_cracked then
    raise exception 'this country is already found' using errcode = 'P0001';
  end if;
  if v_letter = any(v_target.asked_letters) then
    raise exception 'letter already asked on this player' using errcode = 'P0001';
  end if;

  select * into v_secret from player_secrets where player_id = v_target.id;
  v_found := position(v_letter in v_secret.country) > 0;

  update players set
    asked_letters    = asked_letters || v_letter,
    revealed_letters = case when v_found then revealed_letters || v_letter else revealed_letters end,
    masked           = case when v_found
                            then mask_country(v_secret.country, revealed_letters || v_letter)
                            else masked end
  where id = v_target.id;

  update players set
    letters_left = letters_left - 1,
    score        = score - 50
  where id = v_me.id;

  perform bump_stats(auth.uid(), 0, 0, 1);

  insert into game_events (game_id, type, actor_id, target_id, payload)
  values (v_me.game_id, 'ask_letter', v_me.id, v_target.id,
          jsonb_build_object('letter', v_letter, 'found', v_found));

  if not advance_turn(v_me.game_id) then
    perform close_round(v_me.game_id);
  end if;

  return v_found;
end;
$$;

-- ---------------------------------------------------------------------------
drop function if exists submit_guess(uuid, text);

create or replace function submit_guess(p_target_player_id uuid, p_guess text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me      players;
  v_target  players;
  v_game    games;
  v_secret  player_secrets;
  v_guess   text := upper(trim(p_guess));
  v_correct boolean;
  v_points  int := 0;
begin
  select * into v_target from players where id = p_target_player_id;
  if v_target.id is null then
    raise exception 'target not found' using errcode = 'P0002';
  end if;

  select * into v_me
  from players
  where game_id = v_target.game_id and user_id = auth.uid();

  if v_me.id is null then
    raise exception 'you are not in this game' using errcode = '42501';
  end if;

  select * into v_game from games where id = v_target.game_id;

  if v_game.current_player_id is distinct from v_me.id then
    raise exception 'not your turn' using errcode = '42501';
  end if;
  if v_game.status <> 'playing' then
    raise exception 'game is not running' using errcode = 'P0001';
  end if;
  if v_target.id = v_me.id or v_target.is_cracked then
    raise exception 'invalid target' using errcode = 'P0001';
  end if;

  select * into v_secret from player_secrets where player_id = v_target.id;
  v_correct := v_guess = v_secret.country;

  if v_correct then
    v_points := 500 + 100 * v_me.letters_left;
    update players set score = score + v_points where id = v_me.id;
    update players set is_cracked = true, masked = v_secret.country where id = v_target.id;

    insert into discoveries (user_id, country)
    values (auth.uid(), v_secret.country)
    on conflict (user_id, country) do update
      set times = discoveries.times + 1, last_at = now();

    insert into game_events (game_id, type, actor_id, target_id, payload)
    values (v_me.game_id, 'guess', v_me.id, v_target.id,
            jsonb_build_object('guess', v_guess, 'correct', true));
  else
    v_points := -100;
    update players set is_eliminated = true, score = score - 100 where id = v_me.id;

    insert into game_events (game_id, type, actor_id, target_id, payload)
    values (v_me.game_id, 'eliminated', v_me.id, v_target.id,
            jsonb_build_object('guess', v_guess, 'correct', false));
  end if;

  perform bump_stats(auth.uid(), 1, case when v_correct then 1 else 0 end, 0);

  if not advance_turn(v_me.game_id) then
    perform close_round(v_me.game_id);
  end if;

  return jsonb_build_object(
    'correct',      v_correct,
    'country',      case when v_correct then v_secret.country else null end,
    'points',       v_points,
    'letters_left', v_me.letters_left,
    'letters_used', 6 - v_me.letters_left
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- pick_country / my_country / leave_game : la partie devient explicite.
-- ---------------------------------------------------------------------------
drop function if exists pick_country(text);

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
end;
$$;

drop function if exists my_country();

create or replace function my_country(p_game_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_country text;
begin
  select s.country into v_country
  from player_secrets s
  join players p on p.id = s.player_id
  where p.game_id = p_game_id and p.user_id = auth.uid();

  return v_country;
end;
$$;

drop function if exists leave_game();

create or replace function leave_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       players;
  v_game     games;
  v_was_turn boolean;
  v_new_host uuid;
begin
  -- Scopé à la partie : la version précédente faisait `limit 1` sur toutes mes
  -- lignes et pouvait me sortir d'une partie que je n'avais pas demandé à quitter.
  select * into v_me from players
  where game_id = p_game_id and user_id = auth.uid();

  if v_me.id is null then
    return; -- déjà sorti : ce n'est pas une erreur
  end if;

  select * into v_game from games where id = p_game_id;
  v_was_turn := v_game.current_player_id = v_me.id;

  if v_was_turn then
    update games set current_player_id = null where id = v_game.id;
  end if;

  if v_game.host_id = v_me.id then
    select id into v_new_host
    from players
    where game_id = v_game.id and id <> v_me.id
    order by seat
    limit 1;

    update games set host_id = v_new_host where id = v_game.id;
    update players set is_host = true where id = v_new_host;
  end if;

  delete from player_secrets where player_id = v_me.id;
  delete from players where id = v_me.id;

  if not exists (select 1 from players where game_id = v_game.id) then
    delete from games where id = v_game.id;
    return;
  end if;

  if v_game.status = 'playing'
     and (select count(*) from players where game_id = v_game.id) < 2 then
    update games set status = 'finished', ended_at = now(), current_player_id = null
    where id = v_game.id;
    return;
  end if;

  if v_was_turn and v_game.status = 'playing' then
    if not advance_turn(v_game.id) then
      perform close_round(v_game.id);
    end if;
  end if;
end;
$$;

grant execute on function ask_letter(uuid, text)        to authenticated;
grant execute on function submit_guess(uuid, text)      to authenticated;
grant execute on function pick_country(uuid, text)      to authenticated;
grant execute on function my_country(uuid)              to authenticated;
grant execute on function leave_game(uuid)              to authenticated;
