-- 8 Américain : bouton retour "quitter ou accueil", comme le jeu principal
-- (voir components/game/LeaveDialog.tsx). Il manquait le pendant de leave_game
-- (0006_scope_rpc_to_game.sql) pour americain_players/americain_games : sans
-- ça, partir depuis ce bouton ne libérerait ni le siège, ni le tour si
-- c'était le sien, ni l'hôte.
--
-- Contrairement à la note du 0016 ("un joueur qui quitte en cours de partie
-- n'est pas re-siégé"), cette fonction gère maintenant ce cas : le tour passe
-- au joueur suivant dans le sens courant, calculé sur les sièges restants.

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

  if v_was_turn and v_game.status = 'playing' then
    -- Voisin restant dans le sens courant, en partant du siège libéré.
    if v_game.direction = 1 then
      select id into v_target from americain_players
      where game_id = v_game.id and seat > v_me.seat
      order by seat asc limit 1;
      if v_target is null then
        select id into v_target from americain_players
        where game_id = v_game.id order by seat asc limit 1;
      end if;
    else
      select id into v_target from americain_players
      where game_id = v_game.id and seat < v_me.seat
      order by seat desc limit 1;
      if v_target is null then
        select id into v_target from americain_players
        where game_id = v_game.id order by seat desc limit 1;
      end if;
    end if;

    update americain_games set current_player_id = v_target where id = v_game.id;
  end if;
end;
$$;

grant execute on function leave_americain_game(uuid) to authenticated;
