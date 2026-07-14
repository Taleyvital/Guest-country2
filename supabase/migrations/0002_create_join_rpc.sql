-- Création / jointure de partie.
--
-- Pourquoi des RPC plutôt que des inserts depuis le client :
--   1. Atomicité. Créer une partie = insérer games PUIS players PUIS pointer
--      games.host_id sur le player. Fait en 3 requêtes client, un réseau qui
--      lâche au milieu laisse une partie sans hôte.
--   2. La policy "games updated by host only" ne peut pas fonctionner à la
--      création : host_id est NULL et le player n'existe pas encore, donc
--      personne ne peut se désigner hôte. Œuf et poule (bug du 0001).
--   3. Le seat (ordre du tour) doit être attribué sans course entre deux
--      téléphones qui rejoignent en même temps.

-- Attribue le siège suivant en verrouillant la partie : deux joueurs qui
-- rejoignent à la même milliseconde ne peuvent pas obtenir le même seat.
create or replace function next_seat(p_game_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat int;
begin
  perform 1 from games where id = p_game_id for update;
  select coalesce(max(seat) + 1, 0) into v_seat from players where game_id = p_game_id;
  return v_seat;
end;
$$;

create or replace function create_game(p_nickname text, p_total_rounds int default 5)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game   games;
  v_player players;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  insert into games (total_rounds) values (p_total_rounds) returning * into v_game;

  insert into players (game_id, user_id, nickname, is_host, seat)
  values (v_game.id, auth.uid(), p_nickname, true, 0)
  returning * into v_player;

  update games set host_id = v_player.id where id = v_game.id returning * into v_game;

  return v_game;
end;
$$;

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

  -- On ne rejoint pas une partie commencée : le mot est déjà tiré et les tours
  -- distribués. Un retardataire deviendrait spectateur, pas joueur.
  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  -- Reconnexion (téléphone verrouillé, app tuée) : on ne crée pas un doublon,
  -- le joueur retrouve sa place.
  if exists (select 1 from players where game_id = v_game.id and user_id = auth.uid()) then
    return v_game;
  end if;

  insert into players (game_id, user_id, nickname, seat)
  values (v_game.id, auth.uid(), p_nickname, next_seat(v_game.id));

  return v_game;
end;
$$;

-- Corrige la policy du 0001 : elle empêchait aussi l'hôte de démarrer la partie
-- tant que host_id n'était pas posé.
drop policy if exists "games updated by host only" on games;

create policy "games updated by host"
  on games for update to authenticated
  using (host_id in (select id from players where user_id = auth.uid()))
  with check (host_id in (select id from players where user_id = auth.uid()));

grant execute on function create_game(text, int) to authenticated;
grant execute on function join_game(text, text) to authenticated;
