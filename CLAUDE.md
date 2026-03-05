# Basketball Class Management

## Project Overview
Basketball training class management web app for coaches and parents.
- **Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase
- **Package manager**: npm
- **Language**: UI text in Chinese (Simplified), code in English. WhatsApp messages in Bahasa Malaysia or Chinese based on student preference.

## Supabase
- **Auth**: Email/password for coaches; token-based public URLs for parents
- **RLS**: Enabled on all tables — authenticated = full access, anon = read access

## Database Schema
- `students` — name, school_class, parent_name, relationship, phone, health_notes, fee_exempt, preferred_language, active, view_token, registered_at
- `coaches` — name, phone, active
- `class_sessions` — session_date (unique), coach_id (FK→coaches), notes
- `attendance` — student_id, session_id, present, fee_exempt (unique on student+session)
- `payments` — student_id, amount, payment_date, month, year, notes, voided, voided_at, voided_reason
- `refunds` — student_id, coach_id, amount, refund_date, month (nullable), year, total_sessions, total_due, total_paid, notes, voided, voided_at, voided_reason
- `receipts` — payment_id, receipt_number (unique), issued_at, voided
- `credit_notes` — refund_id, credit_note_number (unique), issued_at, voided
- `coach_payments` — coach_id (FK→coaches), amount, payment_date, month, year, notes, voided, voided_at, voided_reason (unique on coach+month+year)

## Key Business Rules
- Fee rate and currency configurable via env vars (see `src/lib/config.ts`)
- Fee-exempt: controlled per-student (`students.fee_exempt`), used as default for attendance `fee_exempt` toggle
- Receipt number format: `{prefix}-{year}-{month}-{sequential}` (e.g. `SJKT-KLBK-2026-03-001`), generated with month-scoped query + retry on unique constraint (error 23505)
- Receipt format: bilingual (BM + Chinese) school format with signature line and stamp area
- Coach tracking: each session has optional coach assignment; coaches managed in settings
- Parent portal: `/view/[token]?year=YYYY` — no auth required, read-only, supports year navigation
- CSV import auto-maps columns by keyword matching (Malay + English), includes duplicate name detection
- Session deletion blocked when month has non-voided payments
- All destructive actions (delete payments, receipts, sessions) require confirmation dialog

## Architecture
- `/src/app/login/` — Auth (login + signup)
- `/src/app/dashboard/` — Protected coach area (students, sessions, attendance, fees, receipts, reports)
- `/src/app/view/[token]/` — Public parent portal (server component)
- `/src/lib/config.ts` — Environment-based configuration (app name, school info, fee rate, currency)
- `/src/lib/supabase/` — client.ts, server.ts, middleware.ts
- `/src/lib/constants.ts` — MONTHS, DAYS_OF_WEEK
- `/src/lib/student-groups.ts` — `groupStudentsByClass()` shared utility
- `/src/lib/receipt-html.ts` — `generateReceiptHtml()`, `printReceiptHtml()` bilingual receipt
- `/src/lib/report-html.ts` — Financial report HTML generators + print for 4 report types (student, monthly, coach payment, annual)
- `/src/lib/phone.ts` — `normalizePhone()` for sibling detection
- `/src/lib/language.ts` — `detectLanguage()`, `getLanguageLabel()` for WhatsApp message language
- `/src/components/sidebar-nav.tsx` — Dashboard navigation (collapsible)
- `/src/middleware.ts` — Auth route protection

## Conventions
- Date format in UI: `{year}年{month}月` (Chinese style)
- Tables use `overflow-x-auto` for mobile scroll
- Delete operations use shadcn AlertDialog for confirmation
- Shared logic extracted to `/src/lib/` — prefer reuse over inline duplication
- Receipt/report print opens popup window — handle blocked popups with toast feedback
- All hardcoded values (app name, school info, currency, fee rate) use `APP_CONFIG` from `src/lib/config.ts`
- Report print HTML follows same bilingual (BM + Chinese) pattern as receipts via `report-html.ts`
- Coach payments use void-and-reenter pattern (same as payments/refunds); unique constraint on coach+month+year

## Dev Commands
- `npm run dev` — Start dev server (port 3000)
- `npm run build` — Production build
- `npx tsc --noEmit` — Type check

## Git Workflow
- Always confirm remote account before pushing
- Never push without explicit user approval
- Stage specific files, never `git add -A`
- Remote push uses SSH alias: `git push git@github.com-davinmaking:davinmaking/basketball-class-management.git main`

## Deployment
- Hosted on Vercel (auto-deploys from GitHub)
- Supabase project ID: `dkjjmjtevzvseykrjcpq` (not accessible via MCP — run migrations manually in Supabase Dashboard)
