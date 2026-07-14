-- Profil & Discovery Log : ce qui SURVIT à une partie.
--
-- Jusqu'ici tout l'état mourait avec la partie (players est supprimé en cascade).
-- Ces deux tables sont rattachées à auth.uid() — la session anonyme est stable, et
-- devient permanente si le joueur lie un e-mail après une partie. Le même uid est
-- conservé, donc l'historique ne se perd pas à la conversion.

-- Un pays est "découvert" quand on l'a deviné chez un adversaire. C'est le seul
-- geste qui compte : voir un pays révélé par quelqu'un d'autre ne l'ajoute pas.
create table discoveries (
  user_id  uuid not null references auth.users(id) on delete cascade,
  country  text not null references countries(name),
  times    int  not null default 1,
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now(),
  primary key (user_id, country)
);

create table player_stats (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  games_played    int not null default 0,
  wins            int not null default 0,
  guesses         int not null default 0,   -- tentatives d'identification
  correct_guesses int not null default 0,   -- pour la précision
  letters_asked   int not null default 0,   -- pour la moyenne de questions
  total_points    int not null default 0
);

alter table discoveries  enable row level security;
alter table player_stats enable row level security;

-- On ne lit QUE ses propres stats. Le Discovery Log d'un adversaire révélerait les
-- pays qu'il connaît — et, en début de partie, orienterait les soupçons.
create policy "own discoveries"  on discoveries  for select to authenticated
  using (user_id = auth.uid());
create policy "own stats"        on player_stats for select to authenticated
  using (user_id = auth.uid());

-- Écriture réservée aux fonctions SECURITY DEFINER : sinon on se donnerait 42 victoires.
revoke insert, update, delete on discoveries, player_stats from anon, authenticated;

create or replace function bump_stats(
  p_user_id uuid,
  p_guesses int default 0,
  p_correct int default 0,
  p_letters int default 0
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into player_stats (user_id, guesses, correct_guesses, letters_asked)
  values (p_user_id, p_guesses, p_correct, p_letters)
  on conflict (user_id) do update set
    guesses         = player_stats.guesses + p_guesses,
    correct_guesses = player_stats.correct_guesses + p_correct,
    letters_asked   = player_stats.letters_asked + p_letters;
$$;

-- ---------------------------------------------------------------------------
-- On rebranche les RPC de jeu pour qu'elles alimentent ces tables.
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

  select p.* into v_me
  from players p join games g on g.id = p.game_id
  where g.current_player_id = p.id and p.user_id = auth.uid();

  if v_me.id is null then
    raise exception 'not your turn' using errcode = '42501';
  end if;

  select * into v_game from games where id = v_me.game_id;
  if v_game.status <> 'playing' then
    raise exception 'game is not running' using errcode = 'P0001';
  end if;

  if v_me.letters_left <= 0 then
    raise exception 'no letters left' using errcode = 'P0001';
  end if;

  select * into v_target from players
  where id = p_target_player_id and game_id = v_me.game_id;

  if v_target.id is null then
    raise exception 'target not in this game' using errcode = 'P0002';
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

-- Postgres refuse de changer le type de retour d'une fonction via CREATE OR REPLACE.
-- submit_guess passait boolean ; elle renvoie désormais le détail du coup (pays,
-- points, questions consommées) dont l'écran de célébration a besoin.
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
  select p.* into v_me
  from players p join games g on g.id = p.game_id
  where g.current_player_id = p.id and p.user_id = auth.uid();

  if v_me.id is null then
    raise exception 'not your turn' using errcode = '42501';
  end if;

  select * into v_game from games where id = v_me.game_id;
  if v_game.status <> 'playing' then
    raise exception 'game is not running' using errcode = 'P0001';
  end if;

  select * into v_target from players
  where id = p_target_player_id and game_id = v_me.game_id;

  if v_target.id is null or v_target.id = v_me.id or v_target.is_cracked then
    raise exception 'invalid target' using errcode = 'P0001';
  end if;

  select * into v_secret from player_secrets where player_id = v_target.id;
  v_correct := v_guess = v_secret.country;

  if v_correct then
    -- +500, plus 100 par question non consommée : on récompense la déduction rapide.
    v_points := 500 + 100 * v_me.letters_left;
    update players set score = score + v_points where id = v_me.id;
    update players set is_cracked = true, masked = v_secret.country where id = v_target.id;

    -- Le pays entre au Discovery Log de celui qui l'a trouvé — pas des spectateurs.
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

  -- L'écran de célébration a besoin de ces chiffres : les renvoyer évite un
  -- aller-retour, et surtout évite que le client les recalcule (et se trompe).
  return jsonb_build_object(
    'correct',      v_correct,
    'country',      case when v_correct then v_secret.country else null end,
    'points',       v_points,
    'letters_left', v_me.letters_left,
    'letters_used', 6 - v_me.letters_left
  );
end;
$$;

-- close_round : à la fin de la PARTIE, on solde les stats cumulées.
create or replace function close_round(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games;
  v_top  int;
begin
  select * into v_game from games where id = p_game_id;

  if v_game.round >= v_game.total_rounds then
    update games
      set status = 'finished', ended_at = now(), current_player_id = null
      where id = p_game_id;

    select max(score) into v_top from players where game_id = p_game_id;

    -- Une partie jouée pour tous ; une victoire pour le(s) meilleur(s) score(s).
    -- L'égalité en tête donne une victoire à chacun, plutôt que d'en couronner un
    -- au hasard.
    insert into player_stats (user_id, games_played, wins, total_points)
    select p.user_id, 1, case when p.score = v_top then 1 else 0 end, p.score
    from players p
    where p.game_id = p_game_id
    on conflict (user_id) do update set
      games_played = player_stats.games_played + 1,
      wins         = player_stats.wins + excluded.wins,
      total_points = player_stats.total_points + excluded.total_points;
  else
    update players set
      masked = '', region = null, asked_letters = '{}', revealed_letters = '{}',
      is_cracked = false, is_eliminated = false, letters_left = 6, has_picked = false
    where game_id = p_game_id;

    delete from player_secrets
    where player_id in (select id from players where game_id = p_game_id);

    update games
      set round = round + 1, status = 'lobby', current_player_id = null
      where id = p_game_id;
  end if;
end;
$$;

grant execute on function submit_guess(uuid, text) to authenticated;
grant execute on function ask_letter(uuid, text)   to authenticated;
