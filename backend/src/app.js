require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = require('./lib/prisma');
const { requireAuth, requireAdmin, requireManagerOrAdmin } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' })); // prescription photos travel as base64

function formatUser(u) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    branchId: u.branchId,
    branchName: u.branch?.name ?? null,
    avatarData: u.avatarData ?? null,
  };
}

function formatPrescription(row) {
  return {
    id: row.id,
    doctorName: row.doctorName,
    phone: row.phone,
    medicines: JSON.parse(row.medicines || '[]'),
    category: row.category,
    source: row.source,
    status: row.status,
    imageCount: row._count?.images ?? (row.images ? row.images.length : 0),
    branchId: row.branchId,
    branchName: row.branch?.name,
    employeeEmail: row.user?.email,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------- auth ---

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const user = await prisma.user.findUnique({ where: { email }, include: { branch: true } });
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, branchId: user.branchId },
    process.env.JWT_SECRET,
    { expiresIn: '30d' },
  );

  res.json({ token, user: formatUser(user) });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { branch: true } });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json(formatUser(user));
});

// Any signed-in user can change their own password (must know the current one).
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'missing_fields' });
  if (newPassword.length < 4) return res.status(400).json({ error: 'password_too_short' });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'not_found' });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_current_password' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ ok: true });
});

// Profile photo — stored as a data URI directly on the user row.
app.post('/api/auth/avatar', requireAuth, async (req, res) => {
  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'missing_image' });
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const type = allowedTypes.includes(mediaType) ? mediaType : 'image/jpeg';
  const avatarData = `data:${type};base64,${imageBase64}`;
  await prisma.user.update({ where: { id: req.user.id }, data: { avatarData } });
  res.json({ ok: true, avatarData });
});

// ------------------------------------------------------------ branches ---
// Every signed-in user can read branch names (needed to show "your branch").
// Only admins create or remove branches.

app.get('/api/branches', requireAuth, async (req, res) => {
  const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
  res.json(branches);
});

app.post('/api/branches', requireAuth, requireAdmin, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'missing_name' });
  const branch = await prisma.branch.create({ data: { name: name.trim() } });
  res.status(201).json(branch);
});

app.delete('/api/branches/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.branch.delete({ where: { id } }).catch(() => {});
  res.status(204).end();
});

// ---------------------------------------------------------------- users --
// Admin-only: create the login for each pharmacy employee, tied to a branch.

app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({ include: { branch: true }, orderBy: { email: 'asc' } });
  res.json(users.map(formatUser));
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, role, branchId } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const passwordHash = await bcrypt.hash(password, 10);
  const allowedRoles = ['admin', 'manager', 'employee'];
  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: allowedRoles.includes(role) ? role : 'employee',
        branchId: branchId ?? null,
      },
      include: { branch: true },
    });
    res.status(201).json(formatUser(user));
  } catch (e) {
    res.status(409).json({ error: 'email_taken' });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.user.delete({ where: { id } }).catch(() => {});
  res.status(204).end();
});

// Admin can reset anyone's password without knowing the old one.
app.post('/api/users/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'password_too_short' });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } }).catch(() => {});
  res.json({ ok: true });
});

// --------------------------------------------------------- prescriptions -
// Employees see only the prescriptions they personally scanned; admins see
// every branch and every employee's records.

app.get('/api/prescriptions', requireAuth, async (req, res) => {
  let where;
  if (req.user.role === 'admin') {
    where = {};
  } else if (req.user.role === 'manager') {
    where = { branchId: req.user.branchId };
  } else {
    where = { userId: req.user.id };
  }
  const rows = await prisma.prescription.findMany({
    where,
    include: { branch: true, user: true, _count: { select: { images: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(rows.map(formatPrescription));
});

const ALLOWED_CATEGORIES = ['Medicine', 'Dairy', 'Beauty', 'Equipment'];
const ALLOWED_SOURCES = ['Government', 'Private'];

app.post('/api/prescriptions', requireAuth, async (req, res) => {
  if (!req.user.branchId) return res.status(400).json({ error: 'no_branch_assigned' });

  const { doctorName, phone, medicines, category, source, images } = req.body || {};
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const imageList = Array.isArray(images) ? images : [];
  const imageCreates = imageList
    .filter((img) => img && img.imageBase64)
    .map((img) => {
      const type = allowedTypes.includes(img.mediaType) ? img.mediaType : 'image/jpeg';
      return { imageData: `data:${type};base64,${img.imageBase64}` };
    });
  const medicineList = Array.isArray(medicines) ? medicines : [];

  const row = await prisma.prescription.create({
    data: {
      doctorName: doctorName || '',
      phone: phone || '',
      medicines: JSON.stringify(medicineList),
      category: ALLOWED_CATEGORIES.includes(category) ? category : 'Medicine',
      source: ALLOWED_SOURCES.includes(source) ? source : 'Private',
      branchId: req.user.branchId,
      userId: req.user.id,
      images: imageCreates.length ? { create: imageCreates } : undefined,
    },
    include: { _count: { select: { images: true } } },
  });

  // Remember one photo per item name, so next time it's typed the photo
  // can be shown automatically. Uses the first uploaded photo of this order.
  if (imageCreates.length && medicineList.length) {
    const imageData = imageCreates[0].imageData;
    await Promise.all(
      medicineList
        .map((m) => String(m).trim().toLowerCase())
        .filter(Boolean)
        .map((name) =>
          prisma.itemImage.upsert({
            where: { name },
            update: { imageData },
            create: { name, imageData },
          }),
        ),
    );
  }

  res.status(201).json(formatPrescription(row));
});

// Look up a remembered photo for an item/medicine name — filled in as
// prescriptions are saved with photos.
app.get('/api/item-image', requireAuth, async (req, res) => {
  const name = (req.query.name || '').toString().trim().toLowerCase();
  if (!name) return res.status(400).json({ error: 'missing_name' });
  const row = await prisma.itemImage.findUnique({ where: { name } });
  res.json({ imageData: row?.imageData ?? null });
});

// Fetch every saved photo for one prescription — kept out of the list
// endpoint so ordinary list/history requests stay light.
app.get('/api/prescriptions/:id/images', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const row = await prisma.prescription.findUnique({ where: { id }, include: { images: true } });
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (req.user.role === 'employee' && row.userId !== req.user.id) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (req.user.role === 'manager' && row.branchId !== req.user.branchId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  res.json({ images: row.images.map((img) => ({ id: img.id, imageData: img.imageData })) });
});

app.delete('/api/prescriptions/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const row = await prisma.prescription.findUnique({ where: { id } });
  if (!row) return res.status(204).end();
  if (req.user.role !== 'admin' && row.userId !== req.user.id) {
    return res.status(403).json({ error: 'forbidden' });
  }
  await prisma.prescription.delete({ where: { id } });
  res.status(204).end();
});

// A manager reviews everything scanned at their own branch and approves
// or rejects it; admins can do this across any branch.

async function setPrescriptionStatus(req, res, status) {
  const id = Number(req.params.id);
  const row = await prisma.prescription.findUnique({ where: { id } });
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (req.user.role !== 'admin' && row.branchId !== req.user.branchId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const updated = await prisma.prescription.update({ where: { id }, data: { status } });
  res.json(formatPrescription(updated));
}

app.post('/api/prescriptions/:id/approve', requireAuth, requireManagerOrAdmin, (req, res) =>
  setPrescriptionStatus(req, res, 'approved'),
);

app.post('/api/prescriptions/:id/reject', requireAuth, requireManagerOrAdmin, (req, res) =>
  setPrescriptionStatus(req, res, 'rejected'),
);

// --------------------------------------------------------------- reports -
// Admin-only. Built by pulling every prescription into memory and tallying
// in JS rather than SQL GROUP BY — medicines live in a JSON text column, so
// this is simpler and fast enough at pharmacy-chain scale.

app.get('/api/reports/overview', requireAuth, requireAdmin, async (req, res) => {
  const [prescriptions, branches, users] = await Promise.all([
    prisma.prescription.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.branch.findMany(),
    prisma.user.findMany(),
  ]);
  const branchNameById = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const userEmailById = Object.fromEntries(users.map((u) => [u.id, u.email]));

  const byBranch = {};
  const byEmployee = {};
  const byDoctor = {};
  const byCategory = {};
  const bySource = {};
  const medicineCounts = {};
  const byDay = {};
  const byMonth = {};
  const byYear = {};

  for (const p of prescriptions) {
    const branchName = branchNameById[p.branchId] || 'Unknown';
    byBranch[branchName] = (byBranch[branchName] || 0) + 1;

    const empEmail = userEmailById[p.userId] || 'Unknown';
    byEmployee[empEmail] = (byEmployee[empEmail] || 0) + 1;

    const doctorKey = (p.doctorName || '').trim() || 'No doctor name';
    byDoctor[doctorKey] = (byDoctor[doctorKey] || 0) + 1;

    const categoryKey = p.category || 'Medicine';
    byCategory[categoryKey] = (byCategory[categoryKey] || 0) + 1;

    const sourceKey = p.source || 'Private';
    bySource[sourceKey] = (bySource[sourceKey] || 0) + 1;

    let meds = [];
    try {
      meds = JSON.parse(p.medicines || '[]');
    } catch (_) {}
    meds.forEach((m) => {
      const key = String(m).trim();
      if (key) medicineCounts[key] = (medicineCounts[key] || 0) + 1;
    });

    const iso = p.createdAt.toISOString();
    const day = iso.slice(0, 10);
    const month = iso.slice(0, 7);
    const year = iso.slice(0, 4);
    byDay[day] = (byDay[day] || 0) + 1;
    byMonth[month] = (byMonth[month] || 0) + 1;
    byYear[year] = (byYear[year] || 0) + 1;
  }

  const toSortedArray = (obj) =>
    Object.entries(obj)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  const toDateSortedArray = (obj) =>
    Object.entries(obj)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([name, count]) => ({ name, count }));

  res.json({
    total: prescriptions.length,
    byBranch: toSortedArray(byBranch),
    byEmployee: toSortedArray(byEmployee),
    byDoctor: toSortedArray(byDoctor),
    byCategory: toSortedArray(byCategory),
    bySource: toSortedArray(bySource),
    topMedicines: toSortedArray(medicineCounts).slice(0, 20),
    byDay: toDateSortedArray(byDay),
    byMonth: toDateSortedArray(byMonth),
    byYear: toDateSortedArray(byYear),
  });
});

// Drill into one doctor: which employees filled their prescriptions, at
// which branches, and which medicines — exactly what a pharmacy owner
// wants to check for a given doctor.
app.get('/api/reports/doctor', requireAuth, requireAdmin, async (req, res) => {
  const name = (req.query.name || '').toString().trim();
  if (!name) return res.status(400).json({ error: 'missing_name' });

  const [prescriptions, branches, users] = await Promise.all([
    prisma.prescription.findMany({
      where: { doctorName: name === 'No doctor name' ? '' : name },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.branch.findMany(),
    prisma.user.findMany(),
  ]);
  const branchNameById = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const userEmailById = Object.fromEntries(users.map((u) => [u.id, u.email]));

  const rows = prescriptions.map((p) => ({
    id: p.id,
    branchName: branchNameById[p.branchId] || null,
    employeeEmail: userEmailById[p.userId] || null,
    medicines: JSON.parse(p.medicines || '[]'),
    category: p.category,
    source: p.source,
    phone: p.phone,
    createdAt: p.createdAt,
  }));

  res.json({ doctorName: name, total: rows.length, prescriptions: rows });
});

// ----------------------------------------------------------- OCR proxy ---
// Reads Kurdish, Arabic, and Latin script — the piece on-device OCR can't do.

const OCR_PROMPT =
  "This is a photo of a medical prescription (handwritten or printed), " +
  "possibly in Kurdish, Arabic, or English. Extract exactly: the doctor's " +
  "name, a phone number if visible anywhere on the slip, and the list of " +
  "medicine names written on it. Keep every name exactly as written in " +
  "its original script and language — do not translate or transliterate. " +
  'Reply with ONLY a JSON object of this exact shape, no other text: ' +
  '{"doctorName": string, "phone": string, "medicines": string[]}. ' +
  'If a field cannot be found, use "" for strings and [] for medicines.';

// Uses Google's Gemini API — the Flash models have a genuinely free tier
// (no credit card, no expiry, just a daily request cap), unlike Anthropic's
// one-time trial credit. Get a key at https://aistudio.google.com/apikey.
const GEMINI_MODEL = 'gemini-3.6-flash';

app.post('/api/scan', requireAuth, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'server_misconfigured', message: 'GEMINI_API_KEY is not set' });
  }

  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'missing_image' });
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const type = allowedTypes.includes(mediaType) ? mediaType : 'image/jpeg';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: OCR_PROMPT },
              { inlineData: { mimeType: type, data: imageBase64 } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res.status(502).json({ error: 'upstream_error', message: errText });
    }

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || '')
      .join('\n');

    const parsed = extractJson(text);
    if (!parsed) return res.status(502).json({ error: 'unparseable_response' });

    res.json({
      doctorName: typeof parsed.doctorName === 'string' ? parsed.doctorName : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      medicines: Array.isArray(parsed.medicines) ? parsed.medicines.map(String) : [],
    });
  } catch (e) {
    res.status(500).json({ error: 'internal_error', message: String(e) });
  }
});

function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_) {
      return null;
    }
  }
}


module.exports = app;