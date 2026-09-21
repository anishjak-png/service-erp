import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { CreateShopError, createShop } from "@/lib/create-shop";

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
      createdAt: true,
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
