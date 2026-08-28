# Service ERP setup (separate from Uma Service)

Service ERP is a **multi-tenant** SaaS clone. Never point this project at Uma’s Supabase or Vercel.

## 1. Supabase (new project)

1. Create a new Supabase project (not Uma’s).
2. Copy pooler `DATABASE_URL` (port 6543) and direct `DIRECT_URL` (port 5432) into `.env`.
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and storage bucket `product-photos`.
4. From this repo:

```bash
npm install
npm run db:push
npm run db:seed
```

Seed creates tenant slug **`demo`**, technicians Tech A/B/C, and optional admin from `ADMIN_MOBILE` / `ADMIN_PASSWORD`.

## 2. Vercel (new project)

1. Import GitHub repo `anishjak-png/service-erp` into a **new** Vercel project.
2. Set the same env vars as `.env.example` (never reuse Uma production secrets).
3. Keep `WHATSAPP_ENABLED=false` until Meta templates (`se_*`) are approved for this product.
4. Deploy production.

## 3. Local / preview tenancy

- Signup: `/signup`
- Login with shop slug: `/?tenant=demo` or subdomain `demo.localhost:3000`
- Header `x-tenant-slug: demo` also works for API tests

## 4. Print bridge (per shop PC)

See [PRINT_BRIDGE_TENANT.md](./PRINT_BRIDGE_TENANT.md).
