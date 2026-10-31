"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, ChevronDown, ChevronRight, Clock, Database, LogOut, Menu, Sparkles, X } from "lucide-react";
import { useAuth } from "@/lib/client/auth";
import { api, useApi } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { ago } from "@/lib/client/format";
import { Logo } from "./Logo";
import { allowed, homeFor, navFor } from "./nav";
import { Spinner } from "../ui/primitives";

interface Ntf { id: string; title: string; body: string; read: boolean; createdAt: string; link?: string; level: string }

function NotificationBell({ portal }: { portal: boolean }) {
  const [open, setOpen] = useState(false);
  const { data, reload } = useApi<{ items: Ntf[] }>("/api/r/notifications?limit=12");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setInterval(reload, 45_000);
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => { clearInterval(t); document.removeEventListener("mousedown", onDoc); };
  }, [reload]);
  const unread = data?.items.filter((n) => !n.read).length ?? 0;
  return (
    <div className="relative" ref={ref}>
      <button aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} onClick={() => setOpen((o) => !o)} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] animate-fade-in rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <button className="text-xs font-medium text-brand-600 hover:underline" onClick={async () => { await api("/api/notifications/read", { body: {} }); reload(); }}>Mark all read</button>
          </div>
          <ul className="max-h-[380px] divide-y divide-slate-100 overflow-y-auto">
            {!data?.items.length && <li className="px-4 py-8 text-center text-sm text-ink-muted">You&apos;re all caught up.</li>}
            {data?.items.map((n) => (
              <li key={n.id}>
                <Link href={n.link ? (portal ? n.link.replace("/app/", "/portal/") : n.link.replace("/portal/", "/app/")) : "#"} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : n.level === "danger" ? "bg-rose-500" : n.level === "warning" ? "bg-amber-500" : "bg-brand-500")} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{n.title}</span>
                    <span className="line-clamp-2 block text-xs text-ink-muted">{n.body}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-soft">{ago(n.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {portal && <Link href="/portal/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-medium text-brand-600 hover:bg-slate-50">View all</Link>}
        </div>
      )}
    </div>
  );
}

function Crumbs({ pathname }: { pathname: string }) {
  const parts = pathname.split("/").filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-ink-muted md:flex">
      {parts.map((p, i) => {
        const href = "/" + parts.slice(0, i + 1).join("/");
        const label = i === 0 ? (p === "app" ? "Workspace" : "Portal") : p.length > 18 ? "Details" : p.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
        const last = i === parts.length - 1;
        return (
          <span key={href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
            {last || i === 0 ? <span className={last ? "font-medium text-slate-700" : ""}>{label}</span> : <Link href={href} className="hover:text-ink">{label}</Link>}
          </span>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, org, modes, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (!allowed(user.role, pathname)) router.replace(homeFor(user.role));
  }, [loading, user, pathname, router]);
  useEffect(() => setMobileOpen(false), [pathname]);
  if (loading || !user || !allowed(user.role, pathname)) {
    return <div className="flex min-h-screen items-center justify-center bg-canvas"><Spinner className="h-7 w-7" /></div>;
  }
  const nav = navFor(user.role);
  const portal = user.role === "customer";
  const sidebar = (
    <div className="flex h-full flex-col bg-navy-900 text-slate-300">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href={homeFor(user.role)} className="text-white"><Logo /></Link>
        <button className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 lg:hidden" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <div key={item.href}>
              {item.section && <p className="mb-1.5 mt-5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{item.section}</p>}
              <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("group mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition", active ? "bg-brand-600 text-white shadow-lg shadow-brand-900/40" : "hover:bg-white/[0.06] hover:text-white")}>
                <Icon className={cn("h-[18px] w-[18px]", active ? "text-white" : "text-slate-400 group-hover:text-white")} />
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>
      <div className="m-3 rounded-2xl bg-white/[0.04] p-3 text-xs">
        <p className="font-medium text-white">{org?.name}</p>
        <p className="mt-0.5 text-slate-400">{user.role === "admin" ? "Administrator" : user.role === "staff" ? "Staff · limited access" : "Customer portal"}</p>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-navy-950/50" onClick={() => setMobileOpen(false)} /><div className="relative h-full w-72">{sidebar}</div></div>}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200/70 bg-canvas/85 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-full p-2 text-slate-600 hover:bg-white lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
            <Crumbs pathname={pathname} />
          </div>
          <div className="flex items-center gap-2">
            {modes?.backend === "local" && <span title="Data is stored in a local JSON file on the server. Set FIREBASE_SERVICE_ACCOUNT_JSON to use Firestore." className="hidden items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 sm:inline-flex"><Database className="h-3 w-3" />Local data mode</span>}
            {modes?.backend === "misconfigured" && <span title="Production database configuration is missing. Contact the operator." className="hidden items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-800 sm:inline-flex"><Database className="h-3 w-3" />Database unavailable</span>}
            {org?.demo && org.demoDate && <span title="Simulated business date used for billing in this demo organisation" className="hidden items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-800 sm:inline-flex"><Clock className="h-3 w-3" />Demo clock: {org.demoDate}</span>}
            {!portal && user.role === "admin" && (
              <Link href="/app/assistant" className="hidden h-10 items-center gap-2 rounded-full border border-brand-200 bg-white pl-4 pr-1.5 text-sm text-ink-muted shadow-card hover:border-brand-300 md:flex">
                Ask about revenue, overdue…<span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white"><Sparkles className="h-3.5 w-3.5" /></span>
              </Link>
            )}
            <NotificationBell portal={portal} />
            <div className="relative">
              <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 hover:bg-slate-50" aria-haspopup="menu" aria-expanded={menu}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-cyan-400 text-xs font-semibold text-white">{user.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}</span>
                <span className="hidden text-left text-xs sm:block"><span className="block font-medium text-ink">{user.name}</span><span className="block capitalize text-ink-muted">{user.role}</span></span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 z-50 mt-2 w-56 animate-fade-in rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl" onMouseLeave={() => setMenu(false)}>
                  <p className="truncate px-3 py-2 text-xs text-ink-muted">{user.email}</p>
                  {portal && <Link role="menuitem" href="/portal/account" className="block rounded-xl px-3 py-2 text-sm hover:bg-slate-50">Account settings</Link>}
                  {user.role === "admin" && <Link role="menuitem" href="/app/settings" className="block rounded-xl px-3 py-2 text-sm hover:bg-slate-50">Settings</Link>}
                  <button role="menuitem" onClick={async () => { await signOut(); router.replace("/login"); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"><LogOut className="h-4 w-4" />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted md:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
