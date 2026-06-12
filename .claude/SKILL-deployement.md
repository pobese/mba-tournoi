# SKILL : Déploiement & DevOps

Consulter ce fichier pour tout ce qui touche au déploiement, DNS, CI/CD.

---

## Architecture de déploiement

```
Développeur (local)
     │
     ├── supabase (local via Docker)
     └── Next.js dev server (localhost:3000)
          
     Push vers GitHub
          │
          ▼
     Vercel (auto-deploy sur push main)
          │  URL : mba.stellix.fr
          │
          └── Supabase Cloud (prod)
               URL : [projet].supabase.co
```

---

## Configuration DNS chez Gandi

1. Aller dans Gandi.net → stellix.fr → DNS Records
2. Ajouter un enregistrement CNAME :
   - **Nom** : `mba`
   - **Type** : CNAME
   - **Valeur** : `cname.vercel-dns.com`
   - **TTL** : 10800 (ou laisser par défaut)
3. Dans Vercel → Project Settings → Domains → Add domain : `mba.stellix.fr`
4. Vercel vérifiera automatiquement le CNAME
5. SSL auto-provisionné par Vercel (Let's Encrypt)

> ⚠️ Ne pas confondre avec stellix.fr (app finance) — seul le sous-domaine `mba` est utilisé ici.

---

## Setup Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Linker le projet (première fois)
vercel link

# Variables d'env à ajouter dans Vercel Dashboard :
# Project Settings → Environment Variables
NEXT_PUBLIC_SUPABASE_URL          # Production + Preview + Development
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Production + Preview + Development
SUPABASE_SERVICE_ROLE_KEY         # Production uniquement (jamais exposée)
NEXT_PUBLIC_APP_URL               # https://mba.stellix.fr (Production)
```

---

## Setup Supabase local

```bash
# Prérequis : Docker Desktop lancé
npm install supabase --save-dev

# Initialiser Supabase dans le projet
npx supabase init

# Lancer Supabase local
npx supabase start
# → Studio disponible sur http://localhost:54323
# → API sur http://localhost:54321

# Arrêter
npx supabase stop

# Après avoir modifié le schéma localement
npx supabase db diff --schema public -f <migration_name>
# Cela crée un fichier dans supabase/migrations/

# Push les migrations vers Supabase cloud (prod)
npx supabase db push

# Générer les types TypeScript
npx supabase gen types typescript --local > src/types/database.ts
```

---

## Workflow de développement

```bash
# 1. Toujours partir d'une branche feature
git checkout -b feature/american-tournament

# 2. Dev avec Supabase local
npx supabase start
npm run dev

# 3. Si modification de schéma DB
npx supabase db diff --schema public -f add_standings_table
# → Vérifier le fichier généré dans supabase/migrations/
# → Le commiter avec le code

# 4. Tests
npm run test

# 5. Push + PR → Vercel déploie automatiquement une preview URL

# 6. Merge main → déploiement prod auto
```

---

## `.gitignore` à vérifier

```
.env.local
.env.*.local
.supabase/
node_modules/
.next/
```

Le fichier `.env.example` doit toujours être commité avec toutes les clés (sans valeurs).

---

## Commandes de débogage production

```bash
# Voir les logs Vercel
vercel logs mba.stellix.fr

# Vérifier les variables d'env en prod
vercel env pull .env.production.local

# Rollback si besoin
vercel rollback
```

---

## next.config.ts de référence

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // Si on ajoute des avatars plus tard
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Strict mode pour détecter les problèmes en dev
  reactStrictMode: true,
}

export default nextConfig
```