'use strict';
/* ═══════════════════════════════════════════════════════
   AlbaWay — SPA 2026
═══════════════════════════════════════════════════════ */

const API = '/api';
let token = localStorage.getItem('bbs_token') || null;
let me; try { me = JSON.parse(localStorage.getItem('bbs_user') || 'null'); } catch(e) { me = null; localStorage.removeItem('bbs_user'); }
let socket = null;

// ─── CITY PHOTOS (Unsplash) ────────────────────────────────────────────────
const CITY_PHOTOS = {
  'zürich':    'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=600&q=75',
  'bern':      'https://images.unsplash.com/photo-1527489377706-5bf97e608852?w=600&q=75',
  'geneva':    'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=75',
  'basel':     'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=75',
  'stuttgart': 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=600&q=75',
  'münchen':   'https://images.unsplash.com/photo-1599982890963-3aabd60064d2?w=600&q=75',
  'frankfurt': 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=600&q=75',
  'berlin':    'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=600&q=75',
  'wien':      'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=600&q=75',
  'london':    'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=75',
  'paris':     'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=75',
  'tirana':    'https://images.unsplash.com/photo-1608501078713-8e445a709b39?w=600&q=75',
  'prishtinë': 'https://images.unsplash.com/photo-1580137189272-c9379f8864fd?w=600&q=75',
  'shkodër':   'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=600&q=75',
  'durrës':    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=75',
  'shkup':     'https://images.unsplash.com/photo-1555990793-da11153b2473?w=600&q=75',
  'default':   'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&q=75',
};
function cityPhoto(city='') {
  return CITY_PHOTOS[city.toLowerCase()] || CITY_PHOTOS.default;
}

// ─── CURSOR ────────────────────────────────────────────────────────────────
let _mx=0,_my=0,_tx=0,_ty=0;
function initCursor() {
  const cur = document.getElementById('cursor');
  const tr  = document.getElementById('cursor-trail');
  if (!cur) return;
  document.addEventListener('mousemove', e => {
    _mx = e.clientX; _my = e.clientY;
    cur.style.transform = `translate(${_mx-5}px,${_my-5}px)`;
  });
  (function loop(){
    _tx += (_mx-_tx)*.1; _ty += (_my-_ty)*.1;
    tr.style.transform = `translate(${_tx-16}px,${_ty-16}px)`;
    requestAnimationFrame(loop);
  })();
  document.addEventListener('mouseover', e => {
    if (e.target.matches('button,a,.tc,.bk-card,.my-tc,.tlc,.bc,.req-card,.ac-item')) {
      cur.style.transform = `translate(${_mx-5}px,${_my-5}px) scale(2.5)`;
      tr.style.opacity = '.4';
    }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.matches('button,a,.tc,.bk-card,.my-tc,.tlc,.bc,.req-card,.ac-item')) {
      cur.style.transform = `translate(${_mx-5}px,${_my-5}px)`;
      tr.style.opacity = '1';
    }
  });
}

// ─── GSAP INIT ─────────────────────────────────────────────────────────────
function initGSAP() {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  document.querySelectorAll('.bc').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX-r.left)/r.width*100)+'%');
      card.style.setProperty('--my', ((e.clientY-r.top)/r.height*100)+'%');
    });
  });
}

// ─── ANIMATIONS ────────────────────────────────────────────────────────────
function animateReveal(container = document) {
  if (!window.gsap) return;
  container.querySelectorAll('.reveal').forEach((el,i) => {
    gsap.fromTo(el,
      { opacity:0, y:40 },
      { opacity:1, y:0, duration:.75, ease:'power3.out',
        delay: (i%4)*.08,
        scrollTrigger:{ trigger:el, start:'top 88%', once:true }
      }
    );
  });
}

function animateHero() {
  if (!window.gsap) return;
  const tl = gsap.timeline({ defaults:{ ease:'power4.out' } });
  tl.from('.hero-badge', { opacity:0, y:20, duration:.6 })
    .from('.hero h1 .h1-white', { opacity:0, y:50, duration:.8 }, '-=.3')
    .from('.hero h1 .h1-red',   { opacity:0, y:50, duration:.8 }, '-=.5')
    .from('.hero-sub',    { opacity:0, y:30, duration:.7 }, '-=.5')
    .from('.search-card', { opacity:0, y:30, scale:.97, duration:.7, ease:'back.out(1.5)' }, '-=.4')
    .from('.hero-stats .hs', { opacity:0, y:20, stagger:.08, duration:.5 }, '-=.3')
    .from('.scroll-hint', { opacity:0, duration:.6 }, '-=.2');
}

function countUp(el, target) {
  if (!window.gsap) { el.textContent = target + (target===98?'%':'+'); return; }
  const suffix = target >= 98 ? '%' : '+';
  gsap.fromTo({v:0},{v:target},{
    v: target, duration:2, ease:'power2.out',
    onUpdate() { el.textContent = Math.round(this.targets()[0].v).toLocaleString() + suffix; }
  });
}

// ─── NAV MAGIC ─────────────────────────────────────────────────────────────
function initNavMagic() {
  const header   = document.getElementById('header');
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks || !header) return;

  // — Pill flottante LERP ——————————————————————————————
  const pill = document.createElement('div');
  pill.className = 'nav-pill';
  navLinks.appendChild(pill);

  let px=0,py=0,pw=0,ph=0, tx=0,ty=0,tw=0,th=0, ready=false;
  (function lerpLoop(){
    px+=(tx-px)*.13; py+=(ty-py)*.13;
    pw+=(tw-pw)*.13; ph+=(th-ph)*.13;
    pill.style.transform=`translate(${px}px,${py}px)`;
    pill.style.width =pw+'px';
    pill.style.height=ph+'px';
    requestAnimationFrame(lerpLoop);
  })();

  [...navLinks.querySelectorAll('a')].forEach(a => {
    a.addEventListener('mouseenter', () => {
      const nr=navLinks.getBoundingClientRect(), lr=a.getBoundingClientRect();
      tx=lr.left-nr.left; ty=lr.top-nr.top; tw=lr.width; th=lr.height;
      if(!ready){ px=tx;py=ty;pw=tw;ph=th; ready=true; }
      pill.style.opacity='1';
    });
    // — Magnétique ——————————————————————————————————————
    a.addEventListener('mousemove', e => {
      const r=a.getBoundingClientRect();
      const dx=(e.clientX-(r.left+r.width/2)) *.28;
      const dy=(e.clientY-(r.top +r.height/2))*.28;
      a.style.transform=`translate(${dx}px,${dy}px)`;
    });
    a.addEventListener('mouseleave',()=>{ a.style.transform=''; });
  });
  navLinks.addEventListener('mouseleave',()=>{ pill.style.opacity='0'; });

  // — Spotlight rouge ——————————————————————————————————
  header.addEventListener('mousemove', e => {
    const r=header.getBoundingClientRect();
    header.style.setProperty('--sx',(e.clientX-r.left)+'px');
    header.style.setProperty('--sop','1');
  });
  header.addEventListener('mouseleave',()=>{ header.style.setProperty('--sop','0'); });

  // — Scroll-aware ———————————————————————————————————————
  let lastY=0;
  window.addEventListener('scroll',()=>{
    const y=window.scrollY;
    header.classList.toggle('scrolled', y>50);
    if(y>lastY+6 && y>130) header.classList.add('nav-hidden');
    else if(y<lastY-6)     header.classList.remove('nav-hidden');
    lastY=y;
  },{passive:true});

  // — Entrée GSAP au chargement ——————————————————————————
  if(window.gsap){
    gsap.from('#header',{ y:-90,opacity:0,duration:.9,ease:'back.out(1.3)',delay:.05 });
    gsap.from('.nav-links a',{ y:-18,opacity:0,stagger:.055,duration:.5,ease:'power3.out',delay:.35 });
  }
}

// ─── INIT ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initCursor();
  initGSAP();
  initNavMagic();
  initSocket();
  updateNav();

  const params = Object.fromEntries(new URLSearchParams(location.search));
  if (params.payment === 'success') {
    setTimeout(() => toast('✅ Pagesa u krye! Tani mund të chatoni me shoferin.','success'), 500);
    history.replaceState({}, '', '/dashboard');
  } else if (params.payment === 'cancel') {
    setTimeout(() => toast('Pagesa u anulua.','info'), 500);
    history.replaceState({}, '', '/dashboard');
  }

  route();
});
window.addEventListener('popstate', route);

// ─── ROUTER ────────────────────────────────────────────────────────────────
function navigate(page, params={}) {
  const qs = new URLSearchParams(params).toString();
  history.pushState({}, '', '/'+page+(qs?'?'+qs:''));
  route();
}
function route() {
  const path   = location.pathname.replace(/^\//,'') || 'home';
  const params = Object.fromEntries(new URLSearchParams(location.search));
  closeModalNow();
  scrollTo(0,0);
  const pages = {
    home:      () => renderHome(),
    search:    () => renderSearch(params),
    publish:   () => renderPublish(),
    dashboard: () => renderDashboard(),
  };
  if (path.startsWith('trip/'))  { renderTripDetail(path.slice(5)); return; }
  if (path.startsWith('reset'))  { renderReset(params.token || ''); return; }
  (pages[path] || renderHome)();
}

// ─── PUSH NOTIFICATIONS ────────────────────────────────────────────────────
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function pushNotif(title, body) {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

// ─── SOCKET ────────────────────────────────────────────────────────────────
function initSocket() {
  if (typeof io === 'undefined') {
    window.addEventListener('load', () => { if (typeof io !== 'undefined') initSocket(); }, { once: true });
    return;
  }
  if (socket) return;
  try { socket = io(); } catch(e) { return; }
  socket.on('connect', () => { if (me && token) socket.emit('identify', { id: me.id, token }); });
  socket.on('new_request', d => {
    showNotif('new_request','🔔 Kërkesë e re!',`${d.passenger.name} → ${d.route}`);
    pushNotif('AlbaWay — Kërkesë e re 🔔', `${d.passenger.name} kërkon vend → ${d.route}`);
  });
  socket.on('booking_update', d => {
    if (d.status==='accepted') {
      showNotif('accepted','✅ Rezervimi u pranua!',`${d.driver_name} · ${d.route||''}`);
      pushNotif('AlbaWay — Rezervim i pranuar ✅', `${d.driver_name} · ${d.route||''}`);
    } else if (d.status==='refused') {
      showNotif('refused','❌ Rezervimi u refuzua',`${d.driver_name}`);
      pushNotif('AlbaWay — Rezervim i refuzuar', `${d.driver_name}`);
    } else {
      showNotif('refused','⚠️ Udhëtimi u anulua','Shoferi anuloi udhëtimin.');
      pushNotif('AlbaWay ⚠️', 'Shoferi anuloi udhëtimin.');
    }
  });
  socket.on('payment_confirmed', d => {
    showNotif('accepted','💳 Pagesa u bë!',`${d.passenger_name} · ${d.route}`);
    pushNotif('AlbaWay — Pagesë e konfirmuar 💳', `${d.passenger_name} pagoi · ${d.route}`);
    loadDriverTab();
  });
  socket.on('payment_success', () => {
    showNotif('accepted','✅ Pagesa u konfirmua!','Tani mund të chatoni me shoferin.');
    pushNotif('AlbaWay — Pagesë e suksesshme ✅', 'Tani mund të chatoni me shoferin.');
    loadPassengerTab();
  });
  socket.on('new_message', msg => {
    const chatMsgs = document.getElementById('chat-msgs');
    if (chatMsgs && window._activeChat?.bookingId === msg.booking_id) {
      const ph = chatMsgs.querySelector('.chat-placeholder');
      if (ph) ph.remove();
      chatMsgs.insertAdjacentHTML('beforeend', chatBubble(msg));
      chatMsgs.scrollTop = chatMsgs.scrollHeight;
    } else if (msg.from_id !== me?.id) {
      showNotif('new_request','💬 Mesazh i ri!', `${msg.from_name}: ${msg.text.slice(0,60)}`);
      pushNotif('AlbaWay — Mesazh i ri 💬', `${msg.from_name}: ${msg.text.slice(0,80)}`);
    }
  });
}

// ─── AUTH ──────────────────────────────────────────────────────────────────
async function apiLogin(email, password) {
  const r = await apiFetch('/login','POST',{email,password});
  token=r.token; me=r.user;
  localStorage.setItem('bbs_token',token);
  localStorage.setItem('bbs_user',JSON.stringify(me));
  socket?.emit('identify', { id: me.id, token });
  requestNotifPermission();
  updateNav(); closeModalNow();
  toast('Mirë se erdhe, '+me.name+'! 🇦🇱','success');
  navigate('home');
}
async function apiRegister(name,email,password,phone) {
  const r = await apiFetch('/register','POST',{name,email,password,phone});
  token=r.token; me=r.user;
  localStorage.setItem('bbs_token',token);
  localStorage.setItem('bbs_user',JSON.stringify(me));
  socket?.emit('identify', { id: me.id, token });
  requestNotifPermission();
  updateNav(); closeModalNow();
  toast('Mirë se vini, '+me.name+'! 🎉','success');
  navigate('dashboard');
}
function logout() {
  token=null; me=null;
  localStorage.removeItem('bbs_token'); localStorage.removeItem('bbs_user');
  updateNav(); toast('U largove me sukses.','info'); navigate('home');
}

// ─── API ───────────────────────────────────────────────────────────────────
async function apiFetch(path, method='GET', body=null) {
  const opts = { method, headers:{'Content-Type':'application/json'} };
  if (token) opts.headers['Authorization']='Bearer '+token;
  if (body)  opts.body = JSON.stringify(body);
  const res  = await fetch(API+path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error||'Gabim serveri');
  return data;
}

// ─── NAV ───────────────────────────────────────────────────────────────────
function updateNav() {
  const ab = document.getElementById('auth-buttons');
  const um = document.getElementById('user-menu');
  if (!ab) return;
  if (me) {
    ab.classList.add('hidden'); um.classList.remove('hidden');
    const ini = document.getElementById('user-initials');
    ini.textContent = initials_(me.name);
    ini.style.background = avatarColor(me.name);
    document.getElementById('user-name-nav').textContent = me.name.charAt(0).toUpperCase() + '.';
  } else {
    ab.classList.remove('hidden'); um.classList.add('hidden');
  }
}

// ─── HOME ──────────────────────────────────────────────────────────────────
async function renderHome() {
  document.getElementById('app').innerHTML = `
  <div class="page">
    <section class="hero">
      <div class="hero-badge"><div class="hero-dot"></div> ${t('hero_badge')}</div>
      <h1>
        <span class="h1-white">${t('hero_h1_1')}</span>
        <span class="h1-red">${t('hero_h1_2')}</span>
      </h1>
      <p class="hero-sub">${t('hero_sub')}</p>
      <div class="search-card">
        <div class="sf"><span class="sf-icon">🔵</span><input id="h-from" placeholder="${t('hero_from')}"/></div>
        <div class="sd"></div>
        <div class="sf"><span class="sf-icon">🔴</span><input id="h-to" placeholder="${t('hero_to')}"/></div>
        <div class="sd"></div>
        <div class="sf"><span class="sf-icon">📅</span><input id="h-date" type="date" min="${today()}"/></div>
        <button class="search-go" onclick="doSearch()">${t('hero_search')}</button>
      </div>
      <div class="hero-stats">
        <div class="hs"><div class="hs-num">18+</div><div class="hs-lbl">${t('stat_cities')}</div></div>
        <div class="hs"><div class="hs-num">CH·DE·AT·UK</div><div class="hs-lbl">Shtete</div></div>
        <div class="hs"><div class="hs-num">Stripe 🔒</div><div class="hs-lbl">Pagesë e sigurt</div></div>
      </div>
      <div class="scroll-hint"><span>${t('scroll')}</span><div class="scroll-bar"></div></div>
    </section>

    <div class="section-wrap" id="trips-home">
      <div class="loading">Duke ngarkuar udhëtimet...</div>
    </div>

    <div class="section-wrap">
      <div class="reveal" style="text-align:center;margin-bottom:48px">
        <div class="section-tag">Si funksionon</div>
        <div class="section-h">Tre hapa, një udhëtim</div>
      </div>
      <div class="bento">
        <div class="bc bc-wide bc-accent reveal">
          <div class="bc-num">01</div><div class="bc-icon">🔍</div>
          <div class="bc-title">Kërko udhëtimin</div>
          <div class="bc-desc">Fut qytetin e nisjes dhe destinacionin. Ne gjejmë shoferin e duhur për ty.</div>
        </div>
        <div class="bc reveal">
          <div class="bc-num">02</div><div class="bc-icon">✋</div>
          <div class="bc-title">Rezervo vendin</div>
          <div class="bc-desc">Dërgo kërkesën — shoferi pranon ose refuzon në kohë reale.</div>
        </div>
        <div class="bc reveal">
          <div class="bc-num">03</div><div class="bc-icon">🤝</div>
          <div class="bc-title">Ndaj kostin</div>
          <div class="bc-desc">Pa komision fshehur. Pagesa direkt te shoferi.</div>
        </div>
        <div class="bc reveal">
          <div class="bc-num">04</div><div class="bc-icon">🚗</div>
          <div class="bc-title">Udhëto rehat</div>
          <div class="bc-desc">Takohu dhe mbërri i lumtur në destinacion.</div>
        </div>
        <div class="bc bc-wide reveal" style="background:rgba(228,30,32,.08);border-color:rgba(228,30,32,.18);display:flex;align-items:center;gap:24px">
          <span style="font-size:3rem">⭐</span>
          <div><div class="bc-title" style="font-size:1.1rem">${t('how_rating')}</div><div class="bc-desc">${t('how_rating_desc')}</div></div>
        </div>
      </div>
    </div>

    <div class="section-wrap">
      <div class="reveal" style="text-align:center;margin-bottom:40px">
        <div class="section-tag">Rrugët tona</div>
        <div class="section-h">Europa drejt Shqipërisë</div>
        <p style="color:var(--muted);margin-top:10px;font-size:.95rem">Rrugët kryesore të diasporës shqiptare</p>
      </div>
      <div class="dest-grid">
        ${[
          {photo:'Geneva',   flag:'🇨🇭', from:'Genève · Zürich · Bern', to:'Prishtinë',       price:'70-90€', qs:['Zürich','Prishtinë']},
          {photo:'München',  flag:'🇩🇪', from:'Stuttgart · München',     to:'Tiranë',           price:'60-80€', qs:['Stuttgart','Tirana']},
          {photo:'Wien',     flag:'🇦🇹', from:'Wien · Graz · Salzburg',  to:'Shkodër · Durrës', price:'55-70€', qs:['Wien','Shkodër']},
          {photo:'London',   flag:'🇬🇧', from:'London',                  to:'Prishtinë',        price:'120-150€',qs:['London','Prishtinë']},
        ].map(d=>`
          <div class="dest-card reveal" onclick="quickSearch('${d.qs[0]}','${d.qs[1]}')">
            <img src="${cityPhoto(d.photo)}" alt="${d.from}" loading="lazy"/>
            <div class="dest-overlay">
              <span class="dest-price-badge">${d.price} / person</span>
              <div class="dest-flag-row">${d.flag}</div>
              <div class="dest-from">${d.from}</div>
              <div class="dest-arrow">→ <span>${d.to}</span></div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <div class="section-wrap" style="text-align:center">
      <div class="reveal" style="background:linear-gradient(135deg,rgba(0,61,130,.35),rgba(228,30,32,.15));border:1px solid rgba(255,255,255,.1);border-radius:28px;padding:72px 32px;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:180px;opacity:.04;pointer-events:none">🇦🇱</div>
        <div class="section-tag">Gati për të filluar?</div>
        <div class="section-h">Bashkohu me komunitetin<br>shqiptar sot</div>
        <p style="color:rgba(255,255,255,.4);margin:12px 0 32px">Falas. I sigurt. I shpejtë.</p>
        <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
          <button onclick="${me?"navigate('publish')":'openModal("register")'}" class="btn-publish" style="width:auto;padding:14px 32px;margin:0">🚗 Publiko udhëtimin</button>
          <button onclick="navigate('search')" class="btn-see-all" style="padding:14px 32px">🔍 Kërko udhëtim</button>
        </div>
      </div>
    </div>
  </div>`;

  animateHero();
  attachAutocomplete('h-from'); attachAutocomplete('h-to');
  document.querySelectorAll('[data-to]').forEach(el => {
    if (!window.gsap) return;
    ScrollTrigger.create({ trigger:el, start:'top 90%', once:true,
      onEnter: () => countUp(el, +el.dataset.to) });
  });

  try {
    const trips = await apiFetch('/trips');
    document.getElementById('trips-home').innerHTML = `
      <div class="section-header-row reveal">
        <div><div class="section-tag">${t('trips_upcoming')}</div><div class="section-h">${t('trips_find')}</div></div>
        <button class="btn-see-all" onclick="navigate('search')">${t('trips_see_all')}</button>
      </div>
      ${trips.length
        ? `<div class="trips-grid">${trips.slice(0,6).map(tripCard).join('')}</div>`
        : `<div class="empty-state"><div class="empty-icon">🚗</div><h3>Nuk ka udhëtime</h3></div>`}`;
    animateReveal();
    initGSAP();
  } catch {
    document.getElementById('trips-home').innerHTML = '';
  }
}

// ─── SEARCH ────────────────────────────────────────────────────────────────
async function renderSearch(params={}) {
  const {from='',to='',date=''} = params;
  document.getElementById('app').innerHTML = `
  <div class="page">
    <div class="section-wrap">
      <div class="search-card reveal" style="max-width:100%;margin-bottom:32px">
        <div class="sf"><span class="sf-icon">🔵</span><input id="s-from" value="${esc(from)}" placeholder="Nga..." list="cl"/></div>
        <div class="sd"></div>
        <div class="sf"><span class="sf-icon">🔴</span><input id="s-to" value="${esc(to)}" placeholder="Drejt..." list="cl"/></div>
        <div class="sd"></div>
        <div class="sf"><span class="sf-icon">📅</span><input id="s-date" type="date" value="${date}" min="${today()}"/></div>
        <button class="search-go" onclick="doSearch()">→</button>
      </div>
      ${cdl()}
      <div id="results"><div class="loading">🔍 Duke kërkuar...</div></div>
    </div>
  </div>`;

  attachAutocomplete('s-from'); attachAutocomplete('s-to');
  try {
    const q = new URLSearchParams();
    if (from) q.set('from',from); if (to) q.set('to',to); if (date) q.set('date',date);
    const trips = await apiFetch('/trips?'+q);
    document.getElementById('results').innerHTML = `
      <div class="section-header-row" style="margin-bottom:24px">
        <div>
          <div class="section-h">${from&&to?esc(from)+' → '+esc(to):'Të gjitha udhëtimet'}</div>
          <p style="color:rgba(255,255,255,.4);margin-top:4px;font-size:.875rem">${trips.length} udhëtim${trips.length!==1?'e':''} i gjetur</p>
        </div>
      </div>
      ${trips.length
        ? `<div class="trips-list">${trips.map(t=>`
            <div class="tlc" onclick="navigate('trip/${t.id}')">
              <div>
                <div class="tlc-route">${esc(t.from_city)} → ${esc(t.to_city)}</div>
                <div class="tlc-meta">
                  <span class="tp">📅 ${fmtDate(t.date)}</span>
                  <span class="tp">🕐 ${esc(t.time)}</span>
                  <span class="tp">💺 ${t.seats_available} vende</span>
                  <span class="tp">${vehicleIcon(t.vehicle?.type)} ${esc(t.vehicle?.brand||'')}</span>
                </div>
                <div class="tlc-driver">
                  <div class="tc-av" style="background:${avatarColor(t.driver?.name||'?')};width:28px;height:28px;font-size:.72rem">${initials_(t.driver?.name||'?')}</div>
                  <span style="font-size:.875rem">${esc(t.driver?.name||'?')}</span>
                  <span style="font-size:.78rem;color:rgba(255,255,255,.4)">⭐ ${t.driver?.rating?.toFixed(1)||''}</span>
                </div>
              </div>
              <div><div class="tlc-price">${t.price}€</div><div class="tlc-psub">/ person</div></div>
              <button class="tlc-btn">Rezervo →</button>
            </div>`).join('')}</div>`
        : `<div class="empty-state"><div class="empty-icon">😕</div><h3>Nuk ka udhëtime</h3><p>Provo datë tjetër ose destinacion tjetër.</p>
           <button onclick="navigate('publish')" class="btn-publish" style="width:auto;padding:14px 28px;margin-top:24px">+ Publiko udhëtimin tënd</button></div>`}`;
    animateReveal();
  } catch(e) {
    document.getElementById('results').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${esc(e.message)}</h3></div>`;
  }
}

// ─── TRIP DETAIL ───────────────────────────────────────────────────────────
async function renderTripDetail(id) {
  document.getElementById('app').innerHTML = `<div class="page"><div class="detail-page"><div class="loading">Duke ngarkuar...</div></div></div>`;
  try {
    const t   = await apiFetch('/trips/'+id);
    const drv = t.driver;
    const isOwn = me && me.id === t.driver_id;
    const opts = [
      {k:'luggage',i:'🧳',l:'Bagazh i lejuar'},
      {k:'music',  i:'🎵',l:'Muzikë'},
      {k:'ac',     i:'❄️',l:'Klimë (A/C)'},
      {k:'pets',   i:'🐾',l:'Kafshe shtëpiake'},
      {k:'smoking',i:'🚬',l:'Duhanpirje'},
    ];
    document.getElementById('app').innerHTML = `
    <div class="page">
      <div class="detail-page">
        <a class="back-link" href="#" onclick="history.back();return false">← Kthehu</a>
        <div class="detail-grid">
          <div class="detail-col">
            <div class="glass-card reveal">
              <h3>📍 Itinerari</h3>
              <div class="route-tl">
                <div class="tl-line"><div class="tl-dot-top"></div><div class="tl-bar"></div><div class="tl-dot-bot"></div></div>
                <div class="tl-labels">
                  <div><div class="tl-city">${esc(t.time)} — ${esc(t.from_city)}</div><div class="tl-point">${esc(t.from_point)}</div></div>
                  <div class="tl-date-badge">📅 ${fmtDate(t.date)}</div>
                  <div><div class="tl-city">${esc(t.to_city)}</div><div class="tl-point">${esc(t.to_point)}</div></div>
                </div>
              </div>
              ${t.notes?`<div class="notes-box">💬 ${esc(t.notes)}</div>`:''}
            </div>
            <div class="glass-card reveal">
              <h3>🚗 Automjeti</h3>
              <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px">
                <span style="font-size:2.5rem">${vehicleIcon(t.vehicle?.type)}</span>
                <div><div style="font-size:1.1rem;font-weight:700">${esc(t.vehicle?.brand||'')} ${esc(t.vehicle?.model||'')}</div>
                <div style="color:rgba(255,255,255,.45);font-size:.875rem;margin-top:2px">${esc(t.vehicle?.color||'')}</div></div>
              </div>
              <div class="opts-grid">${opts.map(o=>`
                <div class="opt-item ${t.options?.[o.k]?'opt-on':'opt-off'}">
                  <span>${o.i}</span><span style="flex:1;font-size:.82rem">${o.l}</span>
                  <span>${t.options?.[o.k]?'✅':'❌'}</span>
                </div>`).join('')}</div>
            </div>
            ${(t.passengers_count > 0 || t.passengers?.length > 0)?`
            <div class="glass-card reveal">
              <h3>👥 Pasagjerë</h3>
              ${t.passengers?.length?
                t.passengers.map(p=>`
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                  <div class="tc-av" style="background:${avatarColor(p.name)};width:36px;height:36px;font-size:.85rem">${initials_(p.name)}</div>
                  <span style="font-weight:600">${esc(p.name)}</span>
                  <span style="color:rgba(255,255,255,.4);font-size:.8rem">⭐${p.rating?.toFixed(1)}</span>
                </div>`).join(''):
                `<div style="color:rgba(255,255,255,.45);font-size:.85rem">🔒 ${t.passengers_count} vend(e) të rezervuar(a)</div>`
              }
            </div>`:''}
          </div>
          <div class="detail-col">
            <div class="glass-card driver-card-big reveal">
              <div class="drv-av-big" style="background:${avatarColor(drv?.name||'?')}">${initials_(drv?.name||'?')}</div>
              <div class="drv-name">${esc(drv?.name||'Shofer')}</div>
              <div class="drv-rate">⭐ ${drv?.rating?.toFixed(1)||''}</div>
              <div class="drv-stats">
                <div><div class="drv-stat-v">${drv?.trips_count||0}</div><div class="drv-stat-l">Udhëtime</div></div>
                <div><div class="drv-stat-v">${t.seats}</div><div class="drv-stat-l">Vende</div></div>
                <div><div class="drv-stat-v">${t.seats_available}</div><div class="drv-stat-l">Lirë</div></div>
              </div>
            </div>
            <div class="glass-card reveal">
              <div class="book-price-row">
                <div><div class="book-price-big">${t.price}€</div><div style="font-size:.78rem;color:rgba(255,255,255,.4)">për person</div></div>
                <span class="badge ${t.seats_available>0?'badge-active':'badge-refused'}">${t.seats_available} vende</span>
              </div>
              <div id="book-area">${bookArea(t,isOwn)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    animateReveal();
  } catch(e) {
    document.getElementById('app').innerHTML = `<div class="page"><div class="detail-page"><div class="empty-state"><div class="empty-icon">⚠️</div><h3>${esc(e.message)}</h3></div></div></div>`;
  }
}

function bookArea(t, isOwn) {
  if (t.status !== 'active') return `<div class="book-status err">🚫 Udhëtimi u anulua</div>`;
  if (isOwn) return `<div style="text-align:center;margin-bottom:12px;color:rgba(255,255,255,.4);font-size:.875rem">Ky është udhëtimi juaj.</div>
    <button onclick="navigate('dashboard')" class="btn-book" style="background:rgba(0,86,179,.5);box-shadow:none">Menaxho →</button>`;
  if (t.seats_available===0) return `<div class="book-status err">😕 Plotë — nuk ka vende</div>`;
  if (!me) return `<div style="text-align:center;margin-bottom:12px;color:rgba(255,255,255,.4);font-size:.875rem">Hyni për të rezervuar.</div>
    <button onclick="openModal('login')" class="btn-book">Hyr dhe Rezervo</button>`;
  return `<div class="book-seats">Dërgoni kërkesën — shoferi pranon ose refuzon.</div>
    <textarea class="book-ta" id="book-msg" placeholder="Mesazh opsional..."></textarea>
    <button class="btn-book" onclick="doBook('${t.id}')">✋ Kërko vendin — ${t.price}€</button>`;
}

async function doBook(tripId) {
  const msg = document.getElementById('book-msg')?.value||'';
  try {
    await apiFetch('/bookings','POST',{trip_id:tripId,seats:1,message:msg});
    document.getElementById('book-area').innerHTML = `<div class="book-status ok">✅ Kërkesa u dërgua! Prit përgjigjen.</div>`;
  } catch(e) {
    document.getElementById('book-area').insertAdjacentHTML('beforeend',`<div class="book-status err" style="margin-top:10px">❌ ${esc(e.message)}</div>`);
  }
}

// ─── PUBLISH ───────────────────────────────────────────────────────────────
function renderPublish() {
  if (!me) { openModal('login'); return; }
  const VTYPES = [{v:'car',i:'🚗',l:'Veturë'},{v:'minivan',i:'🚐',l:'Minivan'},{v:'suv',i:'🚙',l:'SUV'},{v:'bus',i:'🚌',l:'Autobus'}];
  const OPTS   = [{k:'luggage',i:'🧳',l:'Bagazh'},{k:'music',i:'🎵',l:'Muzikë'},{k:'ac',i:'❄️',l:'Klimë'},{k:'pets',i:'🐾',l:'Kafshe'},{k:'smoking',i:'🚬',l:'Duhanpirje'}];
  document.getElementById('app').innerHTML = `
  <div class="page">
    <div class="publish-wrap">
      <div class="pub-title">🚗 Publiko udhëtimin</div>
      <div class="pub-sub">Plotëso të dhënat dhe gjej pasagjerë!</div>
      <div class="glass-card reveal" style="margin-bottom:16px">
        <h3>📍 Itinerari *</h3>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Nga *</label><input class="form-input" id="p-from" placeholder="Zürich" list="cl"/></div>
          <div class="form-group"><label class="form-label">Drejt *</label><input class="form-input" id="p-to" placeholder="Prishtinë" list="cl"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Pika nisjes</label><input class="form-input" id="p-fp" placeholder="Zürich HB"/></div>
          <div class="form-group"><label class="form-label">Pika mbërritjes</label><input class="form-input" id="p-tp" placeholder="Prishtinë Qendër"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Data *</label><input class="form-input" id="p-date" type="date" min="${today()}"/></div>
          <div class="form-group"><label class="form-label">Ora *</label><input class="form-input" id="p-time" type="time" value="06:00"/></div>
        </div>
        ${cdl()}
      </div>
      <div class="glass-card reveal" style="margin-bottom:16px">
        <h3>🚗 Automjeti & Çmimi *</h3>
        <div class="opt-toggle" style="margin-bottom:20px">
          ${VTYPES.map(vt=>`<div class="ot-item" id="vt-${vt.v}" onclick="selVT('${vt.v}')"><span>${vt.i}</span><span style="font-size:.85rem">${vt.l}</span></div>`).join('')}
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Marka</label><input class="form-input" id="p-brand" placeholder="Mercedes, BMW..."/></div>
          <div class="form-group"><label class="form-label">Modeli</label><input class="form-input" id="p-model" placeholder="E-Class, Passat..."/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Ngjyra</label><input class="form-input" id="p-color" placeholder="E zezë, E bardhë..."/></div>
          <div class="form-group"><label class="form-label">Çmimi (€) *</label><input class="form-input" id="p-price" type="number" min="1" placeholder="80"/></div>
        </div>
        <div class="form-group">
          <label class="form-label">Vende *</label>
          <div class="seats-row">${[1,2,3,4,5,6,7,8].map(n=>`<button class="seat-btn ${n===3?'on':''}" id="sb-${n}" onclick="selSeat(${n})">${n}</button>`).join('')}</div>
        </div>
      </div>
      <div class="glass-card reveal" style="margin-bottom:20px">
        <h3>⚙️ Opsionet</h3>
        <div class="opt-toggle">
          ${OPTS.map(o=>`<div class="ot-item ${o.k==='luggage'||o.k==='music'||o.k==='ac'?'on':''}" id="oi-${o.k}" onclick="togOpt('${o.k}')"><span>${o.i}</span><span style="font-size:.85rem">${o.l}</span></div>`).join('')}
        </div>
        <div class="form-group" style="margin-top:20px">
          <label class="form-label">Shënime shtesë</label>
          <textarea class="form-textarea" id="p-notes" placeholder="Ndalojmë në Salzburg, Ferry Ancona-Durrës..."></textarea>
        </div>
      </div>
      <button class="btn-publish" onclick="doPublish()">🇦🇱 Publiko udhëtimin</button>
    </div>
  </div>`;
  animateReveal();
  selVT('car');
  attachAutocomplete('p-from'); attachAutocomplete('p-to');
}

let _curVT='car', _curSeats=3;
function selVT(v){ _curVT=v; document.querySelectorAll('[id^=vt-]').forEach(el=>el.classList.toggle('on',el.id==='vt-'+v)); }
function selSeat(n){ _curSeats=n; document.querySelectorAll('[id^=sb-]').forEach(el=>el.classList.toggle('on',el.id==='sb-'+n)); }
function togOpt(k){ document.getElementById('oi-'+k)?.classList.toggle('on'); }

async function doPublish() {
  const v = id => document.getElementById(id)?.value?.trim()||'';
  const from=v('p-from'),to=v('p-to'),date=v('p-date'),time=v('p-time'),price=v('p-price');
  if (!from||!to||!date||!time||!price) { toast('Plotëso fushat e detyrueshme *','error'); return; }
  const options={};
  ['luggage','music','ac','pets','smoking'].forEach(k=>{options[k]=document.getElementById('oi-'+k)?.classList.contains('on')||false;});
  try {
    const t = await apiFetch('/trips','POST',{
      from_city:from,to_city:to,from_point:v('p-fp'),to_point:v('p-tp'),
      date,time,seats:_curSeats,price:+price,
      vehicle:{type:_curVT,brand:v('p-brand'),model:v('p-model'),color:v('p-color')},
      options,notes:v('p-notes')
    });
    toast('✅ Udhëtimi u publikua!','success');
    navigate('trip/'+t.id);
  } catch(e) { toast(e.message,'error'); }
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
async function renderDashboard() {
  if (!me) { openModal('login'); return; }
  document.getElementById('app').innerHTML = `
  <div class="page">
    <div class="dash-wrap">
      <div class="dash-profile reveal">
        <div class="dash-av" style="background:${avatarColor(me.name)}">${initials_(me.name)}</div>
        <div style="flex:1">
          <div class="dash-name">${esc(me.name)}</div>
          <div class="dash-sub">📧 ${esc(me.email)}${me.phone?' · 📞 '+esc(me.phone):''}</div>
          <div class="dash-sub" style="margin-top:4px">⭐ ${me.rating?.toFixed(1)} · ${me.trips_count} udhëtime si shofer</div>
        </div>
        <button onclick="logout()" class="btn-cancel-t">Dil</button>
      </div>
      <div class="tabs">
        <button class="tab-btn on" id="tb-d" onclick="swTab('d')">${t('dash_driver')}</button>
        <button class="tab-btn"    id="tb-p" onclick="swTab('p')">${t('dash_passenger')}</button>
      </div>
      <div id="tp-d" class="tab-pane on"><div class="loading">${t('trips_loading')}</div></div>
      <div id="tp-p" class="tab-pane"><div class="loading">${t('trips_loading')}</div></div>
    </div>
  </div>`;
  animateReveal();
  loadDriverTab(); loadPassengerTab();
}
function swTab(t) {
  ['d','p'].forEach(x=>{
    document.getElementById('tb-'+x)?.classList.toggle('on',x===t);
    document.getElementById('tp-'+x)?.classList.toggle('on',x===t);
  });
}
async function loadDriverTab() {
  const p = document.getElementById('tp-d'); if (!p) return;
  try {
    const trips = await apiFetch('/trips/mine');
    if (!trips.length) { p.innerHTML=`<div class="empty-state"><div class="empty-icon">🚗</div><h3>${t('dash_no_trips')}</h3><p>${t('dash_no_trips_sub')}</p><button onclick="navigate('publish')" class="btn-publish" style="width:auto;padding:12px 24px;margin-top:20px">${t('dash_pub_now')}</button></div>`; return; }
    p.innerHTML = trips.map(t=>`
      <div class="my-tc">
        <div onclick="navigate('trip/${t.id}')" style="cursor:none;flex:1">
          <div class="my-tc-route">${esc(t.from_city)} → ${esc(t.to_city)}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
            <span class="tp">📅 ${fmtDate(t.date)} ${esc(t.time)}</span>
            <span class="tp">💶 ${t.price}€</span>
            <span class="tp">💺 ${t.seats_available}/${t.seats}</span>
            ${t.status!=='active'?`<span class="badge badge-refused">Anuluar</span>`:''}
          </div>
          ${t.pending_requests>0?`<div class="badge badge-pending" style="display:inline-block;margin-top:8px">⏳ ${t.pending_requests} kërkesë në pritje</div>`:''}
        </div>
        <div class="my-tc-actions">
          <button class="btn-see-all" onclick="navigate('trip/${t.id}')">Shiko</button>
          ${t.status==='active'?`
          <button class="btn-manage" onclick="showReqs('${t.id}','${esc(t.from_city)} → ${esc(t.to_city)}')">Kërkesat (${(t.pending_requests||0)+(t.accepted_passengers||0)})</button>
          <button class="btn-cancel-t" onclick="cancelT('${t.id}')">Anulo</button>`:''}
        </div>
      </div>`).join('');
  } catch(e) { p.innerHTML=`<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${esc(e.message)}</h3></div>`; }
}
async function loadPassengerTab() {
  const p = document.getElementById('tp-p'); if (!p) return;
  try {
    const books = await apiFetch('/bookings/mine');
    if (!books.length) { p.innerHTML=`<div class="empty-state"><div class="empty-icon">🎒</div><h3>${t('dash_no_bookings')}</h3><p>${t('dash_no_bookings_sub')}</p></div>`; return; }
    p.innerHTML = books.map(b=>{
      const st = {accepted:`badge-accepted ${t('st_accepted')}`,pending:`badge-pending ${t('st_pending')}`,refused:`badge-refused ${t('st_refused')}`,cancelled:`badge-cancelled ${t('st_cancelled')}`}[b.status]||'badge-pending';
      const [bc,...bl] = st.split(' ');
      return `<div class="bk-card" onclick="navigate('trip/${b.trip_id}')" style="cursor:none">
        <div class="bk-top">
          <div><div class="bk-route">${esc(b.trip?.from_city||'?')} → ${esc(b.trip?.to_city||'?')}</div>
          <div style="color:rgba(255,255,255,.4);font-size:.82rem;margin-top:4px">📅 ${fmtDate(b.trip?.date)} · ${esc(b.trip?.time||'')} · ${b.trip?.price||0}€ · ${esc(b.trip?.driver?.name||'?')}</div></div>
          <span class="badge ${bc}">${bl.join(' ')}</span>
        </div>
        ${b.status==='accepted' && b.payment_status==='paid' ? `
        <button onclick="event.stopPropagation();openChat('${b.id}','${b.trip?.driver_id||''}','${esc(b.trip?.driver?.name||'Shofer')}')"
          style="margin-top:12px;width:100%;background:linear-gradient(135deg,rgba(0,61,130,.5),rgba(0,61,130,.3));border:1px solid rgba(0,122,255,.35);color:#fff;padding:10px;border-radius:12px;font-size:.85rem;font-weight:700;letter-spacing:.3px;display:flex;align-items:center;justify-content:center;gap:7px">
          💬 ${t('chat_driver')}
        </button>` : ''}
        ${b.status==='accepted' && b.payment_status!=='paid' ? `
        <div style="margin-top:10px;width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.3);padding:9px;border-radius:10px;font-size:.8rem;text-align:center">
          🔒 Chat disponueshëm pas pagesës
        </div>` : ''}
        ${b.status==='accepted' && b.payment_status!=='paid' ? `
        <div style="background:rgba(0,61,130,.15);border:1px solid rgba(0,61,130,.35);border-radius:12px;padding:14px 16px;margin-top:12px">
          <div style="font-size:.8rem;color:rgba(255,255,255,.55);margin-bottom:10px">✅ Rezervimi u pranua! Paguaj për të hapur chatin me shoferin.</div>
          <button onclick="event.stopPropagation();doPay('${b.id}')" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:10px 0;border-radius:10px;font-size:.875rem;font-weight:700;width:100%;cursor:none">
            💳 Paguaj ${b.trip?.price||0}€ — Hap chatin
          </button>
        </div>` : ''}
        ${b.message?`<div style="color:rgba(255,255,255,.35);font-size:.8rem;font-style:italic;margin-top:8px">"${esc(b.message)}"</div>`:''}
        ${b.status==='accepted' && !b.rated && isPast(b.trip?.date) ? `
          <div style="margin-top:14px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:14px">
            <div style="font-size:.82rem;font-weight:700;color:#fbbf24;margin-bottom:10px">⭐ Vlerëso shoferin</div>
            <div id="stars-${b.id}" style="display:flex;gap:6px;margin-bottom:10px">
              ${[1,2,3,4,5].map(s=>`<button onclick="setStar('${b.id}',${s})" id="star-${b.id}-${s}" style="font-size:1.5rem;background:none;color:rgba(255,255,255,.2);transition:all .15s;line-height:1">☆</button>`).join('')}
            </div>
            <input id="rc-${b.id}" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 12px;color:#fff;font-size:.82rem;margin-bottom:8px" placeholder="Koment opsional..."/>
            <button onclick="submitRating('${b.id}')" style="background:rgba(245,158,11,.2);border:1px solid rgba(245,158,11,.3);color:#fbbf24;padding:7px 16px;border-radius:8px;font-size:.82rem;font-weight:700">Dërgo vlerësimin</button>
          </div>` : b.rated ? `<div style="margin-top:10px;font-size:.8rem;color:rgba(255,255,255,.3)">✅ Vlerësimi u dërgua</div>` : ''}
      </div>`;
    }).join('');
  } catch(e) { p.innerHTML=`<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${esc(e.message)}</h3></div>`; }
}
async function showReqs(tripId, route) {
  const reqs = await apiFetch('/trips/'+tripId+'/requests');
  openModalHTML(`
    <button class="modal-close" onclick="closeModalNow()">✕</button>
    <div class="modal-title">Kërkesat · <span style="font-size:1rem;font-weight:400;color:rgba(255,255,255,.5)">${esc(route)}</span></div>
    ${!reqs.length?'<div class="empty-state" style="padding:24px"><div class="empty-icon">📭</div><h3>Nuk ka kërkesa</h3></div>':reqs.map(r=>`
      <div class="req-card">
        <div class="req-av" style="background:${avatarColor(r.passenger?.name||'?')}">${initials_(r.passenger?.name||'?')}</div>
        <div style="flex:1">
          <div style="font-weight:700">${esc(r.passenger?.name||'?')}</div>
          <div style="font-size:.78rem;color:rgba(255,255,255,.4)">⭐${r.passenger?.rating?.toFixed(1)} · ${r.seats} vend(e)</div>
          ${r.message?`<div style="font-size:.8rem;font-style:italic;color:rgba(255,255,255,.4);margin-top:4px">"${esc(r.message)}"</div>`:''}
        </div>
        <span class="badge ${{accepted:'badge-accepted',refused:'badge-refused',pending:'badge-pending',cancelled:'badge-cancelled'}[r.status]||'badge-pending'}">${{accepted:'✅ Pranuar',refused:'❌ Refuzuar',pending:'⏳ Pritje',cancelled:'🚫 Anuluar'}[r.status]||r.status}</span>
        ${r.status==='pending'?`<div style="display:flex;gap:6px">
          <button class="btn-accept" onclick="respBook('${r.id}','accepted','${tripId}','${esc(route)}')">✅ Prano</button>
          <button class="btn-refuse" onclick="respBook('${r.id}','refused','${tripId}','${esc(route)}')">❌ Refuzo</button>
        </div>`:''}
        ${r.status==='accepted' && r.payment_status==='paid' ? `
        <button onclick="openChat('${r.id}','${r.passenger?.id||''}','${esc(r.passenger?.name||'Pasagjer')}')"
          style="margin-top:10px;width:100%;background:linear-gradient(135deg,rgba(0,61,130,.5),rgba(0,61,130,.3));border:1px solid rgba(0,122,255,.35);color:#fff;padding:9px;border-radius:12px;font-size:.82rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:7px">
          💬 Chato me pasagjerin
        </button>` : ''}
        ${r.status==='accepted' && r.payment_status!=='paid' ? `
        <div style="margin-top:8px;width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.3);padding:8px;border-radius:9px;font-size:.78rem;text-align:center">
          🔒 Chat disponueshëm pas pagesës së pasagjerit
        </div>` : ''}
      </div>`).join('')}`);
}
async function respBook(bid, status, tripId, route) {
  try {
    await apiFetch('/bookings/'+bid,'PUT',{status});
    toast(status==='accepted'?'✅ Pranuar!':'Refuzuar.', status==='accepted'?'success':'info');
    closeModalNow(); loadDriverTab();
    if (status==='accepted') showReqs(tripId, route);
  } catch(e) { toast(e.message,'error'); }
}
async function cancelT(id) {
  if (!confirm('Anulo udhëtimin?')) return;
  try { await apiFetch('/trips/'+id+'/cancel','PATCH'); toast('Udhëtimi u anulua.','info'); loadDriverTab(); }
  catch(e) { toast(e.message,'error'); }
}

// ─── MODALS ────────────────────────────────────────────────────────────────
function openModal(type) {
  if (type==='login') {
    openModalHTML(`
      <button class="modal-close" onclick="closeModalNow()">✕</button>
      <div class="modal-title">Mirëseerdhe 🇦🇱</div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="li-e" type="email" placeholder="email@example.com" autofocus/></div>
      <div class="form-group"><label class="form-label">Fjalëkalimi</label><input class="form-input" id="li-p" type="password" placeholder="••••••••" onkeydown="if(event.key==='Enter')doLogin()"/></div>
      <div id="login-info" style="display:none;margin:8px 0 4px;padding:10px 14px;background:rgba(228,30,32,.1);border:1px solid rgba(228,30,32,.3);border-radius:10px;font-size:.82rem;color:#f87171"></div>
      <button class="modal-submit" onclick="doLogin()">Hyr →</button>
      <p class="modal-switch" style="margin-top:8px"><a onclick="openForgotPassword()" style="color:rgba(255,255,255,.4);font-size:.82rem">🔑 Fjalëkalim i harruar?</a></p>
      <p class="modal-switch">Nuk ke llogari? <a onclick="openModal('register')">Regjistrohu</a></p>`);
  } else {
    openModalHTML(`
      <button class="modal-close" onclick="closeModalNow()">✕</button>
      <div class="modal-title">Krijo llogarinë 🎉</div>
      <div class="form-group"><label class="form-label">Emri i plotë *</label><input class="form-input" id="rg-n" placeholder="Arben Krasniqi" autofocus/></div>
      <div class="form-group"><label class="form-label">Email *</label><input class="form-input" id="rg-e" type="email" placeholder="email@example.com"/></div>
      <div class="form-group"><label class="form-label">Telefoni</label><input class="form-input" id="rg-ph" placeholder="+41 79 ..."/></div>
      <div class="form-group"><label class="form-label">Fjalëkalimi *</label><input class="form-input" id="rg-p" type="password" placeholder="••••••••"/></div>
      <button class="modal-submit" onclick="doRegister()">Regjistrohu falas</button>
      <p class="modal-switch">Ke llogari? <a onclick="openModal('login')">Hyr</a></p>`);
  }
}
function openModalHTML(h) { document.getElementById('modal-box').innerHTML=h; document.getElementById('modal-overlay').classList.remove('hidden'); }
function closeModal(e) { if (e.target===document.getElementById('modal-overlay')) closeModalNow(); }
function closeModalNow() { document.getElementById('modal-overlay').classList.add('hidden'); }
async function doLogin() {
  const e=document.getElementById('li-e')?.value?.trim(), p=document.getElementById('li-p')?.value;
  if (!e||!p) { toast('Plotëso fushat','error'); return; }
  try {
    await apiLogin(e,p);
  } catch(err) {
    toast(err.message,'error');
    if (err.message.includes('bllokua') || err.message.includes('bllokuar')) {
      const info = document.getElementById('login-info');
      if (info) {
        info.innerHTML = '📧 Kontrollo emailin tënd — një link rimëkëmbjeje u dërgua.';
        info.style.display = 'block';
      }
    }
  }
}
async function doRegister() {
  const n=document.getElementById('rg-n')?.value?.trim(), e=document.getElementById('rg-e')?.value?.trim(),
        p=document.getElementById('rg-p')?.value, ph=document.getElementById('rg-ph')?.value?.trim();
  if (!n||!e||!p) { toast('Plotëso fushat e detyrueshme','error'); return; }
  try { await apiRegister(n,e,p,ph); } catch(err) { toast(err.message,'error'); }
}

// ─── SEARCH HELPERS ────────────────────────────────────────────────────────
function doSearch() {
  const from = (document.getElementById('h-from')||document.getElementById('s-from'))?.value?.trim()||'';
  const to   = (document.getElementById('h-to')  ||document.getElementById('s-to'))?.value?.trim()||'';
  const date = (document.getElementById('h-date') ||document.getElementById('s-date'))?.value||'';
  navigate('search',{from,to,date});
}
function quickSearch(f,t) { navigate('search',{from:f,to:t}); }

// ─── CARD ──────────────────────────────────────────────────────────────────
function tripCard(t) {
  const img = cityPhoto(t.from_city);
  return `
  <div class="tc reveal" onclick="navigate('trip/${t.id}')">
    <div class="tc-img">
      <img src="${img}" alt="${esc(t.from_city)}" loading="lazy"/>
      <div class="tc-overlay"></div>
      <span class="tc-price">${t.price}€</span>
    </div>
    <div class="tc-body">
      <div class="tc-route">${esc(t.from_city)}<span class="tc-arr">→</span>${esc(t.to_city)}</div>
      <div class="tc-pills">
        <span class="tp">📅 ${fmtDate(t.date)}</span>
        <span class="tp">🕐 ${esc(t.time)}</span>
        <span class="tp">💺 ${t.seats_available} vende</span>
      </div>
      <div class="tc-footer">
        <div class="tc-av" style="background:${avatarColor(t.driver?.name||'?')}">${initials_(t.driver?.name||'?')}</div>
        <div><div class="tc-dname">${esc(t.driver?.name||'?')}</div><div class="tc-drate">⭐ ${t.driver?.rating?.toFixed(1)||''}</div></div>
        <button class="tc-btn">Rezervo</button>
      </div>
    </div>
  </div>`;
}

// ─── NOTIF & TOAST ─────────────────────────────────────────────────────────
function showNotif(type, title, body) {
  const b = document.getElementById('notif-banner');
  b.className = 'notif-banner '+type;
  b.innerHTML = `<button class="notif-close" onclick="this.parentElement.classList.add('hidden')">✕</button>
    <div class="notif-title">${esc(title)}</div><div class="notif-body">${esc(body)}</div>`;
  b.classList.remove('hidden');
  setTimeout(()=>b.classList.add('hidden'), 8000);
}
let _tt;
function toast(msg, type='info') {
  const el = document.getElementById('toast');
  el.textContent=msg; el.className='toast '+type;
  clearTimeout(_tt); _tt=setTimeout(()=>el.classList.add('hidden'), 4000);
}
function toggleMobileNav() { document.getElementById('mobile-nav').classList.toggle('hidden'); }

// ─── UTILS ─────────────────────────────────────────────────────────────────
const AV_COLORS=['#003D82','#E41E20','#0056b3','#533483','#059669','#0284c7','#7c3aed','#b45309'];
function avatarColor(n='') { let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))>>>0; return AV_COLORS[h%AV_COLORS.length]; }
function initials_(n='') { return n.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase(); }
function fmtDate(d='') { if(!d) return ''; const [y,m,day]=d.split('-'); const mo=['Jan','Shk','Mar','Pri','Maj','Qer','Kor','Gus','Sht','Tet','Nën','Dhj']; return `${+day} ${mo[+m-1]} ${y}`; }
function today() { return new Date().toISOString().slice(0,10); }
function esc(s='') { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function vehicleIcon(t) { return {car:'🚗',minivan:'🚐',suv:'🚙',bus:'🚌'}[t]||'🚗'; }
const CITIES_ALL = [
  'Zürich','Bern','Geneva','Basel','Stuttgart','München','Frankfurt','Berlin',
  'Wien','Salzburg','London','Paris','Milano','Brussels','Amsterdam','Lyon',
  'Tirana','Durrës','Shkodër','Vlorë','Gjirokastër','Korçë','Berat','Elbasan','Fier','Lushnjë',
  'Prishtinë','Mitrovicë','Pejë','Gjakovë','Gjilan','Ferizaj','Vushtrri',
  'Shkup','Tetovë','Bitola','Ohrid',
  'Beograd','Zagreb','Ljubljana','Sarajevo','Podgorica'
];

const CITY_ALIASES = {
  'zurich':'Zürich','zuerich':'Zürich','zurigo':'Zürich',
  'munich':'München','munchen':'München','muenchen':'München',
  'geneve':'Geneva','genf':'Geneva','genève':'Geneva','ginebra':'Geneva',
  'vienna':'Wien','vienne':'Wien',
  'berne':'Bern',
  'pristina':'Prishtinë','prishtina':'Prishtinë','kosova':'Prishtinë','kosovo':'Prishtinë',
  'tirane':'Tirana','tiranë':'Tirana',
  'durres':'Durrës','durresso':'Durrës',
  'shkoder':'Shkodër','scutari':'Shkodër',
  'vlore':'Vlorë','vlora':'Vlorë','valona':'Vlorë',
  'gjirokaster':'Gjirokastër','gjirokastra':'Gjirokastër','argyrokastron':'Gjirokastër',
  'korce':'Korçë','korça':'Korçë',
  'mitrovica':'Mitrovicë',
  'peja':'Pejë','pec':'Pejë','peć':'Pejë',
  'gjakova':'Gjakovë','djakovica':'Gjakovë',
  'gnjilane':'Gjilan',
  'skopje':'Shkup','uskup':'Shkup',
  'tetovo':'Tetovë',
  'bruxelles':'Brussels','brussel':'Brussels',
  'milan':'Milano','mailand':'Milano',
  'belgrade':'Beograd',
};

function normalizeCity(s) {
  return s.toLowerCase()
    .replace(/[àáâã]/g,'a').replace(/ä/g,'a').replace(/å/g,'a')
    .replace(/[èéêë]/g,'e').replace(/ë/g,'e')
    .replace(/[ìíîï]/g,'i').replace(/[òóôõ]/g,'o').replace(/ö/g,'o')
    .replace(/[ùúûü]/g,'u').replace(/ü/g,'u')
    .replace(/ç/g,'c').replace(/ñ/g,'n').replace(/ß/g,'ss')
    .trim();
}

function cityMatch(query) {
  const q = normalizeCity(query);
  if (q.length < 2) return [];
  const alias = CITY_ALIASES[q];
  const results = CITIES_ALL.filter(c => normalizeCity(c).includes(q) || c.toLowerCase().includes(query.toLowerCase()));
  if (alias && !results.includes(alias)) results.unshift(alias);
  return [...new Set(results)].slice(0, 7);
}

function attachAutocomplete(inputId) {
  const input = document.getElementById(inputId);
  if (!input || input.dataset.ac) return;
  input.dataset.ac = '1';
  input.removeAttribute('list');
  const wrap = input.closest('.sf') || input.parentNode;
  wrap.style.position = 'relative';
  const drop = document.createElement('div');
  drop.className = 'ac-drop'; drop.id = 'acd-'+inputId;
  wrap.appendChild(drop);

  function renderItems(m) {
    drop.innerHTML = m.length && input.value
      ? m.map(c => `<div class="ac-item">${esc(c)}</div>`).join('')
      : '';
    drop.querySelectorAll('.ac-item').forEach(item => {
      item.addEventListener('pointerdown', e => {
        e.preventDefault();
        pickCity(inputId, item.textContent.trim());
      });
    });
  }

  input.addEventListener('input', () => renderItems(cityMatch(input.value)));
  input.addEventListener('keydown', e => {
    const items = [...drop.querySelectorAll('.ac-item')];
    const sel   = drop.querySelector('.ac-sel');
    const idx   = items.indexOf(sel);
    if (e.key==='ArrowDown'){ e.preventDefault(); items.forEach(i=>i.classList.remove('ac-sel')); (items[idx+1]||items[0])?.classList.add('ac-sel'); }
    if (e.key==='ArrowUp')  { e.preventDefault(); items.forEach(i=>i.classList.remove('ac-sel')); (items[idx-1]||items[items.length-1])?.classList.add('ac-sel'); }
    if (e.key==='Enter' && sel){ pickCity(inputId, sel.textContent.trim()); e.preventDefault(); }
    if (e.key==='Escape') drop.innerHTML='';
  });
  input.addEventListener('blur', () => setTimeout(() => { drop.innerHTML = ''; }, 250));
}

function pickCity(inputId, city) {
  const i = document.getElementById(inputId); if (i) i.value = city;
  const d = document.getElementById('acd-'+inputId); if (d) d.innerHTML='';
}

function cdl() { return ''; }
function isPast(dateStr) { if(!dateStr) return false; return new Date(dateStr) < new Date(); }

// ─── CHAT ──────────────────────────────────────────────────────────────────
async function openChat(bookingId, otherUserId, otherName) {
  window._activeChat = { bookingId, otherUserId };
  let messages = [];
  try { messages = await apiFetch('/messages/'+bookingId); } catch(e) {}
  openModalHTML(`
    <button class="modal-close" onclick="closeModalNow()">✕</button>
    <div class="modal-title">💬 ${esc(otherName)}</div>
    <div id="chat-msgs" style="height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px;margin-bottom:14px">
      ${messages.length
        ? messages.map(m => chatBubble(m)).join('')
        : '<div class="chat-placeholder" style="text-align:center;color:rgba(255,255,255,.3);font-size:.85rem;margin:auto">Nuk ka mesazhe akoma</div>'}
    </div>
    <div style="display:flex;gap:8px">
      <input id="chat-input" class="form-input" style="flex:1" placeholder="Shkruaj mesazhin..."
        onkeydown="if(event.key==='Enter')sendMsg('${bookingId}','${otherUserId}')"/>
      <button onclick="sendMsg('${bookingId}','${otherUserId}')"
        style="background:linear-gradient(135deg,#E41E20,#cc0000);color:#fff;padding:10px 18px;border-radius:12px;font-weight:700;flex-shrink:0">→</button>
    </div>`);
  const el = document.getElementById('chat-msgs');
  if (el) el.scrollTop = el.scrollHeight;
}

function chatBubble(m) {
  const mine = m.from_id === me?.id;
  return `<div style="display:flex;justify-content:${mine?'flex-end':'flex-start'}">
    <div style="max-width:78%;background:${mine?'linear-gradient(135deg,#E41E20,#cc0000)':'rgba(255,255,255,.09)'};
      border-radius:${mine?'14px 14px 4px 14px':'14px 14px 14px 4px'};
      padding:9px 13px;font-size:.875rem;line-height:1.5">${esc(m.text)}</div>
  </div>`;
}

function sendMsg(bookingId, toId) {
  const input = document.getElementById('chat-input');
  const text  = input?.value?.trim();
  if (!text || !socket) return;
  input.value = '';
  socket.emit('send_message', { booking_id: bookingId, to_id: toId, text });
}

// ─── FORGOT PASSWORD ───────────────────────────────────────────────────────
function openForgotPassword() {
  openModalHTML(`
    <button class="modal-close" onclick="closeModalNow()">✕</button>
    <div class="modal-title">🔑 Fjalëkalim i harruar</div>
    <p style="color:rgba(255,255,255,.45);font-size:.875rem;margin:0 0 20px">Shkruaj emailin tënd — do të të dërgojmë një link për të rivendosur fjalëkalimin.</p>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input class="form-input" id="fp-email" type="email" placeholder="email@example.com" autofocus
        onkeydown="if(event.key==='Enter')doForgotPassword()"/>
    </div>
    <button class="modal-submit" onclick="doForgotPassword()">Dërgo linkun →</button>
    <p class="modal-switch"><a onclick="openModal('login')">← Kthehu te hyrja</a></p>`);
}

async function doForgotPassword() {
  const email = document.getElementById('fp-email')?.value?.trim();
  if (!email) { toast('Shkruaj emailin tënd','error'); return; }
  try {
    await apiFetch('/auth/reset-request','POST',{ email });
    closeModalNow();
    toast('✅ Nëse ky email ekziston, një link u dërgua. Kontrollo edhe spam.','success');
  } catch(e) { toast(e.message,'error'); }
}

// ─── RESET PASSWORD ────────────────────────────────────────────────────────
function renderReset(token) {
  if (!token) { navigate('home'); return; }
  document.getElementById('app').innerHTML = `
  <div class="page">
    <div style="max-width:420px;margin:80px auto;padding:0 20px">
      <div class="glass-card reveal">
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:2.5rem">🔑</div>
          <div class="modal-title" style="margin:8px 0">Rivendos fjalëkalimin</div>
          <p style="color:rgba(255,255,255,.4);font-size:.875rem;margin:0">Zgjidh një fjalëkalim të ri të sigurt.</p>
        </div>
        <div class="form-group">
          <label class="form-label">Fjalëkalimi i ri *</label>
          <input class="form-input" id="rp-p1" type="password" placeholder="•••••••• (min. 6 karaktere)" autofocus/>
        </div>
        <div class="form-group">
          <label class="form-label">Konfirmo fjalëkalimin *</label>
          <input class="form-input" id="rp-p2" type="password" placeholder="••••••••"
            onkeydown="if(event.key==='Enter')doReset('${esc(token)}')"/>
        </div>
        <button class="modal-submit" onclick="doReset('${esc(token)}')">✅ Rivendos dhe hyr →</button>
      </div>
    </div>
  </div>`;
  if (window.gsap) gsap.from('.glass-card', { opacity:0, y:30, duration:.6, ease:'power3.out' });
}

async function doReset(token) {
  const p1 = document.getElementById('rp-p1')?.value || '';
  const p2 = document.getElementById('rp-p2')?.value || '';
  if (p1.length < 6)  { toast('Fjalëkalimi duhet të ketë të paktën 6 karaktere.','error'); return; }
  if (p1 !== p2)      { toast('Fjalëkalimet nuk përputhen.','error'); return; }
  try {
    await apiFetch('/auth/reset','POST',{ token, password: p1 });
    toast('✅ Fjalëkalimi u rivendos! Tani mund të hyni.','success');
    navigate('home');
    setTimeout(() => openModal('login'), 600);
  } catch(e) { toast(e.message,'error'); }
}

// ─── PAYMENT ───────────────────────────────────────────────────────────────
async function doPay(bookingId) {
  try {
    toast('Duke hapur pagesën...','info');
    const { url } = await apiFetch('/bookings/'+bookingId+'/checkout','POST');
    window.location.href = url;
  } catch(e) { toast(e.message,'error'); }
}

// ─── RATING ────────────────────────────────────────────────────────────────
let _ratingStars = {};
function setStar(bid, n) {
  _ratingStars[bid] = n;
  [1,2,3,4,5].forEach(s => {
    const btn = document.getElementById(`star-${bid}-${s}`);
    if (btn) { btn.textContent = s<=n ? '⭐' : '☆'; btn.style.color = s<=n ? '#fbbf24' : 'rgba(255,255,255,.2)'; }
  });
}
async function submitRating(bid) {
  const stars   = _ratingStars[bid];
  const comment = document.getElementById(`rc-${bid}`)?.value?.trim() || '';
  if (!stars) { toast('Zgjidh numrin e yjeve','error'); return; }
  try {
    await apiFetch('/ratings','POST',{booking_id:bid, stars, comment});
    toast('✅ Faleminderit për vlerësimin!','success');
    loadPassengerTab();
  } catch(e) { toast(e.message,'error'); }
}
