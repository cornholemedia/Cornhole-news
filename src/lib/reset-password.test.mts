import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeTotpCode,
  resetMfaError,
  resetStepFromAssurance,
} from "./reset-password.ts";

const page = readFileSync(new URL("../app/reset-password/page.tsx", import.meta.url), "utf8");
const callback = readFileSync(new URL("./auth-callback.ts", import.meta.url), "utf8");
const login = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");

test("recovery with a verified factor must reach aal2 before a password change", () => {
  assert.equal(
    resetStepFromAssurance({ hasSession: false, currentLevel: null, nextLevel: null }),
    "signed_out"
  );
  assert.equal(
    resetStepFromAssurance({ hasSession: true, currentLevel: "aal1", nextLevel: "aal1" }),
    "password"
  );
  assert.equal(
    resetStepFromAssurance({ hasSession: true, currentLevel: "aal1", nextLevel: "aal2" }),
    "mfa"
  );
  assert.equal(
    resetStepFromAssurance({ hasSession: true, currentLevel: "aal2", nextLevel: "aal2" }),
    "password"
  );
  assert.equal(normalizeTotpCode(" 123 456 "), "123456");
  assert.equal(normalizeTotpCode("12345"), null);
  assert.match(resetMfaError("Invalid TOTP code"), /didn't match/);
  assert.match(resetMfaError("AAL2 session is required to update email or password"), /authenticator app/);

  const verifyAt = page.indexOf("mfa.challengeAndVerify");
  const updateAt = page.indexOf("auth.updateUser");
  assert.ok(verifyAt > 0);
  assert.ok(updateAt > verifyAt);
  assert.match(page, /resetStepFromAssurance/);
  assert.equal(page.includes("/admin/mfa"), false);
  assert.equal(page.includes("service_role") || page.includes("serviceRole"), false);
});

test("a mocked client does not change the password before the authenticator succeeds", async () => {
  const calls: string[] = [];
  const session = { currentLevel: "aal1", nextLevel: "aal2" };
  const client = {
    async challengeAndVerify(code: string) {
      calls.push(`verify:${code}`);
      if (code !== "123456") return { error: "Invalid TOTP code" };
      session.currentLevel = "aal2";
      return { error: null };
    },
    async updateUser() {
      calls.push("update");
      if (session.nextLevel === "aal2" && session.currentLevel !== "aal2") {
        return { error: "AAL2 session is required to update email or password" };
      }
      return { error: null };
    },
  };

  let step = resetStepFromAssurance({
    hasSession: true,
    currentLevel: session.currentLevel,
    nextLevel: session.nextLevel,
  });
  assert.equal(step, "mfa");
  const wrong = await client.challengeAndVerify("000000");
  assert.match(resetMfaError(wrong.error ?? ""), /didn't match/);
  assert.deepEqual(calls, ["verify:000000"]);

  const verified = await client.challengeAndVerify("123456");
  assert.equal(verified.error, null);
  step = resetStepFromAssurance({
    hasSession: true,
    currentLevel: session.currentLevel,
    nextLevel: session.nextLevel,
  });
  assert.equal(step, "password");
  const updated = await client.updateUser();
  assert.equal(updated.error, null);
  assert.deepEqual(calls, ["verify:000000", "verify:123456", "update"]);
});

test("signup confirmation still ends on the login page", () => {
  assert.match(callback, /kind === "recovery" \? "\/reset-password"/);
  assert.match(login, /Email confirmed — please log in\./);
});
