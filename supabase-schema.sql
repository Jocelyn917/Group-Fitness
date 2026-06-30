-- PulsePal Supabase schema and Row Level Security policies
-- Run this in the Supabase SQL editor after creating your project.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  avatar_url text,
  bio text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text default '',
  category text default 'Fitness',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  visibility text not null default 'public' check (visibility in ('public', 'friends', 'private')),
  progress_type text not null default 'checkbox' check (progress_type in ('checkbox', 'count', 'timer'))
);

create table if not exists public.goal_likes (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (goal_id, user_id)
);

create table if not exists public.goal_comments (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (requester_id, receiver_id),
  check (requester_id <> receiver_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  sender_id uuid references public.profiles(id) on delete set null,
  goal_id uuid references public.goals(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,
  icon text not null default 'badge'
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

insert into public.badges (name, description, icon) values
  ('First Goal', 'Created your first fitness goal', 'spark'),
  ('First Completion', 'Completed your first goal', 'check'),
  ('3-Day Streak', 'Completed goals three days in a row', 'flame'),
  ('7-Day Streak', 'Held a week-long streak', 'trophy'),
  ('30-Day Streak', 'Held a 30-day streak', 'trophy'),
  ('10 Goals Completed', 'Completed ten goals', 'badge'),
  ('50 Goals Completed', 'Completed fifty goals', 'badge'),
  ('Hydration Hero', 'Completed a hydration goal', 'water'),
  ('Gym Starter', 'Completed a gym goal', 'gym'),
  ('Sleep Champion', 'Completed a sleep goal', 'moon'),
  ('Healthy Week', 'Completed wellness goals for a week', 'leaf')
on conflict (name) do nothing;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and receiver_id = b) or (requester_id = b and receiver_id = a))
  );
$$;

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.goal_likes enable row level security;
alter table public.goal_comments enable row level security;
alter table public.friendships enable row level security;
alter table public.notifications enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists "Profiles are readable by signed in users" on public.profiles;
create policy "Profiles are readable by signed in users" on public.profiles for select to authenticated using (true);

drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Read visible goals" on public.goals;
create policy "Read visible goals" on public.goals for select to authenticated using (
  owner_id = auth.uid()
  or visibility = 'public'
  or (visibility = 'friends' and public.are_friends(auth.uid(), owner_id))
);

drop policy if exists "Users create own goals" on public.goals;
create policy "Users create own goals" on public.goals for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "Users update own goals" on public.goals;
create policy "Users update own goals" on public.goals for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users delete own goals" on public.goals;
create policy "Users delete own goals" on public.goals for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "Read likes on visible goals" on public.goal_likes;
create policy "Read likes on visible goals" on public.goal_likes for select to authenticated using (exists (select 1 from public.goals g where g.id = goal_id));

drop policy if exists "Users like as themselves" on public.goal_likes;
create policy "Users like as themselves" on public.goal_likes for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.goals g where g.id = goal_id and g.owner_id <> auth.uid())
);

drop policy if exists "Users remove own likes" on public.goal_likes;
create policy "Users remove own likes" on public.goal_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Read comments on visible goals" on public.goal_comments;
create policy "Read comments on visible goals" on public.goal_comments for select to authenticated using (exists (select 1 from public.goals g where g.id = goal_id));

drop policy if exists "Users comment as themselves" on public.goal_comments;
create policy "Users comment as themselves" on public.goal_comments for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.goals g where g.id = goal_id));

drop policy if exists "Users or owners delete comments" on public.goal_comments;
create policy "Users or owners delete comments" on public.goal_comments for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.goals g where g.id = goal_id and g.owner_id = auth.uid())
);

drop policy if exists "Read own friendships" on public.friendships;
create policy "Read own friendships" on public.friendships for select to authenticated using (requester_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Users send requests" on public.friendships;
create policy "Users send requests" on public.friendships for insert to authenticated with check (requester_id = auth.uid());

drop policy if exists "Receivers update requests" on public.friendships;
create policy "Receivers update requests" on public.friendships for update to authenticated using (receiver_id = auth.uid() or requester_id = auth.uid());

drop policy if exists "Users remove own friendships" on public.friendships;
create policy "Users remove own friendships" on public.friendships for delete to authenticated using (requester_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Signed in users create notifications" on public.notifications;
create policy "Signed in users create notifications" on public.notifications for insert to authenticated with check (sender_id = auth.uid() or sender_id is null);

drop policy if exists "Badges are readable" on public.badges;
create policy "Badges are readable" on public.badges for select to authenticated using (true);

drop policy if exists "Users read own badges" on public.user_badges;
create policy "Users read own badges" on public.user_badges for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users earn own badges" on public.user_badges;
create policy "Users earn own badges" on public.user_badges for insert to authenticated with check (user_id = auth.uid());

create or replace view public.goals_with_counts as
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
