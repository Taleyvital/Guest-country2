-- Revenir dans une partie, et en sortir pour de bon.
--
-- Bug du 0002 : join_game levait 'game already started' AVANT de regarder si
-- l'appelant était déjà joueur. Un joueur qui fermait l'app ou appuyait sur "retour"
-- ne pouvait donc plus jamais revenir dans SA partie — alors que sa place, sa ligne
-- et son pays existaient toujours. On teste l'appartenance d'abord.

create or replace function join_game(p_code text, p_nickname text)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  select * into v_game from games where code = upper(p_code);

  if v_game.id is null then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  -- RECONNEXION D'ABORD. Une partie en cours n'est pas fermée à ses propres joueurs :
  -- c'est même le cas le plus fréquent (téléphone verrouillé, app tuée, "retour").
  if exists (select 1 from players where game_id = v_game.id and user_id = auth.uid()) then
    return v_game;
  end if;

  if v_game.status = 'finished' then
    raise exception 'game is over' using errcode = 'P0001';
  end if;

  -- Un NOUVEAU joueur, en revanche, ne s'invite pas en cours de manche : les pays
  -- sont distribués et les tours répartis.
  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  insert into players (game_id, user_id, nickname, seat)
  values (v_game.id, auth.uid(), p_nickname, next_seat(v_game.id));

  return v_game;
end;
$$;

-- Sortir POUR DE BON. Distinct du simple "retour" : ici on libère sa place.
create or replace function leave_game()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me        players;
  v_game      games;
  v_was_turn  boolean;
  v_new_host  uuid;
begin
  select * into v_me from players where user_id = auth.uid() limit 1;
  if v_me.id is null then
    return; -- déjà sorti : rien à faire, ce n'est pas une erreur
  end if;

  select * into v_game from games where id = v_me.game_id;
  v_was_turn := v_game.current_player_id = v_me.id;

  -- Si c'était son tour, la partie se figerait sur un joueur absent : on passe la
  -- main AVANT de supprimer la ligne.
  if v_was_turn then
    update games set current_player_id = null where id = v_game.id;
  end if;

  -- L'hôte s'en va : la partie ne doit pas rester sans personne pour la lancer.
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

  -- Plus personne : la partie n'a plus de raison d'exister.
  if not exists (select 1 from players where game_id = v_game.id) then
    delete from games where id = v_game.id;
    return;
  end if;

  -- Moins de 2 joueurs en cours de partie : on ne peut plus deviner le pays de
  -- quiconque. On clôt plutôt que de laisser une partie injouable.
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

grant execute on function leave_game() to authenticated;
