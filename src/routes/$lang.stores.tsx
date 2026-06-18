import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  MapPin,
  Phone,
  Navigation,
  Clock,
  List as ListIcon,
  Map as MapIcon,
  LocateFixed,
} from "lucide-react";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$lang/stores")({
  validateSearch: (s: Record<string, unknown>): { product?: string } => {
    const v = typeof s.product === "string" ? s.product : undefined;
    return v ? { product: v } : {};
  },
  head: () => ({
    meta: [
      { title: "Find a Consina Store — Locations Across Indonesia" },
      {
        name: "description",
        content:
          "Find your nearest Consina store. Browse our locations across Indonesia with live opening hours, directions, and an interactive map.",
      },
      { property: "og:title", content: "Find a Consina Store" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PublicStoresPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type DaySchedule =
  | { mode: "closed" }
  | { mode: "24h" }
  | { mode: "open"; from: string; to: string };
type Hours = Record<DayKey, DaySchedule>;

type Store = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_hours: unknown;
};

const DAY_ORDER: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS: Record<DayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const REGIONS = [
  "All",
  "Greater Jakarta",
  "West Java",
  "Central Java",
  "East Java",
  "Bali",
  "Sumatra",
  "Kalimantan",
  "Sulawesi",
  "Eastern Indonesia",
] as const;

// ─── Hours helpers (Asia/Jakarta) ─────────────────────────────────────────────
function parseHours(v: unknown): Hours | null {
  if (!v || typeof v !== "object") return null;
  const out = {} as Hours;
  let any = false;
  for (const d of DAY_ORDER) {
    const x = (v as Record<string, unknown>)[d];
    if (!x || typeof x !== "object") {
      out[d] = { mode: "closed" };
      continue;
    }
    const o = x as Record<string, unknown>;
    if (o.mode === "closed") out[d] = { mode: "closed" };
    else if (o.mode === "24h") {
      out[d] = { mode: "24h" };
      any = true;
    } else if (
      o.mode === "open" &&
      typeof o.from === "string" &&
      typeof o.to === "string"
    ) {
      out[d] = { mode: "open", from: o.from, to: o.to };
      any = true;
    } else out[d] = { mode: "closed" };
  }
  return any ? out : null;
}

function jakartaNow(): { day: DayKey; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wk = parts.find((p) => p.type === "weekday")?.value || "Sun";
  const hh = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value || "0");
  const map: Record<string, DayKey> = {
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
  };
  return { day: map[wk] ?? "mon", minutes: hh * 60 + mm };
}

function toMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function openStatus(hours: Hours | null): {
  open: boolean;
  label: string;
} {
  if (!hours) return { open: false, label: "Hours not available" };
  const { day, minutes } = jakartaNow();
  const today = hours[day];
  if (today.mode === "24h") return { open: true, label: "Open 24 hours" };
  if (today.mode === "open") {
    const from = toMin(today.from);
    const to = toMin(today.to);
    if (minutes >= from && minutes < to)
      return { open: true, label: `Open · closes ${today.to}` };
  }
  // find next opening
  const idx = DAY_ORDER.indexOf(day);
  for (let i = 0; i < 7; i++) {
    const offset = i === 0 ? 0 : i;
    const d = DAY_ORDER[(idx + offset) % 7];
    const sched = hours[d];
    if (sched.mode === "24h")
      return {
        open: false,
        label: i === 0 ? "Closed" : `Closed · opens ${DAY_LABELS[d]} 24h`,
      };
    if (sched.mode === "open") {
      const from = toMin(sched.from);
      if (i === 0 && minutes < from)
        return { open: false, label: `Closed · opens today at ${sched.from}` };
      if (i > 0)
        return {
          open: false,
          label:
            i === 1
              ? `Closed · opens tomorrow at ${sched.from}`
              : `Closed · opens ${DAY_LABELS[d]} at ${sched.from}`,
        };
    }
  }
  return { open: false, label: "Temporarily closed" };
}

// ─── Distance ─────────────────────────────────────────────────────────────────
function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function PublicStoresPage() {
  const { product: productFilter } = Route.useSearch();
  const [stores, setStores] = useState<Store[]>([]);
  const [productInfo, setProductInfo] = useState<{ name: string; storeIds: Set<string> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState<string>("All");
  const [openNow, setOpenNow] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const [geoState, setGeoState] = useState<"idle" | "asking" | "granted" | "denied">(
    "idle",
  );
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  // fetch stores
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("stores")
        .select(
          "id,name,address,city,province,region,phone,latitude,longitude,opening_hours",
        )
        .eq("is_active", true);
      if (cancelled) return;
      if (!error && data) setStores(data as Store[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If a product context is present, load product name + the set of stores carrying it.
  useEffect(() => {
    if (!productFilter) {
      setProductInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: ss }] = await Promise.all([
        supabase.from("products").select("name_en, name_id").eq("id", productFilter).maybeSingle(),
        supabase.from("store_stock").select("store_id").eq("product_id", productFilter),
      ]);
      if (cancelled) return;
      const name = (p as { name_en?: string; name_id?: string } | null);
      setProductInfo({
        name: name?.name_en ?? name?.name_id ?? "this product",
        storeIds: new Set(((ss ?? []) as { store_id: string }[]).map((r) => r.store_id)),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [productFilter]);

  // ask geolocation on mount
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    setGeoState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoState("granted");
      },
      () => setGeoState("denied"),
      { timeout: 8000, maximumAge: 300_000 },
    );
  }, []);

  // derived list
  const enriched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores
      .map((s) => {
        const hours = parseHours(s.opening_hours);
        const status = openStatus(hours);
        const distance =
          userLoc && s.latitude != null && s.longitude != null
            ? haversineKm(userLoc, { lat: Number(s.latitude), lon: Number(s.longitude) })
            : null;
        return { ...s, hours, status, distance };
      })
      .filter((s) => {
        if (region !== "All" && s.region !== region) return false;
        if (openNow && !s.status.open) return false;
        if (productInfo && !productInfo.storeIds.has(s.id)) return false;
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          (s.city || "").toLowerCase().includes(q) ||
          (s.province || "").toLowerCase().includes(q) ||
          (s.address || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        if ((a.region || "") !== (b.region || ""))
          return (a.region || "").localeCompare(b.region || "");
        return a.name.localeCompare(b.name);
      });
  }, [stores, search, region, openNow, userLoc, productInfo]);

  const requestGeo = () => {
    if (!navigator.geolocation) return;
    setGeoState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoState("granted");
      },
      () => setGeoState("denied"),
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <header className="border-b border-border bg-[#f5f0e8]">
          <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8b7355]">
              Store Locator
            </p>
            <h1 className="mt-3 text-3xl font-black leading-[0.95] tracking-tight text-primary md:text-5xl">
              Find a Consina Store
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {loading
                ? "Loading stores…"
                : `${enriched.length} of ${stores.length} stores match your filters.`}
            </p>
            {productInfo && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
                Showing stores that carry <span className="font-semibold">{productInfo.name}</span>
              </div>
            )}
          </div>
        </header>

        {/* Mobile view toggle */}
        <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-[1400px] gap-2 px-4 py-2">
            <button
              onClick={() => setMobileView("list")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold uppercase tracking-wider transition",
                mobileView === "list"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <ListIcon className="h-4 w-4" /> List
            </button>
            <button
              onClick={() => setMobileView("map")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold uppercase tracking-wider transition",
                mobileView === "map"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <MapIcon className="h-4 w-4" /> Map
            </button>
          </div>
        </div>

        <section className="mx-auto max-w-[1400px] md:px-4 md:py-6 lg:px-8">
          <div className="grid grid-cols-1 gap-0 md:grid-cols-5 md:gap-6">
            {/* LEFT PANE */}
            <div
              className={cn(
                "md:col-span-2 md:block",
                mobileView === "list" ? "block" : "hidden",
              )}
            >
              <div className="space-y-3 px-4 pt-4 md:px-0 md:pt-0">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by city or province…"
                    className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none ring-offset-2 transition focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {REGIONS.map((r) => {
                    const active = region === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setRegion(r)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground/70 hover:border-primary hover:text-primary",
                        )}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={openNow}
                      onChange={(e) => setOpenNow(e.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-primary"
                    />
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">Open now</span>
                  </label>
                  <button
                    onClick={requestGeo}
                    disabled={geoState === "asking"}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/70 transition hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    <LocateFixed className="h-3 w-3" />
                    {geoState === "granted"
                      ? "Located"
                      : geoState === "asking"
                        ? "Locating…"
                        : "Use my location"}
                  </button>
                </div>
              </div>

              <div className="mt-3 max-h-[70vh] overflow-y-auto px-4 pb-6 md:max-h-[calc(100vh-200px)] md:px-0">
                {loading ? (
                  <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                    Loading…
                  </p>
                ) : enriched.length === 0 ? (
                  <div className="px-2 py-12 text-center">
                    <MapPin className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-3 text-sm font-semibold">No stores match</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try a different region or clear the search.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {enriched.map((s) => (
                      <StoreListCard
                        key={s.id}
                        store={s}
                        active={highlightId === s.id}
                        onSelect={() => setHighlightId(s.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* RIGHT PANE — MAP */}
            <div
              className={cn(
                "md:col-span-3 md:block",
                mobileView === "map" ? "block" : "hidden",
              )}
            >
              <div className="md:sticky md:top-4">
                <LazyMap
                  stores={enriched}
                  highlightId={highlightId}
                  onMarkerClick={(id) => setHighlightId(id)}
                  userLoc={userLoc}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

// ─── List Card ────────────────────────────────────────────────────────────────
function StoreListCard({
  store,
  active,
  onSelect,
}: {
  store: Store & {
    hours: Hours | null;
    status: { open: boolean; label: string };
    distance: number | null;
  };
  active: boolean;
  onSelect: () => void;
}) {
  const mapsUrl =
    store.latitude != null && store.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${store.name} ${store.address || ""} ${store.city || ""}`,
        )}`;

  return (
    <li
      id={`store-${store.id}`}
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-lg border bg-card p-3 transition",
        active
          ? "border-primary shadow-md ring-1 ring-primary"
          : "border-border hover:border-primary/40 hover:shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold leading-snug text-primary">
          {store.name}
        </h3>
        {store.distance != null && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground">
            {store.distance < 1
              ? `${Math.round(store.distance * 1000)} m`
              : `${store.distance.toFixed(1)} km`}
          </span>
        )}
      </div>

      <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          {store.address ? `${store.address}, ` : ""}
          {store.city}
          {store.province ? `, ${store.province}` : ""}
        </span>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            store.status.open
              ? "bg-emerald-100 text-emerald-800"
              : "bg-orange-100 text-orange-800",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              store.status.open ? "bg-emerald-600" : "bg-orange-600",
            )}
          />
          {store.status.label}
        </span>
      </div>

      <div className="mt-2.5 flex gap-2">
        {store.phone && (
          <a
            href={`tel:${store.phone.replace(/\s+/g, "")}`}
            onClick={(e) => e.stopPropagation()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-semibold text-foreground transition hover:border-primary hover:text-primary"
          >
            <Phone className="h-3 w-3" />
            Call
          </a>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-primary/90"
        >
          <Navigation className="h-3 w-3" />
          Directions
        </a>
      </div>
    </li>
  );
}

// ─── Lazy Map (Leaflet, client-only, IntersectionObserver) ───────────────────
type MapStore = Store & {
  hours: Hours | null;
  status: { open: boolean; label: string };
  distance: number | null;
};

function LazyMap({
  stores,
  highlightId,
  onMarkerClick,
  userLoc,
}: {
  stores: MapStore[];
  highlightId: string | null;
  onMarkerClick: (id: string) => void;
  userLoc: { lat: number; lon: number } | null;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!wrapRef.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="h-[300px] w-full overflow-hidden rounded-none border-y border-border bg-muted md:h-[calc(100vh-180px)] md:rounded-xl md:border"
    >
      {visible ? (
        <LeafletMap
          stores={stores}
          highlightId={highlightId}
          onMarkerClick={onMarkerClick}
          userLoc={userLoc}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          Map loads when scrolled into view…
        </div>
      )}
    </div>
  );
}

function LeafletMap({
  stores,
  highlightId,
  onMarkerClick,
  userLoc,
}: {
  stores: MapStore[];
  highlightId: string | null;
  onMarkerClick: (id: string) => void;
  userLoc: { lat: number; lon: number } | null;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const clusterRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());
  const userMarkerRef = useRef<unknown>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);

  // Init map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Lmod = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      await import("leaflet.markercluster");
      await import("leaflet.markercluster/dist/MarkerCluster.css");
      await import("leaflet.markercluster/dist/MarkerCluster.Default.css");
      if (cancelled || !elRef.current) return;
      const L = (Lmod as unknown as { default: typeof import("leaflet") }).default ?? Lmod;
      LRef.current = L;

      const map = L.map(elRef.current, {
        center: [-2.5, 118],
        zoom: 5,
        scrollWheelZoom: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const cluster = (L as unknown as {
        markerClusterGroup: (opts: unknown) => unknown;
      }).markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 12,
      });
      map.addLayer(cluster as import("leaflet").Layer);

      mapRef.current = map;
      clusterRef.current = cluster;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      if (m?.remove) m.remove();
      mapRef.current = null;
      clusterRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Sync markers when stores change
  useEffect(() => {
    if (!ready) return;
    const L = LRef.current;
    const cluster = clusterRef.current as {
      clearLayers: () => void;
      addLayer: (m: unknown) => void;
    } | null;
    const map = mapRef.current as {
      fitBounds: (b: unknown, o?: unknown) => void;
      setView: (c: [number, number], z: number) => void;
    } | null;
    if (!L || !cluster || !map) return;
    cluster.clearLayers();
    markersRef.current.clear();

    const pts: [number, number][] = [];
    for (const s of stores) {
      if (s.latitude == null || s.longitude == null) continue;
      const lat = Number(s.latitude);
      const lon = Number(s.longitude);
      pts.push([lat, lon]);
      const marker = L.marker([lat, lon], {
        title: s.name,
      }).bindPopup(
        `<div style="font-family:system-ui;min-width:180px">
          <div style="font-weight:700;margin-bottom:4px">${escapeHtml(s.name)}</div>
          <div style="font-size:12px;color:#555">${escapeHtml(s.city || "")}${
            s.province ? ", " + escapeHtml(s.province) : ""
          }</div>
          <div style="font-size:11px;margin-top:4px;color:${
            s.status.open ? "#047857" : "#c2410c"
          }">${escapeHtml(s.status.label)}</div>
        </div>`,
      );
      marker.on("click", () => onMarkerClick(s.id));
      cluster.addLayer(marker);
      markersRef.current.set(s.id, marker);
    }

    if (pts.length > 0) {
      const bounds = L.latLngBounds(pts.map(([a, b]) => L.latLng(a, b)));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    } else {
      map.setView([-2.5, 118], 5);
    }
  }, [stores, ready, onMarkerClick]);

  // User location marker
  useEffect(() => {
    if (!ready) return;
    const L = LRef.current;
    const map = mapRef.current as {
      addLayer: (l: unknown) => void;
      removeLayer: (l: unknown) => void;
    } | null;
    if (!L || !map) return;
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }
    if (userLoc) {
      const m = L.circleMarker([userLoc.lat, userLoc.lon], {
        radius: 8,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.8,
        weight: 2,
      }).bindPopup("You are here");
      m.addTo(map as unknown as import("leaflet").Map);
      userMarkerRef.current = m;
    }
  }, [userLoc, ready]);

  // Pan to highlighted store
  useEffect(() => {
    if (!ready || !highlightId) return;
    const map = mapRef.current as {
      setView: (c: [number, number], z: number, opts?: unknown) => void;
    } | null;
    const marker = markersRef.current.get(highlightId) as
      | {
          getLatLng: () => { lat: number; lng: number };
          openPopup: () => void;
        }
      | undefined;
    if (!map || !marker) return;
    const ll = marker.getLatLng();
    map.setView([ll.lat, ll.lng], 14, { animate: true });
    marker.openPopup();
  }, [highlightId, ready]);

  return <div ref={elRef} className="h-full w-full" />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}