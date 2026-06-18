import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, Search, User as UserIcon } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomersPage,
});

type InquiryRowRaw = {
  id: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_city: string | null;
  created_at: string;
  inquiry_items: {
    quantity: number;
    product: { price_idr: number } | null;
  }[];
};

type Tier = "best" | "active" | "inactive";

type Customer = {
  email: string;
  name: string;
  phone: string | null;
  city: string | null;
  totalInquiries: number;
  lifetimeValue: number;
  lastInquiryAt: string;
  firstInquiryAt: string;
  tier: Tier;
};

function fmtIDR(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / (24 * 3600 * 1000));
  if (d < 1) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d}d ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m}mo ago`;
  return new Date(iso).toLocaleDateString();
}

const TIER_META: Record<Tier, { label: string; cls: string }> = {
  best: {
    label: "Best Customer",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  },
  active: {
    label: "Active",
    cls: "border-blue-500/30 bg-blue-500/10 text-blue-700",
  },
  inactive: {
    label: "Inactive",
    cls: "border-zinc-400/40 bg-zinc-400/10 text-zinc-600",
  },
};

function deriveTier(c: Pick<Customer, "totalInquiries" | "lifetimeValue" | "lastInquiryAt">): Tier {
  const daysSince = (Date.now() - new Date(c.lastInquiryAt).getTime()) / (24 * 3600 * 1000);
  if (c.totalInquiries >= 3 || c.lifetimeValue >= 5_000_000) return "best";
  if (daysSince <= 60) return "active";
  return "inactive";
}

export function aggregateCustomers(rows: InquiryRowRaw[]): Customer[] {
  const byEmail = new Map<string, InquiryRowRaw[]>();
  for (const r of rows) {
    const k = (r.customer_email ?? "").trim().toLowerCase();
    if (!k) continue;
    const arr = byEmail.get(k) ?? [];
    arr.push(r);
    byEmail.set(k, arr);
  }
  const out: Customer[] = [];
  for (const [key, list] of byEmail.entries()) {
    const sorted = [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latest = sorted[0];
    const oldest = sorted[sorted.length - 1];
    const lifetimeValue = list.reduce((s, r) => {
      const t = (r.inquiry_items ?? []).reduce(
        (sum, it) => sum + (it.product?.price_idr ?? 0) * it.quantity,
        0
      );
      return s + t;
    }, 0);
    const base = {
      email: key,
      name: latest.customer_name,
      phone: latest.customer_phone,
      city: latest.customer_city,
      totalInquiries: list.length,
      lifetimeValue,
      lastInquiryAt: latest.created_at,
      firstInquiryAt: oldest.created_at,
    };
    out.push({ ...base, tier: deriveTier(base) });
  }
  out.sort(
    (a, b) =>
      new Date(b.lastInquiryAt).getTime() - new Date(a.lastInquiryAt).getTime()
  );
  return out;
}

function CustomersPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<Tier | "all">("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("inquiries")
        .select(
          `id, status, customer_name, customer_email, customer_phone, customer_city, created_at,
           inquiry_items(quantity, product:products(price_idr))`
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(2000);
      setLoading(false);
      if (error) return toast.error(error.message);
      setCustomers(aggregateCustomers((data ?? []) as unknown as InquiryRowRaw[]));
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (tier !== "all" && c.tier !== tier) return false;
      if (!q) return true;
      const hay = [c.name, c.email, c.phone ?? "", c.city ?? ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [customers, search, tier]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: customers.length, best: 0, active: 0, inactive: 0 };
    for (const cust of customers) c[cust.tier]++;
    return c;
  }, [customers]);

  return (
    <AdminShell>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/admin" className="hover:text-foreground">Dashboard</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Customers</span>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight text-primary">
          Customers{" "}
          <span className="text-muted-foreground font-medium">({customers.length})</span>
        </h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "best", "active", "inactive"] as const).map((t) => {
          const active = tier === t;
          const label =
            t === "all" ? "All" : TIER_META[t as Tier].label;
          return (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-white text-foreground hover:bg-muted"
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  active ? "bg-background/20" : "bg-muted text-muted-foreground"
                )}
              >
                {counts[t] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, phone, city..."
          className="pl-8"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="Users"
          title="No customers yet"
          description="Customers will appear here as soon as the first inquiry is submitted."
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-2 py-2">Contact</th>
                <th className="px-2 py-2">Inquiries</th>
                <th className="px-2 py-2">Lifetime value</th>
                <th className="px-2 py-2">Last inquiry</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const m = TIER_META[c.tier];
                return (
                  <tr
                    key={c.email}
                    onClick={() =>
                      navigate({
                        to: "/admin/customers/$email",
                        params: { email: c.email },
                      })
                    }
                    className="cursor-pointer border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <UserIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.city ?? "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-xs">
                      <div>{c.email}</div>
                      <div className="text-muted-foreground">{c.phone ?? "—"}</div>
                    </td>
                    <td className="px-2 py-2.5 font-medium">{c.totalInquiries}</td>
                    <td className="px-2 py-2.5 font-medium">{fmtIDR(c.lifetimeValue)}</td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">
                      {relTime(c.lastInquiryAt)}
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge variant="outline" className={m.cls}>
                        {m.label}
                      </Badge>
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