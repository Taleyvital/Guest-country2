-- 8 Américain : nombre de manches réglable avant de lancer la partie (au lieu
-- de dépendre uniquement du seuil de pénalité). Par défaut 5 manches.
--
-- La partie s'arrête maintenant sur DEUX conditions (la première atteinte) :
--   - un joueur atteint penalty_threshold (comportement existant)
--   - la manche qui vient de se terminer est la max_rounds-ième
-- Dans les deux cas, le gagnant reste celui qui a la pénalité la plus basse.

alter table americain_games
  add column max_rounds int not null default 5 check (max_rounds > 0);

drop function if exists create_americain_game(text, int, americain_draw_mode, int);

create or replace function create_americain_game(
  p_nickname text,
  p_max_players int default 6,
  p_draw_mode americain_draw_mode default 'unlimited',
  p_penalty_threshold int default 100,
  p_max_rounds int default 5
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

  insert into americain_games (max_players, draw_mode, penalty_threshold, max_rounds)
  values (p_max_players, p_draw_mode, p_penalty_threshold, p_max_rounds)
  returning * into v_game;

  insert into americain_players (game_id, user_id, nickname, is_host, seat)
  values (v_game.id, auth.uid(), p_nickname, true, 0)
  returning * into v_player;

  update americain_games set host_id = v_player.id where id = v_game.id returning * into v_game;

  return v_game;
end;
$$;

grant execute on function create_americain_game(text, int, americain_draw_mode, int, int) to authenticated;

create or replace function americain_end_round(p_game_id uuid, p_winner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game        americain_games;
  v_over        boolean;
  v_penalties   jsonb;
  v_last_place  uuid;
  v_game_winner uuid;
begin
  select coalesce(jsonb_object_agg(p.id, p.hand_count), '{}'::jsonb) into v_penalties
  from americain_players p
  where p.game_id = p_game_id and p.id <> p_winner_id and p.hand_count > 0;

  update americain_players p set penalty_score = penalty_score + p.hand_count
  where p.game_id = p_game_id and p.id <> p_winner_id;

  insert into americain_events (game_id, type, actor_id, payload)
  values (p_game_id, 'round_won', p_winner_id, jsonb_build_object('penalties', v_penalties));

  select * into v_game from americain_games where id = p_game_id;

  select exists (
    select 1 from americain_players
    where game_id = p_game_id and penalty_score >= v_game.penalty_threshold
  ) or v_game.round >= v_game.max_rounds into v_over;

  if v_over then
    -- Le gagnant DE LA PARTIE (pénalité la plus basse au global) n'est pas
    -- forcément celui qui vient de gagner cette dernière manche.
    select id into v_game_winner
    from americain_players
    where game_id = p_game_id
    order by penalty_score asc
    limit 1;

    select id into v_last_place
    from americain_players
    where game_id = p_game_id
    order by penalty_score desc
    limit 1;

    update americain_games set status = 'finished', ended_at = now(), current_player_id = null
      where id = p_game_id;

    insert into americain_events (game_id, type, actor_id, target_id)
    values (p_game_id, 'game_won', v_game_winner, v_last_place);
  else
    update americain_games set round = round + 1 where id = p_game_id;
    perform americain_deal(p_game_id);
  end if;
end;
$$;
