import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  ArrowLeft,
  Download,
  Trash2,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/customers/$email")({
  head: () => ({
    meta: [
      { title: "Customer — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomerDetailPage,
});

type Status = "new" | "contacted" | "in_progress" | "won" | "lost" | "spam" | "closed";

type InquiryRow = {
  id: string;
  status: Status;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_city: string | null;
  message: string | null;
  created_at: string;
  inquiry_items: {
    id: string;
    quantity: number;
    product: {
      id: string;
      name_en: string | null;
      name_id: string | null;
      price_idr: number;
      product_images: { image_url: string; is_primary: boolean | null }[] | null;
    } | null;
  }[];
};

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  new: { label: "New", cls: "border-red-500/30 bg-red-500/10 text-red-700", dot: "bg-red-500" },
  contacted: { label: "Contacted", cls: "border-amber-500/30 bg-amber-500/10 text-amber-700", dot: "bg-amber-500" },
  in_progress: { label: "In Progress", cls: "border-blue-500/30 bg-blue-500/10 text-blue-700", dot: "bg-blue-500" },
  won: { label: "Closed — Won", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" },
  lost: { label: "Closed — Lost", cls: "border-zinc-400/40 bg-zinc-400/10 text-zinc-600", dot: "bg-zinc-400" },
  closed: { label: "Closed", cls: "border-zinc-400/40 bg-zinc-400/10 text-zinc-600", dot: "bg-zinc-400" },
  spam: { label: "Spam", cls: "border-zinc-400/40 bg-zinc-400/10 text-zinc-500 line-through", dot: "bg-zinc-400" },
};

function fmtIDR(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function primaryImg(p: InquiryRow["inquiry_items"][number]) {
  const imgs = p.product?.product_images ?? [];
  if (!imgs.length) return null;
  return (imgs.find((i) => i.is_primary) ?? imgs[0])?.image_url ?? null;
}

function inquiryTotal(r: InquiryRow) {
  return r.inquiry_items.reduce(
    (s, it) => s + (it.product?.price_idr ?? 0) * it.quantity,
    0
  );
}

function CustomerDetailPage() {
  const { email } = Route.useParams();
  const decoded = decodeURIComponent(email);
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("inquiries")
        .select(
          `id, status, customer_name, customer_email, customer_phone, customer_city,
           message, created_at,
           inquiry_items(id, quantity,
             product:products(id, name_en, name_id, price_idr,
               product_images(image_url, is_primary)))`
        )
        .ilike("customer_email", decoded)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      setLoading(false);
      if (error) return toast.error(error.message);
      setRows((data ?? []) as unknown as InquiryRow[]);
    })();
  }, [decoded]);

  const summary = useMemo(() => {
    if (!rows.length) return null;
    const latest = rows[0];
    const lifetimeValue = rows.reduce((s, r) => s + inquiryTotal(r), 0);
    const daysSince = (Date.now() - new Date(latest.created_at).getTime()) / (24 * 3600 * 1000);
    const tier =
      rows.length >= 3 || lifetimeValue >= 5_000_000
        ? "Best Customer"
        : daysSince <= 60
        ? "Active"
        : "Inactive";
    const tierCls =
      tier === "Best Customer"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
        : tier === "Active"
        ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
        : "border-zinc-400/40 bg-zinc-400/10 text-zinc-600";
    return { latest, lifetimeValue, tier, tierCls };
  }, [rows]);

  return (
    <AdminShell>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/admin" className="hover:text-foreground">Dashboard</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/admin/customers" className="hover:text-foreground">Customers</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{decoded}</span>
      </div>

      <Link
        to="/admin/customers"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> All customers
      </Link>

      <div className="mb-3 flex flex-wrap gap-2">
        <Link to="/admin/customers/$email/export" params={{ email }}>
          <Button size="sm" variant="outline">
            <Download className="mr-1.5 h-4 w-4" /> Export data
          </Button>
        </Link>
        <Link to="/admin/customers/$email/delete" params={{ email }}>
          <Button size="sm" variant="outline" className="border-red-500/40 text-red-700 hover:bg-red-500/10">
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete all data
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !summary ? (
        <div className="rounded-md border border-border bg-white p-8 text-center text-muted-foreground">
          No inquiries found for {decoded}.
        </div>
      ) : (
        <>
          {/* Customer header */}
          <section className="mb-6 rounded-lg border border-border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge variant="outline" className={summary.tierCls}>
                  {summary.tier}
                </Badge>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-primary">
                  {summary.latest.customer_name}
                </h1>
                <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    <a className="underline" href={`mailto:${summary.latest.customer_email}`}>
                      {summary.latest.customer_email}
                    </a>
                  </div>
                  {summary.latest.customer_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      <a className="underline" href={`tel:${summary.latest.customer_phone}`}>
                        {summary.latest.customer_phone}
                      </a>
                    </div>
                  )}
                  <div>City: {summary.latest.customer_city ?? "—"}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {summary.latest.customer_phone && (
                  <a
                    href={`https://wa.me/${summary.latest.customer_phone
                      .replace(/\D/g, "")
                      .replace(/^0/, "62")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
                      <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                    </Button>
                  </a>
                )}
                <a href={`mailto:${summary.latest.customer_email}`}>
                  <Button size="sm" variant="outline">
                    <Mail className="mr-1.5 h-4 w-4" /> Email
                  </Button>
                </a>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
              <Stat label="Total inquiries" value={String(rows.length)} />
              <Stat label="Lifetime value" value={fmtIDR(summary.lifetimeValue)} />
              <Stat label="First inquiry" value={fmtDate(rows[rows.length - 1].created_at)} />
              <Stat label="Last inquiry" value={fmtDate(summary.latest.created_at)} />
            </div>
          </section>

          {/* Timeline */}
          <section className="rounded-lg border border-border bg-white p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Inquiry timeline ({rows.length})
            </h2>
            <div className="relative space-y-4 border-l border-border pl-5">
              {rows.map((r) => {
                const m = STATUS_META[r.status] ?? STATUS_META.new;
                const total = inquiryTotal(r);
                return (
                  <div key={r.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[27px] top-2 h-3 w-3 rounded-full ring-4 ring-white",
                        m.dot
                      )}
                    />
                    <Link
                      to="/admin/inquiries/$id"
                      params={{ id: r.id }}
                      className="block rounded-md border border-border p-4 transition hover:bg-muted/40"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={m.cls}>
                            {m.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            #{r.id.slice(0, 8).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {fmtDate(r.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex -space-x-2">
                          {r.inquiry_items.slice(0, 5).map((it) => {
                            const src = primaryImg(it);
                            return (
                              <div
                                key={it.id}
                                className="h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-muted"
                              >
                                {src ? (
                                  <img src={src} alt="" className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                            );
                          })}
                          <span className="ml-3 self-center text-xs text-muted-foreground">
                            {r.inquiry_items.length} item
                            {r.inquiry_items.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="text-sm font-medium">{fmtIDR(total)}</div>
                      </div>
                      {r.message && (
                        <div className="mt-3 line-clamp-2 rounded border border-border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
                          {r.message}
                        </div>
                      )}
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}