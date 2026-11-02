import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminMfaRedirect, adminMfaRequired } from "@/lib/admin-mfa";
import { safeNextPath } from "@/lib/safe-next";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  request.headers.set("x-pathname", request.nextUrl.pathname);

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
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

    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const assuranceKnown = !assuranceError && assurance != null;
    if (assuranceError) {
      console.error("Could not read authenticator assurance:", assuranceError.message);
    }
    const target = adminMfaRedirect({
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      currentLevel: assurance?.currentLevel === "aal2" ? "aal2" : "aal1",
      hasVerifiedFactor: assurance?.nextLevel === "aal2",
      requireEnrollment: adminMfaRequired(),
      assuranceKnown,
    });
    if (target) {
      const destination = new URL(target, request.nextUrl.origin);
      redirectUrl.pathname = destination.pathname;
      redirectUrl.search = destination.search;
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
