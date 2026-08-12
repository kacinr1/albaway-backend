# RAPPORT CHECKLIST — ALBAWAY.CH

Plateforme de covoiturage diaspora albanaise (SPA vanilla JS + Express + PostgreSQL + Stripe + Socket.io · 4 langues sq/fr/de/en).
Date : 2026-08-12. `node --check` OK sur les fichiers modifiés. Injection SEO testée en isolation (4 routes × 4 langues).

> **Spécificité SPA traitée en priorité** : un middleware SSR (`seo-inject.js`, monté avant `express.static`) réécrit `<title>`, meta description, Open Graph, `hreflang`, `<html lang>` et JSON-LD selon la route ET la langue (`?lang=` ou `Accept-Language`, défaut `sq`). Les crawlers et les partages WhatsApp/Facebook (canal n°1) reçoivent désormais les bonnes balises par page.

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 1 | Titres uniques (SSR) | ✅ | Middleware `seo-inject.js` : titres par route (/, /about, /faq, /legal) × 4 langues. |
| 2 | Page de remerciement | ✅ | Écran de confirmation paiement (temps réel + emails) + event GA4 `purchase` déclenché. **Reco** : ajouter la valeur (commission) au `purchase` côté serveur. |
| 3 | robots.txt + sitemap.xml | ✅ | robots présent (`/api`, `/dashboard` bloqués ; `/admin` en `X-Robots-Tag: noindex`). **Sitemap désormais dynamique** (route Express avant `express.static`) : pages statiques + **18 pages corridors** + `/trajets`. |
| 4 | Avis clients | ✅ | Notation **bidirectionnelle** (passager↔conducteur) + **contrainte unique** (from_id, booking_id) + moyenne recalculée depuis la table. **Nb d'avis affiché sur les cartes de trajet**. Endpoint public `/api/reviews/recent` + **section témoignages sur l'accueil** (4 langues). **Reco** : ajouter l'UI de notation côté conducteur (backend prêt). |
| 5 | CTA sticky mobile | ✅ | Barre sticky « Kërko udhëtim » < 768px sur accueil + recherche, masquée en réservation/paiement/trajet/dashboard. Vérifiée à l'écran. |
| 6 | Meta descriptions (SSR) | ✅ | Uniques par route × 4 langues via le middleware. |
| 7 | Fil d'Ariane | ✅ | Fil d'Ariane (Accueil › Trajets › corridor) + JSON-LD `BreadcrumbList` sur chaque page corridor. |
| 8 | Confidentialité + CGU | ✅ | `legal.html` couvre CGU (Kushtet), confidentialité, GDPR et Stripe. **Checkbox consentement CGU+confidentialité à l'inscription ajoutée + loggée en DB** (`consent_terms`, `consent_at`, `consent_version` ; endpoint rejette l'inscription sans consentement). **Reco** : citer explicitement Resend + hébergeur DB + transferts hors UE dans le texte de `legal.html`. |
| 9 | Images de partage RS | ✅ | Route serveur `/trip/:id` : OG/Twitter **dynamiques par trajet** (titre + « Genève → Pristina · date · prix · places ») en version textuelle riche. OG image corrigée (→ `/logo.png`). **Reco** : créer une vraie image 1200×630 de marque (voire OG image générée par trajet). |
| 10 | FAQ + schema | ✅ | `faq.html` + JSON-LD `FAQPage` (16 Q/R) injecté côté serveur par `seo-inject.js`. |
| 11 | 404 personnalisée | ✅ | `404.html` servie avec statut HTTP 404 (fallback Express). |
| 12 | Carte + itinéraire | ⚠️ | **Reco** : afficher l'itinéraire du corridor (Leaflet/OSM) sur les pages trajets. |
| 13 | CTA sans scroller | ✅ | Module de recherche (départ/arrivée/date) dans le hero, visible sans scroll sur mobile (vérifié 390×780). |
| 14 | Alt text | ✅ | Audit fait : 1 seul `<img>` sans alt (aperçu document) corrigé ; photos de villes = backgrounds CSS décoratifs (pas d'alt requis). |
| 15 | Temps de réponse (Render) | ✅/⚠️ | `/health` en place. Webhook Stripe **idempotent vérifié** (garde `payment_status !== 'paid'`). **Reco** : ping externe (cron-job.org / UptimeRobot) toutes les 10 min sur `/health` pour éviter les cold starts ; **passer au tier payant Render avant la haute saison** (cold start pendant un paiement = panier abandonné). |
| 16 | Google Analytics (GA4) | ✅ | `public/consent.js` : GA4 chargé **après consentement** (bandeau 4 langues), `page_view` SPA sur History API, helper `albawayTrack()`. GA id injecté par le SSR. Events câblés : `sign_up`, `search_trips`, `publish_trip`, `begin_checkout`, `purchase`. **Reco** : ajouter la valeur (commission) sur `purchase` (côté serveur) + `view_trip`. |
| 17 | Liens internes | ✅/⚠️ | Footer relie about/faq/legal/app. **Reco** : compléter par langue + lier les corridors entre eux si créés. |
| 18 | Schema (adapté) | ✅ | JSON-LD `Organization` global + `FAQPage` (/faq) + **`Trip` avec `offers`** sur `/trip/:id`. |
| 19 | Études de cas / témoignages | ✅ | Section « Historitë tona » sur l'accueil, alimentée par les vrais avis récents (`/api/reviews/recent`), 4 langues. |

## Ce qui a été livré
- `seo-inject.js` — middleware SSR (titres/meta/OG/hreflang/JSON-LD/GA par route+langue) + **FAQPage** sur /faq + **OG+JSON-LD Trip dynamiques** sur `/trip/:id`.
- `public/consent.js` — consentement cookies 4 langues + GA4 conditionné + `page_view` SPA + funnel complet (`sign_up`, `search_trips`, `publish_trip`, `begin_checkout`, `purchase`).
- **Consentement CGU/confidentialité à l'inscription** loggé en DB (`consent_terms/at/version`).
- **Avis post-trajet bidirectionnels** + contrainte unique + nb d'avis sur les cartes + **section témoignages** (4 langues, `/api/reviews/recent`).
- **CTA sticky mobile** + audit alt + correction OG image.
- `.env.example` (dont `NEXT_PUBLIC_GA_ID`).

## Reste ouvert (nécessite service externe ou features additionnelles)
1. **Keep-alive Render** : cron externe (cron-job.org / UptimeRobot) sur `/health` toutes les 10 min + bascule tier payant avant la saison (cold start pendant paiement = risque).
2. **Vraie image OG 1200×630** de marque (le partage utilise `/logo.png` en attendant) — idéalement OG image générée par trajet.
3. **Carte itinéraire** (Leaflet/OSM) sur les pages trajets (item 12).
4. ~~**Pages corridors** indexables~~ ✅ **FAIT** — `corridors.js` : **18 pages** `/trajets/:slug` (9 corridors × 2 sens, Suisse ⇄ Kosovo/Albanie/Macédoine) SSR autonomes, 4 langues, hreflang, JSON-LD `Trip`+`BreadcrumbList`, CTA vers recherche pré-remplie (`/search?from=&to=`), page index `/trajets`, maillage interne (retour + autres corridors) + liens footer accueil + sitemap. Testé Playwright (H1/title/canonical/JSON-LD/CTA, 4 langues, mobile).
5. **UI de notation côté conducteur** (backend déjà prêt) + footer localisé par langue (item 17).
6. Compléter le texte de `legal.html` (sous-traitants Resend + hébergeur DB + transferts hors UE).

> **Note tests** : SSR/FAQ/Trip/consentement validés par chargement du module + rendu statique (Playwright). Les parcours dépendant de la base (avis, paiement) nécessitent la DB Postgres live pour un test bout-en-bout.
