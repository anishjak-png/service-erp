# Service ERP setup (separate from Uma Service)

Service ERP is a **multi-tenant** SaaS clone. Never point this project at Uma’s Supabase or Vercel.

GitHub: `https://github.com/anishjak-png/service-erp` (private)

## Checklist when you return

Do these once (takes ~15–20 minutes). Code is already on `main`.

### A. New Supabase project

1. [supabase.com](https://supabase.com) → **New project** (name e.g. `service-erp`).
2. Settings → Database → copy:
   - **Pooler** connection string → `DATABASE_URL` (port **6543**, add `?pgbouncer=true` if missing)
   - **Direct** connection string → `DIRECT_URL` (port **5432**)
3. Settings → API → copy `SUPABASE_URL` and `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
4. Storage → create bucket **`product-photos`** (public or signed URLs as you prefer for product photos)
5. In this repo folder (`service-erp`):

```bash
copy .env.example .env
# edit .env with the values above + a long SESSION_SECRET
npm install
npm run db:push
npm run db:seed
```

Seed creates tenant slug **`demo`**, technicians Tech A/B/C, and optional admin from `ADMIN_MOBILE` / `ADMIN_PASSWORD`.

### B. New Vercel project

1. [vercel.com](https://vercel.com) → **Add New…** → Project → import **`anishjak-png/service-erp`**
2. Do **not** link this to the Uma Service Vercel project
3. Environment variables (Production): paste from `.env.example` / your `.env`
   - Required: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`
   - Recommended: `ADMIN_MOBILE`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_APP_URL` (after first deploy)
   - Keep `WHATSAPP_ENABLED=false` until Meta is set up for this product
4. Deploy → open the URL → `/signup` or `/?tenant=demo`

### C. Smoke test

- [ ] Login as seeded admin with `/?tenant=demo`
- [ ] Create a job, open Job Details
- [ ] Signup a second shop and confirm jobs do not cross tenants
- [ ] (Optional) Print bridge: [PRINT_BRIDGE_TENANT.md](./PRINT_BRIDGE_TENANT.md)

## Local / preview tenancy

- Signup: `/signup`
- Login with shop slug: `/?tenant=demo` or subdomain `demo.localhost:3000`
- Header `x-tenant-slug: demo` also works for API tests
- Public track: `/track?tenant=demo` (tenant required)

## Print bridge (per shop PC)

See [PRINT_BRIDGE_TENANT.md](./PRINT_BRIDGE_TENANT.md).
