-- Écran de fin de manche + animation de dernière place pour 8 Américain.
--
-- Le round finit ET la manche suivante est redistribuée dans la MÊME transaction
-- (americain_end_round -> americain_deal) : sans un événement dédié, le client ne
-- peut pas savoir de façon fiable qui vient de gagner (le hand_count=0 du gagnant
-- est écrasé par la redistribution avant même que l'UI ait pu réagir posément).
-- Même pattern que game_events / james_events : table éphémère, fenêtre glissante.

create type americain_event_type as enum ('round_won', 'game_won');

create table americain_events (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references americain_games(id) on delete cascade,
  type       americain_event_type not null,
  actor_id   uuid references americain_players(id) on delete set null,  -- le gagnant
  target_id  uuid references americain_players(id) on delete set null,  -- la dernière place (game_won)
  payload    jsonb not null default '{}'::jsonb,  -- { penalties: { player_id: points } }
  created_at timestamptz not null default now()
);

create index americain_events_game_recent_idx on americain_events (game_id, created_at desc);

create or replace function prune_americain_events()
returns trigger
language plpgsql
as $$
begin
  delete from americain_events e
  where e.game_id = new.game_id
    and e.id not in (
      select id from americain_events where game_id = new.game_id
      order by created_at desc limit 5
    );
  return null;
end;
$$;

create trigger prune_americain_events_after_insert
after insert on americain_events
for each row execute function prune_americain_events();

alter table americain_events enable row level security;

create policy "americain_events readable by table"
  on americain_events for select to authenticated
  using (is_americain_player(game_id));

alter table americain_events replica identity full;
alter publication supabase_realtime add table americain_events;

-- ---------------------------------------------------------------------------
-- americain_end_round : émet 'round_won' avec le détail des pénalités, puis
-- 'game_won' (gagnant + dernière place) si le seuil est atteint.
-- ---------------------------------------------------------------------------
create or replace function americain_end_round(p_game_id uuid, p_winner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game        americain_games;
  v_over        boolean;
  v_penalties   jsonb;
  v_last_place  uuid;
  v_game_winner uuid;
begin
  select coalesce(jsonb_object_agg(p.id, p.hand_count), '{}'::jsonb) into v_penalties
  from americain_players p
  where p.game_id = p_game_id and p.id <> p_winner_id and p.hand_count > 0;

  update americain_players p set penalty_score = penalty_score + p.hand_count
  where p.game_id = p_game_id and p.id <> p_winner_id;

  insert into americain_events (game_id, type, actor_id, payload)
  values (p_game_id, 'round_won', p_winner_id, jsonb_build_object('penalties', v_penalties));

  select * into v_game from americain_games where id = p_game_id;

  select exists (
    select 1 from americain_players
    where game_id = p_game_id and penalty_score >= v_game.penalty_threshold
  ) into v_over;

  if v_over then
    -- Le gagnant DE LA PARTIE (pénalité la plus basse au global) n'est pas
    -- forcément celui qui vient de gagner cette dernière manche.
    select id into v_game_winner
    from americain_players
    where game_id = p_game_id
    order by penalty_score asc
    limit 1;

    select id into v_last_place
    from americain_players
    where game_id = p_game_id
    order by penalty_score desc
    limit 1;

    update americain_games set status = 'finished', ended_at = now(), current_player_id = null
      where id = p_game_id;

    insert into americain_events (game_id, type, actor_id, target_id)
    values (p_game_id, 'game_won', v_game_winner, v_last_place);
  else
    update americain_games set round = round + 1 where id = p_game_id;
    perform americain_deal(p_game_id);
  end if;
end;
$$;
