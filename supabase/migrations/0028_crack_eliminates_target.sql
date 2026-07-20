-- Retour à la règle d'origine : quand ton pays est trouvé, tu es ÉLIMINÉ.
--
-- Depuis 0012, un pays "cracké" restait actif : la cible ne pouvait plus être visée
-- mais continuait à jouer (demander des lettres, tenter des guess sur les autres).
-- On revient à la règle voulue : trouvé = éliminé = spectateur pour le reste de la
-- manche. `is_eliminated` couvre déjà ce blocage (advance_turn l'exclut du tour,
-- ask_letter/submit_guess exigent d'être le joueur courant), donc il suffit de le
-- poser en même temps que `is_cracked` sur une bonne réponse.
drop function if exists submit_guess(uuid, text);

create or replace function submit_guess(p_target_player_id uuid, p_guess text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me        players;
  v_target    players;
  v_game      games;
  v_secret    player_secrets;
  v_correct   boolean;
  v_points    int := 0;
  v_active    int;
  v_total     int;
  v_uncracked int;
begin
  select * into v_target from players where id = p_target_player_id;
  if v_target.id is null then
    raise exception 'target not found' using errcode = 'P0002';
  end if;

  select * into v_me from players
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

  -- Comparaison tolérante : "bresil", "Brésil", "BRESIL" -> tous justes.
  v_correct := norm_country(p_guess) = norm_country(v_secret.country);

  if v_correct then
    v_points := 500 + 100 * v_me.letters_left;
    update players set score = score + v_points where id = v_me.id;

    -- Trouvé = éliminé : la cible passe spectatrice pour le reste de la manche.
    update players set is_cracked = true, is_eliminated = true, masked = v_secret.country
    where id = v_target.id;

    insert into discoveries (user_id, country)
    values (auth.uid(), v_secret.country)
    on conflict (user_id, country) do update
      set times = discoveries.times + 1, last_at = now();

    insert into game_events (game_id, type, actor_id, target_id, payload)
    values (v_me.game_id, 'guess', v_me.id, v_target.id,
            jsonb_build_object('guess', upper(trim(p_guess)), 'correct', true));
  else
    v_points := -100;
    update players set is_eliminated = true, score = score - 100 where id = v_me.id;

    insert into game_events (game_id, type, actor_id, target_id, payload)
    values (v_me.game_id, 'eliminated', v_me.id, v_target.id,
            jsonb_build_object('guess', upper(trim(p_guess)), 'correct', false));
  end if;

  perform bump_stats(auth.uid(), 1, case when v_correct then 1 else 0 end, 0);

  select count(*) into v_total from players where game_id = v_me.game_id;
  select count(*) filter (where not is_eliminated) into v_active from players where game_id = v_me.game_id;
  select count(*) filter (where not is_cracked) into v_uncracked from players where game_id = v_me.game_id;

  if v_active <= 1 then
    update players set score = score + 300 where game_id = v_me.game_id and not is_eliminated;
    perform close_round(v_me.game_id);
  elsif v_total = 2 and v_uncracked <= 1 then
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
