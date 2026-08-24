-- Tamrino (Barbod_gym) — Supabase schema
-- Run this whole file once in: Supabase Dashboard → SQL Editor → New query → Run

-- 1) Workouts: one row per training day (any date, any number of days per week)
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_date date not null default current_date,
  title text not null,
  muscle_group text,
  level text,
  duration_min int,
  gym_name text,
  avg_heart_rate int,
  active_minutes int,
  calories int,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, workout_date)
);

-- 2) Exercises: belong to a workout day
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  name text not null,
  sets int,
  reps int,
  weight_kg numeric,
  icon text,
  order_index int not null default 0,
  done boolean not null default false,
  done_at timestamptz
);

-- 3) Row Level Security: every user only ever sees their own rows
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;

create policy "own workouts" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own exercises" on public.exercises
  for all using (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

-- 4) Helpful index for month/history views
create index if not exists workouts_user_date_idx on public.workouts (user_id, workout_date desc);
