import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { authLinkKind, callbackSuccessPath, kindAfterSession } from "./auth-callback.ts";

const route = readFileSync(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
const signup = readFileSync(new URL("../app/signup/actions.ts", import.meta.url), "utf8");
const recovery = readFileSync(new URL("../app/forgot-password/actions.ts", import.meta.url), "utf8");
const login = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");

test("only a recovery link opens the new-password page", () => {
  assert.equal(authLinkKind("signup"), "signup");
  assert.equal(authLinkKind("email"), "signup");
  assert.equal(authLinkKind("recovery"), "recovery");
  assert.equal(authLinkKind(null), "unknown");
  assert.equal(callbackSuccessPath("signup"), "/login?confirmed=1");
  assert.equal(callbackSuccessPath("recovery"), "/reset-password");

  assert.equal(
    kindAfterSession("signup", { recovery_sent_at: "2026-11-04T12:00:00.000Z" }),
    "signup"
  );
  assert.equal(kindAfterSession(null, { recovery_sent_at: null, email_confirmed_at: null }), "signup");
  assert.equal(
    kindAfterSession(null, {
      email_confirmed_at: "2026-11-01T12:00:00.000Z",
      recovery_sent_at: "2026-11-04T12:00:00.000Z",
    }),
    "recovery"
  );
  assert.equal(
    kindAfterSession(null, {
      recovery_sent_at: "2026-11-01T12:00:00.000Z",
      email_confirmed_at: "2026-11-04T12:00:00.000Z",
    }),
    "signup"
  );

  assert.match(signup, /\/auth\/callback\?type=signup/);
  assert.match(recovery, /\/auth\/callback\?type=recovery/);
  assert.match(route, /kindAfterSession/);
  assert.match(route, /signOut/);
  assert.match(login, /Email confirmed — please log in\./);
});
