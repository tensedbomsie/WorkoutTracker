-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query)

alter table workouts add column if not exists duration_minutes numeric;

create table if not exists progress_photos (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null default now(),
  angle text not null default 'Front',
  image_url text not null,
  created_at timestamptz not null default now()
);

alter table progress_photos enable row level security;

drop policy if exists "own progress photos" on progress_photos;
create policy "own progress photos" on progress_photos
  for all using (owner = auth.uid()) with check (owner = auth.uid());

create table if not exists body_measurements (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight numeric,
  body_fat numeric,
  waist numeric,
  chest numeric,
  arm numeric,
  thigh numeric,
  created_at timestamptz not null default now()
);

alter table body_measurements enable row level security;

drop policy if exists "own body measurements" on body_measurements;
create policy "own body measurements" on body_measurements
  for all using (owner = auth.uid()) with check (owner = auth.uid());

-- Storage bucket for progress photos
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', true)
on conflict (id) do nothing;

drop policy if exists "read progress photos" on storage.objects;
create policy "read progress photos" on storage.objects
  for select using (bucket_id = 'progress-photos');

drop policy if exists "upload own progress photos" on storage.objects;
create policy "upload own progress photos" on storage.objects
  for insert with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "delete own progress photos" on storage.objects;
create policy "delete own progress photos" on storage.objects
  for delete using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
