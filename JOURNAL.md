# RockHound — Journal de bord

Ce fichier retrace les sessions de travail avec Claude Code.
**À lire en début de session** pour reprendre là où on s'est arrêtés.

---

## Session 2026-04-02 (reconstituée depuis la mémoire)

### Ce qui a été fait
Travail de planification complet avec BMad :

1. **Brief produit** → `_bmad-output/planning-artifacts/product-brief.md`
   - Application web cartographique pour prospecteurs PACA (fossiles, minéraux)
   - Problème résolu : InfoTerre/BRGM lent, fragmenté, inaccessible sur le terrain
   - Solution : carte IGN/BRGM interactive + catalogue 26+ sites + contributions communautaires

2. **PRD** → `_bmad-output/planning-artifacts/prd.md`
   - 31 exigences fonctionnelles, 15 exigences non-fonctionnelles
   - 12 étapes complètes

3. **Validation PRD** → `_bmad-output/planning-artifacts/prd-validation-report.md`

4. **Architecture** → `_bmad-output/planning-artifacts/architecture.md`
   - Stack : HTML/CSS/JS vanilla, Leaflet.js 1.9.4, Vercel free tier
   - Pas de framework JS, pas de build step
   - Proxy serverless pour BRGM (CORS obligatoire)
   - Vercel Blob pour persistance communautaire (sans DB)
   - Resend pour emails de notification/modération

5. **Épopées & Stories** → `_bmad-output/planning-artifacts/epics.md`
   - 6 épopées, 14 stories
   - Épopée 1 : Mise en ligne
   - Épopée 2 : Carte & Identification géologique
   - Épopée 3 : Catalogue de sites
   - Épopée 4 : Contributions communautaires
   - Épopée 5 : Éditeur personnel
   - Épopée 6 : Découvrabilité (SEO)

6. **Validation implémentation** → `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-02.md`
   - Statut : **READY** — 0 problème bloquant

---

## Session 2026-04-03

### Où on en est
- Planification 100% terminée
- **Implémentation pas encore commencée**

### Ce qu'on a discuté
- Revue de l'état du projet
- Clarification des 4 étapes de setup nécessaires avant que Claude s'occupe du code
- Mise en place de ce journal + du système de mémoire automatique

### Prochaine action — Épopée 1, Story 1.1

**Étape 1 — GitHub CLI (terminal)**
```bash
gh repo create rockhound --public --source=. --remote=origin --push
```

**Étape 2 — Vercel CLI (terminal)**
```bash
vercel
vercel env add ADMIN_TOKEN
vercel env add RESEND_API_KEY
vercel env add BLOB_READ_WRITE_TOKEN
vercel env add ADMIN_EMAIL
vercel --prod
```

**Étape 3 — Resend (navigateur)**
- Créer compte gratuit sur resend.com
- Récupérer la clé API → coller dans `RESEND_API_KEY`

**Étape 4 — Vercel Blob (navigateur)**
- Dashboard vercel.com → Storage → Créer un Blob
- Récupérer le token → coller dans `BLOB_READ_WRITE_TOKEN`

### Une fois ces 4 étapes faites
Dire à Claude Code **"setup terminé, on commence l'implémentation"** → il s'occupe de tout le code.

---
