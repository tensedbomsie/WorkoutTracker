-- Persist photo-comparison results so the overall coach can read past
-- analyses without re-running vision (expensive + uses separate quota).
create table if not exists progress_photo_analyses (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  before_photo_id uuid references progress_photos(id) on delete set null,
  after_photo_id uuid references progress_photos(id) on delete set null,
  goal text,
  analysis text not null,
  created_at timestamptz not null default now()
);

alter table progress_photo_analyses enable row level security;

create policy "owner can select own photo analyses"
  on progress_photo_analyses for select
  using (owner = auth.uid());

create policy "owner can insert own photo analyses"
  on progress_photo_analyses for insert
  with check (owner = auth.uid());

create policy "owner can delete own photo analyses"
  on progress_photo_analyses for delete
  using (owner = auth.uid());
