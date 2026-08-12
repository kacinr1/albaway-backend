'use strict';
/* ═══════════════════════════════════════════════════════════════
   AlbaWay — Middleware SSR d'injection SEO
   La SPA sert le même HTML partout : ce middleware réécrit <title>,
   meta description, Open Graph, hreflang, JSON-LD et le snippet
   Google Analytics (consenti) selon la route ET la langue demandée.
   À monter AVANT express.static.
═══════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const SITE = 'https://albaway.ch';
const LANGS = ['sq', 'fr', 'de', 'en'];
const OG_LOCALE = { sq: 'sq_AL', fr: 'fr_CH', de: 'de_DE', en: 'en_US' };

// Fichier HTML servi pour chaque route indexable
const ROUTE_FILES = {
  '/':            'index.html',
  '/about.html':  'about.html',
  '/faq.html':    'faq.html',
  '/legal.html':  'legal.html',
};

// SEO par langue et par route (natif, orienté diaspora)
const SEO = {
  sq: {
    '/':           { t: 'AlbaWay — Bashkudhëtim Zvicër ⇄ Kosovë, Shqipëri, Maqedoni', d: 'Gjej ose ofro bashkudhëtim mes Zvicrës, Gjermanisë, Austrisë dhe Kosovës, Shqipërisë e Maqedonisë. Udhëto bashkë, i sigurt dhe lirë.' },
    '/about.html': { t: 'Rreth AlbaWay — Bashkudhëtimi i diasporës shqiptare', d: 'Historia dhe misioni i AlbaWay: të lidhim diasporën shqiptare me atdheun, në mënyrë të sigurt dhe të përballueshme.' },
    '/faq.html':   { t: 'Pyetje të shpeshta — AlbaWay', d: 'Si të rezervosh, si funksionon pagesa, anulimet, bagazhet dhe siguria. Gjithçka që duhet të dish për AlbaWay.' },
    '/legal.html': { t: 'Kushtet & Privatësia — AlbaWay', d: 'Kushtet e përdorimit dhe politika e privatësisë së AlbaWay: të dhënat, pagesat Stripe dhe të drejtat tuaja.' },
  },
  fr: {
    '/':           { t: 'AlbaWay — Covoiturage Suisse ⇄ Kosovo, Albanie, Macédoine', d: 'Trouvez un covoiturage entre la Suisse, l’Allemagne, l’Autriche et le Kosovo, l’Albanie ou la Macédoine. Voyagez ensemble, en confiance et à petit prix.' },
    '/about.html': { t: 'À propos d’AlbaWay — Le covoiturage de la diaspora', d: 'La mission d’AlbaWay : relier la diaspora albanaise à son pays, en toute sécurité et à prix accessible.' },
    '/faq.html':   { t: 'Questions fréquentes — AlbaWay', d: 'Réservation, paiement sécurisé, annulations, bagages et sécurité. Tout ce qu’il faut savoir sur AlbaWay.' },
    '/legal.html': { t: 'CGU & Confidentialité — AlbaWay', d: 'Conditions d’utilisation et politique de confidentialité d’AlbaWay : données, paiements Stripe et vos droits.' },
  },
  de: {
    '/':           { t: 'AlbaWay — Mitfahrgelegenheit Schweiz ⇄ Kosovo, Albanien', d: 'Finden Sie Mitfahrgelegenheiten zwischen der Schweiz, Deutschland, Österreich und dem Kosovo, Albanien oder Nordmazedonien. Gemeinsam reisen, sicher und günstig.' },
    '/about.html': { t: 'Über AlbaWay — Mitfahren für die albanische Diaspora', d: 'Die Mission von AlbaWay: die albanische Diaspora sicher und günstig mit der Heimat verbinden.' },
    '/faq.html':   { t: 'Häufige Fragen — AlbaWay', d: 'Buchung, sichere Zahlung, Stornierungen, Gepäck und Sicherheit. Alles Wichtige zu AlbaWay.' },
    '/legal.html': { t: 'AGB & Datenschutz — AlbaWay', d: 'Nutzungsbedingungen und Datenschutz von AlbaWay: Daten, Stripe-Zahlungen und Ihre Rechte.' },
  },
  en: {
    '/':           { t: 'AlbaWay — Carpooling Switzerland ⇄ Kosovo, Albania', d: 'Find carpooling between Switzerland, Germany, Austria and Kosovo, Albania or North Macedonia. Travel together, safely and affordably.' },
    '/about.html': { t: 'About AlbaWay — Carpooling for the Albanian diaspora', d: 'AlbaWay’s mission: connecting the Albanian diaspora to home, safely and affordably.' },
    '/faq.html':   { t: 'Frequently asked questions — AlbaWay', d: 'Booking, secure payment, cancellations, luggage and safety. Everything you need to know about AlbaWay.' },
    '/legal.html': { t: 'Terms & Privacy — AlbaWay', d: 'AlbaWay’s terms of use and privacy policy: data, Stripe payments and your rights.' },
  },
};

// Extrait les paires question/réponse de faq.html pour le schema FAQPage.
function buildFaqJsonLd(html) {
  const re = /<button class="faq-q"[\s\S]*?<span>([\s\S]*?)<\/span>[\s\S]*?<div class="faq-a">([\s\S]*?)<\/div>/g;
  const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const items = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const q = strip(m[1]);
    const a = strip(m[2]);
    if (q && a) items.push({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } });
  }
  if (!items.length) return '';
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items };
  return `\n  <script type="application/ld+json">${JSON.stringify(ld)}</script>`;
}

const _cache = {};
function readHtml(file) {
  if (!_cache[file]) {
    _cache[file] = fs.readFileSync(path.join(__dirname, 'public', file), 'utf8');
  }
  return _cache[file];
}

function detectLang(req) {
  const q = (req.query.lang || '').toLowerCase();
  if (LANGS.includes(q)) return q;
  const al = (req.headers['accept-language'] || '').toLowerCase();
  for (const l of LANGS) if (al.startsWith(l)) return l;
  return 'sq';
}

function esc(s) { return String(s).replace(/"/g, '&quot;'); }

function buildHead(route, lang) {
  const s = SEO[lang][route];
  const url = SITE + (route === '/' ? '/' : route);
  const alternates = LANGS
    .map(l => `<link rel="alternate" hreflang="${l}" href="${url}?lang=${l}"/>`)
    .join('\n  ') + `\n  <link rel="alternate" hreflang="x-default" href="${url}"/>`;

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AlbaWay',
    url: SITE,
    logo: `${SITE}/logo.png`,
    description: 'Plateforme de covoiturage pour la diaspora albanaise (Suisse, Allemagne, Autriche ⇄ Kosovo, Albanie, Macédoine du Nord).',
    areaServed: ['CH', 'DE', 'AT', 'XK', 'AL', 'MK'],
    contactPoint: { '@type': 'ContactPoint', email: 'support@albaway.ch', contactType: 'customer support' },
  };

  const ga = process.env.NEXT_PUBLIC_GA_ID || process.env.GA_ID || '';
  const gaSnippet = ga ? `
  <script>
    // GA4 chargé uniquement après consentement (RGPD/LPD) — voir /consent.js
    window.__ALBAWAY_GA_ID = '${ga}';
  </script>
  <script src="/consent.js" defer></script>` : '';

  return `<title>${s.t}</title>
  <meta name="description" content="${esc(s.d)}"/>
  <link rel="canonical" href="${url}"/>
  ${alternates}
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${url}"/>
  <meta property="og:title" content="${esc(s.t)}"/>
  <meta property="og:description" content="${esc(s.d)}"/>
  <meta property="og:image" content="${SITE}/logo.png"/>
  <meta property="og:locale" content="${OG_LOCALE[lang]}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${esc(s.t)}"/>
  <meta name="twitter:description" content="${esc(s.d)}"/>
  <meta name="twitter:image" content="${SITE}/logo.png"/>
  <script type="application/ld+json">${JSON.stringify(orgJsonLd)}</script>${gaSnippet}`;
}

// Réécrit tout le bloc entre <title> et </head> d'origine (index.html contient
// déjà title+description+OG entre <title> et le favicon). On remplace de <title>
// jusqu'à juste avant </head> par nos balises + on garde le reste du <head> à partir
// des favicons. Pour rester robuste sur les 4 fichiers, on remplace <title>...</title>
// et la meta description, puis on injecte le reste avant </head>.
function inject(html, route, lang) {
  const s = SEO[lang][route];
  const url = SITE + (route === '/' ? '/' : route);
  let out = html;

  // 1) <title>
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${s.t}</title>`);
  // 2) meta description
  out = out.replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${esc(s.d)}"/>`);
  // 3) OG title/description/url/locale
  out = out.replace(/<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${esc(s.t)}"/>`);
  out = out.replace(/<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${esc(s.d)}"/>`);
  out = out.replace(/<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${url}"/>`);
  out = out.replace(/<meta\s+property="og:locale"[^>]*>/i, `<meta property="og:locale" content="${OG_LOCALE[lang]}"/>`);
  // og-image.png est absente → on pointe vers le logo existant (voir rapport : créer une vraie image 1200×630)
  out = out.replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/i, `$1${SITE}/logo.png$2`);
  out = out.replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/i, `$1${SITE}/logo.png$2`);
  // 4) <html lang="..">
  out = out.replace(/<html[^>]*lang="[^"]*"/i, `<html lang="${lang}"`);

  // 5) hreflang + JSON-LD + GA, injectés avant </head> (idempotent via marqueur)
  if (!out.includes('data-albaway-seo')) {
    const extra = LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${url}?lang=${l}"/>`).join('\n  ')
      + `\n  <link rel="alternate" hreflang="x-default" href="${url}"/>`;
    const orgJsonLd = {
      '@context': 'https://schema.org', '@type': 'Organization', name: 'AlbaWay', url: SITE,
      logo: `${SITE}/logo.png`,
      description: 'Plateforme de covoiturage pour la diaspora albanaise (Suisse, Allemagne, Autriche ⇄ Kosovo, Albanie, Macédoine du Nord).',
      areaServed: ['CH', 'DE', 'AT', 'XK', 'AL', 'MK'],
      contactPoint: { '@type': 'ContactPoint', email: 'support@albaway.ch', contactType: 'customer support' },
    };
    const ga = process.env.NEXT_PUBLIC_GA_ID || process.env.GA_ID || '';
    const gaSnippet = ga
      ? `\n  <script>window.__ALBAWAY_GA_ID='${ga}';</script>\n  <script src="/consent.js" defer></script>`
      : '';
    const faqLd = route === '/faq.html' ? buildFaqJsonLd(html) : '';
    const block = `\n  <!-- data-albaway-seo -->\n  ${extra}\n  <script type="application/ld+json">${JSON.stringify(orgJsonLd)}</script>${faqLd}${gaSnippet}\n</head>`;
    out = out.replace(/<\/head>/i, block);
  }
  return out;
}

function middleware(req, res, next) {
  if (req.method !== 'GET') return next();
  const route = ROUTE_FILES[req.path] ? req.path : null;
  if (!route) return next();
  try {
    const lang = detectLang(req);
    const html = inject(readHtml(ROUTE_FILES[route]), route, lang);
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    return next();
  }
}

module.exports = { middleware, SEO, LANGS, buildHead };
