import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrdersPage,
});

type PaymentStatus =
  | "all"
  | "pending"
  | "awaiting_proof"
  | "verifying"
  | "paid"
  | "failed"
  | "refunded";

type OrderRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  total_idr: number;
  payment_status: string;
  payment_method: string;
  status: string;
  created_at: string;
  voucher_code: string | null;
  voucher_discount_idr: number | null;
};

const STATUS_TABS: { key: PaymentStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "awaiting_proof", label: "Awaiting proof" },
  { key: "verifying", label: "Verifying" },
  { key: "paid", label: "Paid" },
  { key: "failed", label: "Failed" },
];

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  awaiting_proof: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  verifying: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  paid: "bg-green-500/10 text-green-700 border-green-500/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
  refunded: "bg-muted text-muted-foreground border-border",
};

function shortRef(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function OrdersPage() {
  const [tab, setTab] = useState<PaymentStatus>("all");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      let q = supabase
        .from("orders")
        .select(
          "id, customer_name, customer_email, total_idr, payment_status, payment_method, status, created_at, voucher_code, voucher_discount_idr",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (tab !== "all") q = q.eq("payment_status", tab);
      const { data } = await q;
      if (!cancelled) {
        setOrders((data as OrderRow[]) ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of orders) c[o.payment_status] = (c[o.payment_status] ?? 0) + 1;
    return c;
  }, [orders]);

  return (
    <AdminShell>
      <div className="px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Dashboard › Orders</p>
            <h1 className="text-2xl font-bold tracking-tight">
              Orders <span className="text-muted-foreground">({orders.length})</span>
            </h1>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
          {STATUS_TABS.map((s) => (
            <button
              key={s.key}
              onClick={() => setTab(s.key)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm transition",
                tab === s.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
              {s.key !== "all" && counts[s.key] ? (
                <span className="ml-1.5 text-xs">({counts[s.key]})</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon="ShoppingBag"
              title="No orders yet"
              description="Orders created from customer checkouts will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Ref</th>
                    <th className="px-4 py-3 text-left font-medium">Customer</th>
                    <th className="px-4 py-3 text-left font-medium">Total</th>
                    <th className="px-4 py-3 text-left font-medium">Voucher</th>
                    <th className="px-4 py-3 text-left font-medium">Payment</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">
                        {shortRef(o.id)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{o.customer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.customer_email}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        Rp {o.total_idr.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {o.voucher_code ? (
                          <>
                            <span className="font-mono">{o.voucher_code}</span>
                            {o.voucher_discount_idr ? (
                              <span className="ml-1 text-muted-foreground">
                                (−Rp {o.voucher_discount_idr.toLocaleString("id-ID")})
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border text-xs",
                            STATUS_COLOR[o.payment_status],
                          )}
                        >
                          {o.payment_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">{o.status}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/admin/orders/${o.id}` as never}>View</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}