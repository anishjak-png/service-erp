import { NextRequest, NextResponse } from "next/server";
import { getSession, isDeviceApproved } from "@/lib/session";
import { resolveTenantSlugFromRequest } from "@/lib/tenant";

const publicPaths = [
  "/",
  "/j",
  "/track",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/device-pending",
  "/api/webhooks/whatsapp",
];
const publicPrefixes = ["/j/", "/api/track"];

function isPublic(pathname: string): boolean {
  if (publicPaths.includes(pathname)) return true;
  return publicPrefixes.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  const tenantSlug = resolveTenantSlugFromRequest({
    host: request.headers.get("host"),
    searchParams: request.nextUrl.searchParams,
    headerSlug: request.headers.get("x-tenant-slug"),
  });

  const requestHeaders = new Headers(request.headers);
  if (tenantSlug) {
    requestHeaders.set("x-tenant-slug", tenantSlug);
  }

  const session = await getSession();

  if (pathname === "/" && session.isLoggedIn) {
    if (!session.tenantId) {
      return NextResponse.redirect(new URL("/?reauth=1", request.url));
    }
    if (!isDeviceApproved(session)) {
      return NextResponse.redirect(new URL("/device-pending", request.url));
    }
    const home =
      session.role === "technician"
        ? "/jobs/pending?scope=my"
        : "/dashboard";
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (isPublic(pathname)) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  if (!session.isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!session.tenantId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Tenant context required — please sign in again" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/?reauth=1", request.url));
  }

  if (!isDeviceApproved(session)) {
    const allowedWhilePending =
      pathname === "/device-pending" ||
      pathname === "/api/auth/me" ||
      pathname === "/api/auth/logout";

    if (pathname.startsWith("/api/") && !allowedWhilePending) {
      return NextResponse.json(
        { error: "device_pending", deviceStatus: session.deviceStatus },
        { status: 403 }
      );
    }

    if (!allowedWhilePending && !pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/device-pending", request.url));
    }
  }

  if (session.role === "technician") {
    const blocked =
      pathname.startsWith("/admin") ||
      pathname.startsWith("/dashboard");
    if (blocked) {
      return NextResponse.redirect(new URL("/jobs/pending?scope=my", request.url));
    }
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
