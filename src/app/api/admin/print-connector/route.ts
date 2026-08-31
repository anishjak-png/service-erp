import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/auth";
import { zipStoreFiles } from "@/lib/zip-store";

async function collectDir(root: string, prefix: string) {
  const files: Array<{ name: string; data: Buffer }> = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await collectDir(full, rel)));
    } else {
      files.push({ name: rel, data: await readFile(full) });
    }
  }
  return files;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const repoRoot = process.cwd();
  const files = [
    ...(await collectDir(path.join(repoRoot, "scripts/shop-pc"), "shop-pc")),
    ...(await collectDir(
      path.join(repoRoot, "scripts/print-bridge"),
      "print-bridge"
    )),
    {
      name: ".env.shop.example",
      data: await readFile(path.join(repoRoot, ".env.shop.example")),
    },
    {
      name: "README.txt",
      data: Buffer.from(
        [
          "Service ERP Print Connector",
          "",
          "1. Unzip this folder on the shop Windows PC.",
          "2. Run shop-pc/INSTALL.bat once.",
          "3. Copy .env.shop.example to .env and set:",
          "   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
          "   BRANCH_ID=main",
          "   PRINTER_ID=<same ID as Admin → Printers>",
          "   PRINTER_NAME=<Windows / LAN printer name>",
          "   PRINTER_IP and PRINTER_PORT",
          "4. For a second or third printer, install another connector",
          "   with a different PRINTER_ID and match it in Admin → Printers.",
          "5. Assign job receipts and token receipts to the right printer.",
          "",
        ].join("\n"),
        "utf8"
      ),
    },
  ];

  const zip = zipStoreFiles(files);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition":
        'attachment; filename="service-erp-print-connector.zip"',
    },
  });
}
