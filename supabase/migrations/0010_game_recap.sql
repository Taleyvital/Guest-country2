-- Résumé de partie : compteurs par joueur ET par partie.
--
-- game_events est éphémère (purgé à 5 lignes) et player_stats est cumulé sur TOUTES
-- les parties : ni l'un ni l'autre ne permet de raconter UNE partie. On ajoute donc
-- des compteurs sur players, portée = la partie en cours (une ligne players = un
-- joueur dans une partie).
--
-- Ils sont alimentés par un trigger sur les insertions de game_events, PAS en
-- modifiant ask_letter / submit_guess : ces fonctions ont déjà été réécrites
-- plusieurs fois, on évite une nouvelle copie intégrale et le risque qui va avec.

alter table players
  add column found_count   int not null default 0,   -- pays devinés dans cette partie
  add column guess_count   int not null default 0,   -- tentatives d'identification
  add column letters_count int not null default 0;   -- lettres demandées

-- Ces compteurs ne sont PAS remis à zéro entre les manches (close_round ne les
-- touche pas) : le résumé porte sur la partie entière, manches cumulées.

create or replace function bump_game_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.actor_id is null then
    return null;
  end if;

  if new.type = 'ask_letter' then
    update players set letters_count = letters_count + 1 where id = new.actor_id;
  elsif new.type = 'guess' then
    -- 'guess' = tentative correcte : un pays trouvé, et une tentative de plus.
    update players
      set found_count = found_count + 1, guess_count = guess_count + 1
      where id = new.actor_id;
  elsif new.type = 'eliminated' then
    -- 'eliminated' = tentative ratée : une tentative, pas de trouvaille.
    update players set guess_count = guess_count + 1 where id = new.actor_id;
  end if;

  return null;
end;
$$;

create trigger bump_game_counters_after_insert
  after insert on game_events
  for each row execute function bump_game_counters();
