-- Infrastructure PARTAGÉE pour le mode "jouer contre l'ordinateur", commune à
-- Country Guess et 8 Américain.
--
-- PRINCIPE : un bot ne doit JAMAIS dupliquer la logique de coup. Il appelle les
-- MÊMES RPC qu'un client humain (ask_letter, play_card, draw_card...). Le
-- problème : ces RPC résolvent "qui agit" via auth.uid(), qui suppose un JWT
-- porté par un vrai navigateur. Un bot n'a pas de session ouverte quelque part —
-- ses coups sont joués par une Edge Function tournant avec la clé de service.
--
-- effective_uid() résout ce dilemme SANS changer la logique des RPC : elles
-- gagnent juste un paramètre optionnel p_actor_user_id, ignoré pour tout appelant
-- normal (authenticated), et utilisé UNIQUEMENT quand l'appelant est le
-- service_role (donc jamais exploitable depuis un navigateur, qui ne détient que
-- la clé anon). Le reste de chaque fonction — validation du coup, mise à jour de
-- l'état, RLS — reste identique au chemin humain.
create or replace function effective_uid(p_actor_user_id uuid default null)
returns uuid
language sql
stable
as $$
  select case
    when p_actor_user_id is not null and auth.role() = 'service_role' then p_actor_user_id
    else auth.uid()
  end;
$$;

-- ---------------------------------------------------------------------------
-- Un bot est un joueur normal (table players / americain_players), donc sa
-- ligne a besoin d'un user_id qui référence auth.users comme n'importe quel
-- joueur humain. Le bot n'a toutefois jamais besoin de se connecter : on lui
-- crée directement une ligne auth.users minimale, sans mot de passe ni identité
-- (is_anonymous = true, comme un vrai joueur invité, mais sans session associée).
--
-- ATTENTION — dépend du schéma interne de GoTrue (auth.users), pas d'une API
-- publique Supabase stable. Fonctionne sur les versions courantes, mais à
-- revérifier après une montée de version majeure de Supabase Auth.
create or replace function create_bot_auth_user(p_label text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role,
    email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data,
    is_anonymous, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    null, '',
    now(), '', '',
    '', '',
    jsonb_build_object('provider', 'bot', 'providers', jsonb_build_array('bot')),
    jsonb_build_object('nickname', p_label),
    true, now(), now()
  );
  return v_id;
end;
$$;
