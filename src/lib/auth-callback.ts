export type AuthLinkKind = "signup" | "recovery" | "unknown";

export function authLinkKind(type: string | null | undefined): AuthLinkKind {
  if (type === "signup" || type === "email") return "signup";
  if (type === "recovery") return "recovery";
  return "unknown";
}

/**
 * A PKCE code often arrives without `type`. A recovery link is the only one
 * that should open the new-password screen. A confirmed account with no
 * recovery timestamp is a signup confirmation.
 */
export function kindAfterSession(
  type: string | null | undefined,
  user: { recovery_sent_at?: string | null; email_confirmed_at?: string | null } | null
): AuthLinkKind {
  const explicit = authLinkKind(type);
  if (explicit !== "unknown") return explicit;
  if (!user?.recovery_sent_at) return "signup";

  const recoveryAt = Date.parse(user.recovery_sent_at);
  const confirmedAt = user.email_confirmed_at ? Date.parse(user.email_confirmed_at) : Number.NaN;
  if (Number.isNaN(recoveryAt)) return "signup";
  if (Number.isNaN(confirmedAt) || recoveryAt >= confirmedAt - 2000) return "recovery";
  return "signup";
}

export function callbackSuccessPath(kind: AuthLinkKind): "/login?confirmed=1" | "/reset-password" {
  return kind === "recovery" ? "/reset-password" : "/login?confirmed=1";
}
