import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-next";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token if needed. Do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/admin")) {
    const redirectUrl = request.nextUrl.clone();

    if (!user) {
      redirectUrl.pathname = "/login";
      redirectUrl.search = "";
      redirectUrl.searchParams.set(
        "next",
        safeNextPath(request.nextUrl.pathname + request.nextUrl.search, "/admin")
      );
      return redirectKeepingSession(redirectUrl, supabaseResponse);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      redirectUrl.pathname = "/";
      redirectUrl.search = "";
      return redirectKeepingSession(redirectUrl, supabaseResponse);
    }
  }

  return supabaseResponse;
}

function redirectKeepingSession(url: URL, sessionResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}
