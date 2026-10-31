"use client";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { api, useList } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import { dateTime } from "@/lib/client/format";

interface N { id: string; title: string; body: string; level: string; read: boolean; link?: string; channel: string; createdAt: string }

export default function Notifications() {
  const list = useList<N>("notifications", {}, 20);
  return (
    <div>
      <PageHeader title="Notifications" description="Invoices, payments, renewals and credit alerts." actions={<Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} onClick={async () => { await api("/api/notifications/read", { body: {} }); list.reload(); }}>Mark all read</Button>} />
      <DataTable list={list} empty={<EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" />} columns={[
        { key: "t", header: "Notification", cell: (r) => <div className="flex gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${r.read ? "bg-slate-200" : r.level === "danger" ? "bg-rose-500" : r.level === "warning" ? "bg-amber-500" : "bg-brand-500"}`} /><div><p className={r.read ? "text-ink" : "font-semibold text-ink"}>{r.link ? <Link href={r.link.replace("/app/", "/portal/")} className="hover:underline">{r.title}</Link> : r.title}</p><p className="text-xs text-ink-muted">{r.body}</p></div></div> },
        { key: "c", header: "Channel", hideOnMobile: true, cell: (r) => <Badge tone={r.channel === "email_logged" ? "amber" : "slate"}>{r.channel === "email_logged" ? "Email (logged)" : r.channel === "email_sent" ? "Email" : "In-app"}</Badge> },
        { key: "w", header: "When", cell: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.createdAt)}</span> },
      ]} />
    </div>
  );
}
