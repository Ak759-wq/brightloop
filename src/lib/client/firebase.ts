"use client";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

export function resolveFirebaseAuthDomain(configured: string | undefined, projectId: string | undefined): string | undefined {
  return configured || (projectId ? `${projectId}.firebaseapp.com` : undefined);
}

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  authDomain: resolveFirebaseAuthDomain(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnabled = !!firebaseConfig.apiKey;

let app: FirebaseApp | null = null;
export function firebaseAuth(): Auth {
  if (!firebaseEnabled) throw new Error("Firebase is not configured");
  app = getApps()[0] ?? initializeApp(firebaseConfig);
  return getAuth(app);
}
