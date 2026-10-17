import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { CreateShopError, createShop } from "@/lib/create-shop";
import { parseLicenseDate } from "@/lib/tenant";

export async function GET() {
  const { error } = await requirePlatformAdmin();
  if (error) return error;

  const shops = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      jobPrefix: true,
      status: true,
      tariffNotes: true,
      adminPasswordNote: true,
      licenseExpiresAt: true,
      createdAt: true,
      staffUsers: {
        where: { role: "admin" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { name: true, mobile: true },
      },
      _count: {
        select: { jobCards: true, staffUsers: true },
      },
    },
  });

  return NextResponse.json({
    shops: shops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      phone: shop.phone,
      jobPrefix: shop.jobPrefix,
      status: shop.status,
      tariffNotes: shop.tariffNotes,
      adminName: shop.staffUsers[0]?.name ?? "",
      adminMobile: shop.staffUsers[0]?.mobile ?? "",
      adminPassword: shop.adminPasswordNote,
      licenseExpiresAt: shop.licenseExpiresAt,
      createdAt: shop.createdAt,
      jobCount: shop._count.jobCards,
      staffCount: shop._count.staffUsers,
    })),
    totals: {
      all: shops.length,
      active: shops.filter((s) => s.status === "active").length,
      suspended: shops.filter((s) => s.status === "suspended").length,
    },
  });
}

export async function POST(request: NextRequest) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const created = await createShop({
      shopName: typeof body.shopName === "string" ? body.shopName : "",
      adminName: typeof body.adminName === "string" ? body.adminName : "",
      adminMobile:
        typeof body.adminMobile === "string" ? body.adminMobile : "",
      adminPin:
        typeof body.adminPin === "string"
          ? body.adminPin
          : typeof body.password === "string"
            ? body.password
            : "",
      jobPrefix: typeof body.jobPrefix === "string" ? body.jobPrefix : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      tariffNotes:
        typeof body.tariffNotes === "string" ? body.tariffNotes : undefined,
      licenseExpiresAt:
        typeof body.licenseExpiresAt === "string"
          ? parseLicenseDate(body.licenseExpiresAt)
          : undefined,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof CreateShopError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/platform/shops]", err);
    return NextResponse.json({ error: "Could not create shop" }, { status: 500 });
  }
}
