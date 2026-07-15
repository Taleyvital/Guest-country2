-- Règle du "dernier debout" : quand il ne reste qu'un joueur non éliminé, il
-- remporte la manche immédiatement.
--
-- Avant ce correctif, advance_turn ne rendait la main que s'il restait une cible
-- valide. Dans une partie à 2, éliminer un joueur laissait l'autre "actif" avec pour
-- seule cible le pays de l'éliminé — le moteur le forçait donc à continuer à deviner
-- un pays dont le propriétaire était déjà hors-jeu, au lieu de conclure la manche.
--
-- Nouveau : dès qu'un seul joueur (ou zéro) n'est pas éliminé, la manche se termine ;
-- le survivant reçoit un bonus de manche. C'est le cas typique du 2 joueurs — l'un se
-- trompe, l'autre gagne la manche — mais la règle vaut à n'importe quel effectif.

-- Bonus de manche gagnée par survie. Volontairement < à une bonne réponse (500+) :
-- gagner parce que l'adversaire s'est trompé vaut moins que trouver soi-même.
-- Une seule constante à ajuster ici.
-- (inséré en dur ci-dessous : 300)

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
  v_active  int;
begin
  select * into v_target from players where id = p_target_player_id;
  if v_target.id is null then
    raise exception 'target not found' using errcode = 'P0002';
  end if;

  select * into v_me
  from players
  where game_id = v_target.game_id and user_id = auth.uid();

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
  if v_target.id = v_me.id or v_target.is_cracked then
    raise exception 'invalid target' using errcode = 'P0001';
  end if;

  select * into v_secret from player_secrets where player_id = v_target.id;
  v_correct := v_guess = v_secret.country;

  if v_correct then
    v_points := 500 + 100 * v_me.letters_left;
    update players set score = score + v_points where id = v_me.id;
    update players set is_cracked = true, masked = v_secret.country where id = v_target.id;

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

  -- Dernier debout : plus qu'un joueur non éliminé -> il gagne la manche.
  -- (Seul un mauvais guess vient d'éliminer quelqu'un ; après une bonne réponse
  --  l'effectif actif est inchangé, donc ce test ne se déclenche pas à tort.)
  select count(*) into v_active
  from players where game_id = v_me.game_id and not is_eliminated;

  if v_active <= 1 then
    -- Bonus au(x) survivant(s) : 0 ligne si tout le monde est éliminé.
    update players set score = score + 300
    where game_id = v_me.game_id and not is_eliminated;

    perform close_round(v_me.game_id);
  else
    if not advance_turn(v_me.game_id) then
      perform close_round(v_me.game_id);
    end if;
  end if;

  return jsonb_build_object(
    'correct',      v_correct,
    'country',      case when v_correct then v_secret.country else null end,
    'points',       v_points,
    'letters_left', v_me.letters_left,
    'letters_used', 6 - v_me.letters_left
  );
end;
$$;

grant execute on function submit_guess(uuid, text) to authenticated;
