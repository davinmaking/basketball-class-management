-- Basketball Class Management - Initial Schema
-- Run this migration in your Supabase SQL Editor to set up the database.

-- ── Students ──────────────────────────────────────────────
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_class text,
  parent_name text,
  phone text,
  relationship text,
  health_notes text,
  fee_exempt boolean default false,
  preferred_language text default 'ms',
  active boolean default true,
  view_token text unique,
  registered_at timestamptz,
  created_at timestamptz default now()
);

-- ── Class Sessions ───────────────────────────────────────
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null unique,
  notes text,
  created_at timestamptz default now()
);

-- ── Attendance ───────────────────────────────────────────
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  present boolean default false,
  fee_exempt boolean default false,
  created_at timestamptz default now(),
  unique (student_id, session_id)
);

-- ── Payments ─────────────────────────────────────────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric not null,
  payment_date date not null default current_date,
  month integer not null,
  year integer not null,
  notes text,
  voided boolean default false,
  voided_at timestamptz,
  voided_reason text,
  created_at timestamptz default now()
);

-- ── Receipts ─────────────────────────────────────────────
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  receipt_number text not null unique,
  voided boolean default false,
  issued_at timestamptz default now()
);

-- ── Row Level Security ───────────────────────────────────
alter table public.students enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.payments enable row level security;
alter table public.receipts enable row level security;

-- Authenticated users (coaches) get full access
create policy "Authenticated full access" on public.students
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on public.class_sessions
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on public.attendance
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on public.payments
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on public.receipts
  for all using (auth.role() = 'authenticated');

-- Anonymous users (parent portal) get read-only access
create policy "Anon read access" on public.students
  for select using (true);

create policy "Anon read access" on public.class_sessions
  for select using (true);

create policy "Anon read access" on public.attendance
  for select using (true);

create policy "Anon read access" on public.payments
  for select using (true);

create policy "Anon read access" on public.receipts
  for select using (true);
