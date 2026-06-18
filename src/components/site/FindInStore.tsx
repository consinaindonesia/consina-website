import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, Navigation, Phone, LocateFixed, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Lang = "id" | "en";

type StoreRow = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
};

type StockRow = {
  store_id: string;
  stock_quantity: number | null;
  stores: StoreRow | null;
};

type Enriched = StoreRow & {
  stock_quantity: number | null;
  distance: number | null;
};

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function statusFor(qty: number | null) {
  if (qty === null) return { kind: "unknown" as const };
  if (qty === 0) return { kind: "out" as const };
  if (qty <= 5) return { kind: "limited" as const };
  return { kind: "available" as const, qty };
}

export function FindInStore({ productId, lang }: { productId: string; lang: Lang }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Enriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [askedGeo, setAskedGeo] = useState(false);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("store_stock")
        .select(
          "store_id, stock_quantity, stores!inner(id, name, city, address, phone, latitude, longitude, is_active)",
        )
        .eq("product_id", productId);
      if (cancelled) return;
      const list: Enriched[] = ((data ?? []) as unknown as StockRow[])
        .filter((r) => r.stores)
        .map((r) => ({
          id: r.stores!.id,
          name: r.stores!.name,
          city: r.stores!.city,
          address: r.stores!.address,
          phone: r.stores!.phone,
          latitude: r.stores!.latitude,
          longitude: r.stores!.longitude,
          stock_quantity: r.stock_quantity,
          distance: null,
        }));
      setRows(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Ask geolocation once
  useEffect(() => {
    if (askedGeo || typeof window === "undefined" || !navigator.geolocation) return;
    setAskedGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { timeout: 8000, maximumAge: 300_000 },
    );
  }, [askedGeo]);

  const enriched: Enriched[] = (() => {
    const withDistance = rows.map((r) => {
      const distance =
        userLoc && r.latitude != null && r.longitude != null
          ? haversineKm(userLoc, { lat: Number(r.latitude), lon: Number(r.longitude) })
          : null;
      return { ...r, distance };
    });
    const q = cityQuery.trim().toLowerCase();
    const filtered = q
      ? withDistance.filter(
          (r) =>
            (r.city || "").toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q),
        )
      : withDistance;
    return filtered
      .slice()
      .sort((a, b) => {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        if (a.distance != null) return -1;
        if (b.distance != null) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 3);
  })();

  const requestGeo = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
    );
  };

  const labels = lang === "id"
    ? {
        title: "Tersedia di toko",
        subtitle: "Periksa stok terdekat sebelum berkunjung.",
        cityPh: "Masukkan kota Anda…",
        useLoc: "Gunakan lokasi saya",
        none: "Belum ada data stok untuk produk ini.",
        available: "Tersedia",
        inStock: "Tersedia",
        limited: "Tinggal sedikit",
        out: "Habis",
        unknown: "Hubungi untuk cek",
        directions: "Petunjuk arah",
        viewAll: "Lihat semua toko",
      }
    : {
        title: "Find in store",
        subtitle: "Check stock at stores near you before you visit.",
        cityPh: "Enter your city…",
        useLoc: "Use my location",
        none: "No store stock recorded yet for this product.",
        available: "Available",
        inStock: "In stock",
        limited: "Few left",
        out: "Out of stock",
        unknown: "Call to check",
        directions: t("product.find_in_store") || "Directions",
        viewAll: "View all stores",
      };

  return (
    <section className="mt-16 rounded-2xl border border-border bg-card p-5 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-primary">{labels.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
        </div>
        <Button asChild variant="link" className="text-primary">
          <Link
            to={"/$lang/stores" as never}
            params={{ lang } as never}
            search={{ product: productId } as never}
          >
            {labels.viewAll} →
          </Link>
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
          placeholder={labels.cityPh}
          className="h-9 min-w-[200px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <Button variant="outline" size="sm" onClick={requestGeo}>
          <LocateFixed className="mr-1.5 h-3.5 w-3.5" /> {labels.useLoc}
        </Button>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : enriched.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            {labels.none}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {enriched.map((s) => {
              const st = statusFor(s.stock_quantity);
              const badge =
                st.kind === "available"
                  ? {
                      label: st.qty > 5 ? `${labels.available} · ${st.qty}` : labels.inStock,
                      cls: "bg-emerald-500/15 text-emerald-800 border-emerald-500/30",
                    }
                  : st.kind === "limited"
                    ? { label: labels.limited, cls: "bg-amber-500/15 text-amber-800 border-amber-500/30" }
                    : st.kind === "out"
                      ? { label: labels.out, cls: "bg-destructive/15 text-destructive border-destructive/30" }
                      : { label: labels.unknown, cls: "bg-muted text-muted-foreground" };
              return (
                <li
                  key={s.id}
                  className="flex flex-col rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.city ?? ""}
                        {s.distance != null ? ` · ${s.distance.toFixed(1)} km` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className={`border ${badge.cls}`}>{badge.label}</Badge>
                  </div>
                  {s.address && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.address}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    {s.phone && (
                      <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                        <a href={`tel:${s.phone}`}>
                          <Phone className="mr-1 h-3.5 w-3.5" /> {s.phone}
                        </a>
                      </Button>
                    )}
                    {s.latitude && s.longitude && (
                      <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                        <a
                          href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Navigation className="mr-1 h-3.5 w-3.5" /> {labels.directions}
                        </a>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// re-export icon to satisfy unused import in some lints
export { MapPin };