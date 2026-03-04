-- Coaches table
create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Add coach_id to existing tables
alter table public.class_sessions add column coach_id uuid references public.coaches(id);
alter table public.payments add column coach_id uuid references public.coaches(id);
alter table public.refunds add column coach_id uuid references public.coaches(id);

-- RLS
alter table public.coaches enable row level security;

create policy "Authenticated full access" on public.coaches
  for all using (auth.role() = 'authenticated');

create policy "Anon read access" on public.coaches
  for select using (true);
