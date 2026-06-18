import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Search } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/activity")({
  head: () => ({
    meta: [
      { title: "Activity log — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActivityPage,
});

type Row = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  admin_users: { id: string; full_name: string | null; email: string } | null;
};

const ACTION_OPTIONS = [
  "created", "updated", "deleted",
  "login_success", "login_failed",
  "password_reset_requested", "password_changed",
  "role_changed", "status_changed",
  "bulk_import", "bulk_delete", "bulk_translate",
  "settings_changed", "user_deactivated",
  "sla_first_contact", "sla_breach_first_contact",
];

const ENTITY_OPTIONS = [
  "product", "category", "inquiry", "store", "admin_user",
  "attribute", "category_attribute", "auth", "setting", "bulk",
  "order", "shipping_method", "shipping_zone",
];

const CRITICAL_ACTIONS = new Set([
  "deleted", "role_changed", "login_failed", "user_deactivated", "bulk_delete",
]);

function actionTone(action: string): "neutral" | "good" | "warn" | "critical" {
  if (CRITICAL_ACTIONS.has(action)) return "critical";
  if (action === "login_success" || action === "created") return "good";
  if (action.startsWith("sla_breach") || action === "password_reset_requested") return "warn";
  return "neutral";
}

function badgeStyle(tone: ReturnType<typeof actionTone>): React.CSSProperties {
  switch (tone) {
    case "critical": return { backgroundColor: "#fdecec", color: "#b42318", borderColor: "#f3b4b4" };
    case "warn": return { backgroundColor: "#fff4e5", color: "#a15c00", borderColor: "#f4c989" };
    case "good": return { backgroundColor: "#eef6ef", color: "#1a3a2e", borderColor: "#c7e0ca" };
    default: return { backgroundColor: "#f3f3f3", color: "#333", borderColor: "#e0e0e0" };
  }
}

function toCsv(rows: Row[]): string {
  const head = ["created_at","admin_email","admin_name","action","entity_type","entity_id","ip_address","user_agent","before","after","metadata"];
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = rows.map((r) => [
    r.created_at,
    r.admin_users?.email ?? "",
    r.admin_users?.full_name ?? "",
    r.action,
    r.entity_type,
    r.entity_id ?? "",
    r.ip_address ?? "",
    r.user_agent ?? "",
    r.before, r.after, r.metadata,
  ].map(esc).join(","));
  return [head.join(","), ...lines].join("\n");
}

function fmt(d: string) {
  return new Date(d).toLocaleString();
}

function ActivityPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<Array<{ id: string; email: string; full_name: string | null }>>([]);

  // Filters
  const [adminId, setAdminId] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [entityType, setEntityType] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    void supabase
      .from("admin_users")
      .select("id,email,full_name")
      .order("email")
      .then(({ data }) => setAdmins((data as typeof admins) ?? []));
  }, []);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("activity_log")
      .select("id, action, entity_type, entity_id, created_at, ip_address, user_agent, before, after, metadata, admin_users(id, full_name, email)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (adminId) q = q.eq("admin_user_id", adminId);
    if (action) q = q.eq("action", action);
    if (entityType) q = q.eq("entity_type", entityType);
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setDate(end.getDate() + 1);
      q = q.lt("created_at", end.toISOString());
    }
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data as unknown as Row[]) ?? []);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [adminId, action, entityType, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      return (
        r.entity_id?.toLowerCase().includes(s) ||
        r.admin_users?.email?.toLowerCase().includes(s) ||
        r.admin_users?.full_name?.toLowerCase().includes(s) ||
        r.ip_address?.toLowerCase().includes(s) ||
        JSON.stringify(r.metadata ?? {}).toLowerCase().includes(s) ||
        JSON.stringify(r.before ?? {}).toLowerCase().includes(s) ||
        JSON.stringify(r.after ?? {}).toLowerCase().includes(s)
      );
    });
  }, [rows, search]);

  function exportCsv() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-primary">Activity log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Audit trail of admin actions, auth events, and data changes.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="mr-2 h-4 w-4" /> Export CSV ({filtered.length})
        </Button>
      </header>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 md:grid-cols-3 lg:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-muted-foreground">User</span>
          <select value={adminId} onChange={(e) => setAdminId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">All</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-muted-foreground">Action</span>
          <select value={action} onChange={(e) => setAction(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">All</option>
            {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-muted-foreground">Entity</span>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">All</option>
            {ENTITY_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-muted-foreground">From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-muted-foreground">To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-muted-foreground">Search</span>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input type="search" placeholder="email, id, IP, value…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pl-7 pr-2 text-sm" />
          </div>
        </label>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-lg border bg-white">
        {loading ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="Clock" title="No activity" description="Nothing matches your filters." />
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Change</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const tone = actionTone(r.action);
                  return (
                    <tr key={r.id} className="border-t align-top">
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{fmt(r.created_at)}</td>
                      <td className="px-3 py-2">
                        {r.admin_users ? (
                          <div>
                            <div className="font-medium">{r.admin_users.full_name ?? r.admin_users.email}</div>
                            {r.admin_users.full_name && (
                              <div className="text-xs text-muted-foreground">{r.admin_users.email}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">
                            {(r.metadata?.email as string) ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" style={badgeStyle(tone)}>{r.action}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-xs">{r.entity_type}</div>
                        {r.entity_id && (
                          <div className="font-mono text-[10px] text-muted-foreground">{r.entity_id.slice(0, 8)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.ip_address ?? "—"}</td>
                      <td className="px-3 py-2">
                        {(r.before || r.after || r.metadata) ? (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              View details
                            </summary>
                            <div className="mt-2 space-y-1">
                              {r.before && (
                                <div>
                                  <span className="font-semibold text-rose-700">before:</span>
                                  <pre className="overflow-x-auto rounded bg-rose-50 p-2 text-[11px]">{JSON.stringify(r.before, null, 2)}</pre>
                                </div>
                              )}
                              {r.after && (
                                <div>
                                  <span className="font-semibold text-emerald-700">after:</span>
                                  <pre className="overflow-x-auto rounded bg-emerald-50 p-2 text-[11px]">{JSON.stringify(r.after, null, 2)}</pre>
                                </div>
                              )}
                              {r.metadata && (
                                <div>
                                  <span className="font-semibold text-muted-foreground">metadata:</span>
                                  <pre className="overflow-x-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(r.metadata, null, 2)}</pre>
                                </div>
                              )}
                              {r.user_agent && (
                                <div className="text-[10px] text-muted-foreground">UA: {r.user_agent}</div>
                              )}
                            </div>
                          </details>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Showing {filtered.length} of last 500 entries.
        </div>
      </div>
    </AdminShell>
  );
}