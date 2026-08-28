# Print bridge — multi-tenant notes

Each shop PC runs one Print Bridge agent against **Service ERP’s** Supabase (not Uma).

## Required env on the shop PC

Optional: set `TENANT_ID=<tenant cuid>` so the agent ignores other shops’ print jobs.

```
TENANT_ID=clxxxxxxxx
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
BRANCH_ID=main
PRINTER_ID=counter-1
PRINTER_IP=192.168.x.x
PRINTER_PORT=9100
NEXT_PUBLIC_SHOP_NAME=Demo Shop
NEXT_PUBLIC_SHOP_PHONE=...
```

Prefer **one printer route per tenant**. Today Realtime also filters by `branchId` + `printerId`; you can set `BRANCH_ID=<tenantSlug>` for clearer isolation.

## Run

```bash
npm run print-bridge
```

## Tenant isolation

- `PrintJob` rows include `tenantId`.
- Receipt enqueue always stamps the job’s `tenantId`.
- Prefer configuring each shop PC with credentials for Service ERP only.
- Do not share Uma’s print-bridge `.env` with Service ERP.

## Shop branding on receipts

Receipt header uses `NEXT_PUBLIC_SHOP_NAME` / phone from the bridge env. Align those with Admin → Shop settings for that tenant.
