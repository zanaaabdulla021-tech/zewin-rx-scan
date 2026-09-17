# ZEWIN Rx Scan — Flutter

Standalone prescription scanner: sign in → photo → OCR (Kurdish, Arabic,
Latin) → editable form → saved to your branch. Matches the web app's
flow, color system, and backend.

## Setup

```bash
flutter create . --platforms=android,ios   # generates the missing native folders
flutter pub get
```

Deploy `/backend` first (see `backend/README.md`), then point the app at
it in `lib/config.dart`:

```dart
static const String backendUrl = 'https://your-backend-url.example.com';
```

Apply the permission changes noted in:
- `android/PERMISSIONS_TO_ADD.md`
- `ios/PERMISSIONS_TO_ADD.md`

Run with `flutter run`. Sign in with the seeded login from
`backend/README.md` (`admin@zewin.local` / `admin123`) and create real
accounts right away from the in-app admin tab.

## What's in the app

- **Login** — email + password against the backend; session persists on
  the device.
- **Scan** — camera or gallery photo, read via the backend's vision OCR
  (reads Kurdish/Arabic/Latin correctly); falls back to on-device
  Latin-only OCR if the backend is unreachable.
- **Form** — editable doctor name, phone, dynamic medicines list; saves
  to the signed-in user's branch.
- **History** — the prescriptions *you* scanned (admins see every
  employee, every branch), expandable, deletable.
- **Reports tab** (admin only) — totals by branch, by employee, by
  doctor (click a doctor to see which employee filled each of their
  prescriptions, at which branch, with which medicines), and the most
  frequently scanned medicines.
- **Admin tab** (visible to admin accounts only) — create/remove
  branches, create/remove employee logins and assign them to a branch
  (roles: employee, manager, admin).
- **Manager accounts** — no separate tab; a manager sees their whole
  branch's history (not just their own scans) with approve/reject
  buttons on pending prescriptions, right in the History tab.

## Known limitation — on-device fallback only

If the backend is unreachable, the app falls back to Google ML Kit,
which reads **Latin, Chinese, Devanagari, Japanese and Korean script
only** — Kurdish/Arabic doctor names come back empty for manual entry in
that fallback path. With the backend configured and reachable, this
doesn't come up.

## Structure

```
lib/
  main.dart                # auth gate, RTL shell, tabs (Scan/History/Admin)
  theme.dart               # color tokens + ThemeData (kept in sync with web)
  config.dart              # set your deployed backend URL here
  models/
    prescription.dart
    user.dart
    branch.dart
  services/
    auth_service.dart       # login, session persistence
    api_service.dart        # prescriptions, branches, users
    ocr_service.dart        # ML Kit fallback (Latin-script only)
    cloud_ocr_service.dart  # backend OCR — full Kurdish/Arabic reading
  screens/
    login_screen.dart
    scan_screen.dart         # tries cloud OCR first, falls back to on-device
    form_screen.dart
    history_screen.dart
    reports_screen.dart      # totals + doctor drill-down (admin only)
    admin_screen.dart        # branches + users management (admin only)
  widgets/slip_card.dart     # perforated-edge card + stamp button
backend/
  src/index.js               # auth, branches, users, prescriptions, OCR proxy
  prisma/schema.prisma        # Branch / User / Prescription models
  README.md                   # deployment steps
web/
  index.html                  # self-hosted web app (login + same flow) — see below
```

## About the web app

`web/index.html` is a plain, self-contained page that talks to the same
backend directly — deploy it as a static file anywhere (Vercel, your own
server). It's a separate file from the earlier claude.ai-hosted
prototype: a published claude.ai artifact can't call an external backend
directly, so a real login-based web app has to be hosted on your own
infrastructure instead. Before deploying, edit the `BACKEND_URL` constant
near the top of the `<script>` block.
