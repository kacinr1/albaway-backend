# AlbaWay — Contexte projet

## C'est quoi ?
Plateforme de bashkudhëtim (covoiturage) pour la diaspora albanaise en Europe.
Anciennement "bla bla shqip" → rebrandé AlbaWay.

## URLs
- **Production:** https://albaway.ch
- **Render:** https://albaway.onrender.com
- **GitHub:** https://github.com/kacinr1/albaway-backend

## Stack
- **Backend:** Node.js + Express + Socket.io + Stripe
- **Database:** JSON file (`data.json`)
- **Frontend:** SPA vanilla JS (`public/app.js`) + GSAP
- **Hébergement:** Render (free) + domaine albaway.ch (Infomaniak)
- **Mobile:** React Native / Expo (`../mobile/`)

## Fichiers clés
- `server.js` — API REST + Socket.io temps réel + Stripe webhook
- `public/app.js` — SPA frontend complet (~950 lignes)
- `public/i18n.js` — Traductions sq/fr/de/en
- `public/style.css` — Design glassmorphism dark
- `.env` — Clés Stripe (ne jamais committer)

## Fonctionnalités déployées
- Auth register/login/logout
- Publier / chercher / réserver trajets
- Accept/refus en temps réel (Socket.io)
- **Paiement Stripe** → révèle contacts des deux parties après paiement
- **Chat temps réel** entre chauffeur et passager (Socket.io)
- Notation des chauffeurs (1-5 étoiles)
- Autocomplete villes intelligent (geneve=Geneva, zurich=Zürich...)
- **Switcher 4 langues** : albanais (défaut) / français / allemand / anglais
- Vidéo de fond (Video Project 1.mp4, opacité 15%)

## Comptes démo
- arben@demo.com / demo123
- blerina@demo.com / demo123
- ilir@demo.com / demo123

## Stripe
- Mode test actif
- Webhook: https://albaway.ch/api/stripe/webhook
- Variables dans Render: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET

## Déploiement
```bash
# Lancer en local
node server.js
# → http://localhost:3001

# Déployer (auto via Render quand on push sur GitHub)
git add -A && git commit -m "..." && git push
```

## Ce qui reste à faire
- Finaliser toutes les strings i18n dans app.js (publish form, trip detail, auth modal)
- Stripe passer en mode production (live keys)
- Base de données persistante (PostgreSQL ou MongoDB) pour remplacer data.json
- App mobile (React Native / Expo)
