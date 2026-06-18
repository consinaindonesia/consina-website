import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/reports/regional")({
  head: () => ({
    meta: [
      { title: "Regional Analytics — Consina Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegionalReports,
});

type RangeKey = "7d" | "30d" | "90d" | "all";

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "all", label: "All time", days: null },
];

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#84cc16",
];

type InquiryRec = {
  id: string;
  customer_city: string | null;
  preferred_store_id: string | null;
  created_at: string;
};

type StoreRec = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  is_active: boolean;
};

function normalizeCity(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

function RegionalReports() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState<InquiryRec[]>([]);
  const [stores, setStores] = useState<StoreRec[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const days = RANGES.find((r) => r.key === range)?.days ?? null;
      const sinceIso =
        days != null
          ? new Date(Date.now() - days * 86400 * 1000).toISOString()
          : null;

      const inqQ = supabase
        .from("inquiries")
        .select("id, customer_city, preferred_store_id, created_at")
        .is("deleted_at", null);
      if (sinceIso) inqQ.gte("created_at", sinceIso);

      const [inqRes, storesRes] = await Promise.all([
        inqQ.limit(5000),
        supabase
          .from("stores")
          .select("id, name, city, region, is_active")
          .limit(1000),
      ]);

      if (cancelled) return;
      setInquiries((inqRes.data ?? []) as InquiryRec[]);
      setStores((storesRes.data ?? []) as StoreRec[]);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  // 1. Inquiries by city — top 10
  const byCity = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of inquiries) {
      const c = (i.customer_city ?? "").trim();
      if (!c) continue;
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [inquiries]);

  // 2. Inquiries by region — derive via city→store→region lookup, fallback "Unknown"
  const cityToRegion = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stores) {
      const key = normalizeCity(s.city);
      if (key && s.region && !m.has(key)) m.set(key, s.region);
    }
    return m;
  }, [stores]);

  const byRegion = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of inquiries) {
      const region =
        cityToRegion.get(normalizeCity(i.customer_city)) ?? "Unknown";
      map.set(region, (map.get(region) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);
  }, [inquiries, cityToRegion]);

  // 3. Stores by region + avg inquiries per store
  const storesByRegion = useMemo(() => {
    const storeCount = new Map<string, number>();
    for (const s of stores) {
      if (!s.is_active) continue;
      const r = s.region ?? "Unassigned";
      storeCount.set(r, (storeCount.get(r) ?? 0) + 1);
    }
    const inqByStoreRegion = new Map<string, number>();
    const storeIdToRegion = new Map<string, string>();
    for (const s of stores) storeIdToRegion.set(s.id, s.region ?? "Unassigned");
    for (const i of inquiries) {
      if (!i.preferred_store_id) continue;
      const r = storeIdToRegion.get(i.preferred_store_id);
      if (!r) continue;
      inqByStoreRegion.set(r, (inqByStoreRegion.get(r) ?? 0) + 1);
    }
    return [...storeCount.entries()]
      .map(([region, count]) => ({
        region,
        stores: count,
        avgInquiries:
          count > 0
            ? Number(((inqByStoreRegion.get(region) ?? 0) / count).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.stores - a.stores);
  }, [stores, inquiries]);

  // 4. Underserved cities — inquiry cities not present in any store city
  const underserved = useMemo(() => {
    const storeCities = new Set(
      stores.filter((s) => s.is_active).map((s) => normalizeCity(s.city)),
    );
    const map = new Map<string, number>();
    for (const i of inquiries) {
      const c = (i.customer_city ?? "").trim();
      if (!c) continue;
      if (storeCities.has(normalizeCity(c))) continue;
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [inquiries, stores]);

  // 5. Top performing stores by preferred_store_id selections
  const topStores = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of inquiries) {
      if (!i.preferred_store_id) continue;
      counts.set(
        i.preferred_store_id,
        (counts.get(i.preferred_store_id) ?? 0) + 1,
      );
    }
    const byId = new Map(stores.map((s) => [s.id, s]));
    return [...counts.entries()]
      .map(([id, count]) => {
        const s = byId.get(id);
        return {
          id,
          name: s?.name ?? "Unknown store",
          city: s?.city ?? "—",
          region: s?.region ?? "—",
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [inquiries, stores]);

  return (
    <AdminShell>
      <nav className="text-xs text-muted-foreground">
        <Link to="/admin" className="hover:underline">
          Dashboard
        </Link>{" "}
        / <span className="text-foreground">Reports</span> /{" "}
        <span className="text-foreground">Regional</span>
      </nav>

      <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary">
            Regional Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where customers are asking from, and where to invest next.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="uppercase tracking-wider">Range</span>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : inquiries.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="ChartBar"
            title="No inquiries in this range"
            description="Try a longer time window."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Inquiries by city */}
          <Card>
            <SectionTitle
              title="Inquiries by city"
              sub={`Top ${byCity.length} cities`}
            />
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCity} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis
                    type="category"
                    dataKey="city"
                    width={110}
                    fontSize={11}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Inquiries by region — pie */}
          <Card>
            <SectionTitle
              title="Inquiries by region"
              sub="Mapped via stored city → region lookup"
            />
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byRegion}
                    dataKey="count"
                    nameKey="region"
                    outerRadius={100}
                    label={(d: { region: string; count: number }) =>
                      `${d.region} (${d.count})`
                    }
                  >
                    {byRegion.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Stores by region */}
          <Card>
            <SectionTitle
              title="Stores by region"
              sub="Active stores + avg inquiries per store (preferred-store basis)"
            />
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={storesByRegion}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="region" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="stores"
                    name="Stores"
                    fill="hsl(var(--primary))"
                    radius={4}
                  />
                  <Bar
                    dataKey="avgInquiries"
                    name="Avg inquiries/store"
                    fill="hsl(var(--secondary))"
                    radius={4}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Top performing stores */}
          <Card>
            <SectionTitle
              title="Top performing stores"
              sub="By preferred-store selections"
            />
            {topStores.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No preferred-store data yet.
              </p>
            ) : (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-2">Store</th>
                    <th className="py-2 pr-2">City</th>
                    <th className="py-2 pr-2">Region</th>
                    <th className="py-2 text-right">Selections</th>
                  </tr>
                </thead>
                <tbody>
                  {topStores.map((s) => (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="py-2 pr-2 font-semibold text-foreground">
                        {s.name}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {s.city}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {s.region}
                      </td>
                      <td className="py-2 text-right font-mono font-semibold">
                        {s.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Underserved cities */}
          <Card className="lg:col-span-2">
            <SectionTitle
              title="Underserved cities"
              sub="Inquiries from cities with no active Consina store — candidates for expansion"
            />
            {underserved.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Every inquiring city has a store. 🎉
              </p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {underserved.map((c) => (
                  <div
                    key={c.city}
                    className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                  >
                    <span className="truncate text-sm font-semibold text-foreground">
                      {c.city}
                    </span>
                    <span className="ml-3 rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-bold text-secondary">
                      {c.count} inquir{c.count === 1 ? "y" : "ies"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </AdminShell>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-card p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-base font-bold text-primary">
        {title}
      </h2>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}