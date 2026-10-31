"use client";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/client/auth";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/overlay";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
