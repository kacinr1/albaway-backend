'use strict';
/* ═══════════════════════════════════════════════════════════════
   AlbaWay — Pages corridors indexables (SEO diaspora)
   Landings SSR autonomes /trajets/:slug (ex. geneve-pristina) :
   contenu unique par corridor × langue, hreflang, JSON-LD Trip +
   BreadcrumbList, CTA vers une recherche pré-remplie (/search?from=&to=).
   Distances/durées = ordres de grandeur routiers réels (préfixés « ≈ »).
   Prix = fourchette indicative, jamais présentée comme un tarif ferme.
═══════════════════════════════════════════════════════════════ */

const SITE  = 'https://albaway.ch';
const LANGS = ['sq', 'fr', 'de', 'en'];
const OG_LOCALE = { sq: 'sq_AL', fr: 'fr_CH', de: 'de_DE', en: 'en_US' };

// Corridors sources (aller). Les retours sont générés automatiquement.
// km/h = ordre de grandeur route ; price = fourchette indicative (€).
const BASE = [
  { from: 'Genève',    to: 'Prishtinë', slug: 'geneve-pristina',    km: 1400, h: 16, price: '70–90' },
  { from: 'Zürich',    to: 'Prishtinë', slug: 'zurich-pristina',    km: 1350, h: 15, price: '70–90' },
  { from: 'Lausanne',  to: 'Prishtinë', slug: 'lausanne-pristina',  km: 1450, h: 16, price: '75–95' },
  { from: 'Bern',      to: 'Prishtinë', slug: 'bern-pristina',      km: 1380, h: 15, price: '70–90' },
  { from: 'Bâle',      to: 'Prishtinë', slug: 'bale-pristina',      km: 1400, h: 15, price: '70–90' },
  { from: 'Genève',    to: 'Tiranë',    slug: 'geneve-tirana',      km: 1500, h: 17, price: '80–100' },
  { from: 'Zürich',    to: 'Tiranë',    slug: 'zurich-tirana',      km: 1450, h: 16, price: '80–100' },
  { from: 'Genève',    to: 'Shkodër',   slug: 'geneve-shkoder',     km: 1400, h: 16, price: '80–100' },
  { from: 'Zürich',    to: 'Shkup',     slug: 'zurich-skopje',      km: 1300, h: 14, price: '70–90' },
];

// slugs des villes pour composer le slug retour
const CITY_SLUG = {
  'Genève': 'geneve', 'Zürich': 'zurich', 'Lausanne': 'lausanne', 'Bern': 'bern', 'Bâle': 'bale',
  'Prishtinë': 'pristina', 'Tiranë': 'tirana', 'Shkodër': 'shkoder', 'Shkup': 'skopje',
};

// Coordonnées [lat, lon] pour tracer l'itinéraire indicatif du corridor (Leaflet).
const CITY_COORDS = {
  'Genève':    [46.2044, 6.1432],
  'Zürich':    [47.3769, 8.5417],
  'Lausanne':  [46.5197, 6.6323],
  'Bern':      [46.9480, 7.4474],
  'Bâle':      [47.5596, 7.5886],
  'Prishtinë': [42.6629, 21.1655],
  'Tiranë':    [41.3275, 19.8187],
  'Shkodër':   [42.0693, 19.5033],
  'Shkup':     [41.9981, 21.4254],
};

function buildCorridors() {
  const list = [];
  for (const c of BASE) {
    list.push({ ...c });
    // retour
    list.push({
      from: c.to, to: c.from,
      slug: `${CITY_SLUG[c.to]}-${CITY_SLUG[c.from]}`,
      km: c.km, h: c.h, price: c.price,
    });
  }
  return list;
}

const CORRIDORS = buildCorridors();
const BY_SLUG = Object.fromEntries(CORRIDORS.map((c) => [c.slug, c]));

// ─── Copy localisée (templates avec placeholders {from} {to} {km} {h} {price}) ──
const T = {
  sq: {
    breadHome: 'Kreu', breadTrips: 'Udhëtime',
    title: (c) => `Bashkudhëtim ${c.from} → ${c.to} — AlbaWay`,
    desc: (c) => `Gjej ose ofro bashkudhëtim ${c.from} → ${c.to} me diasporën shqiptare. ≈${c.km} km, ≈${c.h}h rrugë, çmim indikativ ${c.price}€. Rezervo i sigurt në AlbaWay.`,
    h1: (c) => `Bashkudhëtim ${c.from} → ${c.to}`,
    intro: (c) => `Udhëto nga ${c.from} për në ${c.to} bashkë me shqiptarë të tjerë të diasporës. AlbaWay të lidh me shoferë të besueshëm në këtë korridor — ndaje shpenzimet, udhëto i qetë.`,
    factsTitle: 'Rreth korridorit',
    fDist: 'Distanca', fTime: 'Kohëzgjatja', fPrice: 'Çmim indikativ',
    approx: (v) => `≈ ${v}`,
    stepsTitle: 'Si funksionon', steps: ['Kërko udhëtimin ' , 'Rezervo & paguaj i sigurt', 'Merr kontaktet e shoferit'],
    stepsD: (c) => [`Shiko udhëtimet e disponueshme ${c.from} → ${c.to}.`, 'Pagesa e sigurt me Stripe; kontaktet zbulohen pas pagesës.', 'Koordinohu me shoferin për orarin dhe vendtakimin.'],
    cta: (c) => `Kërko ${c.from} → ${c.to}`,
    mapCaption: 'Itinerar indikativ i korridorit',
    reverse: (c) => `Udhëtim në kah të kundërt: ${c.to} → ${c.from}`,
    otherTitle: 'Korridore të tjera popullore',
    allTrips: 'Të gjitha korridoret',
    faq: 'Pyetje të shpeshta',
  },
  fr: {
    breadHome: 'Accueil', breadTrips: 'Trajets',
    title: (c) => `Covoiturage ${c.from} → ${c.to} — AlbaWay`,
    desc: (c) => `Trouvez ou proposez un covoiturage ${c.from} → ${c.to} avec la diaspora albanaise. ≈${c.km} km, ≈${c.h}h de route, prix indicatif ${c.price}€. Réservez en confiance sur AlbaWay.`,
    h1: (c) => `Covoiturage ${c.from} → ${c.to}`,
    intro: (c) => `Voyagez de ${c.from} vers ${c.to} avec d’autres membres de la diaspora albanaise. AlbaWay vous met en relation avec des conducteurs de confiance sur ce corridor — partagez les frais, voyagez serein.`,
    factsTitle: 'À propos du corridor',
    fDist: 'Distance', fTime: 'Durée', fPrice: 'Prix indicatif',
    approx: (v) => `≈ ${v}`,
    stepsTitle: 'Comment ça marche', steps: ['Cherchez le trajet', 'Réservez & payez en sécurité', 'Recevez les contacts du conducteur'],
    stepsD: (c) => [`Consultez les trajets ${c.from} → ${c.to} disponibles.`, 'Paiement sécurisé Stripe ; les contacts sont révélés après paiement.', 'Coordonnez l’horaire et le point de rendez-vous avec le conducteur.'],
    cta: (c) => `Chercher ${c.from} → ${c.to}`,
    mapCaption: 'Itinéraire indicatif du corridor',
    reverse: (c) => `Trajet dans l’autre sens : ${c.to} → ${c.from}`,
    otherTitle: 'Autres corridors populaires',
    allTrips: 'Tous les corridors',
    faq: 'Questions fréquentes',
  },
  de: {
    breadHome: 'Start', breadTrips: 'Fahrten',
    title: (c) => `Mitfahrgelegenheit ${c.from} → ${c.to} — AlbaWay`,
    desc: (c) => `Finden oder bieten Sie eine Mitfahrgelegenheit ${c.from} → ${c.to} mit der albanischen Diaspora. ≈${c.km} km, ≈${c.h}h Fahrt, Richtpreis ${c.price}€. Sicher buchen auf AlbaWay.`,
    h1: (c) => `Mitfahrgelegenheit ${c.from} → ${c.to}`,
    intro: (c) => `Reisen Sie von ${c.from} nach ${c.to} gemeinsam mit anderen aus der albanischen Diaspora. AlbaWay verbindet Sie mit vertrauenswürdigen Fahrern auf dieser Strecke — Kosten teilen, entspannt reisen.`,
    factsTitle: 'Über die Strecke',
    fDist: 'Distanz', fTime: 'Dauer', fPrice: 'Richtpreis',
    approx: (v) => `≈ ${v}`,
    stepsTitle: 'So funktioniert’s', steps: ['Fahrt suchen', 'Sicher buchen & zahlen', 'Fahrerkontakt erhalten'],
    stepsD: (c) => [`Verfügbare Fahrten ${c.from} → ${c.to} ansehen.`, 'Sichere Stripe-Zahlung; Kontakte werden nach der Zahlung freigegeben.', 'Zeit und Treffpunkt mit dem Fahrer abstimmen.'],
    cta: (c) => `${c.from} → ${c.to} suchen`,
    mapCaption: 'Indikative Streckenführung',
    reverse: (c) => `Fahrt in Gegenrichtung: ${c.to} → ${c.from}`,
    otherTitle: 'Weitere beliebte Strecken',
    allTrips: 'Alle Strecken',
    faq: 'Häufige Fragen',
  },
  en: {
    breadHome: 'Home', breadTrips: 'Trips',
    title: (c) => `Carpooling ${c.from} → ${c.to} — AlbaWay`,
    desc: (c) => `Find or offer a carpool ${c.from} → ${c.to} with the Albanian diaspora. ≈${c.km} km, ≈${c.h}h drive, indicative price ${c.price}€. Book with confidence on AlbaWay.`,
    h1: (c) => `Carpooling ${c.from} → ${c.to}`,
    intro: (c) => `Travel from ${c.from} to ${c.to} together with other members of the Albanian diaspora. AlbaWay connects you with trusted drivers on this corridor — share the cost, travel easy.`,
    factsTitle: 'About the corridor',
    fDist: 'Distance', fTime: 'Duration', fPrice: 'Indicative price',
    approx: (v) => `≈ ${v}`,
    stepsTitle: 'How it works', steps: ['Search the trip', 'Book & pay securely', 'Get the driver’s contact'],
    stepsD: (c) => [`Browse available ${c.from} → ${c.to} trips.`, 'Secure Stripe payment; contacts are revealed after payment.', 'Coordinate time and meeting point with the driver.'],
    cta: (c) => `Search ${c.from} → ${c.to}`,
    mapCaption: 'Indicative corridor route',
    reverse: (c) => `Trip the other way: ${c.to} → ${c.from}`,
    otherTitle: 'Other popular corridors',
    allTrips: 'All corridors',
    faq: 'FAQ',
  },
};

const INDEX_COPY = {
  sq: { title: 'Korridoret e bashkudhëtimit — AlbaWay', h1: 'Korridoret popullore të diasporës', desc: 'Të gjitha korridoret e bashkudhëtimit Zvicër ⇄ Kosovë, Shqipëri, Maqedoni në AlbaWay.', intro: 'Zgjidh korridorin tënd dhe gjej bashkudhëtim me diasporën shqiptare.' },
  fr: { title: 'Corridors de covoiturage — AlbaWay', h1: 'Corridors populaires de la diaspora', desc: 'Tous les corridors de covoiturage Suisse ⇄ Kosovo, Albanie, Macédoine sur AlbaWay.', intro: 'Choisissez votre corridor et trouvez un covoiturage avec la diaspora albanaise.' },
  de: { title: 'Mitfahr-Strecken — AlbaWay', h1: 'Beliebte Strecken der Diaspora', desc: 'Alle Mitfahr-Strecken Schweiz ⇄ Kosovo, Albanien, Nordmazedonien auf AlbaWay.', intro: 'Wählen Sie Ihre Strecke und finden Sie eine Mitfahrgelegenheit mit der albanischen Diaspora.' },
  en: { title: 'Carpool corridors — AlbaWay', h1: 'Popular diaspora corridors', desc: 'All carpool corridors Switzerland ⇄ Kosovo, Albania, North Macedonia on AlbaWay.', intro: 'Pick your corridor and find a carpool with the Albanian diaspora.' },
};

function detectLang(req) {
  const q = (req.query.lang || '').toLowerCase();
  if (LANGS.includes(q)) return q;
  const al = (req.headers['accept-language'] || '').toLowerCase();
  for (const l of LANGS) if (al.startsWith(l)) return l;
  return 'sq';
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const searchHref = (c) => `/search?from=${encodeURIComponent(c.from)}&to=${encodeURIComponent(c.to)}`;

function head(lang, url, title, desc, jsonLd, extraHead = '') {
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${url}?lang=${l}"/>`).join('\n  ')
    + `\n  <link rel="alternate" hreflang="x-default" href="${url}"/>`;
  const ga = process.env.NEXT_PUBLIC_GA_ID || process.env.GA_ID || '';
  const gaSnippet = ga ? `\n  <script>window.__ALBAWAY_GA_ID='${ga}';</script>\n  <script src="/consent.js" defer></script>` : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}"/>
  <link rel="canonical" href="${url}"/>
  ${alternates}
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${url}"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(desc)}"/>
  <meta property="og:image" content="${SITE}/logo.png"/>
  <meta property="og:locale" content="${OG_LOCALE[lang]}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${esc(title)}"/>
  <meta name="twitter:description" content="${esc(desc)}"/>
  <meta name="twitter:image" content="${SITE}/logo.png"/>
  <link rel="icon" href="/favicon.ico"/>
  ${jsonLd.map((ld) => `<script type="application/ld+json">${JSON.stringify(ld)}</script>`).join('\n  ')}${gaSnippet}
  <style>
    :root{--red:#E41E20}
    *{box-sizing:border-box}
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0d0f14;color:#e8eaf0;line-height:1.6}
    a{color:inherit;text-decoration:none}
    .wrap{max-width:860px;margin:0 auto;padding:0 20px}
    header{display:flex;align-items:center;justify-content:space-between;padding:18px 0;border-bottom:1px solid #1e2230}
    .logo{font-weight:800;font-size:1.25rem;letter-spacing:-.5px}
    .logo b{color:var(--red)}
    .navlink{font-size:.9rem;color:#aeb4c4}
    nav.crumbs{font-size:.8rem;color:#8b91a3;padding:16px 0}
    nav.crumbs a:hover{color:#fff}
    h1{font-size:1.9rem;font-weight:800;margin:.4em 0 .2em;letter-spacing:-.5px}
    .intro{color:#aeb4c4;font-size:1.02rem;max-width:640px}
    .facts{display:flex;flex-wrap:wrap;gap:14px;margin:26px 0}
    .fact{flex:1;min-width:150px;background:#141824;border:1px solid #1e2230;border-radius:16px;padding:16px}
    .fact .k{font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;color:#8b91a3}
    .fact .v{font-size:1.3rem;font-weight:700;margin-top:4px}
    .cta{display:inline-flex;align-items:center;gap:8px;background:var(--red);color:#fff;font-weight:700;padding:15px 26px;border-radius:14px;margin:8px 0 4px;box-shadow:0 10px 30px rgba(228,30,32,.3)}
    .steps{display:grid;gap:14px;grid-template-columns:1fr;margin:14px 0 8px}
    @media(min-width:640px){.steps{grid-template-columns:repeat(3,1fr)}}
    .step{background:#141824;border:1px solid #1e2230;border-radius:16px;padding:18px}
    .step .n{width:28px;height:28px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem}
    .step h3{margin:12px 0 6px;font-size:1rem}
    .step p{margin:0;color:#aeb4c4;font-size:.9rem}
    h2{font-size:1.3rem;margin:34px 0 12px}
    .links{display:flex;flex-wrap:wrap;gap:10px}
    .chip{background:#141824;border:1px solid #1e2230;border-radius:999px;padding:9px 15px;font-size:.9rem;color:#cfd3de}
    .chip:hover{border-color:var(--red);color:#fff}
    footer{border-top:1px solid #1e2230;margin-top:40px;padding:26px 0;color:#8b91a3;font-size:.85rem;display:flex;flex-wrap:wrap;gap:16px}
    footer a:hover{color:#fff}
    .map-wrap{margin:22px 0 6px}
    #corridor-map{height:320px;border-radius:16px;overflow:hidden;border:1px solid #1e2230;background:#141824}
    .map-cap{font-size:.78rem;color:#8b91a3;margin-top:8px}
    .leaflet-popup-content{font-family:inherit}
  </style>
  ${extraHead}
</head>`;
}

// Feuille de style Leaflet (chargée uniquement sur les pages avec carte).
const LEAFLET_CSS = '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>';

function renderCorridor(c, lang) {
  const t = T[lang];
  const url = `${SITE}/trajets/${c.slug}`;
  const reverseSlug = `${CITY_SLUG[c.to]}-${CITY_SLUG[c.from]}`;
  const others = CORRIDORS.filter((x) => x.slug !== c.slug && x.slug !== reverseSlug).slice(0, 6);

  const tripLd = {
    '@context': 'https://schema.org', '@type': 'Trip',
    name: `${c.from} → ${c.to}`, description: t.desc(c), url,
    itinerary: [{ '@type': 'City', name: c.from }, { '@type': 'City', name: c.to }],
    provider: { '@type': 'Organization', name: 'AlbaWay', url: SITE },
  };
  const breadLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.breadHome, item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: t.breadTrips, item: SITE + '/trajets' },
      { '@type': 'ListItem', position: 3, name: `${c.from} → ${c.to}`, item: url },
    ],
  };

  const stepsD = t.stepsD(c);
  const a = CITY_COORDS[c.from], b = CITY_COORDS[c.to];
  const mapScript = (a && b) ? `
  <script>
  (function(){
    function init(){
      var el=document.getElementById('corridor-map');
      if(!el||!window.L) return;
      var a=[${a[0]},${a[1]}], b=[${b[0]},${b[1]}];
      var map=L.map(el,{scrollWheelZoom:false});
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; OpenStreetMap &copy; CARTO',subdomains:'abcd',maxZoom:19}).addTo(map);
      L.polyline([a,b],{color:'#E41E20',weight:3,opacity:.9,dashArray:'6 8'}).addTo(map);
      L.circleMarker(a,{radius:8,color:'#fff',weight:2,fillColor:'#E41E20',fillOpacity:1}).addTo(map).bindPopup(${JSON.stringify(c.from)});
      L.circleMarker(b,{radius:8,color:'#fff',weight:2,fillColor:'#E41E20',fillOpacity:1}).addTo(map).bindPopup(${JSON.stringify(c.to)});
      map.fitBounds(L.latLngBounds([a,b]).pad(0.3));
    }
    var s=document.createElement('script');
    s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    s.crossOrigin='';
    s.onload=init;
    document.body.appendChild(s);
  })();
  </script>` : '';
  const mapBlock = (a && b) ? `
    <div class="map-wrap">
      <div id="corridor-map"></div>
      <div class="map-cap">🗺️ ${esc(t.mapCaption)}</div>
    </div>` : '';

  return head(lang, url, t.title(c), t.desc(c), [tripLd, breadLd], LEAFLET_CSS) + `
<body>
  <div class="wrap">
    <header>
      <a class="logo" href="/?lang=${lang}">Alba<b>Way</b></a>
      <a class="navlink" href="${searchHref(c)}">${esc(t.cta(c))} →</a>
    </header>
    <nav class="crumbs"><a href="/?lang=${lang}">${esc(t.breadHome)}</a> › <a href="/trajets?lang=${lang}">${esc(t.breadTrips)}</a> › ${esc(c.from)} → ${esc(c.to)}</nav>
    <h1>${esc(t.h1(c))}</h1>
    <p class="intro">${esc(t.intro(c))}</p>

    <div class="facts">
      <div class="fact"><div class="k">${esc(t.fDist)}</div><div class="v">${t.approx(c.km + ' km')}</div></div>
      <div class="fact"><div class="k">${esc(t.fTime)}</div><div class="v">${t.approx(c.h + ' h')}</div></div>
      <div class="fact"><div class="k">${esc(t.fPrice)}</div><div class="v">${esc(c.price)} €</div></div>
    </div>
${mapBlock}
    <a class="cta" href="${searchHref(c)}">🔍 ${esc(t.cta(c))}</a>

    <h2>${esc(t.stepsTitle)}</h2>
    <div class="steps">
      ${t.steps.map((s, i) => `<div class="step"><div class="n">${i + 1}</div><h3>${esc(s)}</h3><p>${esc(stepsD[i])}</p></div>`).join('\n      ')}
    </div>

    <h2>${esc(t.otherTitle)}</h2>
    <div class="links">
      <a class="chip" href="/trajets/${reverseSlug}?lang=${lang}">↔ ${esc(t.reverse(c))}</a>
      ${others.map((o) => `<a class="chip" href="/trajets/${o.slug}?lang=${lang}">${esc(o.from)} → ${esc(o.to)}</a>`).join('\n      ')}
    </div>

    <footer>
      <a href="/trajets?lang=${lang}">${esc(t.allTrips)}</a>
      <a href="/faq.html?lang=${lang}">${esc(t.faq)}</a>
      <a href="/?lang=${lang}">AlbaWay</a>
    </footer>
  </div>${mapScript}
</body>
</html>`;
}

function renderIndex(lang) {
  const c = INDEX_COPY[lang];
  const t = T[lang];
  const url = `${SITE}/trajets`;
  const listLd = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: CORRIDORS.map((x, i) => ({
      '@type': 'ListItem', position: i + 1, name: `${x.from} → ${x.to}`, url: `${SITE}/trajets/${x.slug}`,
    })),
  };
  return head(lang, url, c.title, c.desc, [listLd]) + `
<body>
  <div class="wrap">
    <header>
      <a class="logo" href="/?lang=${lang}">Alba<b>Way</b></a>
      <a class="navlink" href="/?lang=${lang}">AlbaWay →</a>
    </header>
    <nav class="crumbs"><a href="/?lang=${lang}">${esc(t.breadHome)}</a> › ${esc(t.breadTrips)}</nav>
    <h1>${esc(c.h1)}</h1>
    <p class="intro">${esc(c.intro)}</p>
    <div class="links" style="margin-top:24px">
      ${CORRIDORS.map((x) => `<a class="chip" href="/trajets/${x.slug}?lang=${lang}">${esc(x.from)} → ${esc(x.to)}</a>`).join('\n      ')}
    </div>
    <footer>
      <a href="/faq.html?lang=${lang}">${esc(t.faq)}</a>
      <a href="/?lang=${lang}">AlbaWay</a>
    </footer>
  </div>
</body>
</html>`;
}

// ─── Routes Express ───
function register(app) {
  app.get('/trajets', (req, res, next) => {
    try {
      const lang = detectLang(req);
      res.set('Content-Type', 'text/html; charset=utf-8').send(renderIndex(lang));
    } catch (e) { next(); }
  });
  app.get('/trajets/:slug', (req, res, next) => {
    const c = BY_SLUG[req.params.slug];
    if (!c) return next();
    try {
      const lang = detectLang(req);
      res.set('Content-Type', 'text/html; charset=utf-8').send(renderCorridor(c, lang));
    } catch (e) { next(); }
  });
}

// URLs pour le sitemap (page index + tous les corridors)
function sitemapUrls() {
  return [`${SITE}/trajets`, ...CORRIDORS.map((c) => `${SITE}/trajets/${c.slug}`)];
}

module.exports = { register, sitemapUrls, CORRIDORS };
