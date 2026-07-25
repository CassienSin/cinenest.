import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export default async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() verifies the JWT locally when possible — far faster than
  // getUser(), which makes a network round trip on every navigation.
  let isLoggedIn = false;
  try {
    const { data } = await supabase.auth.getClaims();
    isLoggedIn = Boolean(data?.claims);
  } catch {
    isLoggedIn = false;
  }

  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith("/login");

  if (!isLoggedIn && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};