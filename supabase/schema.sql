-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query)
-- Uses the same Supabase project as Storyboard / Food Diary, new tables only.

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  subcategory text,
  muscle_group text,
  primary_muscle text,
  secondary_muscle text,
  equipment text,
  movement_pattern text,
  difficulty text,
  stretch_focus boolean not null default false,
  thumbnail_url text,
  notes text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Workout',
  performed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  set_number int not null default 1,
  reps int not null,
  weight numeric not null default 0,
  rest_seconds int,
  created_at timestamptz not null default now()
);

alter table exercises enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table sets enable row level security;

drop policy if exists "own exercises" on exercises;
create policy "own exercises" on exercises
  for all using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "own workouts" on workouts;
create policy "own workouts" on workouts
  for all using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "own workout_exercises" on workout_exercises;
create policy "own workout_exercises" on workout_exercises
  for all using (
    exists (select 1 from workouts w where w.id = workout_exercises.workout_id and w.owner = auth.uid())
  ) with check (
    exists (select 1 from workouts w where w.id = workout_exercises.workout_id and w.owner = auth.uid())
  );

drop policy if exists "own sets" on sets;
create policy "own sets" on sets
  for all using (
    exists (
      select 1 from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = sets.workout_exercise_id and w.owner = auth.uid()
    )
  ) with check (
    exists (
      select 1 from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = sets.workout_exercise_id and w.owner = auth.uid()
    )
  );

-- Seed a starter exercise library (only if you have no exercises yet).
-- Replace YOUR_USER_ID below with your auth.users id, or run this while
-- logged in via the SQL editor's "impersonate" role is not available, so
-- instead we default to the first user in auth.users for convenience.
insert into exercises (owner, name, category, subcategory, muscle_group, primary_muscle, secondary_muscle, equipment, movement_pattern, difficulty)
select u.id, v.name, v.category, v.subcategory, v.muscle_group, v.primary_muscle, v.secondary_muscle, v.equipment, v.movement_pattern, v.difficulty
from (select id from auth.users order by created_at asc limit 1) u
cross join (values
  ('Bench Press', 'Chest', 'Compound', 'Chest', 'Chest', 'Triceps, Shoulders', 'Barbell', 'Push', 'Intermediate'),
  ('Incline Dumbbell Press', 'Chest', 'Compound', 'Upper Chest', 'Upper Chest', 'Shoulders, Triceps', 'Dumbbell', 'Push', 'Intermediate'),
  ('Cable Fly', 'Chest', 'Isolation', 'Chest', 'Chest', null, 'Cable', 'Push', 'Beginner'),
  ('Push-up', 'Chest', 'Compound', 'Chest', 'Chest', 'Triceps, Shoulders', 'Bodyweight', 'Push', 'Beginner'),
  ('Lat Pulldown', 'Back', 'Vertical Pull', 'Lats', 'Lats', 'Biceps', 'Cable', 'Pull', 'Beginner'),
  ('Cross Body Pull Around', 'Back', 'Vertical Pull', 'Lats', 'Lats', 'Rear Delt', 'Cable', 'Pull', 'Intermediate'),
  ('Pull-up', 'Back', 'Vertical Pull', 'Lats', 'Lats', 'Biceps', 'Bodyweight', 'Pull', 'Advanced'),
  ('Barbell Row', 'Back', 'Horizontal Row', 'Mid Back', 'Lats', 'Biceps, Rear Delt', 'Barbell', 'Pull', 'Intermediate'),
  ('Seated Cable Row', 'Back', 'Horizontal Row', 'Mid Back', 'Lats', 'Biceps', 'Cable', 'Pull', 'Beginner'),
  ('Deadlift', 'Back', 'Lower Back', 'Lower Back', 'Erectors', 'Glutes, Hamstrings', 'Barbell', 'Hinge', 'Advanced'),
  ('Back Extension', 'Back', 'Lower Back', 'Lower Back', 'Erectors', 'Glutes', 'Bodyweight', 'Hinge', 'Beginner'),
  ('Overhead Press', 'Shoulder', 'Front Delt', 'Front Delt', 'Front Delt', 'Triceps', 'Barbell', 'Push', 'Intermediate'),
  ('Lateral Raise', 'Shoulder', 'Side Delt', 'Side Delt', 'Side Delt', null, 'Dumbbell', 'Push', 'Beginner'),
  ('Face Pull', 'Shoulder', 'Rear Delt', 'Rear Delt', 'Rear Delt', 'Traps', 'Cable', 'Pull', 'Beginner'),
  ('Reverse Fly', 'Shoulder', 'Rear Delt', 'Rear Delt', 'Rear Delt', null, 'Dumbbell', 'Pull', 'Beginner'),
  ('Barbell Curl', 'Biceps', 'Curl', 'Biceps', 'Biceps', null, 'Barbell', 'Pull', 'Beginner'),
  ('Bicep Curl', 'Biceps', 'Curl', 'Biceps', 'Biceps', null, 'Dumbbell', 'Pull', 'Beginner'),
  ('Tricep Pushdown', 'Triceps', null, 'Triceps', 'Triceps', null, 'Cable', 'Push', 'Beginner'),
  ('Skull Crusher', 'Triceps', null, 'Triceps', 'Triceps', null, 'Barbell', 'Push', 'Intermediate'),
  ('Wrist Curl', 'Forearm', null, 'Forearm', 'Forearm', null, 'Dumbbell', 'Pull', 'Beginner'),
  ('Plank', 'Core', null, 'Core', 'Abs', null, 'Bodyweight', 'Carry', 'Beginner'),
  ('Cable Crunch', 'Core', null, 'Core', 'Abs', null, 'Cable', 'Rotation', 'Beginner'),
  ('Squat', 'Quads', null, 'Quads', 'Quads', 'Glutes', 'Barbell', 'Squat', 'Intermediate'),
  ('Leg Press', 'Quads', null, 'Quads', 'Quads', 'Glutes', 'Machine', 'Squat', 'Beginner'),
  ('Leg Extension', 'Quads', null, 'Quads', 'Quads', null, 'Machine', 'Squat', 'Beginner'),
  ('Romanian Deadlift', 'Hamstrings', null, 'Hamstrings', 'Hamstrings', 'Glutes', 'Barbell', 'Hinge', 'Intermediate'),
  ('Leg Curl', 'Hamstrings', null, 'Hamstrings', 'Hamstrings', null, 'Machine', 'Hinge', 'Beginner'),
  ('Hip Thrust', 'Glutes', null, 'Glutes', 'Glutes', 'Hamstrings', 'Barbell', 'Hinge', 'Intermediate'),
  ('Glute Bridge', 'Glutes', null, 'Glutes', 'Glutes', null, 'Bodyweight', 'Hinge', 'Beginner'),
  ('Standing Calf Raise', 'Calves', null, 'Calves', 'Calves', null, 'Machine', 'Push', 'Beginner')
) as v(name, category, subcategory, muscle_group, primary_muscle, secondary_muscle, equipment, movement_pattern, difficulty)
where not exists (select 1 from exercises);
