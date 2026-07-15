-- Enrichissement du pool de pays (~190) + guess en saisie libre.
--
-- 1) La liste passe de 40 à ~190 pays. Deviner devient un vrai exercice.
-- 2) Le guess ne se choisit plus dans une liste (voir GuessCountryModal) : on tape le
--    pays. Pour qu'une bonne réponse mal accentuée n'élimine pas à tort, la
--    comparaison est désormais INSENSIBLE aux accents, à la casse, aux tirets et
--    apostrophes — côté serveur, seul juge.

create extension if not exists unaccent;

-- Forme canonique d'un nom de pays : sans accents, majuscules, séparateurs unifiés.
-- "Côte d'Ivoire" / "COTE D IVOIRE" / "cote-d'ivoire" -> "COTE D IVOIRE".
create or replace function norm_country(t text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select btrim(regexp_replace(upper(unaccent(coalesce(t, ''))), '[^A-Z0-9]+', ' ', 'g'));
$$;

-- Le pool. Les 40 pays initiaux sont déjà présents : on ignore les doublons.
insert into countries (name, region) values
  ('FRANCE','Europe'),
  ('ALLEMAGNE','Europe'),
  ('ESPAGNE','Europe'),
  ('ITALIE','Europe'),
  ('PORTUGAL','Europe'),
  ('ROYAUME-UNI','Europe'),
  ('IRLANDE','Europe'),
  ('BELGIQUE','Europe'),
  ('PAYS-BAS','Europe'),
  ('LUXEMBOURG','Europe'),
  ('SUISSE','Europe'),
  ('AUTRICHE','Europe'),
  ('SUEDE','Europe'),
  ('NORVEGE','Europe'),
  ('DANEMARK','Europe'),
  ('FINLANDE','Europe'),
  ('ISLANDE','Europe'),
  ('POLOGNE','Europe'),
  ('TCHEQUIE','Europe'),
  ('SLOVAQUIE','Europe'),
  ('HONGRIE','Europe'),
  ('ROUMANIE','Europe'),
  ('BULGARIE','Europe'),
  ('GRECE','Europe'),
  ('CROATIE','Europe'),
  ('SERBIE','Europe'),
  ('BOSNIE-HERZEGOVINE','Europe'),
  ('SLOVENIE','Europe'),
  ('ALBANIE','Europe'),
  ('MACEDOINE DU NORD','Europe'),
  ('MONTENEGRO','Europe'),
  ('KOSOVO','Europe'),
  ('UKRAINE','Europe'),
  ('BIELORUSSIE','Europe'),
  ('LITUANIE','Europe'),
  ('LETTONIE','Europe'),
  ('ESTONIE','Europe'),
  ('MOLDAVIE','Europe'),
  ('RUSSIE','Europe'),
  ('MALTE','Europe'),
  ('CHYPRE','Europe'),
  ('ANDORRE','Europe'),
  ('MONACO','Europe'),
  ('LIECHTENSTEIN','Europe'),
  ('SAINT-MARIN','Europe'),
  ('CHINE','Asie'),
  ('JAPON','Asie'),
  ('COREE DU SUD','Asie'),
  ('COREE DU NORD','Asie'),
  ('MONGOLIE','Asie'),
  ('INDE','Asie'),
  ('PAKISTAN','Asie'),
  ('BANGLADESH','Asie'),
  ('SRI LANKA','Asie'),
  ('NEPAL','Asie'),
  ('BHOUTAN','Asie'),
  ('THAILANDE','Asie'),
  ('VIETNAM','Asie'),
  ('CAMBODGE','Asie'),
  ('LAOS','Asie'),
  ('BIRMANIE','Asie'),
  ('MALAISIE','Asie'),
  ('SINGAPOUR','Asie'),
  ('INDONESIE','Asie'),
  ('PHILIPPINES','Asie'),
  ('BRUNEI','Asie'),
  ('TIMOR ORIENTAL','Asie'),
  ('KAZAKHSTAN','Asie'),
  ('OUZBEKISTAN','Asie'),
  ('TURKMENISTAN','Asie'),
  ('KIRGHIZISTAN','Asie'),
  ('TADJIKISTAN','Asie'),
  ('AFGHANISTAN','Asie'),
  ('IRAN','Asie'),
  ('IRAK','Asie'),
  ('TURQUIE','Asie'),
  ('SYRIE','Asie'),
  ('LIBAN','Asie'),
  ('ISRAEL','Asie'),
  ('JORDANIE','Asie'),
  ('ARABIE SAOUDITE','Asie'),
  ('YEMEN','Asie'),
  ('OMAN','Asie'),
  ('EMIRATS ARABES UNIS','Asie'),
  ('QATAR','Asie'),
  ('BAHREIN','Asie'),
  ('KOWEIT','Asie'),
  ('GEORGIE','Asie'),
  ('ARMENIE','Asie'),
  ('AZERBAIDJAN','Asie'),
  ('MALDIVES','Asie'),
  ('MAROC','Afrique'),
  ('ALGERIE','Afrique'),
  ('TUNISIE','Afrique'),
  ('LIBYE','Afrique'),
  ('EGYPTE','Afrique'),
  ('SOUDAN','Afrique'),
  ('SOUDAN DU SUD','Afrique'),
  ('ETHIOPIE','Afrique'),
  ('ERYTHREE','Afrique'),
  ('DJIBOUTI','Afrique'),
  ('SOMALIE','Afrique'),
  ('KENYA','Afrique'),
  ('OUGANDA','Afrique'),
  ('TANZANIE','Afrique'),
  ('RWANDA','Afrique'),
  ('BURUNDI','Afrique'),
  ('REPUBLIQUE DEMOCRATIQUE DU CONGO','Afrique'),
  ('CONGO','Afrique'),
  ('GABON','Afrique'),
  ('CAMEROUN','Afrique'),
  ('NIGERIA','Afrique'),
  ('NIGER','Afrique'),
  ('TCHAD','Afrique'),
  ('MALI','Afrique'),
  ('MAURITANIE','Afrique'),
  ('SENEGAL','Afrique'),
  ('GAMBIE','Afrique'),
  ('GUINEE','Afrique'),
  ('GUINEE-BISSAU','Afrique'),
  ('SIERRA LEONE','Afrique'),
  ('LIBERIA','Afrique'),
  ('COTE D''IVOIRE','Afrique'),
  ('GHANA','Afrique'),
  ('TOGO','Afrique'),
  ('BENIN','Afrique'),
  ('BURKINA FASO','Afrique'),
  ('CENTRAFRIQUE','Afrique'),
  ('GUINEE EQUATORIALE','Afrique'),
  ('ANGOLA','Afrique'),
  ('ZAMBIE','Afrique'),
  ('ZIMBABWE','Afrique'),
  ('MALAWI','Afrique'),
  ('MOZAMBIQUE','Afrique'),
  ('MADAGASCAR','Afrique'),
  ('MAURICE','Afrique'),
  ('SEYCHELLES','Afrique'),
  ('COMORES','Afrique'),
  ('NAMIBIE','Afrique'),
  ('BOTSWANA','Afrique'),
  ('AFRIQUE DU SUD','Afrique'),
  ('LESOTHO','Afrique'),
  ('ESWATINI','Afrique'),
  ('CAP-VERT','Afrique'),
  ('CANADA','Amérique du Nord'),
  ('ETATS-UNIS','Amérique du Nord'),
  ('MEXIQUE','Amérique du Nord'),
  ('GUATEMALA','Amérique du Nord'),
  ('BELIZE','Amérique du Nord'),
  ('HONDURAS','Amérique du Nord'),
  ('SALVADOR','Amérique du Nord'),
  ('NICARAGUA','Amérique du Nord'),
  ('COSTA RICA','Amérique du Nord'),
  ('PANAMA','Amérique du Nord'),
  ('CUBA','Amérique du Nord'),
  ('HAITI','Amérique du Nord'),
  ('REPUBLIQUE DOMINICAINE','Amérique du Nord'),
  ('JAMAIQUE','Amérique du Nord'),
  ('BAHAMAS','Amérique du Nord'),
  ('TRINITE-ET-TOBAGO','Amérique du Nord'),
  ('BARBADE','Amérique du Nord'),
  ('SAINTE-LUCIE','Amérique du Nord'),
  ('GRENADE','Amérique du Nord'),
  ('DOMINIQUE','Amérique du Nord'),
  ('BRESIL','Amérique du Sud'),
  ('ARGENTINE','Amérique du Sud'),
  ('CHILI','Amérique du Sud'),
  ('URUGUAY','Amérique du Sud'),
  ('PARAGUAY','Amérique du Sud'),
  ('BOLIVIE','Amérique du Sud'),
  ('PEROU','Amérique du Sud'),
  ('EQUATEUR','Amérique du Sud'),
  ('COLOMBIE','Amérique du Sud'),
  ('VENEZUELA','Amérique du Sud'),
  ('GUYANA','Amérique du Sud'),
  ('SURINAME','Amérique du Sud'),
  ('AUSTRALIE','Océanie'),
  ('NOUVELLE-ZELANDE','Océanie'),
  ('PAPOUASIE-NOUVELLE-GUINEE','Océanie'),
  ('FIDJI','Océanie'),
  ('SAMOA','Océanie'),
  ('TONGA','Océanie'),
  ('VANUATU','Océanie'),
  ('ILES SALOMON','Océanie'),
  ('MICRONESIE','Océanie'),
  ('PALAOS','Océanie'),
  ('NAURU','Océanie'),
  ('TUVALU','Océanie'),
  ('KIRIBATI','Océanie'),
  ('ILES MARSHALL','Océanie')
on conflict (name) do nothing;

-- pick_country : matche le pays choisi de façon tolérante (le sélecteur envoie déjà
-- un nom exact, mais on sécurise). Redéfinie pour la comparaison normalisée.
drop function if exists pick_country(uuid, text);

create or replace function pick_country(p_game_id uuid, p_country text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me      players;
  v_game    games;
  v_country countries;
  v_count   int;
  v_starter uuid;
begin
  select * into v_me from players where game_id = p_game_id and user_id = auth.uid();
  if v_me.id is null then
    raise exception 'you are not in this game' using errcode = '42501';
  end if;

  select * into v_game from games where id = p_game_id;
  if v_game.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  select * into v_country from countries
  where norm_country(name) = norm_country(p_country)
  limit 1;
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

  if v_game.intermission
     and not exists (select 1 from players where game_id = p_game_id and not has_picked) then
    select count(*) into v_count from players where game_id = p_game_id;
    select id into v_starter from players where game_id = p_game_id
      order by seat offset ((v_game.round - 1) % v_count) limit 1;
    update games set status = 'playing', intermission = false, current_player_id = v_starter
      where id = p_game_id;
  end if;
end;
$$;

grant execute on function pick_country(uuid, text) to authenticated;
grant execute on function norm_country(text) to authenticated;

-- submit_guess : comparaison normalisée (accents/casse/séparateurs). Le reste est
-- identique à 0012 (bonus dernier debout, fin de manche à 2 sur un crack).
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
    update players set is_cracked = true, masked = v_secret.country where id = v_target.id;

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
