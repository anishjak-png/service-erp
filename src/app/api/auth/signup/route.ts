import { NextRequest, NextResponse } from "next/server";
import { CreateShopError, createShop } from "@/lib/create-shop";
import { isSignupOpen, isValidSignupInvite } from "@/lib/signup-guard";

export async function POST(request: NextRequest) {
  try {
    if (!isSignupOpen()) {
      return NextResponse.json(
        { error: "Shop signup is closed. Contact Service ERP." },
        { status: 403 }
      );
    }

    const body = await request.json();
    if (!isValidSignupInvite(body.inviteCode)) {
      return NextResponse.json(
        { error: "Invalid or missing invite code" },
        { status: 403 }
      );
    }

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
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof CreateShopError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("[POST /api/auth/signup]", error);
    const message =
      error instanceof Error ? error.message : "Signup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
