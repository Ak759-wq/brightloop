import { describe, expect, it } from "vitest";
import { resolveFirebaseAuthDomain } from "@/lib/client/firebase";

describe("Firebase configuration guidance", () => {
  it("uses the project Firebase Auth domain when no explicit auth domain is provided", async () => {
    expect(resolveFirebaseAuthDomain("", "brightloop-test")).toBe("brightloop-test.firebaseapp.com");
  });
});
