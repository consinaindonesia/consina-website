import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Package,
  Store,
  FolderPlus,
  PackagePlus,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Activity,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Consina" }, { name: "robots", content: "noindex" }] }),
  component: AdminHome,
});

type StatState = {
  totalProducts: number;
  productsAddedInRange: number;
  productsMissingTranslations: number;
  newInquiries: number;
  inquiriesInRange: number;
  lastInquiryAt: string | null;
  activeStores: number;
  regionCount: number;
};

type InquiryRow = {
  id: string;
  customer_name: string;
  customer_city: string | null;
  created_at: string;
  item_count: number;
};

type ProductRow = {
  id: string;
  name_en: string;
  updated_at: string;
  category_name: string | null;
  image_url: string | null;
};

type ActivityRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  admin_name: string | null;
};

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const ID_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const ID_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatDate(d: Date, lang: "en" | "id") {
  if (lang === "id") {
    return `${ID_DAYS[d.getDay()]}, ${d.getDate()} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

type RangeKey = "today" | "week" | "month" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

function rangeStart(key: RangeKey, now: Date): Date | null {
  if (key === "all") return null;
  const d = new Date(now);
  if (key === "today") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (key === "week") {
    const day = d.getDay(); // 0=Sun
    const diff = (day + 6) % 7; // Monday-based week
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // month
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function rangeWord(key: RangeKey) {
  switch (key) {
    case "today": return "today";
    case "week": return "this week";
    case "month": return "this month";
    case "all": return "all time";
  }
}

function AdminHome() {
  const { profile } = useAdminAuth();
  const firstName = profile?.full_name?.split(" ")[0] ?? "Admin";
  const now = useMemo(() => new Date(), []);
  const dateLabel = formatDate(now, profile?.preferred_language ?? "en");
  const [range, setRange] = useState<RangeKey>("month");

  const [stats, setStats] = useState<StatState>({
    totalProducts: 0,
    productsAddedInRange: 0,
    productsMissingTranslations: 0,
    newInquiries: 0,
    inquiriesInRange: 0,
    lastInquiryAt: null,
    activeStores: 0,
    regionCount: 0,
  });
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  async function loadAll() {
    const start = rangeStart(range, now);
    const startIso = start ? start.toISOString() : null;

    const productsAddedQuery = supabase
      .from("products")
      .select("id", { count: "exact", head: true });
    if (startIso) productsAddedQuery.gte("created_at", startIso);

    const inquiriesInRangeQuery = supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true });
    if (startIso) inquiriesInRangeQuery.gte("created_at", startIso);

    const [
      productsCount,
      productsAddedInRange,
      productsMissing,
      newInq,
      inquiriesInRange,
      lastInq,
      storesActive,
      storesRegions,
      recentInq,
      recentProducts,
    ] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
      productsAddedQuery,
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .or("name_id.eq.,name_en.eq."),
      supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
      inquiriesInRangeQuery,
      supabase.from("inquiries").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("stores").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("stores").select("region").eq("is_active", true),
      supabase
        .from("inquiries")
        .select("id, customer_name, customer_city, created_at, inquiry_items(id)")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("products")
        .select("id, name_en, updated_at, image_url:product_images(image_url), categories!products_category_id_fkey(name_en)")
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

    const regions = new Set(
      (storesRegions.data ?? []).map((r: { region: string | null }) => r.region).filter(Boolean) as string[],
    );

    setStats({
      totalProducts: productsCount.count ?? 0,
      productsAddedInRange: productsAddedInRange.count ?? 0,
      productsMissingTranslations: productsMissing.count ?? 0,
      newInquiries: newInq.count ?? 0,
      inquiriesInRange: inquiriesInRange.count ?? 0,
      lastInquiryAt: (lastInq.data as { created_at: string } | null)?.created_at ?? null,
      activeStores: storesActive.count ?? 0,
      regionCount: regions.size,
    });

    setInquiries(
      ((recentInq.data ?? []) as Array<{
        id: string;
        customer_name: string;
        customer_city: string | null;
        created_at: string;
        inquiry_items: Array<{ id: string }> | null;
      }>).map((r) => ({
        id: r.id,
        customer_name: r.customer_name,
        customer_city: r.customer_city,
        created_at: r.created_at,
        item_count: r.inquiry_items?.length ?? 0,
      })),
    );

    setProducts(
      ((recentProducts.data ?? []) as Array<{
        id: string;
        name_en: string;
        updated_at: string;
        image_url: Array<{ image_url: string }> | null;
        categories: { name_en: string } | null;
      }>).map((p) => ({
        id: p.id,
        name_en: p.name_en,
        updated_at: p.updated_at,
        category_name: p.categories?.name_en ?? null,
        image_url: p.image_url?.[0]?.image_url ?? null,
      })),
    );
  }

  async function loadActivity() {
    const { data } = await supabase
      .from("activity_log")
      .select("id, action, entity_type, entity_id, created_at, admin_users(full_name)")
      .order("created_at", { ascending: false })
      .limit(10);
    setActivity(
      ((data ?? []) as Array<{
        id: string;
        action: string;
        entity_type: string;
        entity_id: string | null;
        created_at: string;
        admin_users: { full_name: string | null } | null;
      }>).map((a) => ({
        id: a.id,
        action: a.action,
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        created_at: a.created_at,
        admin_name: a.admin_users?.full_name ?? null,
      })),
    );
  }

  useEffect(() => {
    void loadAll();
    if (profile?.role === "admin") void loadActivity();

    const ch = supabase
      .channel("admin-dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiries" },
        (payload) => {
          const name = (payload.new as { customer_name?: string })?.customer_name ?? "someone";
          toast.success(`New inquiry from ${name}`);
          void loadAll();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inquiries" },
        () => void loadAll(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role, range]);

  return (
    <AdminShell>
      {/* Welcome header */}
      <header>
        <h1 className="text-3xl font-black tracking-tight text-primary">
          {greeting(now)}, {firstName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{dateLabel}</p>
      </header>

      {/* Quick stats */}
      <div className="mt-8 flex items-end justify-between gap-4">
        <h2 className="text-lg font-bold text-primary">Overview</h2>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="uppercase tracking-wider">Range</span>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>
      <section className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Products"
          value={stats.totalProducts}
          sub={
            <>
              <div>{stats.productsAddedInRange} added {rangeWord(range)}</div>
              {stats.productsMissingTranslations > 0 && (
                <div className="mt-0.5">
                  <Link
                    to="/admin/products"
                    search={{ lang: "missing" }}
                    className="text-orange-600 hover:underline"
                  >
                    {stats.productsMissingTranslations} missing translation
                    {stats.productsMissingTranslations === 1 ? "" : "s"} →
                  </Link>
                </div>
              )}
            </>
          }
        />
        <StatCard
          label="New Inquiries"
          value={stats.newInquiries}
          sub={
            range === "all"
              ? stats.lastInquiryAt
                ? `Last inquiry: ${timeAgo(stats.lastInquiryAt)}`
                : "No inquiries yet"
              : `${stats.inquiriesInRange} received ${rangeWord(range)}`
          }
          dot={stats.newInquiries > 0}
        />
        <StatCard
          label="Active Stores"
          value={stats.activeStores}
          sub={`Across ${stats.regionCount} region${stats.regionCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Languages"
          value={"2 — ID, EN"}
          sub={
            <Link to="/admin" className="text-secondary hover:underline">
              Manage →
            </Link>
          }
        />
      </section>

      {/* Two columns */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <h2 className="text-lg font-bold text-primary">Inquiries needing attention</h2>
          {inquiries.length === 0 ? (
            <EmptyState
              icon="MessageSquare"
              title="You're all caught up!"
              description="No new inquiries."
            />
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {inquiries.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{i.customer_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[i.customer_city, `${i.item_count} item${i.item_count === 1 ? "" : "s"}`, timeAgo(i.created_at)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Link to="/admin/inquiries" className="text-xs font-semibold text-secondary hover:underline">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Link to="/admin/inquiries" className="text-xs font-semibold text-secondary hover:underline">
              View all inquiries →
            </Link>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-primary">Recently edited</h2>
          {products.length === 0 ? (
            <EmptyState icon="Package" title="No products yet" description="Recently edited products will appear here." />
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {products.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-muted">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Package size={16} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{p.name_en}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.category_name ?? "Uncategorized"} · Edited {timeAgo(p.updated_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Link to="/admin/products" className="text-xs font-semibold text-secondary hover:underline">
              All products →
            </Link>
          </div>
        </Card>
      </section>

      {/* Quick actions */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard icon={<PackagePlus size={20} />} label="New Product" to="/admin/products" />
        <ActionCard icon={<FolderPlus size={20} />} label="New Category" to="/admin/categories" />
        <ActionCard icon={<Store size={20} />} label="New Store" to="/admin" />
        <ActionCard
          icon={<ExternalLink size={20} />}
          label="View Public Site"
          href="https://consina.com"
          external
        />
      </section>

      {/* Activity feed (admin only) */}
      {profile?.role === "admin" && (
        <section className="mt-8">
          <Card>
            <h2 className="text-lg font-bold text-primary">Recent activity</h2>
            {activity.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <ActivityIcon action={a.action} />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground">
                        <span className="font-semibold">{a.admin_name ?? "Someone"}</span>{" "}
                        {a.action} {a.entity_type.replace("_", " ")}
                        <span className="text-muted-foreground"> — {timeAgo(a.created_at)}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <Link to="/admin" className="text-xs font-semibold text-secondary hover:underline">
                View full activity log →
              </Link>
            </div>
          </Card>
        </section>
      )}
    </AdminShell>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-card p-6 shadow-sm">{children}</div>;
}

function StatCard({
  label,
  value,
  sub,
  dot,
}: {
  label: string;
  value: number | string;
  sub?: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <div className="group rounded-xl bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {dot && <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-label="new" />}
      </div>
      <p className="mt-2 text-3xl font-black tracking-tight text-primary">{value}</p>
      {sub && <div className="mt-2 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ActionCard({
  icon,
  label,
  to,
  href,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
}) {
  const className =
    "flex items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/50 p-4 text-sm font-semibold text-foreground transition-all duration-200 hover:border-secondary hover:bg-card hover:text-secondary";
  if (external && href) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
        {icon}
        <span>{label}</span>
      </a>
    );
  }
  return (
    <Link to={to ?? "/admin"} className={className}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function ActivityIcon({ action }: { action: string }) {
  const base = "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full";
  if (action === "created")
    return (
      <span className={`${base} bg-green-100 text-green-700`}>
        <Plus size={14} />
      </span>
    );
  if (action === "deleted")
    return (
      <span className={`${base} bg-red-100 text-red-700`}>
        <Trash2 size={14} />
      </span>
    );
  if (action === "updated")
    return (
      <span className={`${base} bg-blue-100 text-blue-700`}>
        <Pencil size={14} />
      </span>
    );
  return (
    <span className={`${base} bg-muted text-muted-foreground`}>
      <Activity size={14} />
    </span>
  );
}