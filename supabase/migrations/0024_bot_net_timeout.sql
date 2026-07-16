-- Correctif de fiabilité : net._http_response montrait ~40% des appels au bot
-- en "timed_out" (constaté en prod) — pg_net abandonne par défaut au bout de
-- 5000ms (net.http_post.timeout_milliseconds), et le délai volontaire du bot
-- (jusqu'à 2500ms) + le cold start Deno + les allers-retours DB (surtout les
-- tentatives de country_guess sur lettre déjà posée) dépassaient cette marge.
--
-- pg_net poste en asynchrone : ce timeout ne bloque jamais la partie (le
-- trigger ne l'attend pas), mais un appel marqué "timed out" par pg_net est un
-- appel dont on ne sait plus s'il a abouti côté Edge Function — pas la bonne
-- position pour une fonctionnalité censée toujours faire avancer le tour.

create or replace function resolve_bot_turn_country_guess()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := app_setting('bot_url');
  v_key text := app_setting('bot_key');
  v_is_bot boolean;
begin
  if new.current_player_id is null
     or new.current_player_id is not distinct from old.current_player_id then
    return new;
  end if;

  select is_bot into v_is_bot from players where id = new.current_player_id;
  if not coalesce(v_is_bot, false) then
    return new;
  end if;

  if v_url is null or v_key is null then
    return new;
  end if;

  perform net.http_post(
    url                 := v_url,
    headers             := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body                := jsonb_build_object('game_type', 'country_guess', 'game_id', new.id),
    timeout_milliseconds := 12000
  );

  return new;
exception when others then
  return new;
end;
$$;

create or replace function resolve_bot_turn_americain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := app_setting('bot_url');
  v_key text := app_setting('bot_key');
  v_is_bot boolean;
begin
  if new.current_player_id is null
     or new.current_player_id is not distinct from old.current_player_id then
    return new;
  end if;

  select is_bot into v_is_bot from americain_players where id = new.current_player_id;
  if not coalesce(v_is_bot, false) then
    return new;
  end if;

  if v_url is null or v_key is null then
    return new;
  end if;

  perform net.http_post(
    url                 := v_url,
    headers             := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body                := jsonb_build_object('game_type', 'americain', 'game_id', new.id),
    timeout_milliseconds := 12000
  );

  return new;
exception when others then
  return new;
end;
$$;
