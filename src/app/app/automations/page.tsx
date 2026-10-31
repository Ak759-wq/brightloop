"use client";
import { useState } from "react";
import { FlaskConical, Play, Workflow, Zap, ArrowRight } from "lucide-react";
import { api, useList } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/AppShell";
import { CrudListPage } from "@/components/CrudListPage";
import { Badge, Button, Card, EmptyState, StatusPill, Tabs } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { dateTime, money, cap } from "@/lib/client/format";

interface Rule { id: string; name: string; trigger: string; minAmount: number | null; action: string; message: string; tag: string; enabled: boolean }
interface Exec { id: string; ruleName: string; trigger: string; status: string; detail: string; label: string; createdAt: string }
interface Job { id: string; trigger: string; status: string; today: string; processed: number; invoicesCreated: number; duplicates: number; closed: number; failed: number; overdueMarked: number; dunningReminders: number; durationMs: number; createdAt: string; errors?: { subscription: string; error: string }[] }
interface Evt { id: string; type: string; label: string; actor?: string; createdAt: string; error?: string }

const TRIGGERS = ["invoice.overdue", "invoice.created", "payment.failed", "payment.succeeded", "subscription.activated", "subscription.closed", "credits.low", "renewal.upcoming", "dunning.exhausted"];
const ACTIONS = [{ value: "notify_staff", label: "Notify staff (in-app)" }, { value: "notify_customer", label: "Notify customer (in-app)" }, { value: "email_customer", label: "Email customer (logged if no provider)" }, { value: "tag_customer", label: "Tag customer" }];

export default function AutomationsPage() {
  const toast = useToast();
  const [tab, setTab] = useState("rules");
  const execs = useList<Exec>("automation_executions", {});
  const jobs = useList<Job>("billing_jobs", {});
  const events = useList<Evt>("billing_events", {});
  const [running, setRunning] = useState(false);
  const runNow = async () => {
    setRunning(true);
    try { const r = await api<Job>("/api/billing/run", { body: {} }); toast.success(r.status === "locked" ? "Another run is in progress" : "Billing run complete", `${r.invoicesCreated} invoices · ${r.duplicates} duplicates prevented · ${r.overdueMarked} overdue`); jobs.reload(); events.reload(); execs.reload(); }
    catch (e) { toast.error("Run failed", (e as Error).message); } finally { setRunning(false); }
  };
  const tabs = <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ value: "rules", label: "Rules" }, { value: "log", label: "Execution log" }, { value: "jobs", label: "Billing jobs" }, { value: "events", label: "Billing events" }]} /></div>;
  if (tab === "rules") return (
    <CrudListPage<Rule> title="Automations" singular="Rule" collection="automation_rules" emptyIcon={<Workflow className="h-6 w-6" />}
      description="When something happens in billing, do something – automatically, with every execution logged."
      above={tabs}
      headerActions={<Button variant="secondary" loading={running} icon={<Play className="h-4 w-4" />} onClick={runNow}>Run billing now</Button>}
      columns={[
        { key: "n", header: "Rule", cell: (r) => <div><p className="font-medium text-ink">{r.name}</p><p className="line-clamp-1 max-w-sm text-xs text-ink-muted">{r.message}</p></div> },
        { key: "f", header: "When → then", cell: (r) => <span className="flex flex-wrap items-center gap-1.5"><Badge tone="violet"><Zap className="h-3 w-3" />{r.trigger}</Badge><ArrowRight className="h-3 w-3 text-slate-400" /><Badge tone="blue">{cap(r.action)}</Badge>{r.minAmount ? <Badge>≥ {money(r.minAmount)}</Badge> : null}</span> },
        { key: "e", header: "Status", cell: (r) => (r.enabled ? <Badge tone="green" dot>Enabled</Badge> : <Badge>Disabled</Badge>) },
      ]}
      rowActions={(r) => <Button size="sm" variant="ghost" icon={<FlaskConical className="h-3.5 w-3.5" />} onClick={async () => { try { await api("/api/automations/test", { body: { ruleId: r.id } }); toast.success("Test event fired", "See the execution log"); execs.reload(); } catch (e) { toast.error("Test failed", (e as Error).message); } }}>Test</Button>}
      fields={[
        { name: "name", label: "Rule name", type: "text" },
        { name: "trigger", label: "When (trigger)", type: "select", options: TRIGGERS.map((t) => ({ value: t, label: t })) },
        { name: "action", label: "Then (action)", type: "select", options: ACTIONS },
        { name: "minAmount", label: "Only if amount ≥ (optional)", type: "money", nullable: true },
        { name: "tag", label: "Tag", type: "text", showIf: (v) => v.action === "tag_customer" },
        { name: "message", label: "Message", type: "textarea", hint: "Use {label} and {amount}" },
        { name: "enabled", label: "Enabled", type: "switch" },
      ]}
      defaults={{ trigger: "invoice.overdue", action: "notify_staff", enabled: true, message: "{label} needs attention ({amount})." }} />
  );
  return (
    <div>
      <PageHeader title="Automations" description="Execution history, scheduled billing jobs and the billing event stream." actions={<Button variant="secondary" loading={running} icon={<Play className="h-4 w-4" />} onClick={runNow}>Run billing now</Button>} />
      {tabs}
      {tab === "log" && <DataTable list={execs} empty={<EmptyState title="No executions yet" />} columns={[
        { key: "w", header: "When", cell: (r) => dateTime(r.createdAt) }, { key: "r", header: "Rule", cell: (r) => <b className="font-medium">{r.ruleName}</b> },
        { key: "t", header: "Trigger", cell: (r) => <Badge tone="violet">{r.trigger}</Badge> }, { key: "l", header: "Record", cell: (r) => <span className="font-mono text-xs">{r.label}</span> },
        { key: "s", header: "Result", cell: (r) => <StatusPill status={r.status} /> }, { key: "d", header: "Detail", cell: (r) => <span className="text-xs text-ink-muted">{r.detail}</span> },
      ]} />}
      {tab === "jobs" && (<>
        <Card className="mb-4 p-4 text-sm text-slate-600">Scheduled daily by GitHub Actions (<code className="rounded bg-slate-100 px-1">.github/workflows/billing-cron.yml</code>) calling <code className="rounded bg-slate-100 px-1">POST /api/billing/run</code> with <code className="rounded bg-slate-100 px-1">x-cron-secret</code>. A lock prevents concurrent runs; each invoice&apos;s id is subscription + period start, so re-runs never double-bill.</Card>
        <DataTable list={jobs} empty={<EmptyState title="No billing runs yet" />} columns={[
          { key: "w", header: "Started", cell: (r) => dateTime(r.createdAt) }, { key: "tr", header: "Trigger", cell: (r) => <Badge>{r.trigger}</Badge> }, { key: "d", header: "Business date", cell: (r) => r.today },
          { key: "s", header: "Status", cell: (r) => <StatusPill status={r.status} /> }, { key: "p", header: "Processed", align: "right", cell: (r) => r.processed },
          { key: "i", header: "Invoices", align: "right", cell: (r) => r.invoicesCreated }, { key: "du", header: "Dupes blocked", align: "right", cell: (r) => r.duplicates },
          { key: "f", header: "Failed", align: "right", cell: (r) => <span className={r.failed ? "font-semibold text-rose-600" : ""} title={r.errors?.map((e) => `${e.subscription}: ${e.error}`).join("\n")}>{r.failed}</span> },
          { key: "ms", header: "Duration", align: "right", cell: (r) => `${r.durationMs ?? 0} ms` },
        ]} />
      </>)}
      {tab === "events" && <DataTable list={events} empty={<EmptyState title="No events" />} columns={[
        { key: "w", header: "When", cell: (r) => dateTime(r.createdAt) }, { key: "t", header: "Event", cell: (r) => <Badge tone={r.type.includes("fail") ? "red" : "blue"}>{r.type}</Badge> },
        { key: "l", header: "Record", cell: (r) => <span className="font-mono text-xs">{r.label}</span> }, { key: "a", header: "Actor / detail", cell: (r) => <span className="text-xs text-ink-muted">{r.error ?? r.actor ?? ""}</span> },
      ]} />}
    </div>
  );
}
