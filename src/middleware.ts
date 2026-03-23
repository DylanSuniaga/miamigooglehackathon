import { type NextRequest, NextResponse } from "next/server";

export async function middleware(_request: NextRequest) {
  // Auth is deferred — passthrough all requests
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
