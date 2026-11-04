import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { authLinkKind, kindAfterSession } from "@/lib/auth-callback";

function publicOrigin(request: NextRequest) {
  const { origin } = new URL(request.url);
  if (process.env.NODE_ENV === "development") return origin;

  // Vercel terminates TLS in front of the app, so request.url can be an
  // internal host. Prefer the forwarded host, matching Supabase's Next.js guide.
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost && /^[A-Za-z0-9.-]+(?::\d+)?$/.test(forwardedHost)) {
    return `https://${forwardedHost}`;
  }
  return origin;
}

function loginRedirect(origin: string, params: Record<string, string>) {
  const url = new URL("/login", origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

function resetPasswordRedirect(origin: string, error?: string) {
  const url = new URL("/reset-password", origin);
  if (error) url.searchParams.set("error", error);
  return url;
}

function failureCode(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("code verifier") || lower.includes("pkce")) {
    return "same_browser";
  }
  return "invalid_link";
}

function failureRedirect(origin: string, kind: ReturnType<typeof authLinkKind>, message: string) {
  if (kind === "recovery") return resetPasswordRedirect(origin, failureCode(message));
  return loginRedirect(origin, { error: "confirm" });
}

// Signup confirmation and password recovery both return here.
// Only a recovery link continues to /reset-password. Confirming an email
// leaves the password from signup unchanged and asks the person to log in.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const kind = authLinkKind(type);

  if (!code && !tokenHash) {
    return NextResponse.redirect(
      kind === "recovery"
        ? resetPasswordRedirect(origin, "invalid_link")
        : loginRedirect(origin, { error: "confirm" })
    );
  }

  if (tokenHash && kind === "unknown") {
    return NextResponse.redirect(loginRedirect(origin, { error: "confirm" }));
  }

  const storedCookies: { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }[] = [];
  const storedHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach((cookie) => {
            storedCookies.push(cookie);
          });
          Object.assign(storedHeaders, headers);
        },
      },
    }
  );

  function redirectWithSession(url: URL) {
    const redirect = NextResponse.redirect(url);
    storedCookies.forEach(({ name, value, options }) => {
      redirect.cookies.set(name, value, options);
    });
    Object.entries(storedHeaders).forEach(([key, value]) => {
      redirect.headers.set(key, value);
    });
    return redirect;
  }

  let user: User | null = null;

  if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) return NextResponse.redirect(failureRedirect(origin, kind, error.message));
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code!);
    if (error) return NextResponse.redirect(failureRedirect(origin, kind, error.message));
    user = data.user;
  }

  const resolved = kindAfterSession(type, user);
  if (resolved === "recovery") {
    return redirectWithSession(resetPasswordRedirect(origin));
  }

  await supabase.auth.signOut();
  return redirectWithSession(loginRedirect(origin, { confirmed: "1" }));
}
