# RAASTA Tracker — Next.js Edition

Full-stack performance tracking for **Team Najeeb** — Sales Agents and Content Creators.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router + TypeScript strict |
| Database | PostgreSQL on [Neon](https://neon.tech) (serverless) |
| ORM | Drizzle ORM + drizzle-kit |
| Auth | Custom PIN auth (bcrypt cost 12, httpOnly cookie sessions) |
| Styling | Tailwind CSS — RAASTA black/gold brand system |
| Charts | Recharts — cumulative revenue vs target (Area chart) |
| State | React Query + Server Actions |
| Package manager | pnpm |
| Deployment | Vercel |

---

## Quick Start (Development)

### 1. Clone / extract the project

```bash
cd raasta-next
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Create a Neon database

1. Go to [console.neon.tech](https://console.neon.tech) → **New Project**
2. Copy the connection string

### 4. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local — fill in DATABASE_URL and BETTER_AUTH_SECRET
```

**Required variables:**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | 64-char random secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `BETTER_AUTH_URL` | App base URL (`http://localhost:3000` in dev) |

### 5. Run database migrations

```bash
pnpm db:push        # Push schema to Neon (development — no migration files)
# OR
pnpm db:generate    # Generate SQL migration files
pnpm db:migrate     # Apply migration files (recommended for production)
```

Seed initial data (employee categories + positions):

```bash
pnpm tsx src/db/seed.ts
```

### 6. Run in development

```bash
pnpm dev
# App: http://localhost:3000
```

---

## Production Deployment (Vercel)

### 1. Push to GitHub

```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/your-org/raasta-tracker.git
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → Import your GitHub repo
2. Framework Preset: **Next.js** (auto-detected)
3. Root Directory: `.` (leave default)

### 3. Set Environment Variables in Vercel

```
DATABASE_URL        = <your Neon connection string>
BETTER_AUTH_SECRET  = <64-char random string>
BETTER_AUTH_URL     = https://your-app.vercel.app
NODE_ENV            = production
```

### 4. Deploy

Vercel builds and deploys automatically. First deploy runs `next build`.

### 5. Run migrations on production

```bash
# From local machine, with production DATABASE_URL in .env.local:
pnpm db:migrate
pnpm tsx src/db/seed.ts
```

---

## First-Time Setup (After Deployment)

1. Open the app URL
2. Navigate to **Team** → Admin PIN setup screen appears
3. Create your 4-digit Admin PIN (stored as bcrypt hash)
4. Go to **Team** → add Sales Agents and Content Creators
5. Team members can immediately start submitting targets and daily logs

---

## Directory Structure

```
src/
├── app/
│   ├── (public)/           # Public routes (no auth)
│   │   ├── targets/        # Weekly target submission (multi-step)
│   │   └── daily-log/      # Daily log submission
│   ├── (admin)/            # Admin-gated routes
│   │   ├── analytics/      # Dashboard + corrections + notifications
│   │   └── manage-team/    # Member CRUD + PIN settings
│   └── api/
│       └── auth/
│           └── check/      # Session check endpoint
├── components/
│   ├── ui/                 # Card, Button, Input, Select, Badge
│   ├── charts/             # RevenueChart (Recharts Area)
│   ├── AdminGate.tsx       # PIN setup/login gate
│   ├── Navigation.tsx      # Mobile bottom nav + desktop sidebar
│   └── Providers.tsx       # React Query + AdminContext
├── context/
│   └── AdminContext.tsx    # Admin session state
├── db/
│   ├── schema.ts           # All 20+ Drizzle table definitions
│   ├── relations.ts        # Drizzle relational queries
│   ├── index.ts            # Neon + Drizzle client
│   └── seed.ts             # Initial data seeder
└── lib/
    ├── auth.ts             # PIN auth: bcrypt, sessions, rate limiting
    ├── auth-server.ts      # RSC / Server Action auth helpers
    ├── domain/
    │   ├── weeks.ts        # Week generator (pure, unit-testable)
    │   └── helpers.ts      # fmtAED, generateRef, MONTHS, cn
    ├── validators/
    │   ├── members.ts      # Zod: AddMember, UpdateMember
    │   ├── targets.ts      # Zod: SalesTarget, CreatorTarget
    │   └── daily-log.ts    # Zod: SalesLog, CreatorLog, CorrectionRequest
    └── actions/
        ├── auth.ts         # Server Actions: login, logout, setupPin, changePin
        ├── members.ts      # Server Actions: addMember, updateMember, deleteMember
        ├── weeks.ts        # Server Action: getWeeksForMonth (upsert)
        ├── targets.ts      # Server Actions: submitSalesTarget, submitCreatorTarget
        ├── daily-log.ts    # Server Actions: submitSalesLog, submitCreatorLog
        ├── corrections.ts  # Server Actions: submit, approve, reject corrections
        └── analytics.ts    # Server Actions: overview, member detail, notifications
```

---

## Key Business Rules Preserved

- **Week assignment:** Mon–Sat boundaries; week goes to the month containing ≥ 3 of its 6 working days; ties go to Monday's month.
- **Connected Calls:** Computed as `organic_calls + marketing_calls` in the Server Action before insert.
- **Sunday rule:** Daily logs blocked on Sundays unless configured as a "special Sunday" exception.
- **Duplicate prevention:** `UNIQUE (member_id, week_id)` for targets; `UNIQUE (member_id, log_date)` for logs — enforced at DB level.
- **Corrections:** Propose → Admin approve/reject → changes applied + audit log entry, all atomic via Drizzle transaction.
- **Safe delete:** Members with historical data are deactivated instead of permanently deleted.
- **Lead reconciliation:** Distributed leads must total exactly `leads_generated` — validated in Zod.
- **Viral video deduplication:** URL uniqueness enforced at DB level + pre-insert check with friendly error.
- **Position flagging:** If submitted position ≠ recorded member position, `position_flagged = true` + admin notification.
- **LER/BDM team revenue:** Additional `team_revenue_targets` row created when position is LER or BDM.
- **Status badges:** Always use icon + label, never color alone.

---

## Database Scripts

```bash
pnpm db:push        # Sync schema to DB (dev, no migration file)
pnpm db:generate    # Generate SQL migration
pnpm db:migrate     # Apply migrations
pnpm db:studio      # Open Drizzle Studio (visual DB browser)
```

---

## Security

- Admin PIN stored as **bcrypt (cost 12)**
- Sessions stored server-side in `admin_sessions` table; delivered as **httpOnly cookie**
- Rate limiting: 5 PIN attempts per 15 minutes per IP (in-memory; resets on cold start)
- All admin Server Actions call `isAdminAuthenticated()` — server-side, not client-side
- Audit log records all admin actions
- HTTPS enforced in production by Vercel

---

## Acceptance Checklist

Work through these before going live:

- [ ] App works on iPhone, Android, tablet, desktop
- [ ] Active members appear in selectors; inactive do not
- [ ] Weeks show correct Mon–Sat date ranges for current month
- [ ] Sunday logs are blocked (unless configured as special Sunday)
- [ ] Connected Calls = Organic + Marketing auto-computed
- [ ] Late reason required only when "After 9:59 AM" selected
- [ ] Developer name required only when "Yes" selected
- [ ] Absent selection ends performance form
- [ ] Duplicate daily logs and targets are blocked
- [ ] Revenue chart shows cumulative area vs target line
- [ ] Status badges use icons + labels (not color alone)
- [ ] Admin PIN enforced server-side
- [ ] Corrections only affect analytics after Admin approves
- [ ] Lead distribution reconciliation validates
- [ ] Viral video URL deduplication works
- [ ] Sales and Creator forms show only correct fields

---

Built for **RAASTA Realty — Team Najeeb**.
