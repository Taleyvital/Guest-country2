-- Bots pour Country Guess.

alter table players add column is_bot boolean not null default false;

-- ---------------------------------------------------------------------------
-- Compléter le salon avec des bots — l'hôte choisit combien de joueurs il veut
-- au total ; les places manquantes sont remplies par des bots déjà prêts à
-- jouer (pays choisi, dé lancé) puisque personne ne cliquera pour eux.
-- ---------------------------------------------------------------------------
create or replace function fill_lobby_with_bots(p_game_id uuid, p_target_players int default 4)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game       games;
  v_have       int;
  v_bot_number int;
  v_bot_uid    uuid;
  v_bot_id     uuid;
  v_seat       int;
  v_country    countries;
begin
  select * into v_game from games where id = p_game_id;
  if v_game.id is null then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from players where id = v_game.host_id and user_id = auth.uid()) then
    raise exception 'only the host can fill with bots' using errcode = '42501';
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  if p_target_players < 2 or p_target_players > 8 then
    raise exception 'invalid player count' using errcode = 'P0001';
  end if;

  select count(*) into v_have from players where game_id = p_game_id;
  select count(*) into v_bot_number from players where game_id = p_game_id and is_bot;

  while v_have < p_target_players loop
    v_bot_number := v_bot_number + 1;
    v_bot_uid    := create_bot_auth_user('Bot ' || v_bot_number);
    v_seat       := next_seat(p_game_id);

    insert into players (game_id, user_id, nickname, seat, is_bot, is_ready)
    values (p_game_id, v_bot_uid, 'Bot ' || v_bot_number, v_seat, true, true)
    returning id into v_bot_id;

    -- Pays au hasard, si possible différent de ceux déjà pris dans CETTE partie —
    -- un vrai joueur éviterait spontanément le doublon, mais ce n'est pas une
    -- règle du jeu : un doublon reste légal si le pool est trop petit.
    select * into v_country from countries
    where name not in (
      coalesce((
        select array_agg(s.country) from player_secrets s
        join players p on p.id = s.player_id
        where p.game_id = p_game_id
      ), array[]::text[])
    )
    order by random() limit 1;

    if v_country.name is null then
      select * into v_country from countries order by random() limit 1;
    end if;

    insert into player_secrets (player_id, country, region)
    values (v_bot_id, v_country.name, v_country.region);

    update players set
      masked     = mask_country(v_country.name, '{}'),
      region     = v_country.region,
      has_picked = true,
      dice_roll  = floor(random() * 6)::int + 1,
      dice_tiebreak = random()
    where id = v_bot_id;

    v_have := v_have + 1;
  end loop;
end;
$$;

grant execute on function fill_lobby_with_bots(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- ask_letter : identique à 0006, seule l'identité de l'appelant change — un bot
-- (Edge Function, service_role) peut désormais agir à la place de auth.uid().
--
-- DROP d'abord : `create or replace` ne remplace une fonction que si la liste
-- de paramètres est IDENTIQUE. Ajouter p_actor_user_id créerait sinon une
-- SURCHARGE en plus de l'ancienne (uuid, text) — et PostgREST, recevant un
-- appel à 2 arguments nommés, ne saurait plus choisir entre les deux
-- (« could not choose a best candidate function »).
-- ---------------------------------------------------------------------------
drop function if exists ask_letter(uuid, text);

create or replace function ask_letter(
  p_target_player_id uuid,
  p_letter text,
  p_actor_user_id uuid default null
)
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
  v_uid    uuid := effective_uid(p_actor_user_id);
begin
  if v_letter !~ '^[A-Z]$' then
    raise exception 'invalid letter' using errcode = 'P0001';
  end if;

  select * into v_target from players where id = p_target_player_id;
  if v_target.id is null then
    raise exception 'target not found' using errcode = 'P0002';
  end if;

  select * into v_me
  from players
  where game_id = v_target.game_id and user_id = v_uid;

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

  perform bump_stats(v_uid, 0, 0, 1);

  insert into game_events (game_id, type, actor_id, target_id, payload)
  values (v_me.game_id, 'ask_letter', v_me.id, v_target.id,
          jsonb_build_object('letter', v_letter, 'found', v_found));

  if not advance_turn(v_me.game_id) then
    perform close_round(v_me.game_id);
  end if;

  return v_found;
end;
$$;

grant execute on function ask_letter(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Déclenchement du tour bot — même schéma que notify_turn_change (0008) :
-- trigger silencieux si non configuré. Réglages via app_settings, pas
-- current_setting : voir 0023_bot_settings_table.sql (ALTER DATABASE SET
-- demande un privilège que Supabase n'accorde pas sur les projets hébergés).
-- ---------------------------------------------------------------------------
create or replace function resolve_bot_turn_country_guess()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := current_setting('app.bot_url', true);
  v_key text := current_setting('app.bot_key', true);
  v_is_bot boolean;
begin
  if new.current_player_id is null
     or new.current_player_id is not distinct from old.current_player_id then
    return new;
  end if;

  select is_bot into v_is_bot from players where id = new.current_player_id;
  if not coalesce(v_is_bot, false) then
    return new;
  end if;

  if v_url is null or v_key is null then
    return new;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('game_type', 'country_guess', 'game_id', new.id)
  );

  return new;
exception when others then
  -- Un bot en retard n'est jamais pire qu'une partie bloquée : on n'échoue jamais
  -- le vrai changement de tour pour ça.
  return new;
end;
$$;

create trigger on_turn_change_bot
  after update of current_player_id on games
  for each row execute function resolve_bot_turn_country_guess();
