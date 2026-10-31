"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role } from "@/lib/types";
import type { AuthEntry } from "@/lib/auth-entry";
import { api, setTokenGetter } from "./api";
import { firebaseAuth, firebaseEnabled } from "./firebase";

export interface SessionInfo {
  uid: string;
  email: string;
  name: string;
  role: Role;
  orgId: string;
  customerId: string | null;
}
export interface OrgInfo {
  id: string;
  name: string;
  currency: string;
  demo: boolean;
  demoDate: string | null;
  sellerState: string;
  retentionDiscountId: string | null;
  today: string;
}
export interface Modes {
  auth: "firebase" | "local";
  backend: "firestore" | "local";
  email: boolean;
  razorpay: boolean;
  llm: boolean;
}
interface Me {
  session: SessionInfo | null;
  org: OrgInfo | null;
  modes: Modes;
}

interface AuthCtx {
  loading: boolean;
  user: SessionInfo | null;
  org: OrgInfo | null;
  modes: Modes | null;
  signIn: (email: string, password: string, entry?: AuthEntry) => Promise<SessionInfo>;
  /** Google sign-in (Firebase mode). New Google users get a customer account; invited staff/admins are linked by email. */
  signInWithGoogle: (entry?: AuthEntry) => Promise<SessionInfo>;
  googleAvailable: boolean;
  signUp: (input: { name: string; email: string; password: string; company?: string; placeOfSupply?: string }) => Promise<SessionInfo>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const LS = "brightloop_token";
const REDIRECT_ENTRY = "brightloop_auth_entry";
/** While signIn/signUp run their own bootstrap (with the user's details), the auth listener must not race them. */
let explicitFlow = false;
const DEMO_EMAILS = ["admin@brightloop.demo", "staff@brightloop.demo", "customer@brightloop.demo"];

function friendlyFirebaseError(code: string): string {
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Incorrect email or password";
  if (code.includes("email-already-in-use")) return "An account with this email already exists";
  if (code.includes("too-many-requests")) return "Too many attempts. Try again in a few minutes.";
  if (code.includes("network")) return "Network error. Check your connection.";
  if (code.includes("weak-password")) return "Password is too weak";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return "Google sign-in was cancelled";
  if (code.includes("account-exists-with-different-credential")) return "This email already has a password login. Sign in with your password instead.";
  if (code.includes("unauthorized-domain")) return "Google sign-in isn't enabled for this domain yet";
  if (code.includes("operation-not-allowed")) return "Google sign-in isn't enabled for this workspace yet";
  return "Sign-in failed. Please try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async (): Promise<Me> => {
    const m = await api<Me>("/api/me");
    setMe(m);
    return m;
  }, []);

  useEffect(() => {
    if (firebaseEnabled) {
      const auth = firebaseAuth();
      setTokenGetter(async () => (auth.currentUser ? auth.currentUser.getIdToken() : null));
      let unsub = () => {};
      import("firebase/auth").then(({ onAuthStateChanged }) => {
        unsub = onAuthStateChanged(auth, async (u) => {
          let redirectEntry: AuthEntry | null = null;
          try {
            let m = await loadMe();
            redirectEntry = sessionStorage.getItem(REDIRECT_ENTRY) as AuthEntry | null;
            if (u && !explicitFlow && (!m.session || redirectEntry)) {
              await api("/api/auth/bootstrap", { method: "POST", body: redirectEntry ? { entry: redirectEntry } : {} });
              if (redirectEntry) sessionStorage.removeItem(REDIRECT_ENTRY);
              m = await loadMe();
            }
          } catch (e) {
            if (redirectEntry) {
              sessionStorage.removeItem(REDIRECT_ENTRY);
              await auth.signOut();
              setMe(null);
            } else {
              throw e;
            }
          } finally {
            setLoading(false);
          }
        });
      });
      return () => unsub();
    }
    setTokenGetter(async () => localStorage.getItem(LS));
    loadMe().finally(() => setLoading(false));
  }, [loadMe]);

  const requireSession = (m: Me) => {
    if (!m.session) throw new Error("Your account profile could not be loaded");
    return m.session;
  };

  const value = useMemo<AuthCtx>(() => ({
    loading,
    user: me?.session ?? null,
    org: me?.org ?? null,
    modes: me?.modes ?? null,
    refresh: async () => { await loadMe(); },
    googleAvailable: firebaseEnabled,
    async signInWithGoogle(entry) {
      if (!firebaseEnabled) throw new Error("Google sign-in needs Firebase to be configured");
      explicitFlow = true;
      try {
        const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import("firebase/auth");
        const auth = firebaseAuth();
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        let displayName: string | null = null;
        try {
          const cred = await signInWithPopup(auth, provider);
          displayName = cred.user.displayName;
        } catch (e) {
          const code = (e as { code?: string }).code ?? "";
          if (code.includes("popup-blocked")) {
            if (entry) sessionStorage.setItem(REDIRECT_ENTRY, entry);
            await signInWithRedirect(auth, provider);
            throw new Error("Redirecting to Google…");
          }
          throw new Error(friendlyFirebaseError(code));
        }
        await api("/api/auth/bootstrap", {
          method: "POST",
          body: {
            ...(displayName && displayName.trim().length >= 2 ? { name: displayName.trim().slice(0, 80) } : {}),
            ...(entry ? { entry } : {}),
          },
        });
        const m = await loadMe();
        return requireSession(m);
      } finally { explicitFlow = false; }
    },
    async signIn(email, password, entry) {
      email = email.trim().toLowerCase();
      if (firebaseEnabled) {
        explicitFlow = true;
        try {
        const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import("firebase/auth");
        const auth = firebaseAuth();
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (e) {
          const code = (e as { code?: string }).code ?? "";
          // Demo accounts are provisioned in Firebase Auth on first use (claimable seeded profiles).
          if (DEMO_EMAILS.includes(email) && (code.includes("invalid-credential") || code.includes("user-not-found"))) {
            try { await createUserWithEmailAndPassword(auth, email, password); }
            catch (e2) { throw new Error(friendlyFirebaseError((e2 as { code?: string }).code ?? "")); }
          } else throw new Error(friendlyFirebaseError(code));
        }
        await api("/api/auth/bootstrap", { method: "POST", body: entry ? { entry } : {} });
        const m = await loadMe();
        return requireSession(m);
        } finally { explicitFlow = false; }
      }
      const { token } = await api<{ token: string }>("/api/auth/local/login", { body: { email, password, ...(entry ? { entry } : {}) } });
      localStorage.setItem(LS, token);
      return requireSession(await loadMe());
    },
    async signUp(input) {
      const email = input.email.trim().toLowerCase();
      if (firebaseEnabled) {
        explicitFlow = true;
        try {
        const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
        try {
          const cred = await createUserWithEmailAndPassword(firebaseAuth(), email, input.password);
          await updateProfile(cred.user, { displayName: input.name });
        } catch (e) {
          throw new Error(friendlyFirebaseError((e as { code?: string }).code ?? ""));
        }
        await api("/api/auth/bootstrap", { method: "POST", body: { name: input.name, company: input.company, placeOfSupply: input.placeOfSupply } });
        return requireSession(await loadMe());
        } finally { explicitFlow = false; }
      }
      const { token } = await api<{ token: string }>("/api/auth/local/register", { body: { ...input, email } });
      localStorage.setItem(LS, token);
      return requireSession(await loadMe());
    },
    async signOut() {
      if (firebaseEnabled) {
        const { signOut } = await import("firebase/auth");
        await signOut(firebaseAuth());
      }
      localStorage.removeItem(LS);
      setMe((m) => (m ? { ...m, session: null, org: null } : m));
    },
    async resetPassword(email) {
      if (firebaseEnabled) {
        const { sendPasswordResetEmail } = await import("firebase/auth");
        try { await sendPasswordResetEmail(firebaseAuth(), email.trim().toLowerCase()); } catch { /* do not reveal whether the account exists */ }
        return "If that email has an account, a reset link is on its way. Check your inbox (and spam).";
      }
      const r = await api<{ message: string }>("/api/auth/local/reset-request", { body: { email } });
      return `${r.message} (Local mode: email delivery is not configured, so the link is printed in the server log.)`;
    },
  }), [loading, me, loadMe]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
