import { NextResponse, type NextRequest } from "next/server";

/**
 * Gives every browser an anonymous id on its first page view.
 *
 * Minting it lazily when an order is placed looked fine until two orders went
 * out at once: neither request had the cookie yet, both minted their own, only
 * one Set-Cookie survived, and the guest's history lost the other order.
 * Issuing it before anything is ordered removes the race entirely.
 *
 * It is not a login. It identifies a browser so that order history is the
 * guest's own — nothing more.
 */

const COOKIE = "ls_guest";
const MAX_AGE = 60 * 60 * 24 * 180;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.get(COOKIE)) {
    response.cookies.set(COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE,
    });
  }
  return response;
}

export const config = {
  /* Everything except static assets and the staff area — back of house has its
     own session and no use for a guest id. */
  matcher: ["/((?!_next/static|_next/image|admin|favicon.ico|grain.png|uploads).*)"],
};
