# Service ERP

Multi-tenant SaaS for appliance service job cards (Next.js + Prisma + Supabase + Vercel).

**This is not Uma Service.** Use a separate Supabase project and a separate Vercel project. Never reuse Uma production credentials.

## Features

- Multi-tenant shops (created from `/platform` → own `tenantId` data isolation)
- Job cards with auto-generated numbers (`SE-…` by default, per-shop prefix configurable)
- Staff login (mobile + password only) with device approval; each mobile belongs to one shop
- Search, delivery workflow, technician My Jobs
- Optional LAN thermal printing (Windows Print Bridge)
- WhatsApp/Meta optional (`WHATSAPP_ENABLED=false` by default)
- No spare-parts / sales module (removed for SaaS MVP)

## Quick start (new Supabase)

1. Create a **new** [Supabase](https://supabase.com) project
2. Copy `.env.example` → `.env` and fill `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`
3. Run:

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

- Staff login: `/` (mobile + password)
- Platform (create companies): `/platform/login`
- Demo tenant (after seed): log in with `ADMIN_MOBILE` / `ADMIN_PASSWORD`
- Full checklist: **[docs/SAAS_SETUP.md](docs/SAAS_SETUP.md)**

### Seed admin

| Variable | Purpose |
|----------|---------|
| `ADMIN_MOBILE` | 10-digit mobile for first admin on demo tenant |
| `ADMIN_PASSWORD` | Password for that admin |

## Deploy (new Vercel)

1. `npm run db:push` and `npm run db:seed` once against the **Service ERP** Supabase
2. Import GitHub `anishjak-png/service-erp` into a **new** Vercel project
3. Set env vars from `.env.example` (never Uma’s)
4. Deploy

## Print bridge

See [docs/PRINT_BRIDGE_TENANT.md](docs/PRINT_BRIDGE_TENANT.md) and [docs/PRINT_SETUP.md](docs/PRINT_SETUP.md).

## Docs

| Doc | Purpose |
|-----|---------|
| [docs/SAAS_SETUP.md](docs/SAAS_SETUP.md) | Supabase + Vercel for Service ERP |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Database connection details |
| [docs/PRINT_SETUP.md](docs/PRINT_SETUP.md) | Thermal printer |
| [docs/UI_GUIDELINES.md](docs/UI_GUIDELINES.md) | Mobile UI rules |
