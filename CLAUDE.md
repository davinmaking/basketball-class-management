# Basketball Class Management

## Project Overview
Basketball training class management web app for coaches and parents.
- **Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase
- **Package manager**: npm
- **Language**: UI text in Chinese (Simplified), code in English. WhatsApp messages in Bahasa Malaysia.

## Supabase
- **Project ID**: `dkjjmjtevzvseykrjcpq`
- **Region**: `ap-southeast-1`
- **Auth**: Email/password for coaches; token-based public URLs for parents
- **RLS**: Enabled on all tables — authenticated = full access, anon = read access
- **Note**: Supabase MCP is connected to a different org — use code-side approaches for DB logic

## Database Schema
- `students` — name, school_class, parent_name, relationship, phone, health_notes, fee_exempt, active, view_token, registered_at
- `class_sessions` — session_date (unique), notes
- `attendance` — student_id, session_id, present, fee_exempt (unique on student+session)
- `payments` — student_id, amount, payment_date, month, year, notes, voided, voided_at, voided_reason
- `receipts` — payment_id, receipt_number (unique), issued_at, voided

## Key Business Rules
- Fee rate: RM5 per session (defined in `src/lib/constants.ts`)
- Fee-exempt: controlled per-student (`students.fee_exempt`), used as default for attendance `fee_exempt` toggle
- Receipt number format: `RCP-{year}-{sequential}`, generated with year-scoped query + retry on unique constraint (error 23505)
- Parent portal: `/view/[token]?year=YYYY` — no auth required, read-only, supports year navigation
- CSV import auto-maps columns by keyword matching (Malay + English), includes duplicate name detection
- Session deletion blocked when month has non-voided payments
- All destructive actions (delete payments, receipts, sessions) require confirmation dialog

## Architecture
- `/src/app/login/` — Auth (login + signup)
- `/src/app/dashboard/` — Protected coach area (students, sessions, attendance, fees, receipts)
- `/src/app/view/[token]/` — Public parent portal (server component)
- `/src/lib/supabase/` — client.ts, server.ts, middleware.ts
- `/src/lib/constants.ts` — MONTHS, DAYS_OF_WEEK, FEE_PER_SESSION
- `/src/lib/student-groups.ts` — `groupStudentsByClass()` shared utility
- `/src/lib/receipt-html.ts` — `generateReceiptHtml()`, `printReceiptHtml()` shared utility
- `/src/lib/phone.ts` — `normalizePhone()` for sibling detection
- `/src/components/sidebar-nav.tsx` — Dashboard navigation (collapsible)
- `/src/middleware.ts` — Auth route protection

## Conventions
- Date format in UI: `{year}年{month}月` (Chinese style)
- Tables use `overflow-x-auto` for mobile scroll
- Delete operations use shadcn AlertDialog for confirmation
- Shared logic extracted to `/src/lib/` — prefer reuse over inline duplication
- Receipt print opens popup window — handle blocked popups with toast feedback

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
