import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  MoreHorizontal,
  Phone,
  Mail,
  MessageCircle,
  ChevronRight,
  Trash2,
  UserPlus,
  Tag as TagIcon,
  Ban,
  Eye,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/inquiries")({
  head: () => ({
    meta: [
      { title: "Inquiries — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InquiriesPage,
});

type Status = "new" | "contacted" | "in_progress" | "closed" | "spam";
type DateRange = "today" | "7d" | "30d" | "all";

type ItemRow = {
  id: string;
  quantity: number;
  notes: string | null;
  product: {
    id: string;
    name_en: string | null;
    name_id: string | null;
    price_idr: number;
    product_images: { image_url: string; is_primary: boolean | null }[] | null;
  } | null;
};

type InquiryRow = {
  id: string;
  status: Status;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_city: string | null;
  message: string | null;
  assigned_to: string | null;
  preferred_store_id: string | null;
  created_at: string;
  first_contacted_at: string | null;
  inquiry_items: ItemRow[];
  assignee?: { id: string; full_name: string | null; email: string } | null;
};

type AdminUser = { id: string; full_name: string | null; email: string };

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  new: {
    label: "New",
    cls: "border-red-500/30 bg-red-500/10 text-red-700",
    dot: "bg-red-500",
  },
  contacted: {
    label: "Contacted",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    dot: "bg-amber-500",
  },
  in_progress: {
    label: "In Progress",
    cls: "border-blue-500/30 bg-blue-500/10 text-blue-700",
    dot: "bg-blue-500",
  },
  closed: {
    label: "Closed",
    cls: "border-zinc-400/40 bg-zinc-400/10 text-zinc-600",
    dot: "bg-zinc-400",
  },
  spam: {
    label: "Spam",
    cls: "border-zinc-400/40 bg-zinc-400/10 text-zinc-500 line-through",
    dot: "bg-zinc-400",
  },
};

const STATUS_PILLS: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "in_progress", label: "In Progress" },
  { value: "closed", label: "Closed" },
];

function fmtIDR(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function slaInfo(created_at: string, status: Status, first_contacted_at?: string | null) {
  // SLA only applies to inquiries still in "new". Once contacted, SLA is settled.
  if (status !== "new" || first_contacted_at) return null;
  const hours = (Date.now() - new Date(created_at).getTime()) / 3_600_000;
  if (hours >= 24) return { level: "breach" as const, hours };
  if (hours >= 18) return { level: "orange" as const, hours };
  if (hours >= 12) return { level: "yellow" as const, hours };
  return null;
}

const SLA_ROW_CLS = {
  yellow: "bg-yellow-50/70 hover:bg-yellow-50",
  orange: "bg-orange-50/80 hover:bg-orange-100/80",
  breach: "bg-red-50/80 hover:bg-red-100/80",
} as const;

function primaryImage(it: ItemRow): string | null {
  const imgs = it.product?.product_images ?? [];
  if (!imgs.length) return null;
  const p = imgs.find((i) => i.is_primary) ?? imgs[0];
  return p?.image_url ?? null;
}

function itemTotal(it: ItemRow) {
  return (it.product?.price_idr ?? 0) * it.quantity;
}

function inquiryTotal(r: InquiryRow) {
  return r.inquiry_items.reduce((s, it) => s + itemTotal(it), 0);
}

function preferredChannel(r: InquiryRow): { label: string; icon: typeof Phone } {
  if (r.customer_phone) return { label: "WhatsApp", icon: MessageCircle };
  return { label: "Email", icon: Mail };
}

function emailKey(e: string) {
  return (e ?? "").trim().toLowerCase();
}

function InquiriesPage() {
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const navigate = useNavigate();
  const rowsRef = useRef<InquiryRow[]>([]);
  rowsRef.current = rows;

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("inquiries")
      .select(
        `id, status, customer_name, customer_email, customer_phone, customer_city,
         message, assigned_to, preferred_store_id, created_at, first_contacted_at,
         inquiry_items(id, quantity, notes,
           product:products(id, name_en, name_id, price_idr,
             product_images(image_url, is_primary)))`
      )
      .order("created_at", { ascending: false })
      .is("deleted_at", null)
      .limit(500);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const inquiries = (data ?? []) as unknown as InquiryRow[];
    const assigneeIds = Array.from(
      new Set(inquiries.map((r) => r.assigned_to).filter(Boolean) as string[])
    );
    if (assigneeIds.length) {
      const { data: users } = await supabase
        .from("admin_users")
        .select("id, full_name, email")
        .in("id", assigneeIds);
      const byId = new Map((users ?? []).map((u) => [u.id, u as AdminUser]));
      inquiries.forEach((r) => {
        r.assignee = r.assigned_to ? byId.get(r.assigned_to) ?? null : null;
      });
    }
    setRows(inquiries);
  }

  async function loadAdmins() {
    const { data } = await supabase
      .from("admin_users")
      .select("id, full_name, email")
      .order("full_name");
    setAdmins((data ?? []) as AdminUser[]);
  }

  useEffect(() => {
    void load();
    void loadAdmins();
  }, []);

  // Realtime: new inquiries
  useEffect(() => {
    const channel = supabase
      .channel("admin-inquiries")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiries" },
        (payload) => {
          const newId = (payload.new as { id: string }).id;
          // refetch the single row with items
          void (async () => {
            const { data } = await supabase
              .from("inquiries")
              .select(
                `id, status, customer_name, customer_email, customer_phone, customer_city,
                 message, assigned_to, preferred_store_id, created_at, first_contacted_at,
                 inquiry_items(id, quantity, notes,
                   product:products(id, name_en, name_id, price_idr,
                     product_images(image_url, is_primary)))`
              )
              .eq("id", newId)
              .maybeSingle();
            if (!data) return;
            const row = data as unknown as InquiryRow;
            setRows((prev) => {
              if (prev.some((r) => r.id === row.id)) return prev;
              return [row, ...prev];
            });
            setFlash((prev) => new Set(prev).add(row.id));
            setTimeout(() => {
              setFlash((prev) => {
                const n = new Set(prev);
                n.delete(row.id);
                return n;
              });
            }, 2500);
          })();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inquiries" },
        (payload) => {
          const next = payload.new as Partial<InquiryRow> & { id: string };
          setRows((prev) =>
            prev.map((r) => (r.id === next.id ? { ...r, ...next } : r))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "inquiries" },
        (payload) => {
          const old = payload.old as { id: string };
          setRows((prev) => prev.filter((r) => r.id !== old.id));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Filter
  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === "today"
        ? now - 24 * 3600 * 1000
        : range === "7d"
        ? now - 7 * 24 * 3600 * 1000
        : range === "30d"
        ? now - 30 * 24 * 3600 * 1000
        : 0;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (cutoff && new Date(r.created_at).getTime() < cutoff) return false;
      if (q) {
        const hay = [
          r.customer_name,
          r.customer_email,
          r.customer_phone ?? "",
          r.customer_city ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, status, range, search]);

  // Mark rows whose customer has at least one earlier inquiry (returning customer)
  const returningIds = useMemo(() => {
    const earliestByEmail = new Map<string, number>();
    for (const r of rows) {
      const k = emailKey(r.customer_email);
      const t = new Date(r.created_at).getTime();
      const cur = earliestByEmail.get(k);
      if (cur === undefined || t < cur) earliestByEmail.set(k, t);
    }
    const out = new Set<string>();
    for (const r of rows) {
      const k = emailKey(r.customer_email);
      const t = new Date(r.created_at).getTime();
      if ((earliestByEmail.get(k) ?? t) < t) out.add(r.id);
    }
    return out;
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const s of ["new", "contacted", "in_progress", "closed"] as Status[]) {
      c[s] = rows.filter((r) => r.status === s).length;
    }
    return c;
  }, [rows]);

  const newCount = counts.new ?? 0;

  // Browser tab badge
  useEffect(() => {
    const base = "Inquiries — Admin";
    document.title = newCount > 0 ? `Consina Admin (${newCount} new)` : base;
    return () => {
      document.title = base;
    };
  }, [newCount]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  }

  async function updateStatus(ids: string[], next: Status) {
    const { error } = await supabase
      .from("inquiries")
      .update({ status: next })
      .in("id", ids);
    if (error) return toast.error(error.message);
    setRows((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, status: next } : r))
    );
    toast.success(
      ids.length === 1 ? "Status updated" : `${ids.length} inquiries updated`
    );
    setSelected(new Set());
  }

  async function assignTo(ids: string[], adminId: string | null) {
    const { error } = await supabase
      .from("inquiries")
      .update({ assigned_to: adminId })
      .in("id", ids);
    if (error) return toast.error(error.message);
    const assignee = adminId ? admins.find((a) => a.id === adminId) ?? null : null;
    setRows((prev) =>
      prev.map((r) =>
        ids.includes(r.id) ? { ...r, assigned_to: adminId, assignee } : r
      )
    );
    toast.success("Assignment updated");
    setSelected(new Set());
  }

  async function removeRows(ids: string[]) {
    if (!confirm(`Delete ${ids.length} inquir${ids.length === 1 ? "y" : "ies"}? This cannot be undone.`)) return;
    // delete child items first (no cascade declared)
    await supabase.from("inquiry_items").delete().in("inquiry_id", ids);
    const { error } = await supabase.from("inquiries").delete().in("id", ids);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    setSelected(new Set());
    toast.success("Deleted");
  }

  return (
    <AdminShell>
      {/* Breadcrumb */}
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/admin" className="hover:text-foreground">
          Dashboard
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Inquiries</span>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight text-primary">
          Inquiries{" "}
          <span className="text-muted-foreground font-medium">
            ({rows.length})
          </span>
        </h1>
      </div>

      {/* Status pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_PILLS.map((p) => {
          const active = status === p.value;
          const dot =
            p.value === "all" ? null : STATUS_META[p.value as Status]?.dot;
          const n = counts[p.value] ?? 0;
          return (
            <button
              key={p.value}
              onClick={() => setStatus(p.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-white text-foreground hover:bg-muted"
              )}
            >
              {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
              {p.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  active ? "bg-background/20" : "bg-muted text-muted-foreground"
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + date range */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, email, phone, city..."
            className="pl-8"
          />
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-white p-0.5">
          {(
            [
              { v: "today", l: "Today" },
              { v: "7d", l: "Last 7 days" },
              { v: "30d", l: "Last 30 days" },
              { v: "all", l: "All time" },
            ] as { v: DateRange; l: string }[]
          ).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setRange(opt.v)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition",
                range === opt.v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
          <div>
            <strong>{selected.size}</strong> selected
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Assign to…
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => assignTo(Array.from(selected), null)}
                >
                  Unassigned
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {admins.map((a) => (
                  <DropdownMenuItem
                    key={a.id}
                    onClick={() => assignTo(Array.from(selected), a.id)}
                  >
                    {a.full_name ?? a.email}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <TagIcon className="mr-1.5 h-3.5 w-3.5" /> Change status…
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(["new", "contacted", "in_progress", "closed"] as Status[]).map(
                  (s) => (
                    <DropdownMenuItem
                      key={s}
                      onClick={() => updateStatus(Array.from(selected), s)}
                    >
                      {STATUS_META[s].label}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="sm"
              variant="outline"
              onClick={() => removeRows(Array.from(selected))}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="MessageSquare"
          title="No inquiries yet"
          description="Customer inquiries will appear here. Make sure your product pages have the 'Add to Inquiry' button enabled."
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2">
                  <Checkbox
                    checked={
                      selected.size > 0 && selected.size === filtered.length
                    }
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2">Items</th>
                <th className="px-2 py-2">Est. value</th>
                <th className="px-2 py-2">Channel</th>
                <th className="px-2 py-2">Submitted</th>
                <th className="px-2 py-2">Assigned</th>
                <th className="w-12 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.new;
                const ch = preferredChannel(r);
                const ChannelIcon = ch.icon;
                const imgs = r.inquiry_items.slice(0, 3);
                const isNew = r.status === "new";
                const isFlashing = flash.has(r.id);
                const sla = slaInfo(r.created_at, r.status, r.first_contacted_at);
                return (
                  <tr
                    key={r.id}
                    onClick={() =>
                      navigate({ to: "/admin/inquiries/$id", params: { id: r.id } })
                    }
                    className={cn(
                      "cursor-pointer border-t border-border transition-colors",
                      isNew && "border-l-4 border-l-red-500",
                      isFlashing && "animate-pulse bg-amber-50",
                      sla && SLA_ROW_CLS[sla.level],
                      "hover:bg-muted/40"
                    )}
                  >
                    <td
                      className="px-3 py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleSelect(r.id)}
                        aria-label="Select row"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge variant="outline" className={meta.cls}>
                        {meta.label}
                      </Badge>
                      {sla?.level === "breach" && (
                        <Badge
                          variant="outline"
                          className="ml-1.5 border-red-600/40 bg-red-600/10 px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider text-red-700"
                        >
                          SLA breach
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{r.customer_name}</span>
                        {returningIds.has(r.id) && (
                          <Badge
                            variant="outline"
                            className="border-violet-500/30 bg-violet-500/10 px-1.5 py-0 text-[10px] font-semibold text-violet-700"
                          >
                            Returning
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.customer_city ?? "—"}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {imgs.map((it) => {
                            const src = primaryImage(it);
                            return (
                              <div
                                key={it.id}
                                className="h-7 w-7 overflow-hidden rounded-full border-2 border-white bg-muted"
                              >
                                {src ? (
                                  <img
                                    src={src}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {r.inquiry_items.length} item
                          {r.inquiry_items.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-medium">
                      {fmtIDR(inquiryTotal(r))}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ChannelIcon className="h-3.5 w-3.5" /> {ch.label}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">
                      {relTime(r.created_at)}
                    </td>
                    <td
                      className="px-2 py-2.5 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded px-1.5 py-0.5 hover:bg-muted">
                            {r.assignee
                              ? r.assignee.full_name ?? r.assignee.email
                              : <span className="text-muted-foreground italic">Unassigned</span>}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => assignTo([r.id], null)}>
                            Unassigned
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {admins.map((a) => (
                            <DropdownMenuItem
                              key={a.id}
                              onClick={() => assignTo([r.id], a.id)}
                            >
                              {a.full_name ?? a.email}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td
                      className="px-2 py-2.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate({ to: "/admin/inquiries/$id", params: { id: r.id } })
                            }
                          >
                            <Eye className="mr-2 h-3.5 w-3.5" /> View
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs">Change status</DropdownMenuLabel>
                          {(["new", "contacted", "in_progress", "closed"] as Status[]).map((s) => (
                            <DropdownMenuItem
                              key={s}
                              onClick={() => updateStatus([r.id], s)}
                            >
                              <span className={cn("mr-2 h-2 w-2 rounded-full", STATUS_META[s].dot)} />
                              {STATUS_META[s].label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => updateStatus([r.id], "spam")}>
                            <Ban className="mr-2 h-3.5 w-3.5" /> Mark spam
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => removeRows([r.id])}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}