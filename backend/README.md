# ZEWIN Rx Scan — backend

Express + Prisma (PostgreSQL) API: login, branches, users, prescriptions,
and the OCR proxy (reads Kurdish/Arabic/Latin prescription photos via a
vision model).

## Local setup

Local development needs a Postgres server — easiest is Docker:
```bash
docker run --name zewin-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```
Or use any Postgres install you already have; just point `DATABASE_URL` at it.

```bash
cd backend
npm install
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, GEMINI_API_KEY
npx prisma migrate dev --name init
npm run seed               # creates the first branch + admin login
npm run dev                 # http://localhost:3000
```

Get a free Gemini API key at https://aistudio.google.com/apikey — sign in
with any Google account, no credit card, no expiry (just a daily request
cap on the Flash model, plenty for this use case).

Seeded login: `admin@zewin.local` / `admin123` — sign in and create real
accounts immediately, this one is only a bootstrap.

## Deploy (Vercel + Neon — free, no credit card, no trial expiry)

**1. Database — Neon (free Postgres, no card):**
1. Go to https://neon.tech, sign up with GitHub.
2. Create a project (any name/region). Neon shows a connection string
   immediately — copy it (starts with `postgresql://`).

**2. Hosting — Vercel (free, no card):**
1. Go to https://vercel.com, sign up with GitHub (same account as the
   `zewin-rx-scan` repo).
2. **Add New** → **Project** → import `zewin-rx-scan`.
3. Set **Root Directory** to `backend`. Vercel auto-detects the Node
   runtime from `api/index.js` — no build command needed.
4. Under **Environment Variables**, add:
   - `DATABASE_URL` → the Neon connection string from step 1
   - `JWT_SECRET` → any long random string
   - `GEMINI_API_KEY` → your key from aistudio.google.com
5. **Deploy**. Vercel gives you a URL like
   `https://zewin-rx-scan.vercel.app` — paste that into `web/index.html`
   (`BACKEND_URL`) and `lib/config.dart` (`backendUrl`).

**3. Run the migration once** (Vercel's serverless functions can't run a
one-off start command like a normal server, so do this from your own
machine, pointed at Neon):
```bash
cd backend
# Windows PowerShell:
$env:DATABASE_URL="paste-your-neon-connection-string-here"
npx prisma migrate deploy
node prisma/seed.js
```
This creates the tables and the first branch + admin login directly on
the Neon database Vercel is using — no local Postgres needed for this
step.

No sleep, no trial credit, no card, ever — both Neon's and Vercel's free
tiers are free indefinitely under normal personal-project usage.

## Roles

- **admin** — manages branches and user logins (`/api/branches`,
  `/api/users`), sees prescriptions and reports across every branch and
  employee, and can approve/reject anywhere.
- **manager** — tied to one branch; sees every prescription scanned at
  that branch (any employee, any status) and approves or rejects them.
- **employee** — scans and saves prescriptions; only sees the
  prescriptions they personally scanned (not their whole branch's).

## API summary

| Method | Path                     | Auth            | Purpose                          |
|--------|--------------------------|-----------------|------------------------------------|
| POST   | /api/auth/login          | —               | email + password → JWT            |
| GET    | /api/auth/me             | user            | current user + branch             |
| POST   | /api/auth/change-password | user            | change your own password (needs current) |
| POST   | /api/auth/avatar          | user            | upload/replace your own profile photo |
| GET    | /api/branches            | user            | list branches                     |
| POST   | /api/branches            | admin           | create branch                     |
| DELETE | /api/branches/:id        | admin           | remove branch                     |
| GET    | /api/users                | admin           | list logins                       |
| POST   | /api/users                | admin           | create a login (employee/manager/admin) |
| DELETE | /api/users/:id            | admin           | remove a login                    |
| POST   | /api/users/:id/reset-password | admin       | reset a user's password (no current needed) |
| GET    | /api/prescriptions        | user            | own (employee) / branch (manager) / all (admin) |
| POST   | /api/prescriptions        | user            | save a scanned prescription (fields: doctorName, phone, medicines, category, images: [{imageBase64, mediaType}, ...]; status: pending) |
| GET    | /api/prescriptions/:id/images | user         | fetch every saved photo for one prescription |
| DELETE | /api/prescriptions/:id    | user            | delete (own record; admin: any)   |
| POST   | /api/prescriptions/:id/approve | manager/admin | mark approved (own branch; admin: any) |
| POST   | /api/prescriptions/:id/reject  | manager/admin | mark rejected (own branch; admin: any) |
| POST   | /api/scan                 | user            | photo → {doctorName, phone, medicines} |
| GET    | /api/reports/overview     | admin           | totals by branch/employee/doctor, top medicines, by-day counts |
| GET    | /api/reports/doctor?name= | admin           | one doctor's prescriptions: branch, employee, medicines, date |
