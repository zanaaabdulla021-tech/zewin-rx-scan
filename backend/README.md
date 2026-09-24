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

## Multi-tenancy

Every branch and prescription belongs to exactly one **Organization** (one
pharmacy business). Data never crosses between organizations — an owner's
"sees everything" only ever means everything *within their own
organization*. A brand-new pharmacy signs up via
`POST /api/auth/register-organization`, which creates their Organization,
a first branch, and their first owner login in one call.

A person's *login* (email + password) is separate from their *access* at
any one company: a `User` is one identity, and a `Membership` row ties
that identity to one company with a role and (usually) a branch there.
Someone can hold a Membership at more than one company — same email and
password everywhere, different role/branch per company — and switches
between them with `POST /api/auth/switch-company` without logging out.
The JWT always carries the *currently active* company's role/branch/org;
switching just re-issues it for a different Membership.

## Subscription plans

Every organization is on a plan (`free` / `basic` / `business` /
`enterprise`) that caps its branch count, user count, and scans per
calendar month. All limits live in one place, `backend/src/plans.js` —
nothing else hard-codes a number. Hitting a cap returns
`402 { error: "plan_limit_reached", limit, max }` from the branch/user/
scan creation endpoints. A company checks its own plan and current usage
via `GET /api/company/subscription`; only the super admin can change a
company's plan or status.

## Billing

Separately from the plan tier above, what a company actually **owes** is
per-branch: `$10/branch/month`, or `$100/branch/year` if billed yearly —
also centralized in `backend/src/plans.js` (`PRICE_PER_BRANCH`). A
company's `billingCycle` (`monthly` | `yearly`) times its current branch
count gives its total cost, returned as `billing` in both
`GET /api/company/subscription` and every company object the super admin
sees. Only the super admin sets a company's billing cycle
(`POST /api/superadmin/companies/:id/billing-cycle`). No payment
processor is wired up — this only tracks and displays what's owed.

## Roles

- **super_admin** — platform-level, not tied to any organization; manages
  every company (create, activate/suspend, delete) via `/api/superadmin/*`.
- **owner** — full control of their own company: branches, users (any
  role, including other owners/company_admins), all prescriptions and
  reports, approve/reject anywhere in it.
- **company_admin** — manages branches, users, and settings like an
  owner, but cannot create, edit, delete, or reset the password of an
  owner or another company_admin — only the owner can manage those.
- **branch_manager** — tied to one branch; sees every prescription
  scanned at that branch (any employee, any status) and approves or
  rejects them. Cannot manage branches or users.
- **employee** — scans and saves prescriptions; only sees the
  prescriptions they personally scanned (not their whole branch's).
- **viewer** — read-only: sees every prescription and report across the
  company, but cannot scan, edit, approve/reject, or manage anything.

## API summary

| Method | Path                     | Auth            | Purpose                          |
|--------|--------------------------|-----------------|------------------------------------|
| POST   | /api/auth/register-organization | —       | create a brand-new pharmacy (organization) + its first branch + first owner login |
| POST   | /api/auth/login          | —               | email + password → JWT + the list of companies this login can access |
| POST   | /api/auth/switch-company  | any (multi-company) | re-issues the JWT scoped to a different company you belong to |
| GET    | /api/company/subscription | any (own org)  | this company's plan, limits, and current usage |
| GET    | /api/activity-logs        | owner/company_admin | this company's own audit trail (last 200 events) |
| GET    | /api/superadmin/overview  | super admin     | platform-wide totals (companies, users, branches, scans) |
| GET    | /api/superadmin/activity-logs | super admin | platform-wide audit trail, optional ?companyId= filter |
| GET    | /api/superadmin/companies | super admin     | list every company on the platform |
| GET    | /api/superadmin/companies/:id | super admin | one company's full detail, including its users |
| POST   | /api/superadmin/companies | super admin     | create a company + first branch + first admin in one call |
| PATCH  | /api/superadmin/companies/:id | super admin | edit a company's name/contact fields |
| POST   | /api/superadmin/companies/:id/status | super admin | set status: trial / active / suspended / expired |
| POST   | /api/superadmin/companies/:id/plan | super admin | set plan: free / basic / business / enterprise |
| POST   | /api/superadmin/companies/:id/billing-cycle | super admin | set billing: monthly ($10/branch) or yearly ($100/branch) |
| DELETE | /api/superadmin/companies/:id | super admin | delete a company and everything in it |
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
| POST   | /api/prescriptions        | user            | save a scanned prescription (fields: doctorName, phone, medicines, category, source, images: [{imageBase64, mediaType}, ...]; status: pending) |
| GET    | /api/prescriptions/:id/images | user         | fetch every saved photo for one prescription |
| GET    | /api/item-image?name=     | user            | remembered photo for a medicine/item name, if one was saved before |
| DELETE | /api/prescriptions/:id    | user            | delete (own record; admin: any)   |
| POST   | /api/prescriptions/:id/approve | manager/admin | mark approved (own branch; admin: any) |
| POST   | /api/prescriptions/:id/reject  | manager/admin | mark rejected (own branch; admin: any) |
| POST   | /api/scan                 | user            | photo → {doctorName, phone, medicines} |
| GET    | /api/reports/overview     | admin           | totals by branch/employee/doctor, top medicines, by-day counts |
| GET    | /api/reports/doctor?name= | admin           | one doctor's prescriptions: branch, employee, medicines, date |

## Company logo & expiry

A company's owner/company_admin can upload their own logo
(`POST /api/company/logo`), returned as `logoData` from
`GET /api/company/subscription` and in every company object the super
admin sees. Only the super admin sets a company's `expiryDate`
(via the existing `PATCH /api/superadmin/companies/:id`) — once that date
passes, the company is blocked from every endpoint exactly like a
`suspended`/`expired` status, regardless of what `status` says.

## Notifications

In-app notifications, not email/push. A notification is either personal
(`userId` set — e.g. "your scan was rejected") or broadcast to every
owner/company_admin of a company (`userId` null — e.g. "your company was
suspended"). Auto-created when: a prescription is rejected, a company's
status changes to suspended/expired/active, or someone is added to a
company. `GET /api/notifications` returns the current person's list plus
an `unreadCount`; `POST /api/notifications/:id/read` and
`POST /api/notifications/read-all` mark them read.

## Billing — manual and gateway payments, side by side

The super admin can always activate a company by hand (set status/expiry
directly on `/api/superadmin/companies/:id`) — that never goes away.
Alongside it, a company can submit a payment claim
(`POST /api/company/payments/request`, e.g. "paid via bank transfer,
ref #1234") which the super admin reviews at
`GET /api/superadmin/payments` and approves
(`POST /api/superadmin/payments/:id/approve`). Approving a payment sets
the company to `active` and pushes its `expiryDate` forward by one
billing period (1 month or 1 year, from `billingCycle`). The `Payment`
model has a `method` field (`"manual"` today) so that a real gateway
(e.g. ZainCash, once merchant credentials exist) can later create
already-approved `Payment` rows the same way — the manual review queue
keeps working unchanged alongside it.

## Branch approval

A branch a company creates itself (`POST /api/branches`) starts with
`approved: false` and cannot be used for scanning
(`POST /api/prescriptions` returns `402 { error: "branch_pending_approval" }`)
until the super admin approves it
(`POST /api/superadmin/branches/:id/approve`, or rejects/deletes it via
`POST /api/superadmin/branches/:id/reject`). The first branch created at
company registration or by the super admin when onboarding a new company
is auto-approved — only branches a company adds later need review.
`GET /api/superadmin/branches/pending` lists everything awaiting review.

## Branch stats / control panel

`GET /api/branches/stats` returns every branch a caller can see (their
whole org for owner/company_admin/viewer, or just their own branch for
branch_manager/employee) with live counts: userCount, prescriptionCount,
scansToday, pendingCount, approvedCount, rejectedCount, and the assigned
branch_manager's email. This powers the branch cards and "control panel"
in the web app — the underlying data model (Organization → Branch →
Membership/Prescription, all org- and branch-scoped server-side) was
already in place; this just exposes it as a friendlier per-branch view.

## Medicine reference info (AI-assisted)

`POST /api/medicine-info { name }` asks Gemini to identify a medicine by
name and return brief reference info (type, used-for, active ingredient,
important precautions, common side effects) — or `{ identified: false }`
if it can't confidently identify the item. It never fabricates details
for an unrecognized name. This is informational only, shown in the Scan
form's item cards with a standing disclaimer that it doesn't replace
pharmacist/doctor review.

## Verify item photo against typed name

`POST /api/medicine-verify-photo { name, imageBase64, mediaType }` asks
Gemini whether a photo of the actual product plausibly matches the typed
item name — returns `{ checked, matches, confidence, detectedName, note }`.
It never invents a specific brand it can't actually read in the photo;
if it can't judge confidently it reports low confidence and no match
rather than guessing. Shown in the Scan form as a per-item "Verify item
photo" button — a sanity check, not a replacement for the pharmacist's
own confirmation.

## Saving a verified item photo

`POST /api/item-image { name, imageBase64, mediaType }` saves/replaces the
remembered photo for that item name — **shared across the whole
platform**, not scoped to one company. A medicine looks the same no
matter which pharmacy is using the app, so once any company verifies a
photo for "panadol", every company benefits from it
(`GET /api/item-image` looks it up the same way, platform-wide, and also
returns `createdByOrgName` — which company most recently saved that
photo, for transparency only; it never restricts who can see or reuse
it). The Scan form's "Verify item photo" button calls this automatically
after checking a photo.

`/api/medicine-info`'s response also includes `manufacturer` — the
pharmaceutical company that makes that brand (e.g. Haleon/GSK for
Panadol) — left blank if Gemini isn't confident which company makes it,
even when it can identify the medicine itself.

## Item name autocomplete

`GET /api/item-names` returns every distinct medicine/item name this
company has used in its last 500 prescriptions, for the Scan form's
item-name field to suggest via the browser's native autocomplete
(`<datalist>`) — so a pharmacist picks a name already on file instead of
retyping it, which also naturally avoids inconsistent spellings.

## Super admin dashboard: growth charts and recent activity

`GET /api/superadmin/overview` now also returns:
- `organizationsGrowth` / `scansGrowth` — real counts per month for the
  last 12 months (companies created, prescriptions scanned platform-wide)
- `recentCompanies` — the 5 most recently created companies
- `recentActivity` — the 6 most recent platform-wide activity log entries

All from real data — no projections or fabricated numbers. The web
dashboard renders the two growth series as bar charts (reusing the same
chart renderer as company reports) plus "Recent organizations" and
"Recent activity" lists.

## Module Builder (Phase 1)

Foundation for a reusable Module Builder: `Module` records with a
structured `definition` JSON field (metadata, pages, components,
dataSources, apis, actions, permissions, settings) — never just raw
HTML, so Code and Studio creation paths produce the same shape.

- `GET/POST /api/superadmin/modules` — list / create
- `GET/DELETE /api/superadmin/modules/:id` — view / delete

Web: Super Admin → "Module Builder" tab. Lets you create a module
(name, description, Code or Studio method) and see it in a list.
The actual Code editor and Studio drag-and-drop canvas that fill in
a module's `definition` are NOT built yet — this phase only lays the
real data foundation they'll write to.

## Module Builder (Phase 2 — Code Mode)

`PATCH /api/superadmin/modules/:id` saves a module's `definition`
(also its name/description/status) — both Code and Studio phases write
through this one endpoint since they share the same data shape.

Code Mode is now real: file explorer, create/open/delete files, a
CodeMirror editor with JS/HTML/CSS syntax highlighting, and Save (writes
`definition.files` back via the PATCH above). Studio Mode still shows
its "coming in the next phase" notice.

## Module Builder (Phase 3 — AI Assistant in Code Mode)

`POST /api/superadmin/modules/:id/ai { action, instruction, filePath, fileContent }`
— action is one of generate/explain/fix/refactor. Uses the same Gemini
setup as OCR/medicine-info. Always returns a suggestion; **never writes
to the module itself** — the developer reviews it in the AI panel and,
only if they choose to, clicks "Replace file with this" (which just
updates the editor — they still have to hit Save separately).

## Module Builder (Phase 4 — Version Control)

New `ModuleVersion` table stores definition snapshots per module.
- `POST /api/superadmin/modules/:id/versions` — save a snapshot (optional note)
- `GET /api/superadmin/modules/:id/versions` — list (newest first)
- `GET .../versions/:versionId` — view one snapshot's full definition
- `POST .../versions/:versionId/restore` — restore it as current
  (auto-snapshots the current state first, so nothing is ever lost)

Web: "Versions" button in the Code Mode toolbar opens the panel — save,
view (JSON preview), or restore any past version.

## Module Builder (Phase 5 — Publishing workflow)

`POST /api/superadmin/modules/:id/status { status }` moves a module
through Draft → Preview → Testing → Approved → Published — always an
explicit call a super admin makes from the UI; nothing else in the
builder changes status automatically.

Web: the module detail view shows a pipeline (current stage highlighted)
and buttons for every stage, each behind a confirm dialog (Publish gets
its own wording).

## Module Builder (Phase 6 — Studio Mode, real drag-and-drop)

Opening a Studio module now shows a working canvas (native HTML5
drag-and-drop, no external library): drag a component (Container, Row,
Text/Number/Select/Checkbox field, Table, Button) from the palette onto
the canvas, click it to edit its label and (for fields) its data
binding ("table.column") in the Properties panel, reorder/duplicate/
remove it, then Save — writes to `definition.components`, the same
structured shape Code Mode's `definition.files` lives alongside.

Scope note: this is the real component/canvas/binding/save loop from
the spec, with a deliberately smaller starter palette (not every listed
component type yet) and no Grid/Tabs/Accordion nesting or resize
handles — those extend this same foundation later rather than needing
a different architecture.

## Module Builder (Phase 7 — Data Sources)

`GET /api/superadmin/data-sources` returns the app's real business
tables and fields (organizations, branches, users, memberships,
prescriptions, payments) — matches backend/prisma/schema.prisma exactly,
not a made-up list. Internal bookkeeping tables (ActivityLog,
ModuleVersion) are left out on purpose.

Web: Studio Mode's Properties panel now has real "Bind to table" /
"Field" dropdowns (populated from this endpoint) instead of a free-text
box — a form field's binding is always a real column that actually
exists.

## Module Builder (Phase 8 — Permissions, final phase)

New `User.builderPermissions` field (JSON array, `null` = unrestricted —
every admin's starting state). `requireBuilderPermission(perm)` checks
it fresh from the database on every request (not the JWT, so a change
takes effect immediately). Guards every module-builder route:
builder.view/create/edit/delete/publish/restore, matching the spec
exactly. Publishing specifically needs builder.publish even when the
route is otherwise builder.edit.

- `GET /api/superadmin/admins` — list super admins + their permissions
- `PATCH /api/superadmin/admins/:id/builder-permissions { permissions }`
  — only callable by an admin who is themselves unrestricted, so a
  restricted admin can never grant themselves (or anyone) more access

Web: Super Admins tab now lists every admin with a permissions
checklist — editable only if you're unrestricted yourself.

**This completes all 8 phases of the Module Builder spec**: Modules
list + create (Code/Studio), real Code editor with AI assistant, Studio
drag-and-drop canvas with real data-source binding, version control,
publishing workflow, and now granular permissions — all built on one
shared `Module.definition` data shape, reusable by future projects.
