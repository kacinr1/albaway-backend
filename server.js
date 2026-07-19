'use strict';

require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const crypto     = require('crypto');
const path       = require('path');
const Stripe     = require('stripe');
const { Pool }   = require('pg');
const dns        = require('dns').promises;
const bcrypt     = require('bcryptjs');
const rateLimit  = require('express-rate-limit');
const helmet     = require('helmet');
const { Resend } = require('resend');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

let pool;

async function createPool() {
  const dbUrl  = new URL(process.env.DATABASE_URL);
  let   host   = dbUrl.hostname;
  try {
    const [ipv4] = await dns.resolve4(host);
    host = ipv4;
  } catch(_) {}
  pool = new Pool({
    host,
    port:     parseInt(dbUrl.port) || 5432,
    database: dbUrl.pathname.replace(/^\//, ''),
    user:     decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    ssl:      { rejectUnauthorized: false },
    max:      10,
  });
}

const ALLOWED_ORIGINS = [
  'https://albaway.ch',
  'https://www.albaway.ch',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3001'] : [])
];

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
};

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: ALLOWED_ORIGINS } });

app.use(cors(corsOptions));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src":      ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://js.stripe.com", "https://fonts.googleapis.com"],
      "script-src-attr": ["'unsafe-inline'"],
      "style-src":       ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      "font-src":    ["'self'", "https://fonts.gstatic.com"],
      "img-src":     ["'self'", "data:", "https://images.unsplash.com", "https://*.basemaps.cartocdn.com"],
      "connect-src": ["'self'", "wss://albaway.ch", "https://albaway.ch", "https://api.stripe.com"],
      "frame-src":   ["'none'"],
      "object-src":  ["'none'"],
    },
  },
  hsts:                        { maxAge: 31536000, includeSubDomains: true },
  frameguard:                  { action: 'deny' },
  crossOriginEmbedderPolicy:   false,
}));
app.use(express.json({
  verify: (req, res, buf) => { if (req.path === '/api/stripe/webhook') req.rawBody = buf; }
}));
// Route PWA mobile
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

function uid() { return crypto.randomUUID(); }
function legacyHash(pw) { return crypto.createHash('sha256').update(pw + '_bbshqip_2026').digest('hex'); }
async function hashPassword(pw) { return bcrypt.hash(pw, 10); }
async function verifyPassword(pw, stored) {
  if (stored.startsWith('$2')) return bcrypt.compare(pw, stored);
  return legacyHash(pw) === stored;
}
const q = (text, params) => pool.query(text, params);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Shumë tentativa. Provoni sërish pas 15 minutash.' }
});

const failedAttempts = new Map(); // email → count

async function sendResetEmail(email, name, token) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[EMAIL] ❌ RESEND_API_KEY non configuré dans Render');
    return;
  }
  const base = process.env.FRONTEND_URL || 'https://albaway.ch';
  const link = `${base}/reset?token=${token}`;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from:    'AlbaWay <noreply@albaway.ch>',
    to:      email,
    subject: 'AlbaWay — Rimëkëmbja e llogarisë',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0a0f;color:#fff;border-radius:16px">
        <div style="text-align:center;margin-bottom:28px">
          <div style="font-size:2.5rem">🇦🇱</div>
          <h1 style="color:#E41E20;margin:8px 0;font-size:1.6rem">AlbaWay</h1>
        </div>
        <p style="margin:0 0 12px">Mirëdita <strong>${name}</strong>,</p>
        <p style="color:rgba(255,255,255,.7);margin:0 0 24px">
          Llogaria juaj u bllokua pas <strong>6 tentativave të dështuara</strong> të hyrjes.
          Klikoni butonin më poshtë për të rivendosur fjalëkalimin:
        </p>
        <div style="text-align:center;margin:32px 0">
          <a href="${link}"
             style="background:#E41E20;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:1rem;display:inline-block">
            🔑 Rivendos fjalëkalimin
          </a>
        </div>
        <p style="color:rgba(255,255,255,.35);font-size:.82rem">⏱ Ky link është i vlefshëm për 1 orë.</p>
        <p style="color:rgba(255,255,255,.35);font-size:.82rem">Nëse nuk jeni ju, injoroni këtë email.</p>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:24px 0"/>
        <p style="color:rgba(255,255,255,.2);font-size:.75rem;text-align:center">AlbaWay · Bashkudhëtim shqiptar 🇦🇱</p>
      </div>`
  });
  if (error) console.error('[EMAIL] ❌ Resend error:', error);
  else        console.log('[EMAIL] ✅ Envoyé à', email, '— id:', data.id);
}

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({ from:'AlbaWay <noreply@albaway.ch>', to, subject, html });
    if (error) console.error('[EMAIL] ❌', subject, error.message);
    else        console.log('[EMAIL] ✅', subject, '→', to);
  } catch(e) { console.error('[EMAIL] ❌', e.message); }
}

function emailWrap(body) {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0a0f;color:#fff;border-radius:16px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:2rem">🇦🇱</div>
      <h1 style="color:#E41E20;margin:6px 0;font-size:1.5rem">AlbaWay</h1>
    </div>
    ${body}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:24px 0"/>
    <p style="color:rgba(255,255,255,.2);font-size:.75rem;text-align:center">AlbaWay · Bashkudhëtim shqiptar 🇦🇱</p>
  </div>`;
}

// ─── INIT DB ──────────────────────────────────────────────────────────────
async function initDb() {
  await q(`CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT DEFAULT '',
    rating FLOAT DEFAULT 5.0,
    trips_count INT DEFAULT 0,
    locked BOOLEAN DEFAULT FALSE,
    reset_token TEXT,
    reset_token_expires BIGINT,
    created_at BIGINT NOT NULL
  )`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires BIGINT`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT ''`);
  await q(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS women_only BOOLEAN DEFAULT FALSE`);
  await q(`CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY,
    driver_id UUID REFERENCES users(id),
    from_city TEXT NOT NULL,
    to_city TEXT NOT NULL,
    from_point TEXT DEFAULT '',
    to_point TEXT DEFAULT '',
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    seats INT NOT NULL,
    seats_available INT NOT NULL,
    price FLOAT NOT NULL,
    vehicle JSONB DEFAULT '{}',
    options JSONB DEFAULT '{}',
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY,
    trip_id UUID REFERENCES trips(id),
    passenger_id UUID REFERENCES users(id),
    seats INT DEFAULT 1,
    status TEXT DEFAULT 'pending',
    message TEXT DEFAULT '',
    payment_status TEXT,
    paid_at BIGINT,
    rated BOOLEAN DEFAULT FALSE,
    rating JSONB,
    created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id),
    from_id UUID REFERENCES users(id),
    from_name TEXT DEFAULT '',
    to_id UUID,
    text TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS ratings (
    id UUID PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id),
    trip_id UUID REFERENCES trips(id),
    from_id UUID REFERENCES users(id),
    to_id UUID,
    stars INT NOT NULL,
    comment TEXT DEFAULT '',
    created_at BIGINT NOT NULL
  )`);
}

// ─── SEED ─────────────────────────────────────────────────────────────────
async function seed() {
  const { rows } = await q('SELECT COUNT(*) FROM users');
  if (parseInt(rows[0].count) > 0) return;

  const pw  = await hashPassword('demo123');
  const now = Date.now();
  const drivers = [
    { id: uid(), name: 'Arben Krasniqi',  email: 'arben@demo.com',   phone: '+41 79 123 45 67', rating: 4.9, trips_count: 24 },
    { id: uid(), name: 'Blerina Hoxha',   email: 'blerina@demo.com', phone: '+49 176 987 65 43', rating: 4.7, trips_count: 11 },
    { id: uid(), name: 'Ilir Berisha',    email: 'ilir@demo.com',    phone: '+43 699 222 33 44', rating: 4.8, trips_count: 18 },
    { id: uid(), name: 'Vjosa Gashi',     email: 'vjosa@demo.com',   phone: '+41 78 333 22 11',  rating: 5.0, trips_count: 7  },
    { id: uid(), name: 'Driton Morina',   email: 'driton@demo.com',  phone: '+49 163 555 66 77', rating: 4.6, trips_count: 32 },
  ];
  for (const d of drivers) {
    await q(
      'INSERT INTO users (id,name,email,password,phone,rating,trips_count,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [d.id, d.name, d.email, pw, d.phone, d.rating, d.trips_count, now]
    );
  }

  const fmt = d => d.toISOString().slice(0, 10);
  const d1  = new Date(); d1.setDate(d1.getDate() + 1);
  const d3  = new Date(); d3.setDate(d3.getDate() + 3);
  const d5  = new Date(); d5.setDate(d5.getDate() + 5);
  const d7  = new Date(); d7.setDate(d7.getDate() + 7);
  const d10 = new Date(); d10.setDate(d10.getDate() + 10);

  const trips = [
    [uid(), drivers[0].id, 'Zürich',    'Prishtinë', 'Zürich HB',          'Prishtinë Qendër',   fmt(d1),  '05:30', 3, 80, {type:'car',brand:'Mercedes',model:'E-Class',color:'E zezë'},      {luggage:true,smoking:false,music:true,pets:false,ac:true},  'Ndalojmë në Salzburg ~20 min.'],
    [uid(), drivers[1].id, 'Stuttgart', 'Tirana',    'Stuttgart Hbf',       'Sheshi Skënderbej',  fmt(d3),  '04:00', 4, 70, {type:'car',brand:'BMW',model:'5 Series',color:'E bardhë'},         {luggage:true,smoking:false,music:true,pets:false,ac:true},  'Ferry Ancona-Durrës.'],
    [uid(), drivers[2].id, 'Wien',      'Shkodër',   'Wien Westbahnhof',    'Shkodër Qendër',     fmt(d3),  '06:00', 3, 60, {type:'minivan',brand:'VW',model:'Touran',color:'Gri'},             {luggage:true,smoking:false,music:false,pets:true,ac:true},  'Bashkë me familjen.'],
    [uid(), drivers[3].id, 'Bern',      'Durrës',    'Bern Hauptbahnhof',   'Durrës Qendër',      fmt(d5),  '05:00', 2, 75, {type:'car',brand:'Audi',model:'A6',color:'E kaltër'},             {luggage:true,smoking:false,music:true,pets:false,ac:true},  'Ndalojmë çdo 3 orë.'],
    [uid(), drivers[4].id, 'München',   'Shkup',     'München Hbf',         'Shkup Qendër',       fmt(d7),  '06:30', 4, 65, {type:'car',brand:'Volkswagen',model:'Passat',color:'E kuqe'},     {luggage:true,smoking:false,music:true,pets:false,ac:true},  'Rruga Salzburg-Ljubljana.'],
    [uid(), drivers[0].id, 'Prishtinë', 'Zürich',    'Prishtinë Qendër',    'Zürich HB',          fmt(d10), '03:00', 3, 80, {type:'car',brand:'Mercedes',model:'E-Class',color:'E zezë'},      {luggage:true,smoking:false,music:true,pets:false,ac:true},  'Kthim Prishtinë→Zürich.'],
  ];
  for (const [id, did, fc, tc, fp, tp, date, time, seats, price, vehicle, options, notes] of trips) {
    await q(
      'INSERT INTO trips (id,driver_id,from_city,to_city,from_point,to_point,date,time,seats,seats_available,price,vehicle,options,notes,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
      [id, did, fc, tc, fp, tp, date, time, seats, seats, price, JSON.stringify(vehicle), JSON.stringify(options), notes, 'active', now]
    );
  }
  console.log('✅  Të dhënat demo u ngarkuan.');
}

// ─── AUTH TOKENS (in-memory) ───────────────────────────────────────────────
const tokens = new Map();

function createToken(userId) {
  const t = crypto.randomUUID();
  tokens.set(t, userId);
  return t;
}

async function getUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  const userId = tokens.get(h.slice(7));
  if (!userId) return null;
  const { rows } = await q('SELECT * FROM users WHERE id=$1', [userId]);
  return rows[0] || null;
}

function auth(req, res, next) {
  getUser(req)
    .then(user => {
      if (!user) return res.status(401).json({ error: 'Ju lutem hyni fillimisht' });
      req.user = user;
      next();
    })
    .catch(next);
}

// ─── SOCKET ───────────────────────────────────────────────────────────────
const userSockets = new Map();

io.on('connection', socket => {
  socket.on('identify', async ({ id, token: tok } = {}) => {
    if (!id || !tok || tokens.get(tok) !== id) return;
    userSockets.set(id, socket.id);
    socket.userId = id;
  });
  socket.on('disconnect', () => {
    if (socket.userId) userSockets.delete(socket.userId);
  });

  socket.on('join', ({ booking_id }) => {
    if (booking_id) socket.join(`booking_${booking_id}`);
  });

  // === LIVE TRACKING : conducteur partage sa position GPS ===
  socket.on('location:update', async (data) => {
    try {
      const { booking_id, lat, lng, speed } = data || {};
      if (!booking_id || typeof lat !== 'number' || typeof lng !== 'number') return;

      // Vérifie que l'émetteur est bien le conducteur du trajet, et que le passager a payé
      const result = await pool.query(
        `SELECT t.driver_id, b.passenger_id, b.payment_status
         FROM bookings b JOIN trips t ON t.id = b.trip_id
         WHERE b.id = $1`,
        [booking_id]
      );
      if (!result.rows.length) return;
      const { driver_id, payment_status } = result.rows[0];

      // Sécurité : seul le conducteur émet, seuls les passagers PAYÉS reçoivent
      if (socket.userId !== driver_id) return;
      if (payment_status !== 'paid') return;

      // Relais temps réel uniquement — AUCUN stockage DB (bon pour LPD/RGPD)
      io.to(`booking_${booking_id}`).emit('location:update', { booking_id, lat, lng, speed });
    } catch (err) {
      console.error('location:update error', err.message);
    }
  });

  socket.on('send_message', async ({ booking_id, to_id, text }) => {
    try {
      if (!socket.userId || !text?.trim()) return;
      const { rows: [booking] } = await q('SELECT * FROM bookings WHERE id=$1', [booking_id]);
      if (!booking) return;
      const { rows: [trip] } = await q('SELECT * FROM trips WHERE id=$1', [booking.trip_id]);
      const isParty = booking.passenger_id === socket.userId || trip?.driver_id === socket.userId;
      if (!isParty) return;
      const { rows: [sender] } = await q('SELECT name FROM users WHERE id=$1', [socket.userId]);
      const msg = {
        id: uid(), booking_id,
        from_id: socket.userId,
        from_name: sender?.name || '',
        to_id, text: text.trim(),
        created_at: Date.now()
      };
      await q(
        'INSERT INTO messages (id,booking_id,from_id,from_name,to_id,text,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [msg.id, msg.booking_id, msg.from_id, msg.from_name, msg.to_id, msg.text, msg.created_at]
      );
      const sid = userSockets.get(to_id);
      if (sid) io.to(sid).emit('new_message', msg);
      socket.emit('new_message', msg);
    } catch(e) { console.error('send_message error:', e.message); }
  });
});

function notify(userId, event, payload) {
  const sid = userSockets.get(userId);
  if (sid) io.to(sid).emit(event, payload);
}

// ─── RATINGS API ──────────────────────────────────────────────────────────
app.post('/api/ratings', auth, async (req, res) => {
  try {
    const { booking_id, stars, comment } = req.body;
    if (!stars || stars < 1 || stars > 5)
      return res.status(400).json({ error: 'Vlerësimi duhet të jetë 1–5 yje' });

    const { rows: [booking] } = await q('SELECT * FROM bookings WHERE id=$1', [booking_id]);
    if (!booking)                             return res.status(404).json({ error: 'Rezervimi nuk u gjet' });
    if (booking.passenger_id !== req.user.id) return res.status(403).json({ error: 'Nuk keni akses' });
    if (booking.status !== 'accepted')        return res.status(400).json({ error: 'Vetëm rezervimet e pranuara mund të vlerësohen' });
    if (booking.rated)                        return res.status(400).json({ error: 'Tashmë e keni vlerësuar' });

    const { rows: [trip] } = await q('SELECT * FROM trips WHERE id=$1', [booking.trip_id]);
    if (!trip) return res.status(404).json({ error: 'Udhëtimi nuk u gjet' });

    const { rows: [driver] } = await q('SELECT * FROM users WHERE id=$1', [trip.driver_id]);
    if (driver) {
      const count     = driver.trips_count || 1;
      const newRating = Math.round(((driver.rating || 5) * (count - 1) + stars) / count * 10) / 10;
      await q('UPDATE users SET rating=$1 WHERE id=$2', [newRating, driver.id]);
    }

    const ratingData = { stars, comment: comment || '', created_at: Date.now() };
    await q('UPDATE bookings SET rated=TRUE, rating=$1 WHERE id=$2', [JSON.stringify(ratingData), booking_id]);
    await q(
      'INSERT INTO ratings (id,booking_id,trip_id,from_id,to_id,stars,comment,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [uid(), booking_id, booking.trip_id, req.user.id, trip.driver_id, stars, comment || '', Date.now()]
    );

    const { rows: [updated] } = await q('SELECT rating FROM users WHERE id=$1', [trip.driver_id]);
    res.json({ ok: true, new_rating: updated?.rating });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ratings/:user_id', async (req, res) => {
  try {
    const { rows } = await q(`
      SELECT r.*, u.name as from_name
      FROM ratings r
      LEFT JOIN users u ON u.id = r.from_id
      WHERE r.to_id = $1
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [req.params.user_id]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── AUTH API ─────────────────────────────────────────────────────────────
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, phone, gender } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Plotëso të gjitha fushat' });

    const { rows: existing } = await q('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.length) return res.status(400).json({ error: 'Ky email është i regjistruar' });

    const user = {
      id: uid(), name, email, password: await hashPassword(password),
      phone: phone || '', gender: gender || '', rating: 5.0, trips_count: 0, created_at: Date.now()
    };
    await q(
      'INSERT INTO users (id,name,email,password,phone,gender,rating,trips_count,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [user.id, user.name, user.email, user.password, user.phone, user.gender, user.rating, user.trips_count, user.created_at]
    );
    const token = createToken(user.id);
    const { password: _, ...safe } = user;
    sendEmail(user.email, 'Mirë se erdhët në AlbaWay 🇦🇱', emailWrap(`
      <p>Mirëdita <strong>${user.name}</strong>,</p>
      <p style="color:rgba(255,255,255,.7)">Llogaria juaj u krijua me sukses! Tani mund të kërkoni ose publikoni udhëtime.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="https://albaway.ch" style="background:#E41E20;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">🔍 Kërko udhëtim</a>
      </div>`));
    res.json({ token, user: safe });
  } catch(e) { res.status(500).json({ error: 'Gabim serveri' }); }
});

app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Plotëso fushat' });

    const key = email.toLowerCase().trim();
    const { rows: [user] } = await q('SELECT * FROM users WHERE LOWER(email)=$1', [key]);

    if (user?.locked) {
      return res.status(403).json({ error: 'Llogaria është bllokuar. Kontrollo emailin tënd për rimëkëmbjen.' });
    }

    if (!user || !(await verifyPassword(password, user.password))) {
      const attempts = (failedAttempts.get(key) || 0) + 1;
      failedAttempts.set(key, attempts);

      if (attempts >= 6 && user) {
        const resetToken   = uid();
        const resetExpires = Date.now() + 60 * 60 * 1000;
        await q('UPDATE users SET locked=TRUE, reset_token=$1, reset_token_expires=$2 WHERE id=$3',
          [resetToken, resetExpires, user.id]);
        failedAttempts.delete(key);
        sendResetEmail(user.email, user.name, resetToken).catch(e => console.error('email error:', e.message));
        return res.status(403).json({ error: 'Llogaria u bllokua. Kontrollo emailin tënd për udhëzimet e rimëkëmbjes.' });
      }

      const left = 6 - attempts;
      return res.status(400).json({ error: `Email ose fjalëkalim i gabuar. ${left} tentativ${left === 1 ? 'ë' : 'a'} të mbetura.` });
    }

    failedAttempts.delete(key);
    if (!user.password.startsWith('$2')) {
      await q('UPDATE users SET password=$1 WHERE id=$2', [await hashPassword(password), user.id]);
    }
    const token = createToken(user.id);
    const { password: _, reset_token: __, reset_token_expires: ___, ...safe } = user;
    res.json({ token, user: safe });
  } catch(e) { res.status(500).json({ error: 'Gabim serveri' }); }
});

app.post('/api/auth/reset-request', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });
    const { rows: [user] } = await q('SELECT * FROM users WHERE LOWER(email)=$1', [email.toLowerCase().trim()]);
    if (user) {
      const resetToken   = uid();
      const resetExpires = Date.now() + 60 * 60 * 1000;
      await q('UPDATE users SET locked=FALSE, reset_token=$1, reset_token_expires=$2 WHERE id=$3',
        [resetToken, resetExpires, user.id]);
      sendResetEmail(user.email, user.name, resetToken).catch(e => console.error('email error:', e.message));
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Gabim serveri' }); }
});

app.post('/api/auth/reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 6)
      return res.status(400).json({ error: 'Të dhëna të pasakta' });

    const { rows: [user] } = await q(
      'SELECT * FROM users WHERE reset_token=$1 AND reset_token_expires > $2',
      [token, Date.now()]
    );
    if (!user) return res.status(400).json({ error: 'Link i pavlefshëm ose i skaduar.' });

    await q(
      'UPDATE users SET password=$1, locked=FALSE, reset_token=NULL, reset_token_expires=NULL WHERE id=$2',
      [await hashPassword(password), user.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Gabim serveri' }); }
});

app.get('/api/me', auth, (req, res) => {
  const { password: _, ...safe } = req.user;
  res.json(safe);
});

// ─── TRIP API ─────────────────────────────────────────────────────────────
app.get('/api/trips', async (req, res) => {
  try {
    const { from, to, date, seats } = req.query;
    let text = `
      SELECT t.*, u.id as drv_id, u.name as drv_name, u.rating as drv_rating, u.trips_count as drv_trips
      FROM trips t LEFT JOIN users u ON u.id = t.driver_id
      WHERE t.status = 'active'
    `;
    const params = [];
    if (from)  { params.push(`%${from.toLowerCase()}%`); text += ` AND LOWER(t.from_city) LIKE $${params.length}`; }
    if (to)    { params.push(`%${to.toLowerCase()}%`);   text += ` AND LOWER(t.to_city) LIKE $${params.length}`; }
    if (date)  { params.push(date);                      text += ` AND t.date = $${params.length}`; }
    if (seats) { params.push(parseInt(seats));           text += ` AND t.seats_available >= $${params.length}`; }
    text += ' ORDER BY t.date, t.time';

    const { rows } = await q(text, params);
    const result = rows.map(r => ({
      id: r.id, driver_id: r.driver_id, from_city: r.from_city, to_city: r.to_city,
      from_point: r.from_point, to_point: r.to_point, date: r.date, time: r.time,
      seats: r.seats, seats_available: r.seats_available, price: r.price,
      vehicle: r.vehicle, options: r.options, notes: r.notes,
      status: r.status, created_at: r.created_at,
      driver: r.drv_id ? { id: r.drv_id, name: r.drv_name, rating: r.drv_rating, trips_count: r.drv_trips } : null
    }));
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/trips/mine', auth, async (req, res) => {
  try {
    const { rows: trips } = await q(
      'SELECT * FROM trips WHERE driver_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const result = await Promise.all(trips.map(async t => {
      const { rows: [p] } = await q("SELECT COUNT(*) FROM bookings WHERE trip_id=$1 AND status='pending'",  [t.id]);
      const { rows: [a] } = await q("SELECT COUNT(*) FROM bookings WHERE trip_id=$1 AND status='accepted'", [t.id]);
      return { ...t, pending_requests: parseInt(p.count), accepted_passengers: parseInt(a.count) };
    }));
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/trips/:id', async (req, res) => {
  try {
    const { rows: [trip] } = await q('SELECT * FROM trips WHERE id=$1', [req.params.id]);
    if (!trip) return res.status(404).json({ error: 'Udhëtimi nuk u gjet' });

    const { rows: [drv] } = await q('SELECT * FROM users WHERE id=$1', [trip.driver_id]);
    const { rows: accepted } = await q("SELECT * FROM bookings WHERE trip_id=$1 AND status='accepted'", [trip.id]);

    const currentUser = await getUser(req);
    const isDriver = currentUser && currentUser.id === trip.driver_id;

    const passengers = isDriver
      ? (await Promise.all(
          accepted.map(b => q('SELECT id,name,rating FROM users WHERE id=$1', [b.passenger_id]).then(r => r.rows[0]))
        )).filter(Boolean)
      : [];

    res.json({
      ...trip,
      driver: drv ? { id: drv.id, name: drv.name, rating: drv.rating, trips_count: drv.trips_count } : null,
      passengers,
      passengers_count: accepted.length
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/trips', auth, async (req, res) => {
  try {
    const { from_city, to_city, from_point, to_point, date, time, seats, price, vehicle, options, notes, women_only } = req.body;
    if (!from_city || !to_city || !date || !time || !seats || !price)
      return res.status(400).json({ error: 'Plotëso të gjitha fushat e detyrueshme' });

    const trip = {
      id: uid(), driver_id: req.user.id,
      from_city, to_city,
      from_point: from_point || from_city,
      to_point:   to_point   || to_city,
      date, time,
      seats: +seats, seats_available: +seats,
      price: +price,
      vehicle: vehicle || {}, options: options || {},
      notes: notes || '', women_only: !!women_only, status: 'active', created_at: Date.now()
    };
    await q(
      'INSERT INTO trips (id,driver_id,from_city,to_city,from_point,to_point,date,time,seats,seats_available,price,vehicle,options,notes,women_only,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',
      [trip.id, trip.driver_id, trip.from_city, trip.to_city, trip.from_point, trip.to_point, trip.date, trip.time, trip.seats, trip.seats_available, trip.price, JSON.stringify(trip.vehicle), JSON.stringify(trip.options), trip.notes, trip.women_only, trip.status, trip.created_at]
    );
    await q('UPDATE users SET trips_count = trips_count + 1 WHERE id=$1', [req.user.id]);
    res.json(trip);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/trips/:id/cancel', auth, async (req, res) => {
  try {
    const { rows: [trip] } = await q('SELECT * FROM trips WHERE id=$1 AND driver_id=$2', [req.params.id, req.user.id]);
    if (!trip) return res.status(404).json({ error: 'Nuk u gjet' });

    await q("UPDATE trips SET status='cancelled' WHERE id=$1", [trip.id]);
    const { rows: pending } = await q("SELECT * FROM bookings WHERE trip_id=$1 AND status='pending'", [trip.id]);
    for (const b of pending) {
      await q("UPDATE bookings SET status='cancelled' WHERE id=$1", [b.id]);
      notify(b.passenger_id, 'booking_update', { booking_id: b.id, status: 'cancelled' });
      q('SELECT email,name FROM users WHERE id=$1', [b.passenger_id]).then(r => {
        const pax = r.rows[0];
        if (pax?.email) sendEmail(pax.email, `Udhëtimi u anulua ❌ — ${trip.from_city} → ${trip.to_city}`, emailWrap(`
          <p>Mirëdita <strong>${pax.name}</strong>,</p>
          <p style="color:rgba(255,255,255,.7)">Fatkeqësisht, udhëtimi <strong>${trip.from_city} → ${trip.to_city}</strong> i datës <strong>${trip.date}</strong> u anulua nga shoferi. Rezervimi juaj u anulua automatikisht.</p>
          <div style="text-align:center;margin:28px 0">
            <a href="https://albaway.ch" style="background:#E41E20;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">🔍 Kërko udhëtim tjetër</a>
          </div>`));
      }).catch(() => {});
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── BOOKING API ──────────────────────────────────────────────────────────
app.get('/api/bookings/mine', auth, async (req, res) => {
  try {
    const { rows: bookings } = await q(
      'SELECT * FROM bookings WHERE passenger_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const result = await Promise.all(bookings.map(async b => {
      const { rows: [trip] }  = await q('SELECT * FROM trips WHERE id=$1', [b.trip_id]);
      const { rows: [drv] }   = trip ? await q('SELECT * FROM users WHERE id=$1', [trip.driver_id]) : { rows: [] };
      return {
        ...b,
        trip: trip ? {
          ...trip,
          driver: drv ? { id: drv.id, name: drv.name, rating: drv.rating } : null
        } : null
      };
    }));
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/trips/:id/requests', auth, async (req, res) => {
  try {
    const { rows: [trip] } = await q('SELECT * FROM trips WHERE id=$1 AND driver_id=$2', [req.params.id, req.user.id]);
    if (!trip) return res.status(403).json({ error: 'Nuk keni akses' });

    const { rows: bookings } = await q('SELECT * FROM bookings WHERE trip_id=$1', [trip.id]);
    const result = await Promise.all(bookings.map(async b => {
      const { rows: [p] } = await q('SELECT * FROM users WHERE id=$1', [b.passenger_id]);
      return {
        ...b,
        passenger: p ? { id: p.id, name: p.name, rating: p.rating } : null
      };
    }));
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/bookings', auth, async (req, res) => {
  try {
    const { trip_id, seats, message } = req.body;
    const { rows: [trip] } = await q('SELECT * FROM trips WHERE id=$1', [trip_id]);
    if (!trip || trip.status !== 'active')
      return res.status(400).json({ error: 'Udhëtimi nuk është i disponueshëm' });
    if (trip.driver_id === req.user.id)
      return res.status(400).json({ error: 'Nuk mund të rezervosh udhëtimin tënd' });

    const want = parseInt(seats) || 1;
    if (trip.seats_available < want)
      return res.status(400).json({ error: 'Nuk ka vende të mjaftueshme' });

    const { rows: dup } = await q(
      "SELECT id FROM bookings WHERE trip_id=$1 AND passenger_id=$2 AND status IN ('pending','accepted')",
      [trip_id, req.user.id]
    );
    if (dup.length) return res.status(400).json({ error: 'Ke tashmë një rezervim aktiv' });
    if (trip.women_only && req.user.gender !== 'female')
      return res.status(403).json({ error: '👩 Ky udhëtim është vetëm për udhëtare femra' });

    const booking = {
      id: uid(), trip_id, passenger_id: req.user.id,
      seats: want, status: 'pending', message: message || '', created_at: Date.now()
    };
    await q(
      'INSERT INTO bookings (id,trip_id,passenger_id,seats,status,message,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [booking.id, booking.trip_id, booking.passenger_id, booking.seats, booking.status, booking.message, booking.created_at]
    );
    notify(trip.driver_id, 'new_request', {
      booking_id: booking.id, trip_id,
      passenger: { name: req.user.name },
      seats: want, message: booking.message,
      route: `${trip.from_city} → ${trip.to_city}`,
      date: trip.date
    });
    q('SELECT email,name FROM users WHERE id=$1', [trip.driver_id]).then(r => {
      const drv = r.rows[0];
      if (drv?.email) sendEmail(drv.email, `Kërkesë e re rezervimi — ${trip.from_city} → ${trip.to_city}`, emailWrap(`
        <p>Mirëdita <strong>${drv.name}</strong>,</p>
        <p style="color:rgba(255,255,255,.7)"><strong>${req.user.name}</strong> dëshiron të rezervojë <strong>${want} vend(e)</strong> për rrugën <strong>${trip.from_city} → ${trip.to_city}</strong> më datën <strong>${trip.date}</strong>.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="https://albaway.ch" style="background:#E41E20;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">✅ Prano ose Refuzo</a>
        </div>`));
    }).catch(() => {});
    res.json(booking);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/bookings/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'refused'].includes(status))
      return res.status(400).json({ error: 'Status i pavlefshëm' });

    const { rows: [b] } = await q('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Rezervimi nuk u gjet' });

    const { rows: [trip] } = await q('SELECT * FROM trips WHERE id=$1', [b.trip_id]);
    if (!trip || trip.driver_id !== req.user.id) return res.status(403).json({ error: 'Nuk keni akses' });
    if (b.status !== 'pending') return res.status(400).json({ error: 'Rezervimi nuk është në pritje' });

    await q('UPDATE bookings SET status=$1 WHERE id=$2', [status, b.id]);
    if (status === 'accepted') {
      await q('UPDATE trips SET seats_available = GREATEST(0, seats_available - $1) WHERE id=$2', [b.seats, trip.id]);
    }
    notify(b.passenger_id, 'booking_update', {
      booking_id: b.id, status,
      route: `${trip.from_city} → ${trip.to_city}`,
      date: trip.date, time: trip.time,
      driver_name: req.user.name
    });
    if (status === 'accepted') {
      q('SELECT email,name FROM users WHERE id=$1', [b.passenger_id]).then(r => {
        const pax = r.rows[0];
        if (pax?.email) sendEmail(pax.email, `Rezervimi u pranua ✅ — ${trip.from_city} → ${trip.to_city}`, emailWrap(`
          <p>Mirëdita <strong>${pax.name}</strong>,</p>
          <p style="color:rgba(255,255,255,.7)">Shoferi <strong>${req.user.name}</strong> pranoi rezervimin tuaj për rrugën <strong>${trip.from_city} → ${trip.to_city}</strong> më datën <strong>${trip.date}</strong> ora <strong>${trip.time}</strong>.</p>
          <p style="color:rgba(255,255,255,.7)">Hyni në AlbaWay dhe klikoni <strong>"Paguaj"</strong> për të konfirmuar vendin tuaj.</p>
          <div style="text-align:center;margin:28px 0">
            <a href="https://albaway.ch" style="background:#E41E20;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">💳 Paguaj tani</a>
          </div>`));
      }).catch(() => {});
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── STRIPE CHECKOUT ──────────────────────────────────────────────────────
app.post('/api/bookings/:id/checkout', auth, async (req, res) => {
  try {
    const { rows: [b] } = await q('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (!b)                             return res.status(404).json({ error: 'Rezervimi nuk u gjet' });
    if (b.passenger_id !== req.user.id) return res.status(403).json({ error: 'Nuk keni akses' });
    if (b.status !== 'accepted')        return res.status(400).json({ error: 'Rezervimi duhet të pranohet fillimisht' });
    if (b.payment_status === 'paid')    return res.status(400).json({ error: 'Tashmë është paguar' });

    const { rows: [trip] } = await q('SELECT * FROM trips WHERE id=$1', [b.trip_id]);
    let drv = null;
    if (trip) {
      const { rows } = await q('SELECT * FROM users WHERE id=$1', [trip.driver_id]);
      drv = rows[0] || null;
    }

    const base = process.env.FRONTEND_URL || 'http://localhost:3001';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name:        `AlbaWay — ${trip?.from_city} → ${trip?.to_city}`,
            description: `📅 ${trip?.date} · 🕐 ${trip?.time} · Shofer: ${drv?.name || ''}`,
          },
          unit_amount: Math.round((trip?.price || 0) * 100),
        },
        quantity: b.seats || 1,
      }],
      mode:        'payment',
      metadata:    { booking_id: b.id },
      success_url: `${base}/dashboard?payment=success&booking=${b.id}`,
      cancel_url:  `${base}/dashboard?payment=cancel`,
    });
    res.json({ url: session.url });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── STRIPE WEBHOOK ───────────────────────────────────────────────────────
app.post('/api/stripe/webhook', async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured — webhook rejected');
    return res.status(500).json({ error: 'Webhook not configured' });
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], secret);
  } catch(e) { return res.status(400).send(`Webhook Error: ${e.message}`); }

  if (event.type === 'checkout.session.completed') {
    const bookingId = event.data.object.metadata?.booking_id;
    if (bookingId) {
      const { rows: [b] } = await q('SELECT * FROM bookings WHERE id=$1', [bookingId]);
      if (b && b.payment_status !== 'paid') {
        await q("UPDATE bookings SET payment_status='paid', paid_at=$1 WHERE id=$2", [Date.now(), bookingId]);
        const { rows: [trip] }      = await q('SELECT * FROM trips WHERE id=$1', [b.trip_id]);
        const { rows: [passenger] } = await q('SELECT * FROM users WHERE id=$1', [b.passenger_id]);
        notify(trip?.driver_id, 'payment_confirmed', {
          booking_id:     b.id,
          passenger_name: passenger?.name || '',
          route: trip ? `${trip.from_city} → ${trip.to_city}` : ''
        });
        notify(b.passenger_id, 'payment_success', {
          booking_id: b.id,
          route: trip ? `${trip.from_city} → ${trip.to_city}` : ''
        });
        // Emails paiement confirmé
        const route = trip ? `${trip.from_city} → ${trip.to_city}` : '';
        const { rows: [driver] } = await q('SELECT * FROM users WHERE id=$1', [trip?.driver_id]);
        if (passenger?.email) sendEmail(passenger.email, `Pagesa u konfirmua 💳 — ${route}`, emailWrap(`
          <p>Mirëdita <strong>${passenger.name}</strong>,</p>
          <p style="color:rgba(255,255,255,.7)">Pagesa juaj u konfirmua për rrugën <strong>${route}</strong> më datën <strong>${trip?.date}</strong>.</p>
          ${driver ? `<p style="color:rgba(255,255,255,.7)">Kontakti i shoferit: <strong>${driver.name}</strong>${driver.phone ? ` · 📞 ${driver.phone}` : ''}</p>` : ''}
          <div style="text-align:center;margin:28px 0">
            <a href="https://albaway.ch" style="background:#E41E20;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">💬 Hap chatin</a>
          </div>`));
        if (driver?.email) sendEmail(driver.email, `Pagesa u krye nga ${passenger?.name || 'pasagjeri'} 💰`, emailWrap(`
          <p>Mirëdita <strong>${driver.name}</strong>,</p>
          <p style="color:rgba(255,255,255,.7)"><strong>${passenger?.name || 'Pasagjeri'}</strong> kreu pagesën për rrugën <strong>${route}</strong> më datën <strong>${trip?.date}</strong>.</p>
          ${passenger?.phone ? `<p style="color:rgba(255,255,255,.7)">Kontakti i pasagjerit: 📞 <strong>${passenger.phone}</strong></p>` : ''}
          <div style="text-align:center;margin:28px 0">
            <a href="https://albaway.ch" style="background:#E41E20;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">💬 Hap chatin</a>
          </div>`));
      }
    }
  }
  res.json({ received: true });
});

// ─── ADMIN (temporaire) ───────────────────────────────────────────────────
app.post('/api/admin/test-email', async (req, res) => {
  const { secret, to } = req.body;
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: 'Forbidden' });
  if (!process.env.RESEND_API_KEY)
    return res.json({ error: '❌ RESEND_API_KEY non défini dans Render' });

  const dest = to || 'kacinr1@gmail.com';
  const demo = { name: 'Arben Krasniqi', route: 'Zürich → Prishtinë', date: '2026-07-28', time: '08:00', phone: '+41 79 123 45 67' };
  const results = [];

  const templates = [
    { subject: '1/5 · Mirë se erdhët në AlbaWay 🇦🇱', html: emailWrap(`
      <p>Mirëdita <strong>${demo.name}</strong>,</p>
      <p style="color:rgba(255,255,255,.7)">Llogaria juaj u krijua me sukses! Tani mund të kërkoni ose publikoni udhëtime.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="https://albaway.ch" style="background:#E41E20;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">🔍 Kërko udhëtim</a>
      </div>`) },
    { subject: '2/5 · Kërkesë e re rezervimi — Zürich → Prishtinë', html: emailWrap(`
      <p>Mirëdita <strong>${demo.name}</strong>,</p>
      <p style="color:rgba(255,255,255,.7)"><strong>Blerina Morina</strong> dëshiron të rezervojë <strong>2 vend(e)</strong> për rrugën <strong>${demo.route}</strong> më datën <strong>${demo.date}</strong>.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="https://albaway.ch" style="background:#E41E20;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">✅ Prano ose Refuzo</a>
      </div>`) },
    { subject: '3/5 · Rezervimi u pranua ✅ — Zürich → Prishtinë', html: emailWrap(`
      <p>Mirëdita <strong>${demo.name}</strong>,</p>
      <p style="color:rgba(255,255,255,.7)">Shoferi <strong>Driton Berisha</strong> pranoi rezervimin tuaj për rrugën <strong>${demo.route}</strong> më datën <strong>${demo.date}</strong> ora <strong>${demo.time}</strong>.</p>
      <p style="color:rgba(255,255,255,.7)">Hyni në AlbaWay dhe klikoni <strong>"Paguaj"</strong> për të konfirmuar vendin tuaj.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="https://albaway.ch" style="background:#E41E20;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">💳 Paguaj tani</a>
      </div>`) },
    { subject: '4/5 · Pagesa u konfirmua 💳 — Zürich → Prishtinë', html: emailWrap(`
      <p>Mirëdita <strong>${demo.name}</strong>,</p>
      <p style="color:rgba(255,255,255,.7)">Pagesa juaj u konfirmua për rrugën <strong>${demo.route}</strong> më datën <strong>${demo.date}</strong>.</p>
      <p style="color:rgba(255,255,255,.7)">Kontakti i shoferit: <strong>Driton Berisha</strong> · 📞 ${demo.phone}</p>
      <div style="text-align:center;margin:28px 0">
        <a href="https://albaway.ch" style="background:#E41E20;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">💬 Hap chatin</a>
      </div>`) },
    { subject: '5/5 · Udhëtimi u anulua ❌ — Zürich → Prishtinë', html: emailWrap(`
      <p>Mirëdita <strong>${demo.name}</strong>,</p>
      <p style="color:rgba(255,255,255,.7)">Fatkeqësisht, udhëtimi <strong>${demo.route}</strong> i datës <strong>${demo.date}</strong> u anulua nga shoferi. Rezervimi juaj u anulua automatikisht.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="https://albaway.ch" style="background:#E41E20;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">🔍 Kërko udhëtim tjetër</a>
      </div>`) },
  ];

  for (const tpl of templates) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({ from:'AlbaWay <noreply@albaway.ch>', to: dest, subject: tpl.subject, html: tpl.html });
    results.push({ subject: tpl.subject, ok: !error, id: data?.id, error: error?.message });
  }
  res.json({ sent_to: dest, results });
});

app.post('/api/admin/unlock', async (req, res) => {
  const { secret, email } = req.body;
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: 'Forbidden' });
  const { rows } = await q(
    'UPDATE users SET locked=FALSE, reset_token=NULL, reset_token_expires=NULL WHERE LOWER(email)=$1 RETURNING id',
    [email.toLowerCase()]
  );
  res.json({ ok: true, updated: rows.length });
});

app.post('/api/admin/clean-demo', async (req, res) => {
  const { secret } = req.body;
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows: demoUsers } = await q(
      "SELECT id FROM users WHERE email LIKE '%@demo.com'", []
    );
    if (!demoUsers.length) return res.json({ ok: true, cancelled: 0, msg: 'Nuk ka trajete demo' });
    const ids = demoUsers.map(u => u.id);
    const { rowCount } = await q(
      `UPDATE trips SET status='cancelled', seats_available=0 WHERE driver_id = ANY($1) AND status='active'`,
      [ids]
    );
    res.json({ ok: true, cancelled: rowCount, demo_users: ids.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── MESSAGES API ─────────────────────────────────────────────────────────
app.get('/api/messages/:booking_id', auth, async (req, res) => {
  try {
    const { rows: [booking] } = await q('SELECT * FROM bookings WHERE id=$1', [req.params.booking_id]);
    if (!booking) return res.status(404).json({ error: 'Rezervimi nuk u gjet' });

    const { rows: [trip] } = await q('SELECT * FROM trips WHERE id=$1', [booking.trip_id]);
    const isParty = booking.passenger_id === req.user.id || trip?.driver_id === req.user.id;
    if (!isParty) return res.status(403).json({ error: 'Nuk keni akses' });

    const { rows } = await q(
      'SELECT * FROM messages WHERE booking_id=$1 ORDER BY created_at',
      [req.params.booking_id]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── HEALTH ───────────────────────────────────────────────────────────────
app.get('/health', async (_, res) => {
  try {
    const { rows: [u] } = await q('SELECT COUNT(*) FROM users');
    const { rows: [t] } = await q('SELECT COUNT(*) FROM trips');
    res.json({ status: 'ok', users: parseInt(u.count), trips: parseInt(t.count) });
  } catch(e) { res.status(500).json({ status: 'db_error', error: e.message }); }
});

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.includes('.')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ─── START ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

createPool()
  .then(initDb)
  .then(seed)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`\n🇦🇱  AlbaWay → http://localhost:${PORT}\n`);
      console.log('   Kontet demo: arben@demo.com / demo123\n');
    });
  })
  .catch(err => {
    console.error('❌  DB init failed:', err);
    process.exit(1);
  });

module.exports = { server, io };
