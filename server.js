'use strict';

require('dotenv').config();

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const Stripe   = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => { if (req.path === '/api/stripe/webhook') req.rawBody = buf; }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ─── DATABASE (JSON file) ──────────────────────────────────────────────────
const DB_FILE = path.join(__dirname, 'data.json');

function db() {
  if (!fs.existsSync(DB_FILE)) return { users: [], trips: [], bookings: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function uid() { return crypto.randomUUID(); }
function hash(pw) { return crypto.createHash('sha256').update(pw + '_bbshqip_2026').digest('hex'); }

// ─── SEED (demo data on first run) ────────────────────────────────────────

// ─── RATINGS API ──────────────────────────────────────────────────────────
app.post('/api/ratings', auth, (req, res) => {
  const { booking_id, stars, comment } = req.body;
  if (!stars || stars < 1 || stars > 5)
    return res.status(400).json({ error: 'Vlerësimi duhet të jetë 1–5 yje' });

  const data    = db();
  const booking = data.bookings.find(b => b.id === booking_id);
  if (!booking) return res.status(404).json({ error: 'Rezervimi nuk u gjet' });
  if (booking.passenger_id !== req.user.id)
    return res.status(403).json({ error: 'Nuk keni akses' });
  if (booking.status !== 'accepted')
    return res.status(400).json({ error: 'Vetëm rezervimet e pranuara mund të vlerësohen' });
  if (booking.rated)
    return res.status(400).json({ error: 'Tashmë e keni vlerësuar' });

  const trip = data.trips.find(t => t.id === booking.trip_id);
  if (!trip) return res.status(404).json({ error: 'Udëtimi nuk u gjet' });

  // update driver rating
  const dIdx = data.users.findIndex(u => u.id === trip.driver_id);
  if (dIdx >= 0) {
    const driver = data.users[dIdx];
    const count  = driver.trips_count || 1;
    driver.rating = ((driver.rating || 5) * (count - 1) + stars) / count;
    driver.rating = Math.round(driver.rating * 10) / 10;
  }

  // mark booking as rated
  const bIdx = data.bookings.findIndex(b => b.id === booking_id);
  data.bookings[bIdx].rated = true;
  data.bookings[bIdx].rating = { stars, comment: comment || '', created_at: Date.now() };

  // save rating in ratings array
  if (!data.ratings) data.ratings = [];
  data.ratings.push({
    id: uid(), booking_id, trip_id: booking.trip_id,
    from_id: req.user.id, to_id: trip.driver_id,
    stars, comment: comment || '', created_at: Date.now()
  });

  save(data);
  res.json({ ok: true, new_rating: data.users[dIdx]?.rating });
});

app.get('/api/ratings/:user_id', (req, res) => {
  const data = db();
  const ratings = (data.ratings || [])
    .filter(r => r.to_id === req.params.user_id)
    .map(r => {
      const from = data.users.find(u => u.id === r.from_id);
      return { ...r, from_name: from?.name || 'Anonim' };
    })
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 20);
  res.json(ratings);
});

// ─── SEED ─────────────────────────────────────────────────────────────────
function seed() {
  const data = db();
  if (data.users.length > 0) return;

  const drivers = [
    { id: uid(), name: 'Arben Krasniqi',  email: 'arben@demo.com',   password: hash('demo123'), phone: '+41 79 123 45 67', rating: 4.9, trips_count: 24, created_at: Date.now() },
    { id: uid(), name: 'Blerina Hoxha',   email: 'blerina@demo.com', password: hash('demo123'), phone: '+49 176 987 65 43', rating: 4.7, trips_count: 11, created_at: Date.now() },
    { id: uid(), name: 'Ilir Berisha',    email: 'ilir@demo.com',    password: hash('demo123'), phone: '+43 699 222 33 44', rating: 4.8, trips_count: 18, created_at: Date.now() },
    { id: uid(), name: 'Vjosa Gashi',     email: 'vjosa@demo.com',   password: hash('demo123'), phone: '+41 78 333 22 11', rating: 5.0, trips_count: 7,  created_at: Date.now() },
    { id: uid(), name: 'Driton Morina',   email: 'driton@demo.com',  password: hash('demo123'), phone: '+49 163 555 66 77', rating: 4.6, trips_count: 32, created_at: Date.now() },
  ];

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const in3days  = new Date(); in3days.setDate(in3days.getDate() + 3);
  const in5days  = new Date(); in5days.setDate(in5days.getDate() + 5);
  const in7days  = new Date(); in7days.setDate(in7days.getDate() + 7);
  const in10days = new Date(); in10days.setDate(in10days.getDate() + 10);

  const fmt = d => d.toISOString().slice(0,10);

  const trips = [
    {
      id: uid(), driver_id: drivers[0].id,
      from_city: 'Zürich',      to_city: 'Prishtinë',
      from_point: 'Zürich HB',  to_point: 'Prishtinë Qendër',
      date: fmt(tomorrow), time: '05:30',
      seats: 3, seats_available: 2, price: 80,
      vehicle: { type: 'car', brand: 'Mercedes', model: 'E-Class', color: 'E zezë' },
      options: { luggage: true, smoking: false, music: true, pets: false, ac: true },
      notes: 'Ndalojmë në Salzburg ~20 min. Rruga E55.',
      status: 'active', created_at: Date.now()
    },
    {
      id: uid(), driver_id: drivers[1].id,
      from_city: 'Stuttgart',   to_city: 'Tirana',
      from_point: 'Stuttgart Hbf', to_point: 'Sheshi Skënderbej',
      date: fmt(in3days), time: '04:00',
      seats: 4, seats_available: 3, price: 70,
      vehicle: { type: 'car', brand: 'BMW', model: '5 Series', color: 'E bardhë' },
      options: { luggage: true, smoking: false, music: true, pets: false, ac: true },
      notes: 'Ferry Ancona-Durrës. Kthim të dielën.',
      status: 'active', created_at: Date.now()
    },
    {
      id: uid(), driver_id: drivers[2].id,
      from_city: 'Wien',        to_city: 'Shkodër',
      from_point: 'Wien Westbahnhof', to_point: 'Shkodër Qendër',
      date: fmt(in3days), time: '06:00',
      seats: 3, seats_available: 3, price: 60,
      vehicle: { type: 'minivan', brand: 'VW', model: 'Touran', color: 'Gri' },
      options: { luggage: true, smoking: false, music: false, pets: true, ac: true },
      notes: 'Bashkë me familjen. Mirëpritim pasagjerë familjarë.',
      status: 'active', created_at: Date.now()
    },
    {
      id: uid(), driver_id: drivers[3].id,
      from_city: 'Bern',        to_city: 'Durrës',
      from_point: 'Bern Hauptbahnhof', to_point: 'Durrës Qendër',
      date: fmt(in5days), time: '05:00',
      seats: 2, seats_available: 2, price: 75,
      vehicle: { type: 'car', brand: 'Audi', model: 'A6', color: 'E kaltër' },
      options: { luggage: true, smoking: false, music: true, pets: false, ac: true },
      notes: 'Rruga autostradale. Ndalojmë çdo 3 orë.',
      status: 'active', created_at: Date.now()
    },
    {
      id: uid(), driver_id: drivers[4].id,
      from_city: 'München',     to_city: 'Shkup',
      from_point: 'München Hbf', to_point: 'Shkup Qendër',
      date: fmt(in7days), time: '06:30',
      seats: 4, seats_available: 4, price: 65,
      vehicle: { type: 'car', brand: 'Volkswagen', model: 'Passat', color: 'E kuqe' },
      options: { luggage: true, smoking: false, music: true, pets: false, ac: true },
      notes: 'Rruga Salzburg-Ljubljana-Zagreb-Beograd-Shkup.',
      status: 'active', created_at: Date.now()
    },
    {
      id: uid(), driver_id: drivers[0].id,
      from_city: 'Prishtinë',   to_city: 'Zürich',
      from_point: 'Prishtinë Qendër', to_point: 'Zürich HB',
      date: fmt(in10days), time: '03:00',
      seats: 3, seats_available: 3, price: 80,
      vehicle: { type: 'car', brand: 'Mercedes', model: 'E-Class', color: 'E zezë' },
      options: { luggage: true, smoking: false, music: true, pets: false, ac: true },
      notes: 'Kthim Prishtinë→Zürich. Ndalojmë në Beograd.',
      status: 'active', created_at: Date.now()
    },
  ];

  data.users = drivers;
  data.trips = trips;
  save(data);
  console.log('✅  Të dhënat demo u ngarkuan.');
}

// ─── AUTH TOKENS ──────────────────────────────────────────────────────────
const tokens = new Map(); // token → userId

function createToken(userId) {
  const t = crypto.randomUUID();
  tokens.set(t, userId);
  return t;
}

function getUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  const userId = tokens.get(h.slice(7));
  if (!userId) return null;
  return db().users.find(u => u.id === userId) || null;
}

function auth(req, res, next) {
  req.user = getUser(req);
  if (!req.user) return res.status(401).json({ error: 'Ju lutem hyni fillimisht' });
  next();
}

// ─── SOCKET – real-time notifications ─────────────────────────────────────
const userSockets = new Map(); // userId → socketId

io.on('connection', socket => {
  socket.on('identify', userId => {
    userSockets.set(userId, socket.id);
    socket.userId = userId;
  });
  socket.on('disconnect', () => {
    if (socket.userId) userSockets.delete(socket.userId);
  });

  socket.on('send_message', ({ booking_id, to_id, text }) => {
    if (!socket.userId || !text?.trim()) return;
    const data    = db();
    const booking = data.bookings.find(b => b.id === booking_id);
    if (!booking) return;

    const trip = data.trips.find(t => t.id === booking.trip_id);
    const isParty = booking.passenger_id === socket.userId || trip?.driver_id === socket.userId;
    if (!isParty) return;

    const sender = data.users.find(u => u.id === socket.userId);
    if (!data.messages) data.messages = [];
    const msg = {
      id: uid(), booking_id,
      from_id: socket.userId,
      from_name: sender?.name || '',
      to_id, text: text.trim(),
      created_at: Date.now()
    };
    data.messages.push(msg);
    save(data);

    const sid = userSockets.get(to_id);
    if (sid) io.to(sid).emit('new_message', msg);
    socket.emit('new_message', msg);
  });
});

function notify(userId, event, payload) {
  const sid = userSockets.get(userId);
  if (sid) io.to(sid).emit(event, payload);
}

// ─── AUTH API ─────────────────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Plotëso të gjitha fushat' });

  const data = db();
  if (data.users.find(u => u.email === email))
    return res.status(400).json({ error: 'Ky email është i regjistruar' });

  const user = { id: uid(), name, email, password: hash(password), phone: phone || '',
                 rating: 5.0, trips_count: 0, created_at: Date.now() };
  data.users.push(user);
  save(data);

  const token = createToken(user.id);
  const { password: _, ...safe } = user;
  res.json({ token, user: safe });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const data = db();
  const user = data.users.find(u => u.email === email && u.password === hash(password));
  if (!user) return res.status(400).json({ error: 'Email ose fjalëkalim i gabuar' });

  const token = createToken(user.id);
  const { password: _, ...safe } = user;
  res.json({ token, user: safe });
});

app.get('/api/me', auth, (req, res) => {
  const { password: _, ...safe } = req.user;
  res.json(safe);
});

// ─── TRIP API ─────────────────────────────────────────────────────────────
app.get('/api/trips', (req, res) => {
  const { from, to, date, seats } = req.query;
  const data = db();
  let trips = data.trips.filter(t => t.status === 'active');

  if (from)  trips = trips.filter(t => t.from_city.toLowerCase().includes(from.toLowerCase()));
  if (to)    trips = trips.filter(t => t.to_city.toLowerCase().includes(to.toLowerCase()));
  if (date)  trips = trips.filter(t => t.date === date);
  if (seats) trips = trips.filter(t => t.seats_available >= parseInt(seats));

  trips.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const result = trips.map(t => {
    const drv = data.users.find(u => u.id === t.driver_id);
    return { ...t, driver: drv ? { id: drv.id, name: drv.name, rating: drv.rating, trips_count: drv.trips_count } : null };
  });
  res.json(result);
});

app.get('/api/trips/mine', auth, (req, res) => {
  const data = db();
  const trips = data.trips
    .filter(t => t.driver_id === req.user.id)
    .sort((a, b) => b.created_at - a.created_at)
    .map(t => {
      const pending  = data.bookings.filter(b => b.trip_id === t.id && b.status === 'pending').length;
      const accepted = data.bookings.filter(b => b.trip_id === t.id && b.status === 'accepted').length;
      return { ...t, pending_requests: pending, accepted_passengers: accepted };
    });
  res.json(trips);
});

app.get('/api/trips/:id', (req, res) => {
  const data = db();
  const trip = data.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Udëtimi nuk u gjet' });

  const drv  = data.users.find(u => u.id === trip.driver_id);
  const accepted = data.bookings.filter(b => b.trip_id === trip.id && b.status === 'accepted');
  const passengers = accepted.map(b => {
    const p = data.users.find(u => u.id === b.passenger_id);
    return p ? { id: p.id, name: p.name, rating: p.rating } : null;
  }).filter(Boolean);

  res.json({
    ...trip,
    driver: drv ? { id: drv.id, name: drv.name, rating: drv.rating, trips_count: drv.trips_count, phone: drv.phone } : null,
    passengers
  });
});

app.post('/api/trips', auth, (req, res) => {
  const { from_city, to_city, from_point, to_point, date, time, seats, price, vehicle, options, notes } = req.body;
  if (!from_city || !to_city || !date || !time || !seats || !price)
    return res.status(400).json({ error: 'Plotëso të gjitha fushat e detyrueshme' });

  const data  = db();
  const trip  = {
    id: uid(), driver_id: req.user.id,
    from_city, to_city,
    from_point: from_point || from_city,
    to_point:   to_point   || to_city,
    date, time,
    seats: +seats, seats_available: +seats,
    price: +price,
    vehicle: vehicle || {},
    options: options || {},
    notes: notes || '',
    status: 'active',
    created_at: Date.now()
  };
  data.trips.push(trip);
  const idx = data.users.findIndex(u => u.id === req.user.id);
  if (idx >= 0) data.users[idx].trips_count = (data.users[idx].trips_count || 0) + 1;
  save(data);
  res.json(trip);
});

app.patch('/api/trips/:id/cancel', auth, (req, res) => {
  const data = db();
  const idx  = data.trips.findIndex(t => t.id === req.params.id && t.driver_id === req.user.id);
  if (idx < 0) return res.status(404).json({ error: 'Nuk u gjet' });

  data.trips[idx].status = 'cancelled';
  data.bookings
    .filter(b => b.trip_id === req.params.id && b.status === 'pending')
    .forEach(b => {
      data.bookings.find(x => x.id === b.id).status = 'cancelled';
      notify(b.passenger_id, 'booking_update', { booking_id: b.id, status: 'cancelled' });
    });
  save(data);
  res.json({ ok: true });
});

// ─── BOOKING API ──────────────────────────────────────────────────────────
app.get('/api/bookings/mine', auth, (req, res) => {
  const data = db();
  const result = data.bookings
    .filter(b => b.passenger_id === req.user.id)
    .sort((a, b) => b.created_at - a.created_at)
    .map(b => {
      const trip   = data.trips.find(t => t.id === b.trip_id);
      const drv    = trip ? data.users.find(u => u.id === trip.driver_id) : null;
      const isPaid = b.payment_status === 'paid';
      return {
        ...b,
        trip: trip ? {
          ...trip,
          driver: drv ? { name: drv.name, rating: drv.rating, phone: isPaid ? (drv.phone || '') : null } : null
        } : null
      };
    });
  res.json(result);
});

app.get('/api/trips/:id/requests', auth, (req, res) => {
  const data = db();
  const trip = data.trips.find(t => t.id === req.params.id && t.driver_id === req.user.id);
  if (!trip) return res.status(403).json({ error: 'Nuk keni akses' });

  const result = data.bookings
    .filter(b => b.trip_id === req.params.id)
    .map(b => {
      const p      = data.users.find(u => u.id === b.passenger_id);
      const isPaid = b.payment_status === 'paid';
      return {
        ...b,
        passenger: p ? { id: p.id, name: p.name, rating: p.rating, phone: isPaid ? (p.phone || '') : null } : null
      };
    });
  res.json(result);
});

app.post('/api/bookings', auth, (req, res) => {
  const { trip_id, seats, message } = req.body;
  const data  = db();
  const trip  = data.trips.find(t => t.id === trip_id);

  if (!trip || trip.status !== 'active')
    return res.status(400).json({ error: 'Udëtimi nuk është i disponueshëm' });
  if (trip.driver_id === req.user.id)
    return res.status(400).json({ error: 'Nuk mund të rezervosh udëtimin tënd' });

  const want = parseInt(seats) || 1;
  if (trip.seats_available < want)
    return res.status(400).json({ error: 'Nuk ka vende të mjaftueshme' });

  const dup = data.bookings.find(b =>
    b.trip_id === trip_id && b.passenger_id === req.user.id &&
    ['pending','accepted'].includes(b.status)
  );
  if (dup) return res.status(400).json({ error: 'Ke tashmë një rezervim aktiv' });

  const booking = {
    id: uid(), trip_id,
    passenger_id: req.user.id,
    seats: want,
    status: 'pending',
    message: message || '',
    created_at: Date.now()
  };
  data.bookings.push(booking);
  save(data);

  notify(trip.driver_id, 'new_request', {
    booking_id: booking.id, trip_id,
    passenger: { name: req.user.name },
    seats: want, message: booking.message,
    route: `${trip.from_city} → ${trip.to_city}`,
    date: trip.date
  });
  res.json(booking);
});

app.put('/api/bookings/:id', auth, (req, res) => {
  const { status } = req.body;
  if (!['accepted','refused'].includes(status))
    return res.status(400).json({ error: 'Status i pavlefshëm' });

  const data  = db();
  const bIdx  = data.bookings.findIndex(b => b.id === req.params.id);
  if (bIdx < 0) return res.status(404).json({ error: 'Rezervimi nuk u gjet' });

  const b    = data.bookings[bIdx];
  const trip = data.trips.find(t => t.id === b.trip_id);
  if (!trip || trip.driver_id !== req.user.id)
    return res.status(403).json({ error: 'Nuk keni akses' });
  if (b.status !== 'pending')
    return res.status(400).json({ error: 'Rezervimi nuk është në pritje' });

  data.bookings[bIdx].status = status;

  if (status === 'accepted') {
    const tIdx = data.trips.findIndex(t => t.id === b.trip_id);
    data.trips[tIdx].seats_available = Math.max(0, data.trips[tIdx].seats_available - b.seats);
  }
  save(data);

  notify(b.passenger_id, 'booking_update', {
    booking_id: b.id, status,
    route: `${trip.from_city} → ${trip.to_city}`,
    date: trip.date, time: trip.time,
    driver_name: req.user.name
  });
  res.json({ ok: true });
});

// ─── STRIPE CHECKOUT ──────────────────────────────────────────────────────
app.post('/api/bookings/:id/checkout', auth, async (req, res) => {
  try {
    const data = db();
    const b    = data.bookings.find(b => b.id === req.params.id);
    if (!b)                          return res.status(404).json({ error: 'Rezervimi nuk u gjet' });
    if (b.passenger_id !== req.user.id) return res.status(403).json({ error: 'Nuk keni akses' });
    if (b.status !== 'accepted')     return res.status(400).json({ error: 'Rezervimi duhet të pranohet fillimisht' });
    if (b.payment_status === 'paid') return res.status(400).json({ error: 'Tashmë është paguar' });

    const trip = data.trips.find(t => t.id === b.trip_id);
    const drv  = trip ? data.users.find(u => u.id === trip.driver_id) : null;
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
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── STRIPE WEBHOOK ───────────────────────────────────────────────────────
app.post('/api/stripe/webhook', (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    event = secret
      ? stripe.webhooks.constructEvent(req.rawBody, sig, secret)
      : JSON.parse(req.rawBody?.toString() || '{}');
  } catch(e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const bookingId = event.data.object.metadata?.booking_id;
    if (bookingId) {
      const data = db();
      const bIdx = data.bookings.findIndex(b => b.id === bookingId);
      if (bIdx >= 0 && data.bookings[bIdx].payment_status !== 'paid') {
        data.bookings[bIdx].payment_status = 'paid';
        data.bookings[bIdx].paid_at        = Date.now();
        save(data);

        const b         = data.bookings[bIdx];
        const trip      = data.trips.find(t => t.id === b.trip_id);
        const passenger = data.users.find(u => u.id === b.passenger_id);

        notify(trip?.driver_id, 'payment_confirmed', {
          booking_id:      b.id,
          passenger_name:  passenger?.name  || '',
          passenger_phone: passenger?.phone || '',
          route: trip ? `${trip.from_city} → ${trip.to_city}` : ''
        });
        notify(b.passenger_id, 'payment_success', {
          booking_id: b.id,
          route: trip ? `${trip.from_city} → ${trip.to_city}` : ''
        });
      }
    }
  }

  res.json({ received: true });
});

// ─── MESSAGES API ─────────────────────────────────────────────────────────
app.get('/api/messages/:booking_id', auth, (req, res) => {
  const data    = db();
  const booking = data.bookings.find(b => b.id === req.params.booking_id);
  if (!booking) return res.status(404).json({ error: 'Rezervimi nuk u gjet' });

  const trip    = data.trips.find(t => t.id === booking.trip_id);
  const isParty = booking.passenger_id === req.user.id || trip?.driver_id === req.user.id;
  if (!isParty) return res.status(403).json({ error: 'Nuk keni akses' });

  const messages = (data.messages || [])
    .filter(m => m.booking_id === req.params.booking_id)
    .sort((a, b) => a.created_at - b.created_at);
  res.json(messages);
});

// ─── HEALTH ───────────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  const data = db();
  res.json({ status: 'ok', users: data.users.length, trips: data.trips.length });
});

// ─── SPA FALLBACK (must be last) ──────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.includes('.')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ─── START ────────────────────────────────────────────────────────────────
seed();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🇦🇱  AlbaWay → http://localhost:${PORT}\n`);
  console.log('   Kontet demo: arben@demo.com / demo123\n');
});

module.exports = { server, io };
