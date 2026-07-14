-- Boucle de jeu.
--
-- Règle : chaque joueur CHOISIT son pays. Les autres doivent le deviner.
-- À son tour, un joueur désigne un adversaire et lui demande une lettre : la lettre
-- est cherchée dans le pays de LA CIBLE. Il peut aussi tenter d'identifier le pays
-- d'un adversaire — juste il marque, faux il est éliminé de la manche.
--
-- Chacun voit donc son propre pays se faire éventer, sans pouvoir l'empêcher.

-- ---------------------------------------------------------------------------
-- Le pays choisi vit dans SA PROPRE table, sans aucune policy.
--
-- Pourquoi pas une colonne de `players` : la RLS de Postgres filtre des LIGNES, pas
-- des COLONNES. `players` doit rester lisible par toute la table (voir ses adversaires),
-- donc un `select *` depuis la console renverrait le pays de chacun. Table séparée +
-- RLS active + zéro policy = inaccessible au navigateur. Seules les fonctions
-- SECURITY DEFINER ci-dessous y touchent. Le pays des autres ne descend jamais au client.
-- ---------------------------------------------------------------------------
create table player_secrets (
  player_id uuid primary key references players(id) on delete cascade,
  country   text not null,
  region    text not null
);

alter table player_secrets enable row level security;
-- Aucune policy. Volontaire.
revoke all on player_secrets from anon, authenticated;

-- État PUBLIC du joueur : ce que tous les téléphones peuvent voir sans tricher.
alter table players
  -- "BRA___" : l'état de MON pays, tel que les autres l'ont découvert.
  add column masked           text   not null default '',
  -- Indice public : "Amérique du Sud". Révélé dès le début, c'est la porte d'entrée.
  add column region           text,
  -- Lettres déjà demandées SUR MON pays, par n'importe qui. Public : tout le monde a
  -- vu passer les actions. Sert à griser le clavier.
  add column asked_letters    text[] not null default '{}',
  add column revealed_letters text[] not null default '{}',
  -- Mon pays a été trouvé : je ne suis plus une cible valide.
  add column is_cracked       boolean not null default false,
  -- Mon budget de questions pour la manche.
  add column letters_left     int    not null default 6,
  -- A choisi son pays : condition pour lancer la partie.
  add column has_picked       boolean not null default false;

-- ---------------------------------------------------------------------------
-- Pool de pays : le choix est contraint à cette liste, sinon un guess ne pourrait
-- pas être validé ("Hollande" vs "Pays-Bas" vs "Netherlands").
-- ---------------------------------------------------------------------------
create table countries (
  name   text primary key,
  region text not null
);

alter table countries enable row level security;
create policy "countries readable" on countries for select to authenticated using (true);

insert into countries (name, region) values
  ('BRESIL','Amérique du Sud'), ('ARGENTINE','Amérique du Sud'), ('PEROU','Amérique du Sud'),
  ('CHILI','Amérique du Sud'), ('COLOMBIE','Amérique du Sud'), ('BOLIVIE','Amérique du Sud'),
  ('MEXIQUE','Amérique du Nord'), ('CANADA','Amérique du Nord'), ('CUBA','Amérique du Nord'),
  ('FRANCE','Europe'), ('ESPAGNE','Europe'), ('ITALIE','Europe'), ('ALLEMAGNE','Europe'),
  ('PORTUGAL','Europe'), ('GRECE','Europe'), ('SUEDE','Europe'), ('POLOGNE','Europe'),
  ('IRLANDE','Europe'), ('NORVEGE','Europe'), ('SUISSE','Europe'), ('BELGIQUE','Europe'),
  ('JAPON','Asie'), ('CHINE','Asie'), ('INDE','Asie'), ('THAILANDE','Asie'),
  ('VIETNAM','Asie'), ('COREE','Asie'), ('INDONESIE','Asie'), ('MONGOLIE','Asie'),
  ('EGYPTE','Afrique'), ('MAROC','Afrique'), ('SENEGAL','Afrique'), ('KENYA','Afrique'),
  ('NIGERIA','Afrique'), ('TUNISIE','Afrique'), ('ETHIOPIE','Afrique'), ('GHANA','Afrique'),
  ('AUSTRALIE','Océanie'), ('FIDJI','Océanie'), ('SAMOA','Océanie');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function mask_country(p_country text, p_revealed text[])
returns text
language sql
immutable
as $$
  select string_agg(
    case when ch = ' ' then ' '
         when ch = any(p_revealed) then ch
         else '_' end,
    '' order by ord)
  from unnest(string_to_array(p_country, null)) with ordinality as t(ch, ord);
$$;

-- Un joueur peut-il encore jouer ? (pas éliminé)
-- Peut-il encore être visé ? (pays pas encore trouvé)
-- Les deux sont indépendants : ton pays peut être trouvé alors que tu continues
-- d'enquêter sur celui des autres.

-- Passe la main au joueur actif suivant. Renvoie false si la manche est finie :
-- soit plus personne pour jouer, soit plus rien à deviner.
create or replace function advance_turn(p_game_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_seat int;
  v_next_id      uuid;
begin
  select p.seat into v_current_seat
  from games g join players p on p.id = g.current_player_id
  where g.id = p_game_id;

  -- Le prochain joueur non éliminé APRÈS le siège courant ; sinon on repart du plus
  -- petit siège. C'est ce `order by` qui fait la table ronde.
  -- Il doit rester au moins une cible valide pour lui : un joueur dont le pays n'est
  -- pas encore trouvé et qui n'est pas lui-même. Sans ce filtre, le dernier joueur
  -- en lice tournerait dans le vide, sans coup possible.
  select p.id into v_next_id
  from players p
  where p.game_id = p_game_id
    and not p.is_eliminated
    and exists (
      select 1 from players t
      where t.game_id = p_game_id and t.id <> p.id and not t.is_cracked
    )
  order by (p.seat > coalesce(v_current_seat, -1)) desc, p.seat
  limit 1;

  update games set current_player_id = v_next_id where id = p_game_id;

  return v_next_id is not null;
end;
$$;

create or replace function close_round(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games;
begin
  select * into v_game from games where id = p_game_id;

  if v_game.round >= v_game.total_rounds then
    update games
      set status = 'finished', ended_at = now(), current_player_id = null
      where id = p_game_id;
  else
    -- Manche suivante : chacun rechoisit un pays. On repasse par le lobby de choix
    -- plutôt que de tirer au sort — c'est le joueur qui décide, c'est la règle.
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

-- ---------------------------------------------------------------------------
-- RPC — le seul chemin par lequel l'état du jeu change
-- ---------------------------------------------------------------------------

-- Choix du pays, avant le lancement. Le pays est écrit dans player_secrets ; seuls
-- la longueur du mot et la région descendent au client (via `masked` et `region`).
create or replace function pick_country(p_country text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me      players;
  v_country countries;
begin
  select * into v_me from players where user_id = auth.uid()
    and game_id in (select id from games where status = 'lobby')
  limit 1;

  if v_me.id is null then
    raise exception 'not in a lobby' using errcode = '42501';
  end if;

  select * into v_country from countries where name = upper(trim(p_country));
  if v_country.name is null then
    raise exception 'unknown country' using errcode = 'P0002';
  end if;

  insert into player_secrets (player_id, country, region)
  values (v_me.id, v_country.name, v_country.region)
  on conflict (player_id) do update
    set country = excluded.country, region = excluded.region;

  update players set
    masked           = mask_country(v_country.name, '{}'),
    region           = v_country.region,
    revealed_letters = '{}',
    asked_letters    = '{}',
    has_picked       = true
  where id = v_me.id;
end;
$$;

-- Le joueur a le droit de relire SON pays (reconnexion, téléphone verrouillé).
-- Celui des autres reste inaccessible : la fonction ne lit que sa propre ligne.
create or replace function my_country()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_country text;
begin
  select s.country into v_country
  from player_secrets s
  join players p on p.id = s.player_id
  where p.user_id = auth.uid()
  limit 1;

  return v_country;
end;
$$;

create or replace function start_game(p_game_id uuid)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games;
begin
  select * into v_game from games where id = p_game_id;

  if v_game.id is null then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  -- L'hôte, et lui seul. Vérifié ici et non par une policy : le client n'a plus aucun
  -- droit d'UPDATE sur games (REVOKE en fin de fichier).
  if not exists (
    select 1 from players where id = v_game.host_id and user_id = auth.uid()
  ) then
    raise exception 'only the host can start the game' using errcode = '42501';
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  if (select count(*) from players where game_id = p_game_id) < 2 then
    raise exception 'need at least 2 players' using errcode = 'P0001';
  end if;

  -- Sans pays choisi par tout le monde, il n'y a rien à deviner.
  if exists (select 1 from players where game_id = p_game_id and not has_picked) then
    raise exception 'everyone must pick a country' using errcode = 'P0001';
  end if;

  update games set
    status            = 'playing',
    started_at        = coalesce(started_at, now()),
    current_player_id = (select id from players where game_id = p_game_id order by seat limit 1)
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

-- Demande une lettre SUR LE PAYS DE LA CIBLE.
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

  -- Si cette ligne ne remonte pas, ce n'est pas mon tour. Le bouton grisé côté client
  -- est un confort ; ceci est la vraie barrière.
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

  -- Les lettres déjà demandées le sont PAR PAYS, pas par joueur : deux enquêteurs
  -- partagent ce qu'ils ont découvert sur une même cible.
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

  insert into game_events (game_id, type, actor_id, target_id, payload)
  values (v_me.game_id, 'ask_letter', v_me.id, v_target.id,
          jsonb_build_object('letter', v_letter, 'found', v_found));

  if not advance_turn(v_me.game_id) then
    perform close_round(v_me.game_id);
  end if;

  return v_found;
end;
$$;

-- Tente d'identifier le pays d'un adversaire.
create or replace function submit_guess(p_target_player_id uuid, p_guess text)
returns boolean
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
    -- +500, plus 100 par lettre non consommée : on récompense la déduction rapide
    -- plutôt que l'épuisement du budget.
    update players set score = score + 500 + 100 * letters_left where id = v_me.id;

    -- Le pays est éventé : la cible n'est plus visable, mais elle continue d'enquêter.
    update players set is_cracked = true, masked = v_secret.country where id = v_target.id;

    insert into game_events (game_id, type, actor_id, target_id, payload)
    values (v_me.game_id, 'guess', v_me.id, v_target.id,
            jsonb_build_object('guess', v_guess, 'correct', true));
  else
    update players set is_eliminated = true, score = score - 100 where id = v_me.id;

    insert into game_events (game_id, type, actor_id, target_id, payload)
    values (v_me.game_id, 'eliminated', v_me.id, v_target.id,
            jsonb_build_object('guess', v_guess, 'correct', false));
  end if;

  if not advance_turn(v_me.game_id) then
    perform close_round(v_me.game_id);
  end if;

  return v_correct;
end;
$$;

-- ---------------------------------------------------------------------------
-- Verrouillage des écritures client
--
-- La policy "players update own row" du 0001 laissait modifier N'IMPORTE QUELLE
-- colonne de sa propre ligne — dont score et is_eliminated. Un `update players set
-- score = 9999` depuis la console du navigateur passait. La RLS ne filtre pas les
-- colonnes : il faut des GRANT colonne par colonne.
-- ---------------------------------------------------------------------------
revoke update on players from anon, authenticated;
grant update (nickname, avatar, is_ready) on players to authenticated;

-- Plus aucune écriture directe sur games : tout passe par les RPC. L'hôte lui-même
-- ne peut plus se donner le tour.
revoke update on games from anon, authenticated;
drop policy if exists "games updated by host" on games;

grant execute on function pick_country(text)              to authenticated;
grant execute on function my_country()                    to authenticated;
grant execute on function start_game(uuid)                to authenticated;
grant execute on function ask_letter(uuid, text)          to authenticated;
grant execute on function submit_guess(uuid, text)        to authenticated;
