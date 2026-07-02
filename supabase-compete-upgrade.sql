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
