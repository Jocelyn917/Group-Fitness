-- PulsePal Compete upgrade
-- Run this once in the Supabase SQL editor for an existing project.

alter table public.goals add column if not exists challenge_key text;
alter table public.goals add column if not exists challenge_label text;
alter table public.goals add column if not exists challenge_points integer not null default 0;

drop view if exists public.goals_with_counts;
create view public.goals_with_counts as
select
  g.*,
  p.display_name as owner_name,
  p.avatar_url as owner_avatar_url,
  coalesce(l.like_count, 0) as like_count,
  coalesce(c.comment_count, 0) as comment_count,
  exists(select 1 from public.goal_likes gl where gl.goal_id = g.id and gl.user_id = auth.uid()) as viewer_liked
from public.goals g
join public.profiles p on p.id = g.owner_id
left join (select goal_id, count(*)::int as like_count from public.goal_likes group by goal_id) l on l.goal_id = g.id
left join (select goal_id, count(*)::int as comment_count from public.goal_comments group by goal_id) c on c.goal_id = g.id
where
  g.owner_id = auth.uid()
  or g.visibility = 'public'
  or (g.visibility = 'friends' and public.are_friends(auth.uid(), g.owner_id));

create table if not exists public.ranked_activities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text default '',
  activity_type text not null check (activity_type in ('duration_highest_wins', 'count_highest_wins', 'time_lowest_wins', 'distance_highest_wins')),
  unit text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_results (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.ranked_activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value numeric not null check (value > 0),
  display_value text not null,
  notes text default '',
  created_at timestamptz not null default now()
);

insert into public.ranked_activities (name, description, activity_type, unit, sort_order) values
  ('Highest Plank Time', 'Hold a plank as long as you can.', 'duration_highest_wins', 'min:sec', 1),
  ('Most Pushups', 'Total pushups in one attempt.', 'count_highest_wins', 'reps', 2),
  ('Fastest 1 km Run', 'Your fastest one kilometer run.', 'time_lowest_wins', 'min:sec', 3),
  ('Longest Wall Sit', 'Hold a wall sit as long as possible.', 'duration_highest_wins', 'min:sec', 4),
  ('Most Squats', 'Total squats in one attempt.', 'count_highest_wins', 'reps', 5),
  ('Longest Run Distance', 'Longest run distance logged.', 'distance_highest_wins', 'km', 6)
on conflict (name) do update set
  description = excluded.description,
  activity_type = excluded.activity_type,
  unit = excluded.unit,
  sort_order = excluded.sort_order;

alter table public.ranked_activities enable row level security;
alter table public.activity_results enable row level security;

drop policy if exists "Ranked activities are readable" on public.ranked_activities;
create policy "Ranked activities are readable"
on public.ranked_activities for select
to authenticated
using (true);

drop policy if exists "Activity results are readable" on public.activity_results;
create policy "Activity results are readable"
on public.activity_results for select
to authenticated
using (true);

drop policy if exists "Users submit own activity results" on public.activity_results;
create policy "Users submit own activity results"
on public.activity_results for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users update own activity results" on public.activity_results;
create policy "Users update own activity results"
on public.activity_results for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users delete own activity results" on public.activity_results;
create policy "Users delete own activity results"
on public.activity_results for delete
to authenticated
using (user_id = auth.uid());
