/**
 * Enable RLS + revoke anon/authenticated on all public tables.
 *   npx tsx scripts/enable-rls.ts
 *
 * Same statements as prisma/enable-rls.sql (run there in SQL Editor if this fails).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ENABLE_RLS = `
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
`;

async function main() {
  await prisma.$executeRawUnsafe(ENABLE_RLS);
  await prisma.$executeRawUnsafe(
    `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated`
  );
  await prisma.$executeRawUnsafe(
    `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated`
  );
  await prisma.$executeRawUnsafe(
    `REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated`
  );
  await prisma.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated`
  );
  await prisma.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated`
  );
  console.log("RLS enabled on public tables; anon/authenticated revoked.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
