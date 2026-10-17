import { NextResponse, type NextRequest } from "next/server";

/**
 * Route protection (UX layer). Reads the role from the JWT cookie to redirect early:
 *  - logged out → /login
 *  - wrong role (student on /coach, coach on /student) → own home
 * The token is only decoded here, NOT verified — the API verifies it on every request,
 * so a forged cookie gets past this redirect but is rejected by every endpoint.
 */

type Role = "coach" | "student";

function readSession(req: NextRequest): { role: Role } | null {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      role?: Role;
      exp?: number;
    };
    if (!payload.role || (payload.exp && payload.exp * 1000 < Date.now())) return null;
    return { role: payload.role };
  } catch {
    return null;
  }
}

const home = (role: Role) => (role === "coach" ? "/coach" : "/student");

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = readSession(req);
  const redirect = (to: string) => NextResponse.redirect(new URL(to, req.url));

  if (pathname === "/" || pathname === "/login") {
    return session ? redirect(home(session.role)) : pathname === "/" ? redirect("/login") : NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/coach") && session.role !== "coach") return redirect(home(session.role));
  if (pathname.startsWith("/student") && session.role !== "student") return redirect(home(session.role));

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/coach/:path*", "/student/:path*", "/match/:path*"],
};
