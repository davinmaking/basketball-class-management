# Basketball Class Management

## Project Overview
Basketball training class management web app for coaches and parents.
- **Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase
- **Package manager**: npm
- **Language**: UI text bilingual (Chinese + Malay) on public pages; Chinese on dashboard; code in English. WhatsApp messages in Bahasa Malaysia or Chinese based on student preference.

## Supabase
- **Auth**: Email/password for coaches; token-based public URLs for parents
- **RLS**: Enabled on all tables — authenticated = full access, anon = read access

## Database Schema
- `students` — name, school_class, parent_name, relationship, phone, health_notes, fee_exempt, preferred_language, active, view_token, registered_at
- `coaches` — name, phone, active
- `class_sessions` — session_date (unique), notes
- `session_coaches` — session_id (FK→class_sessions), coach_id (FK→coaches) (unique on session+coach) — many-to-many join table
- `attendance` — student_id, session_id, present, fee_exempt (unique on student+session)
- `payments` — student_id, amount, payment_date, month, year, notes, voided, voided_at, voided_reason
- `refunds` — student_id, coach_id, amount, refund_date, month (nullable), year, total_sessions, total_due, total_paid, notes, voided, voided_at, voided_reason
- `receipts` — payment_id, receipt_number (unique), issued_at, voided
- `credit_notes` — refund_id, credit_note_number (unique), issued_at, voided
- `coach_payments` — coach_id (FK→coaches), amount, payment_date, month, year, notes, voided, voided_at, voided_reason (unique on coach+month+year)

## Key Business Rules
- Fee rate and currency configurable via env vars (see `src/lib/config.ts`)
- Fee-exempt: controlled per-student (`students.fee_exempt`), used as default for attendance `fee_exempt` toggle
- Receipt number format: `RCPT-{year}-{month}-{sequential}` (e.g. `RCPT-2026-03-001`), generated with month-scoped query + retry on unique constraint (error 23505)
- Credit note number format: `RTRN-{year}-{sequential}` (e.g. `RTRN-2026-001`)
- Receipt/credit note format: bilingual (BM + Chinese), no school header, coach name as 收款人/退款人, student name shown, footer disclaimers, centered when printing
- Coach tracking: each session supports multiple coaches via `session_coaches` join table; coaches managed in settings
- Parent portal: `/view/[token]?year=YYYY` — no auth required, read-only, bilingual (Chinese + Malay), supports year navigation, back button to directory
- Student directory: `/directory` — public page listing all active students grouped by class, searchable, links to individual parent portals
- CSV import auto-maps columns by keyword matching (Malay + English), includes duplicate name detection
- Dashboard outstanding = all-time cumulative (not current month only) — students may pay late across months
- Session deletion blocked when month has non-voided payments
- Student/coach deletion: hard delete with linked-record check (attendance/payments/refunds); blocked if records exist with toast suggesting deactivation
- All destructive actions (delete payments, receipts, sessions, students, coaches) require confirmation dialog

## Architecture
- `/src/app/login/` — Auth (login + signup)
- `/src/app/dashboard/` — Protected coach area (students, sessions, attendance, fees, receipts, reports); dashboard page shows stat cards + all-time outstanding students grouped by class
- `/src/app/directory/` — Public student directory (server + client component with search)
- `/src/app/view/[token]/` — Public parent portal (server component, bilingual)
- `/src/lib/config.ts` — Environment-based configuration (app name, school info, fee rate, currency)
- `/src/lib/supabase/` — client.ts, server.ts, middleware.ts
- `/src/lib/constants.ts` — MONTHS, DAYS_OF_WEEK
- `/src/lib/student-groups.ts` — `groupStudentsByClass()` shared utility
- `/src/lib/receipt-html.ts` — `generateReceiptHtml()`, `printReceiptHtml()` bilingual receipt
- `/src/lib/report-html.ts` — Financial report HTML generators + print for 4 report types (student, monthly, coach payment, annual)
- `/src/lib/phone.ts` — `normalizePhone()` for sibling detection
- `/src/lib/language.ts` — `detectLanguage()`, `getLanguageLabel()` for WhatsApp message language
- `/src/components/sidebar-nav.tsx` — Dashboard navigation (collapsible)
- `/src/components/ui/skeleton.tsx` — Reusable skeleton loader component
- `/src/app/dashboard/loading.tsx` — Dashboard loading boundary (skeleton stat cards)
- `/src/middleware.ts` — Auth route protection

## UI/Design Conventions
- Theme uses `--success` / `--success-foreground` CSS variables (emerald green) for positive states
- All buttons have `active:scale-[0.98]` tactile feedback via button.tsx CVA base class
- Loading states use Skeleton components (not plain text "加载中...")
- Empty states use composed layout: icon in rounded bg + heading + subtext + optional CTA button
- Sidebar active state uses soft highlight (`bg-primary/10 text-primary`) not solid fill
- Finance and Reports tabs use `variant="line"` (underline style)
- Stat card values use `tabular-nums tracking-tight` for clean number display
- Student lists grouped by class use `groupStudentsByClass()` with class header rows (`bg-muted/50`, `colSpan` full width)
- Page headings use `tracking-tight` for tighter typography
- Login, parent portal, and directory use `min-h-[100dvh]` (not `min-h-screen`) with Dribbble brand icon
- Public pages (parent portal, directory) use bilingual labels: "华语 / Malay" format (e.g. "余额 / Baki")

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
