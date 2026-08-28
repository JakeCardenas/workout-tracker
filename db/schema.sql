-- Run this once in the Supabase SQL editor before anyone signs up.
-- Without the policies below, row level security denies everything and the
-- app will look broken; with them, a signed-in user can only ever touch
-- the single row keyed to their own auth.uid().

create table if not exists public.workout_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workout_state enable row level security;

drop policy if exists "read own state"   on public.workout_state;
drop policy if exists "insert own state" on public.workout_state;
drop policy if exists "update own state" on public.workout_state;
drop policy if exists "delete own state" on public.workout_state;

create policy "read own state"
  on public.workout_state for select
  using (auth.uid() = user_id);

create policy "insert own state"
  on public.workout_state for insert
  with check (auth.uid() = user_id);

create policy "update own state"
  on public.workout_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own state"
  on public.workout_state for delete
  using (auth.uid() = user_id);

create index if not exists workout_state_updated_at_idx
  on public.workout_state (updated_at desc);
