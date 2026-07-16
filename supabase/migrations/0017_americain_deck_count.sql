-- Expose le nombre de cartes restantes dans la pioche, PUBLIQUEMENT — jamais leur
-- contenu ni leur ordre (americain_state reste sans aucune policy). Sert uniquement
-- à afficher le badge "12 cartes" sur le dos de la pioche : un compte ne révèle rien
-- qu'un joueur ne puisse déjà déduire (52 - cartes distribuées - cartes défaussées).

alter table americain_games add column deck_count int not null default 0;

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
  update americain_games set deck_count = jsonb_array_length(v_rest) where id = p_game_id;

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
    deck_count        = jsonb_array_length(v_remaining)
  where id = p_game_id;
end;
$$;
