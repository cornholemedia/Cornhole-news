import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

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

// Completes Supabase's password-reset email link, then sends the user to
// /reset-password with a session cookie so they can call updateUser.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const isRecoveryToken = Boolean(tokenHash && type === "recovery");

  if (!code && !isRecoveryToken) {
    return NextResponse.redirect(resetPasswordRedirect(origin, "invalid_link"));
  }

  const successUrl = resetPasswordRedirect(origin);
  const response = NextResponse.redirect(successUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    }
  );

  if (isRecoveryToken) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash!,
    });
    if (error) {
      return NextResponse.redirect(resetPasswordRedirect(origin, failureCode(error.message)));
    }
    return response;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code!);
  if (error) {
    return NextResponse.redirect(resetPasswordRedirect(origin, failureCode(error.message)));
  }
  return response;
}
