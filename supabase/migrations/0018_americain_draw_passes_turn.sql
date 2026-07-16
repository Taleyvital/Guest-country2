-- Correction de règle (retour joueur) : piocher passe TOUJOURS le tour, que la
-- pioche soit "illimitée" ou "unique". L'hypothèse du 0016 (en pioche illimitée,
-- le joueur restait actif pour piocher jusqu'à obtenir une carte jouable, puis
-- la jouer dans le même tour) ne correspond pas au jeu attendu : dans les deux
-- modes, un draw_card met fin au tour, un point c'est tout. La différence entre
-- les deux modes n'était de toute façon pas assez incarnée pour justifier deux
-- comportements de fin de tour distincts.

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

  select array_agg(id order by seat) into v_seats from americain_players where game_id = p_game_id;
  v_n := array_length(v_seats, 1);
  select array_position(v_seats, v_me.id) into v_my_idx;
  v_next_idx := ((v_my_idx - 1 + v_game.direction) % v_n + v_n) % v_n + 1;
  update americain_games set current_player_id = v_seats[v_next_idx] where id = p_game_id;

  return v_card;
end;
$$;
