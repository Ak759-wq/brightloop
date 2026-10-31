"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role } from "@/lib/types";
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
  signIn: (email: string, password: string) => Promise<SessionInfo>;
  signUp: (input: { name: string; email: string; password: string; company?: string; placeOfSupply?: string }) => Promise<SessionInfo>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const LS = "brightloop_token";
const DEMO_EMAILS = ["admin@brightloop.demo", "staff@brightloop.demo", "customer@brightloop.demo"];

function friendlyFirebaseError(code: string): string {
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Incorrect email or password";
  if (code.includes("email-already-in-use")) return "An account with this email already exists";
  if (code.includes("too-many-requests")) return "Too many attempts. Try again in a few minutes.";
  if (code.includes("network")) return "Network error. Check your connection.";
  if (code.includes("weak-password")) return "Password is too weak";
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
          try {
            let m = await loadMe();
            if (u && !m.session) {
              await api("/api/auth/bootstrap", { method: "POST", body: {} });
              m = await loadMe();
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
    async signIn(email, password) {
      email = email.trim().toLowerCase();
      if (firebaseEnabled) {
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
        let m = await loadMe();
        if (!m.session) { await api("/api/auth/bootstrap", { method: "POST", body: {} }); m = await loadMe(); }
        return requireSession(m);
      }
      const { token } = await api<{ token: string }>("/api/auth/local/login", { body: { email, password } });
      localStorage.setItem(LS, token);
      return requireSession(await loadMe());
    },
    async signUp(input) {
      const email = input.email.trim().toLowerCase();
      if (firebaseEnabled) {
        const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
        try {
          const cred = await createUserWithEmailAndPassword(firebaseAuth(), email, input.password);
          await updateProfile(cred.user, { displayName: input.name });
        } catch (e) {
          throw new Error(friendlyFirebaseError((e as { code?: string }).code ?? ""));
        }
        await api("/api/auth/bootstrap", { method: "POST", body: { name: input.name, company: input.company, placeOfSupply: input.placeOfSupply } });
        return requireSession(await loadMe());
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
