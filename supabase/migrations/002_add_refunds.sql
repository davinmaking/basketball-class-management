-- Refund Feature - Add refunds and credit notes tables
-- Run this migration in your Supabase SQL Editor after 001_initial_schema.sql.

-- ── Refunds ────────────────────────────────────────────────
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric not null,
  refund_date date not null default current_date,
  year integer not null,
  month integer,                    -- null = full year refund
  total_paid numeric not null,      -- snapshot: total payments in period
  total_sessions integer not null,  -- snapshot: chargeable sessions in period
  total_due numeric not null,       -- snapshot: total_sessions * fee_rate
  notes text,
  voided boolean default false,
  voided_at timestamptz,
  voided_reason text,
  created_at timestamptz default now()
);

-- ── Credit Notes ───────────────────────────────────────────
create table if not exists public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.refunds(id) on delete cascade,
  credit_note_number text not null unique,
  voided boolean default false,
  issued_at timestamptz default now()
);

-- ── Row Level Security ─────────────────────────────────────
alter table public.refunds enable row level security;
alter table public.credit_notes enable row level security;

-- Authenticated users (coaches) get full access
create policy "Authenticated full access" on public.refunds
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on public.credit_notes
  for all using (auth.role() = 'authenticated');

-- Anonymous users (parent portal) get read-only access
create policy "Anon read access" on public.refunds
  for select using (true);

create policy "Anon read access" on public.credit_notes
  for select using (true);
