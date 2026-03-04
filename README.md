# Basketball Class Management

A web app for managing school-based sports training classes. Track students, attendance, fees, and generate bilingual receipts (Bahasa Malaysia + Chinese).

Built for Malaysian school teachers who run after-school training programs.

## Features

- **Student Management** - Add, edit, import (CSV), track active/inactive status
- **Attendance Tracking** - Session-based attendance with fee-exempt marking
- **Fee Management** - Auto-calculated fees based on attendance, payment recording
- **Receipt Generation** - Bilingual school-format receipts with signature and stamp area
- **Parent Portal** - Read-only view for parents via unique token link (no login needed)
- **WhatsApp Reminders** - One-click fee reminder messages in BM or Chinese
- **CSV Import** - Bulk student import with auto column mapping (BM + EN keywords)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (email/password)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/your-username/basketball-class-management.git
cd basketball-class-management
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration file:

```bash
# Copy and paste the contents of this file into Supabase SQL Editor:
supabase/migrations/001_initial_schema.sql
```

3. Create your coach account via **Authentication > Users > Add User**

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase project URL and anon key (found in **Settings > API**).

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your coach account.

## Configuration

All settings are optional environment variables with sensible defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | (required) | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (required) | Your Supabase anon key |
| `NEXT_PUBLIC_APP_NAME` | `篮球训练班管理` | App title shown in sidebar and login |
| `NEXT_PUBLIC_CLASS_NAME` | `篮球训练班` | Class name (Chinese) |
| `NEXT_PUBLIC_CLASS_NAME_BM` | `Kelas Bola Keranjang` | Class name (Bahasa Malaysia) |
| `NEXT_PUBLIC_SCHOOL_NAME` | `Sekolah Kebangsaan Contoh` | School name on receipts |
| `NEXT_PUBLIC_SCHOOL_ADDRESS` | (empty) | School address on receipts |
| `NEXT_PUBLIC_SCHOOL_PHONE` | (empty) | School phone on receipts |
| `NEXT_PUBLIC_FEE_PER_SESSION` | `5` | Fee per session in local currency |
| `NEXT_PUBLIC_RECEIPT_PREFIX` | `RCP` | Receipt number prefix |
| `NEXT_PUBLIC_CURRENCY` | `RM` | Currency symbol |

## Project Structure

```
src/
  app/
    login/           # Auth (login + signup)
    dashboard/       # Protected coach area
      students/      # Student CRUD + CSV import
      attendance/    # Session & attendance management
      fees/          # Fee calculation + payment recording
      receipts/      # Receipt listing + printing
    view/[token]/    # Public parent portal (no auth)
  components/        # Shared UI components (shadcn/ui)
  lib/
    config.ts        # Environment-based configuration
    supabase/        # Supabase client (browser + server)
    receipt-html.ts  # Bilingual receipt template
    language.ts      # Language detection utilities
    phone.ts         # Phone number formatting
  types/
    database.ts      # Supabase generated types
```

## Deployment

Deploy to [Vercel](https://vercel.com):

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel project settings
4. Deploy

## Development

```bash
npm run dev       # Start dev server
npm run build     # Production build
npx tsc --noEmit  # Type check
```
