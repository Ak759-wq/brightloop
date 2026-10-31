import { describe, expect, it } from "vitest";
import { resolveFirebaseAuthDomain } from "@/lib/client/firebase";
import { backendDiagnostic, backendMode } from "@/server/store";

describe("Firebase configuration guidance", () => {
  it("uses the project Firebase Auth domain when no explicit auth domain is provided", async () => {
    expect(resolveFirebaseAuthDomain("", "brightloop-test")).toBe("brightloop-test.firebaseapp.com");
  });

  it("refuses a local backend fallback on hosted production without Firestore credentials", () => {
    const previousVercel = process.env.VERCEL;
    const previousServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    process.env.VERCEL = "1";
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    expect(backendMode()).toBe("misconfigured");
    expect(backendDiagnostic()).toMatch(/FIREBASE_SERVICE_ACCOUNT_JSON/);

    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    if (previousServiceAccount === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = previousServiceAccount;
  });
});
