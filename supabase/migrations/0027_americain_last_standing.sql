-- 8 Américain : la manche ne s'arrête plus dès que LE PREMIER joueur vide sa
-- main. Elle continue — les joueurs qui finissent sont "sortis" (ils ne
-- rejouent plus ce tour-ci, sautés par le Valet/As/2/pioche) — jusqu'à ce
-- qu'il ne reste plus qu'UN SEUL joueur avec des cartes : c'est lui le
-- perdant de la manche (pénalité = cartes qui lui restent en main), tous les
-- autres ont déjà 0 carte donc 0 pénalité. Le premier sorti garde le crédit
-- affiché de "vainqueur de la manche" (round_first_out).
--
-- Ça change la rotation du tour : au lieu de faire tourner TOUS les sièges
-- (comme avant), on ne fait tourner que les joueurs encore actifs
-- (hand_count > 0) — americain_seat_after() ci-dessous, utilisé par
-- play_card, draw_card et leave_americain_game.

alter table americain_games
  add column round_first_out uuid references americain_players(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Prochain joueur ACTIF (hand_count > 0) après p_seat dans le sens p_direction,
-- en bouclant. Un joueur qui a fini sa main n'est plus jamais renvoyé : c'est
-- ce qui matérialise "il est sorti de la manche", que ce soit pour le tour
-- normal, un Valet/As/2, ou un joueur qui quitte la partie en plein tour.
-- ---------------------------------------------------------------------------
create or replace function americain_seat_after(p_game_id uuid, p_seat int, p_direction int)
returns uuid
language plpgsql
stable
as $$
declare
  v_target uuid;
begin
  if p_direction = 1 then
    select id into v_target from americain_players
      where game_id = p_game_id and hand_count > 0 and seat > p_seat
      order by seat asc limit 1;
    if v_target is null then
      select id into v_target from americain_players
        where game_id = p_game_id and hand_count > 0
        order by seat asc limit 1;
    end if;
  else
    select id into v_target from americain_players
      where game_id = p_game_id and hand_count > 0 and seat < p_seat
      order by seat desc limit 1;
    if v_target is null then
      select id into v_target from americain_players
        where game_id = p_game_id and hand_count > 0
        order by seat desc limit 1;
    end if;
  end if;
  return v_target;
end;
$$;

-- ---------------------------------------------------------------------------
-- americain_deal : identique à 0017, + reset de round_first_out pour la
-- nouvelle manche.
-- ---------------------------------------------------------------------------
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
  v_remaining jsonb;
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

  select e into v_starter
  from jsonb_array_elements_text(v_deck) with ordinality as t(e, ord)
  where ord = i;

  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_remaining
  from jsonb_array_elements_text(v_deck) with ordinality as t(e, ord)
  where ord > i;

  update americain_state set
    deck    = v_remaining,
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
    direction         = 1,
    deck_count        = jsonb_array_length(v_remaining),
    round_first_out   = null
  where id = p_game_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- play_card : même signature que 0022 (support bot inchangé). Ne termine plus
-- la manche au premier joueur à 0 carte — voir le commentaire en tête de
-- fichier.
-- ---------------------------------------------------------------------------
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
  v_me            americain_players;
  v_game          americain_games;
  v_cards         jsonb;
  v_suit          text;
  v_rank          text;
  v_step          int;
  v_target        uuid;
  v_skip_seat     int;
  v_penalty       int;
  v_drawn         text;
  v_active_count  int;
  v_uid           uuid := effective_uid(p_actor_user_id);
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

  -- Ce joueur vient peut-être de sortir de la manche (plus aucune carte).
  if (select hand_count from americain_players where id = v_me.id) = 0 then
    if v_game.round_first_out is null then
      update americain_games set round_first_out = v_me.id where id = p_game_id;
      v_game.round_first_out := v_me.id;
    end if;

    select count(*) into v_active_count from americain_players
      where game_id = p_game_id and hand_count > 0;

    -- Plus qu'un seul joueur avec des cartes (ou zéro) : la manche s'arrête,
    -- il est le perdant.
    if v_active_count <= 1 then
      perform americain_end_round(p_game_id, v_game.round_first_out);
      return;
    end if;
  end if;

  if v_rank = '10' then
    update americain_games set direction = -direction where id = p_game_id;
  end if;

  select direction into v_step from americain_games where id = p_game_id;

  if v_rank in ('J', 'A', '2') then
    -- Joueur actif suivant : sauté (et pénalisé pour As/2).
    v_target := americain_seat_after(p_game_id, v_me.seat, v_step);

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

    select seat into v_skip_seat from americain_players where id = v_target;
    v_target := americain_seat_after(p_game_id, v_skip_seat, v_step);
  else
    v_target := americain_seat_after(p_game_id, v_me.seat, v_step);
  end if;

  update americain_games set current_player_id = v_target where id = p_game_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- draw_card : même signature que 0022, tour passé au prochain joueur ACTIF.
-- ---------------------------------------------------------------------------
create or replace function draw_card(p_game_id uuid, p_actor_user_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me     americain_players;
  v_game   americain_games;
  v_card   text;
  v_target uuid;
  v_uid    uuid := effective_uid(p_actor_user_id);
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

  v_target := americain_seat_after(p_game_id, v_me.seat, v_game.direction);
  update americain_games set current_player_id = v_target where id = p_game_id;

  return v_card;
end;
$$;

grant execute on function play_card(uuid, text, text, uuid) to authenticated;
grant execute on function draw_card(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- leave_americain_game (0026) : la rotation de tour doit ignorer les joueurs
-- déjà sortis de la manche (hand_count = 0), comme le reste — sinon on
-- pourrait renvoyer le tour à quelqu'un qui n'a plus de cartes à jouer.
-- Ajoute aussi le cas où le départ laisse la manche avec ≤ 1 joueur actif :
-- elle doit se terminer immédiatement, sans quoi la partie resterait bloquée
-- en attendant un tour que plus personne ne peut jouer.
-- ---------------------------------------------------------------------------
create or replace function leave_americain_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me        americain_players;
  v_game      americain_games;
  v_was_turn  boolean;
  v_new_host  uuid;
  v_target    uuid;
  v_remaining int;
  v_active    int;
begin
  select * into v_me from americain_players
  where game_id = p_game_id and user_id = auth.uid();

  if v_me.id is null then
    return; -- déjà sorti : ce n'est pas une erreur
  end if;

  select * into v_game from americain_games where id = p_game_id for update;
  v_was_turn := v_game.current_player_id = v_me.id;

  if v_game.host_id = v_me.id then
    select id into v_new_host
    from americain_players
    where game_id = v_game.id and id <> v_me.id
    order by seat
    limit 1;
  end if;

  delete from americain_players where id = v_me.id;
  -- americain_hands suit en cascade (FK on delete cascade sur player_id).

  select count(*) into v_remaining from americain_players where game_id = v_game.id;

  if v_remaining = 0 then
    delete from americain_games where id = v_game.id;
    return;
  end if;

  if v_new_host is not null then
    update americain_games set host_id = v_new_host where id = v_game.id;
    update americain_players set is_host = true where id = v_new_host;
  end if;

  if v_game.status = 'playing' and v_remaining < 2 then
    update americain_games set status = 'finished', ended_at = now(), current_player_id = null
    where id = v_game.id;
    return;
  end if;

  if v_game.status = 'playing' then
    select count(*) into v_active from americain_players
      where game_id = v_game.id and hand_count > 0;

    if v_active <= 1 then
      perform americain_end_round(
        v_game.id,
        coalesce(
          v_game.round_first_out,
          (select id from americain_players where game_id = v_game.id order by seat limit 1)
        )
      );
      return;
    end if;

    if v_was_turn then
      v_target := americain_seat_after(v_game.id, v_me.seat, v_game.direction);
      update americain_games set current_player_id = v_target where id = v_game.id;
    end if;
  end if;
end;
$$;

grant execute on function leave_americain_game(uuid) to authenticated;
