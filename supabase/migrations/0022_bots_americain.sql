-- Bots pour 8 Américain.

alter table americain_players add column is_bot boolean not null default false;

-- ---------------------------------------------------------------------------
-- Complète jusqu'à max_players (déjà choisi à la création de la table) avec
-- des bots prêts à jouer — il n'y a rien d'autre à préparer pour eux ici
-- (pas de pays à choisir, contrairement à Country Guess).
-- ---------------------------------------------------------------------------
create or replace function fill_americain_lobby_with_bots(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game       americain_games;
  v_have       int;
  v_bot_number int;
  v_bot_uid    uuid;
  v_seat       int;
begin
  select * into v_game from americain_games where id = p_game_id;
  if v_game.id is null then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from americain_players where id = v_game.host_id and user_id = auth.uid()) then
    raise exception 'only the host can fill with bots' using errcode = '42501';
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  select count(*) into v_have from americain_players where game_id = p_game_id;
  select count(*) into v_bot_number from americain_players where game_id = p_game_id and is_bot;

  while v_have < v_game.max_players loop
    v_bot_number := v_bot_number + 1;
    v_bot_uid    := create_bot_auth_user('Bot ' || v_bot_number);
    v_seat       := americain_next_seat(p_game_id);

    insert into americain_players (game_id, user_id, nickname, seat, is_bot, is_ready)
    values (p_game_id, v_bot_uid, 'Bot ' || v_bot_number, v_seat, true, true);

    v_have := v_have + 1;
  end loop;
end;
$$;

grant execute on function fill_americain_lobby_with_bots(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- play_card / draw_card : identiques à 0016/0018, seule l'identité de
-- l'appelant change (voir effective_uid, 0020_bots_shared.sql).
--
-- DROP d'abord : ajouter un paramètre créerait sinon une surcharge en plus de
-- l'ancienne signature, et PostgREST ne saurait plus choisir laquelle appeler
-- (voir le même commentaire dans 0021_bots_country_guess.sql).
-- ---------------------------------------------------------------------------
drop function if exists play_card(uuid, text, text);
drop function if exists draw_card(uuid);

create or replace function play_card(
  p_game_id uuid,
  p_card text,
  p_chosen_color text default null,
  p_actor_user_id uuid default null
)
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
  v_seats    uuid[];
  v_my_idx   int;
  v_step     int;
  v_target_idx int;
  v_target   uuid;
  v_penalty  int;
  v_drawn    text;
  v_uid      uuid := effective_uid(p_actor_user_id);
begin
  select * into v_me from americain_players where game_id = p_game_id and user_id = v_uid;
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

create or replace function draw_card(p_game_id uuid, p_actor_user_id uuid default null)
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
  v_uid   uuid := effective_uid(p_actor_user_id);
begin
  select * into v_me from americain_players where game_id = p_game_id and user_id = v_uid;
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

  select array_agg(id order by seat) into v_seats from americain_players where game_id = p_game_id;
  v_n := array_length(v_seats, 1);
  select array_position(v_seats, v_me.id) into v_my_idx;
  v_next_idx := ((v_my_idx - 1 + v_game.direction) % v_n + v_n) % v_n + 1;
  update americain_games set current_player_id = v_seats[v_next_idx] where id = p_game_id;

  return v_card;
end;
$$;

grant execute on function play_card(uuid, text, text, uuid) to authenticated;
grant execute on function draw_card(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Déclenchement du tour bot — même principe que resolve_bot_turn_country_guess.
-- ---------------------------------------------------------------------------
create or replace function resolve_bot_turn_americain()
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

  select is_bot into v_is_bot from americain_players where id = new.current_player_id;
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
    body    := jsonb_build_object('game_type', 'americain', 'game_id', new.id)
  );

  return new;
exception when others then
  return new;
end;
$$;

create trigger on_turn_change_bot
  after update of current_player_id on americain_games
  for each row execute function resolve_bot_turn_americain();
