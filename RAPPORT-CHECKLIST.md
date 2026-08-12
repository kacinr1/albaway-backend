# RAPPORT CHECKLIST — ALBAWAY.CH

Plateforme de covoiturage diaspora albanaise (SPA vanilla JS + Express + PostgreSQL + Stripe + Socket.io · 4 langues sq/fr/de/en).
Date : 2026-08-12. `node --check` OK sur les fichiers modifiés. Injection SEO testée en isolation (4 routes × 4 langues).

> **Spécificité SPA traitée en priorité** : un middleware SSR (`seo-inject.js`, monté avant `express.static`) réécrit `<title>`, meta description, Open Graph, `hreflang`, `<html lang>` et JSON-LD selon la route ET la langue (`?lang=` ou `Accept-Language`, défaut `sq`). Les crawlers et les partages WhatsApp/Facebook (canal n°1) reçoivent désormais les bonnes balises par page.

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 1 | Titres uniques (SSR) | ✅ | Middleware `seo-inject.js` : titres par route (/, /about, /faq, /legal) × 4 langues. |
| 2 | Page de remerciement | ⚠️ | Confirmations paiement/réservation via notifications temps réel + emails. **Reco** : page/écran dédié post-paiement avec event GA4 `purchase` (valeur = commission). |
| 3 | robots.txt + sitemap.xml | ✅ | Présents (`/api`, `/dashboard` bloqués ; `/admin` en `X-Robots-Tag: noindex`). **Reco** : ajouter les pages corridors au sitemap si créées. |
| 4 | Avis clients | ✅ | Notation **bidirectionnelle** (passager↔conducteur) + **contrainte unique** (from_id, booking_id) + moyenne recalculée depuis la table. **Nb d'avis affiché sur les cartes de trajet**. Endpoint public `/api/reviews/recent` + **section témoignages sur l'accueil** (4 langues). **Reco** : ajouter l'UI de notation côté conducteur (backend prêt). |
| 5 | CTA sticky mobile | ⚠️ | Hero avec recherche + CTA présents. **Reco** : barre sticky « Kërko udhëtim » sur pages de contenu (hors flow paiement). |
| 6 | Meta descriptions (SSR) | ✅ | Uniques par route × 4 langues via le middleware. |
| 7 | Fil d'Ariane | N/A | Pertinent seulement si les pages corridors (item 3) sont créées. |
| 8 | Confidentialité + CGU | ✅ | `legal.html` couvre CGU (Kushtet), confidentialité, GDPR et Stripe. **Checkbox consentement CGU+confidentialité à l'inscription ajoutée + loggée en DB** (`consent_terms`, `consent_at`, `consent_version` ; endpoint rejette l'inscription sans consentement). **Reco** : citer explicitement Resend + hébergeur DB + transferts hors UE dans le texte de `legal.html`. |
| 9 | Images de partage RS | ✅ | Route serveur `/trip/:id` : OG/Twitter **dynamiques par trajet** (titre + « Genève → Pristina · date · prix · places ») en version textuelle riche. OG image corrigée (→ `/logo.png`). **Reco** : créer une vraie image 1200×630 de marque (voire OG image générée par trajet). |
| 10 | FAQ + schema | ✅ | `faq.html` + JSON-LD `FAQPage` (16 Q/R) injecté côté serveur par `seo-inject.js`. |
| 11 | 404 personnalisée | ✅ | `404.html` servie avec statut HTTP 404 (fallback Express). |
| 12 | Carte + itinéraire | ⚠️ | **Reco** : afficher l'itinéraire du corridor (Leaflet/OSM) sur les pages trajets. |
| 13 | CTA sans scroller | ⚠️ | Module de recherche dans le hero. **Reco** : vérifier 375×667 que départ/arrivée/date sont visibles sans scroll. |
| 14 | Alt text | ⚠️ | À auditer sur les images de villes (`public/images/cities`). |
| 15 | Temps de réponse (Render) | ✅/⚠️ | `/health` en place. Webhook Stripe **idempotent vérifié** (garde `payment_status !== 'paid'`). **Reco** : ping externe (cron-job.org / UptimeRobot) toutes les 10 min sur `/health` pour éviter les cold starts ; **passer au tier payant Render avant la haute saison** (cold start pendant un paiement = panier abandonné). |
| 16 | Google Analytics (GA4) | ✅ | `public/consent.js` : GA4 chargé **après consentement** (bandeau 4 langues), `page_view` SPA sur History API, helper `albawayTrack()`. GA id injecté par le SSR. Events câblés : `sign_up`, `search_trips`, `publish_trip`, `begin_checkout`, `purchase`. **Reco** : ajouter la valeur (commission) sur `purchase` (côté serveur) + `view_trip`. |
| 17 | Liens internes | ✅/⚠️ | Footer relie about/faq/legal/app. **Reco** : compléter par langue + lier les corridors entre eux si créés. |
| 18 | Schema (adapté) | ✅ | JSON-LD `Organization` global + `FAQPage` (/faq) + **`Trip` avec `offers`** sur `/trip/:id`. |
| 19 | Études de cas / témoignages | ✅ | Section « Historitë tona » sur l'accueil, alimentée par les vrais avis récents (`/api/reviews/recent`), 4 langues. |

## Ce qui a été livré dans cette passe
- `seo-inject.js` — middleware SSR (titres/meta/OG/hreflang/JSON-LD/GA par route+langue), monté avant `express.static`.
- `public/consent.js` — consentement cookies 4 langues + GA4 conditionné + `page_view` SPA.
- Correction OG image cassée (→ `/logo.png`).
- `.env.example` (dont `NEXT_PUBLIC_GA_ID`).

## Recommandations prioritaires (prochaine passe)
1. **Légal** : checkbox consentement CGU/confidentialité à l'inscription, loggée en DB (RGPD/LPD + Stripe LIVE).
2. **OG dynamique par trajet** + vraie image de marque 1200×630 (canal de croissance n°1).
3. **Avis post-trajet** (UI + contrainte DB) et affichage sur cartes/profils.
4. **Events funnel GA4** dans `app.js` + page de remerciement `purchase`.
5. **Keep-alive Render** (cron externe) et bascule tier payant avant la saison estivale.
6. **Pages corridors** indexables (`/trajets/geneve-pristina`…) — fort levier SEO diaspora.
