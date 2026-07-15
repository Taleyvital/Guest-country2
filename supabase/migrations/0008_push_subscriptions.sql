-- Notifications push : abonnements + déclenchement au changement de tour.
--
-- Système INDÉPENDANT du son. Les push sont un BONUS : si quoi que ce soit ici
-- échoue (settings absents, fonction indisponible), le jeu continue normalement —
-- le trigger avale ses propres erreurs.

create table push_subscriptions (
  -- endpoint = identifiant unique d'un abonnement navigateur. C'est la clé : un même
  -- utilisateur sur deux appareils a deux endpoints, on veut prévenir les deux.
  endpoint     text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,   -- l'objet PushSubscription complet (endpoint + keys)
  created_at   timestamptz not null default now()
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Un joueur ne gère que SES abonnements. Personne ne lit ceux des autres (ce sont
-- des jetons d'envoi, à traiter comme des secrets).
create policy "own push subscriptions"
  on push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Déclenchement : quand games.current_player_id change, prévenir le joueur concerné.
--
-- On appelle l'Edge Function `notify-turn-change` via pg_net (HTTP asynchrone, non
-- bloquant pour la transaction de jeu). L'URL et la clé de service sont lues dans des
-- réglages de base de données, pour ne pas coder de secret en dur :
--
--   alter database postgres set app.notify_url = 'https://<ref>.supabase.co/functions/v1/notify-turn-change';
--   alter database postgres set app.notify_key = '<SERVICE_ROLE_KEY>';
--
-- Tant que ces réglages sont absents, le trigger ne fait rien (le jeu reste jouable,
-- simplement sans push).
-- ---------------------------------------------------------------------------
create extension if not exists pg_net;

create or replace function notify_turn_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := current_setting('app.notify_url', true);
  v_key text := current_setting('app.notify_key', true);
begin
  -- Rien à faire si le tour n'a pas changé, ou si personne n'a le tour.
  if new.current_player_id is null
     or new.current_player_id is not distinct from old.current_player_id then
    return new;
  end if;

  -- Push non configuré : on n'échoue pas, on passe.
  if v_url is null or v_key is null then
    return new;
  end if;

  -- Feu et oublie : pg_net poste en asynchrone, la transaction de jeu ne l'attend pas.
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object(
      'game_id',           new.id,
      'current_player_id', new.current_player_id
    )
  );

  return new;
exception when others then
  -- Un push est un bonus : jamais il ne doit faire échouer l'avancement du tour.
  return new;
end;
$$;

create trigger on_turn_change
  after update of current_player_id on games
  for each row execute function notify_turn_change();
