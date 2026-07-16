-- Correctif : `alter database postgres set app.bot_url = ...` (documenté dans
-- 0021/0022) demande un privilège superuser que Supabase n'accorde pas sur les
-- projets hébergés — même limite, vérifiée en prod, sur app.notify_url/app.notify_key
-- de notify_turn_change (0008), jamais configurables pour la même raison.
--
-- Remplace le mécanisme par une table de réglages ordinaire : verrouillée comme
-- player_secrets/americain_state (RLS activée, zéro policy = inaccessible aux
-- clients), lue par les fonctions SECURITY DEFINER via un simple SELECT — ça ne
-- demande que des droits DML normaux, que le rôle de connexion a déjà.
create table app_settings (
  key   text primary key,
  value text not null
);

alter table app_settings enable row level security;
-- Aucune policy. Volontaire : ni anon, ni authenticated ne doit pouvoir lire
-- une clé de service.

create or replace function app_setting(p_key text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select value from app_settings where key = p_key;
$$;

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
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('game_type', 'country_guess', 'game_id', new.id)
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
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('game_type', 'americain', 'game_id', new.id)
  );

  return new;
exception when others then
  return new;
end;
$$;
