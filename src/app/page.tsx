"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/client/auth";
import { homeFor } from "@/components/shell/nav";
import { Spinner } from "@/components/ui/primitives";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading) router.replace(user ? homeFor(user.role) : "/login"); }, [loading, user, router]);
  return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
}
