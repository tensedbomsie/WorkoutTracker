-- v2: Guided workout programs — "today's program" auto-navigate mode
-- Run once in Supabase SQL Editor.

create table if not exists workout_programs (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal text,
  total_days int not null default 1,
  current_day_number int not null default 1,
  repeats boolean not null default true,
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references workout_programs(id) on delete cascade,
  day_number int not null,
  name text not null default 'Day',
  created_at timestamptz not null default now()
);

create table if not exists program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references program_days(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  position int not null default 0,
  target_sets int not null default 3,
  target_reps int not null default 10,
  target_weight numeric,
  target_rest_seconds int not null default 60,
  created_at timestamptz not null default now()
);

-- Link a real workout session back to the program day it came from (nullable — manual logs stay untouched)
alter table workouts add column if not exists program_day_id uuid references program_days(id) on delete set null;

alter table workout_programs enable row level security;
alter table program_days enable row level security;
alter table program_exercises enable row level security;

drop policy if exists "own workout_programs" on workout_programs;
create policy "own workout_programs" on workout_programs
  for all using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "own program_days" on program_days;
create policy "own program_days" on program_days
  for all using (
    exists (select 1 from workout_programs p where p.id = program_days.program_id and p.owner = auth.uid())
  ) with check (
    exists (select 1 from workout_programs p where p.id = program_days.program_id and p.owner = auth.uid())
  );

drop policy if exists "own program_exercises" on program_exercises;
create policy "own program_exercises" on program_exercises
  for all using (
    exists (
      select 1 from program_days d
      join workout_programs p on p.id = d.program_id
      where d.id = program_exercises.program_day_id and p.owner = auth.uid()
    )
  ) with check (
    exists (
      select 1 from program_days d
      join workout_programs p on p.id = d.program_id
      where d.id = program_exercises.program_day_id and p.owner = auth.uid()
    )
  );
