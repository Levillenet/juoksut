create table public.record_baseline (
  competition_id int not null,
  event_id int not null,
  athlete_id int not null,
  pb text not null default '',
  sb text not null default '',
  captured_at timestamptz not null default now(),
  primary key (competition_id, event_id, athlete_id)
);

alter table public.record_baseline enable row level security;

create policy "Anyone authenticated can read baselines"
  on public.record_baseline for select
  to authenticated using (true);

create policy "Anyone authenticated can insert baselines"
  on public.record_baseline for insert
  to authenticated with check (true);

create index idx_record_baseline_competition on public.record_baseline (competition_id);