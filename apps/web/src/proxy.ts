import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Chequeo optimista: solo mira si la cookie existe, no valida contra la base
// (Proxy no es un lugar apto para eso — ver domain/infraestructura.md).
// La validación real del token pasa en apps/web/src/app/dashboard/layout.tsx.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/dashboard/:path*",
};
