# Basketball Class Management

## Project Overview
Basketball training class management web app for coaches and parents.
- **Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase
- **Package manager**: npm
- **Language**: UI text in Bahasa Malaysia, code in English

## Supabase
- **Project ID**: `dkjjmjtevzvseykrjcpq`
- **Region**: `ap-southeast-1`
- **Auth**: Email/password for coaches; token-based public URLs for parents
- **RLS**: Enabled on all tables — authenticated = full access, anon = read access

## Database Schema
- `students` — name, school_class, parent_name, phone, health_notes, fee_exempt, view_token
- `class_sessions` — session_date (unique), notes
- `attendance` — student_id, session_id, present (unique on student+session)
- `payments` — student_id, amount, payment_date, month, year
- `receipts` — payment_id, receipt_number (unique)

## Key Business Rules
- Fee rate: RM5 per session
- Fee-exempt students show RM0 due
- Receipt number format: `RCP-{year}-{sequential}`
- Parent portal: `/view/[token]` — no auth required, read-only
- CSV import auto-maps columns by keyword matching (Malay + English)

## Architecture
- `/src/app/login/` — Auth (login + signup)
- `/src/app/dashboard/` — Protected coach area (students, sessions, attendance, fees, receipts)
- `/src/app/view/[token]/` — Public parent portal
- `/src/lib/supabase/` — client.ts, server.ts, middleware.ts
- `/src/components/sidebar-nav.tsx` — Dashboard navigation
- `/src/middleware.ts` — Auth route protection

## Dev Commands
- `npm run dev` — Start dev server (port 3000)
- `npm run build` — Production build
- `npx tsc --noEmit` — Type check

## Git Workflow
- Always confirm remote account before pushing
- Never push without explicit user approval
- Stage specific files, never `git add -A`

## Test Account
- Email: `coach@basketball.com`
- Password: `coach123`
