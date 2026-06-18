import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Upload,
  Download,
  X,
  Loader2,
  Search,
  Boxes,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/stores")({
  head: () => ({
    meta: [
      { title: "Stores — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoresPage,
});

// ──────────────────────────────────────────────────────────────────────────────
// Domain data
// ──────────────────────────────────────────────────────────────────────────────

type Region =
  | "Greater Jakarta"
  | "West Java"
  | "Central Java"
  | "East Java"
  | "Bali"
  | "Sumatra"
  | "Kalimantan"
  | "Sulawesi"
  | "Eastern Indonesia";

const REGIONS: Region[] = [
  "Greater Jakarta",
  "West Java",
  "Central Java",
  "East Java",
  "Bali",
  "Sumatra",
  "Kalimantan",
  "Sulawesi",
  "Eastern Indonesia",
];

// City → { province, region }. "Other" lets admins type freely.
const CITY_MAP: Record<string, { province: string; region: Region }> = {
  Jakarta: { province: "DKI Jakarta", region: "Greater Jakarta" },
  Bekasi: { province: "West Java", region: "Greater Jakarta" },
  Bogor: { province: "West Java", region: "Greater Jakarta" },
  Depok: { province: "West Java", region: "Greater Jakarta" },
  Tangerang: { province: "Banten", region: "Greater Jakarta" },
  "Tangerang Selatan": { province: "Banten", region: "Greater Jakarta" },
  Bandung: { province: "West Java", region: "West Java" },
  Cimahi: { province: "West Java", region: "West Java" },
  Cirebon: { province: "West Java", region: "West Java" },
  Sukabumi: { province: "West Java", region: "West Java" },
  Semarang: { province: "Central Java", region: "Central Java" },
  Solo: { province: "Central Java", region: "Central Java" },
  Yogyakarta: { province: "DI Yogyakarta", region: "Central Java" },
  Surabaya: { province: "East Java", region: "East Java" },
  Malang: { province: "East Java", region: "East Java" },
  Kediri: { province: "East Java", region: "East Java" },
  Denpasar: { province: "Bali", region: "Bali" },
  Ubud: { province: "Bali", region: "Bali" },
  Medan: { province: "North Sumatra", region: "Sumatra" },
  Padang: { province: "West Sumatra", region: "Sumatra" },
  Palembang: { province: "South Sumatra", region: "Sumatra" },
  Pekanbaru: { province: "Riau", region: "Sumatra" },
  "Bandar Lampung": { province: "Lampung", region: "Sumatra" },
  Pontianak: { province: "West Kalimantan", region: "Kalimantan" },
  Banjarmasin: { province: "South Kalimantan", region: "Kalimantan" },
  Balikpapan: { province: "East Kalimantan", region: "Kalimantan" },
  Samarinda: { province: "East Kalimantan", region: "Kalimantan" },
  Makassar: { province: "South Sulawesi", region: "Sulawesi" },
  Manado: { province: "North Sulawesi", region: "Sulawesi" },
  Palu: { province: "Central Sulawesi", region: "Sulawesi" },
  Mataram: { province: "West Nusa Tenggara", region: "Eastern Indonesia" },
  Kupang: { province: "East Nusa Tenggara", region: "Eastern Indonesia" },
  Ambon: { province: "Maluku", region: "Eastern Indonesia" },
  Jayapura: { province: "Papua", region: "Eastern Indonesia" },
};

const CITY_OPTIONS = Object.keys(CITY_MAP).sort();

// Indonesia rough bounds
const ID_BOUNDS = { latMin: -11, latMax: 6, lonMin: 95, lonMax: 141 };

function isInIndonesia(lat: number, lon: number) {
  return (
    lat >= ID_BOUNDS.latMin &&
    lat <= ID_BOUNDS.latMax &&
    lon >= ID_BOUNDS.lonMin &&
    lon <= ID_BOUNDS.lonMax
  );
}

// Accepts: 0812..., +6281..., 62812..., with optional spaces / dashes
const PHONE_RE = /^(\+62|62|0)[0-9\s-]{7,15}$/;

// ──────────────────────────────────────────────────────────────────────────────
// Opening hours
// ──────────────────────────────────────────────────────────────────────────────

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

type DaySchedule =
  | { mode: "closed" }
  | { mode: "24h" }
  | { mode: "open"; from: string; to: string };

type Hours = Record<DayKey, DaySchedule>;

const DEFAULT_HOURS: Hours = {
  mon: { mode: "open", from: "09:00", to: "21:00" },
  tue: { mode: "open", from: "09:00", to: "21:00" },
  wed: { mode: "open", from: "09:00", to: "21:00" },
  thu: { mode: "open", from: "09:00", to: "21:00" },
  fri: { mode: "open", from: "09:00", to: "21:00" },
  sat: { mode: "open", from: "10:00", to: "22:00" },
  sun: { mode: "open", from: "10:00", to: "22:00" },
};

function parseHours(v: unknown): Hours {
  if (!v || typeof v !== "object") return structuredClone(DEFAULT_HOURS);
  const out = structuredClone(DEFAULT_HOURS);
  for (const d of DAYS) {
    const x = (v as Record<string, unknown>)[d.key];
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (o.mode === "closed") out[d.key] = { mode: "closed" };
    else if (o.mode === "24h") out[d.key] = { mode: "24h" };
    else if (o.mode === "open" && typeof o.from === "string" && typeof o.to === "string")
      out[d.key] = { mode: "open", from: o.from, to: o.to };
  }
  return out;
}

function summarizeHours(h: Hours): string {
  const today = (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as DayKey[])[
    new Date().getDay()
  ];
  const s = h[today];
  if (s.mode === "closed") return "Closed today";
  if (s.mode === "24h") return "Open 24 hours";
  return `Today ${s.from}–${s.to}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Types & form state
// ──────────────────────────────────────────────────────────────────────────────

type Store = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  phone: string | null;
  email: string | null;
  description_id: string | null;
  description_en: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_hours: unknown;
  is_active: boolean;
};

type FormState = {
  id: string | null;
  name: string;
  address: string;
  city: string;
  cityOther: string;
  province: string;
  region: string;
  phone: string;
  email: string;
  description_id: string;
  description_en: string;
  image_url: string;
  latitude: string;
  longitude: string;
  hours: Hours;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  address: "",
  city: "",
  cityOther: "",
  province: "",
  region: "",
  phone: "",
  email: "",
  description_id: "",
  description_en: "",
  image_url: "",
  latitude: "",
  longitude: "",
  hours: structuredClone(DEFAULT_HOURS),
  is_active: true,
};

function storeToForm(s: Store): FormState {
  const cityKnown = s.city && CITY_MAP[s.city];
  return {
    id: s.id,
    name: s.name ?? "",
    address: s.address ?? "",
    city: cityKnown ? (s.city as string) : s.city ? "__other__" : "",
    cityOther: cityKnown ? "" : s.city ?? "",
    province: s.province ?? "",
    region: s.region ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    description_id: s.description_id ?? "",
    description_en: s.description_en ?? "",
    image_url: s.image_url ?? "",
    latitude: s.latitude != null ? String(s.latitude) : "",
    longitude: s.longitude != null ? String(s.longitude) : "",
    hours: parseHours(s.opening_hours),
    is_active: s.is_active,
  };
}

// Extract lat/lon from a Google Maps URL or "lat,lon" string
function tryExtractCoords(input: string): { lat: number; lon: number } | null {
  const trimmed = input.trim();
  // "lat,lon"
  const plain = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (plain) return { lat: parseFloat(plain[1]), lon: parseFloat(plain[2]) };
  // Google Maps @lat,lon,zoom
  const at = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lon: parseFloat(at[2]) };
  // !3d...!4d... pattern
  const d = trimmed.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (d) return { lat: parseFloat(d[1]), lon: parseFloat(d[2]) };
  return null;
}

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&countrycodes=id&limit=1&q=" +
      encodeURIComponent(query);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!arr.length) return null;
    return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon) };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "active" | "inactive";

function StoresPage() {
  const [rows, setRows] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stores")
      .select(
        "id,name,address,city,province,region,phone,email,description_id,description_en,image_url,latitude,longitude,opening_hours,is_active",
      )
      .order("name");
    if (error) toast.error(error.message);
    setRows((data ?? []) as Store[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "active" && !r.is_active) return false;
      if (status === "inactive" && r.is_active) return false;
      if (regionFilter !== "all" && r.region !== regionFilter) return false;
      if (q) {
        const blob = [r.name, r.address, r.city, r.province, r.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, status, regionFilter, search]);

  const counts = useMemo(() => {
    let active = 0;
    for (const r of rows) if (r.is_active) active++;
    return { all: rows.length, active, inactive: rows.length - active };
  }, [rows]);

  function openNew() {
    setForm({ ...EMPTY_FORM, hours: structuredClone(DEFAULT_HOURS) });
    setEditorOpen(true);
  }

  function openEdit(s: Store) {
    setForm(storeToForm(s));
    setEditorOpen(true);
  }

  async function toggleActive(s: Store) {
    const next = !s.is_active;
    setRows((prev) => prev.map((r) => (r.id === s.id ? { ...r, is_active: next } : r)));
    const { error } = await supabase.from("stores").update({ is_active: next }).eq("id", s.id);
    if (error) {
      toast.error(error.message);
      void refresh();
    } else {
      toast.success(next ? "Store activated" : "Store deactivated");
    }
  }

  async function doDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("stores").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) return toast.error(error.message);
    toast.success("Store deleted");
    void refresh();
  }

  return (
    <AdminShell>
      {/* Breadcrumb */}
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/admin" className="hover:text-foreground">
          Dashboard
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Stores</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight text-primary">
          Stores{" "}
          <span className="text-muted-foreground font-medium">({rows.length})</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Import CSV
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" /> New Store
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            { value: "all", label: `All (${counts.all})` },
            { value: "active", label: `Active (${counts.active})` },
            { value: "inactive", label: `Inactive (${counts.inactive})` },
          ] as { value: StatusFilter; label: string }[]
        ).map((p) => (
          <button
            key={p.value}
            onClick={() => setStatus(p.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition",
              status === p.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted",
            )}
          >
            {p.label}
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="All regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stores…"
              className="h-9 w-[240px] pl-8"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Address</th>
                <th className="px-3 py-2 text-left font-medium">City</th>
                <th className="px-3 py-2 text-left font-medium">Province</th>
                <th className="px-3 py-2 text-left font-medium">Region</th>
                <th className="px-3 py-2 text-left font-medium">Phone</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No stores yet</p>
                    <p className="text-xs mt-1">
                      Add your first store or import from a CSV file.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium">{s.name}</td>
                    <td className="px-3 py-2.5 max-w-[280px]">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block truncate">{s.address ?? "—"}</span>
                          </TooltipTrigger>
                          {s.address && (
                            <TooltipContent className="max-w-sm">
                              {s.address}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="px-3 py-2.5">{s.city ?? "—"}</td>
                    <td className="px-3 py-2.5">{s.province ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {s.region ? (
                        <Badge variant="outline" className="text-xs">
                          {s.region}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{s.phone ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <Switch
                        checked={s.is_active}
                        onCheckedChange={() => void toggleActive(s)}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(s)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          aria-label="Manage stock"
                        >
                          <Link to="/admin/stores/$id/stock" params={{ id: s.id }}>
                            <Boxes className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        {s.latitude && s.longitude ? (
                          <Button variant="ghost" size="sm" asChild aria-label="View on map">
                            <a
                              href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(s.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor dialog */}
      <StoreEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        form={form}
        setForm={setForm}
        onSaved={() => {
          setEditorOpen(false);
          void refresh();
        }}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete store?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the store from the directory. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void doDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV import */}
      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onDone={() => {
          setImportOpen(false);
          void refresh();
        }}
      />
    </AdminShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Editor dialog
// ──────────────────────────────────────────────────────────────────────────────

function StoreEditorDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: FormState;
  setForm: (f: FormState | ((p: FormState) => FormState)) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [coordInput, setCoordInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  function cityChange(v: string) {
    if (v === "__other__") {
      setForm((f) => ({ ...f, city: v }));
      return;
    }
    const meta = CITY_MAP[v];
    setForm((f) => ({
      ...f,
      city: v,
      province: meta?.province ?? f.province,
      region: meta?.region ?? f.region,
    }));
  }

  function applyHoursTo(days: DayKey[], schedule: DaySchedule) {
    setForm((f) => {
      const next = { ...f.hours };
      for (const d of days) next[d] = { ...schedule };
      return { ...f, hours: next };
    });
  }

  function pasteCoords() {
    const res = tryExtractCoords(coordInput);
    if (!res) {
      toast.error("Could not find coordinates in the pasted text.");
      return;
    }
    if (!isInIndonesia(res.lat, res.lon)) {
      toast.error("Coordinates are outside Indonesia.");
      return;
    }
    setForm((f) => ({
      ...f,
      latitude: res.lat.toFixed(6),
      longitude: res.lon.toFixed(6),
    }));
    setCoordInput("");
    toast.success("Coordinates set");
  }

  async function geocodeFromAddress() {
    const cityName = form.city === "__other__" ? form.cityOther : form.city;
    const q = [form.address, cityName, form.province, "Indonesia"]
      .filter(Boolean)
      .join(", ");
    if (!q.trim()) {
      toast.error("Enter an address or city first.");
      return;
    }
    setGeocoding(true);
    const res = await geocode(q);
    setGeocoding(false);
    if (!res) {
      toast.error("No results found. Try pasting from Google Maps instead.");
      return;
    }
    if (!isInIndonesia(res.lat, res.lon)) {
      toast.error("Result is outside Indonesia.");
      return;
    }
    setForm((f) => ({
      ...f,
      latitude: res.lat.toFixed(6),
      longitude: res.lon.toFixed(6),
    }));
    toast.success("Coordinates filled from address");
  }

  async function save() {
    const cityValue = form.city === "__other__" ? form.cityOther.trim() : form.city;
    if (!form.name.trim()) return toast.error("Name is required.");
    if (!form.address.trim()) return toast.error("Address is required.");
    if (!cityValue) return toast.error("City is required.");
    if (!form.region) return toast.error("Region is required.");
    if (!form.phone.trim()) return toast.error("Phone is required.");
    if (!PHONE_RE.test(form.phone.trim()))
      return toast.error("Phone must be Indonesian format (+62..., 62..., or 0...).");
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
      return toast.error("Email looks invalid.");

    let lat: number | null = null;
    let lon: number | null = null;
    if (form.latitude || form.longitude) {
      lat = parseFloat(form.latitude);
      lon = parseFloat(form.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon))
        return toast.error("Coordinates must be numeric.");
      if (!isInIndonesia(lat, lon))
        return toast.error("Coordinates must be within Indonesia.");
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: cityValue,
      province: form.province.trim() || null,
      region: form.region,
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      description_id: form.description_id.trim() || null,
      description_en: form.description_en.trim() || null,
      image_url: form.image_url.trim() || null,
      latitude: lat,
      longitude: lon,
      opening_hours: form.hours as unknown as never,
      is_active: form.is_active,
    };
    try {
      if (form.id) {
        const { error } = await supabase.from("stores").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Store updated");
      } else {
        const { error } = await supabase.from("stores").insert(payload);
        if (error) throw error;
        toast.success("Store created");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const lat = parseFloat(form.latitude);
  const lon = parseFloat(form.longitude);
  const hasValidCoords =
    !Number.isNaN(lat) && !Number.isNaN(lon) && isInIndonesia(lat, lon);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit store" : "New store"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5">
          {/* Identity */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *" className="sm:col-span-2">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Consina Buaran Flagship"
              />
            </Field>
            <Field label="Address *" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Jl. Buaran Raya No. 12"
              />
            </Field>

            <Field label="City *">
              <Select value={form.city} onValueChange={cityChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {CITY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value="__other__">Other…</SelectItem>
                </SelectContent>
              </Select>
              {form.city === "__other__" && (
                <Input
                  className="mt-2"
                  placeholder="Enter city name"
                  value={form.cityOther}
                  onChange={(e) => setForm({ ...form, cityOther: e.target.value })}
                />
              )}
            </Field>
            <Field label="Province">
              <Input
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                placeholder="Auto-filled from city"
              />
            </Field>
            <Field label="Region *">
              <Select
                value={form.region}
                onValueChange={(v) => setForm({ ...form, region: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Phone *">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+62 812 3456 7890"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="store@consina.id"
              />
            </Field>
            <Field label="Photo URL">
              <Input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          </div>

          {/* Opening hours */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Opening hours</Label>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    applyHoursTo(["mon", "tue", "wed", "thu", "fri"], {
                      mode: "open",
                      from: "09:00",
                      to: "21:00",
                    })
                  }
                >
                  Apply Mon–Fri
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    applyHoursTo(["sat", "sun"], {
                      mode: "open",
                      from: "10:00",
                      to: "22:00",
                    })
                  }
                >
                  Apply weekends
                </Button>
              </div>
            </div>
            <div className="rounded-md border divide-y">
              {DAYS.map((d) => {
                const s = form.hours[d.key];
                return (
                  <div key={d.key} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="w-24 text-sm font-medium">{d.label}</span>
                    <Select
                      value={s.mode}
                      onValueChange={(v) => {
                        const next: DaySchedule =
                          v === "closed"
                            ? { mode: "closed" }
                            : v === "24h"
                              ? { mode: "24h" }
                              : {
                                  mode: "open",
                                  from: s.mode === "open" ? s.from : "09:00",
                                  to: s.mode === "open" ? s.to : "21:00",
                                };
                        setForm((f) => ({ ...f, hours: { ...f.hours, [d.key]: next } }));
                      }}
                    >
                      <SelectTrigger className="h-8 w-[120px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="24h">24 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    {s.mode === "open" && (
                      <>
                        <Input
                          type="time"
                          className="h-8 w-[120px]"
                          value={s.from}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              hours: {
                                ...f.hours,
                                [d.key]: { mode: "open", from: e.target.value, to: s.to },
                              },
                            }))
                          }
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input
                          type="time"
                          className="h-8 w-[120px]"
                          value={s.to}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              hours: {
                                ...f.hours,
                                [d.key]: {
                                  mode: "open",
                                  from: s.from,
                                  to: e.target.value,
                                },
                              },
                            }))
                          }
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{summarizeHours(form.hours)}</p>
          </div>

          {/* Coordinates */}
          <div>
            <Label className="mb-2 block">Coordinates</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Latitude">
                <Input
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="-6.2088"
                />
              </Field>
              <Field label="Longitude">
                <Input
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  placeholder="106.8456"
                />
              </Field>
              <div className="sm:col-span-2 flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[220px]">
                  <Label className="mb-1 block text-xs text-muted-foreground">
                    Paste from Google Maps (URL or "lat, lon")
                  </Label>
                  <Input
                    value={coordInput}
                    onChange={(e) => setCoordInput(e.target.value)}
                    placeholder="https://www.google.com/maps/@-6.2088,106.8456,15z"
                  />
                </div>
                <Button type="button" variant="outline" onClick={pasteCoords}>
                  Extract
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void geocodeFromAddress()}
                  disabled={geocoding}
                >
                  {geocoding ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5 mr-1" />
                  )}
                  Geocode from address
                </Button>
              </div>
              {hasValidCoords && (
                <div className="sm:col-span-2 overflow-hidden rounded-md border">
                  <iframe
                    title="Store location"
                    width="100%"
                    height="240"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01}%2C${lat - 0.01}%2C${lon + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lon}`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Descriptions */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Description (Indonesian)">
              <Textarea
                rows={3}
                value={form.description_id}
                onChange={(e) => setForm({ ...form, description_id: e.target.value })}
              />
            </Field>
            <Field label="Description (English)">
              <Textarea
                rows={3}
                value={form.description_en}
                onChange={(e) => setForm({ ...form, description_en: e.target.value })}
              />
            </Field>
          </div>

          {/* Active */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive stores stay hidden from the public store locator.
              </p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {form.id ? "Save changes" : "Create store"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// CSV import
// ──────────────────────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "name",
  "address",
  "city",
  "province",
  "region",
  "phone",
  "email",
  "latitude",
  "longitude",
  "description_id",
  "description_en",
  "image_url",
  "is_active",
];

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (ch === "\r") {
        // ignore
      } else cur += ch;
    }
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => {
      const o: Record<string, string> = {};
      headers.forEach((h, idx) => (o[h] = (r[idx] ?? "").trim()));
      return o;
    });
}

function CsvImportDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  function downloadTemplate() {
    const csv =
      CSV_HEADERS.join(",") +
      "\n" +
      [
        "Consina Buaran Flagship",
        '"Jl. Buaran Raya No. 12"',
        "Jakarta",
        "DKI Jakarta",
        "Greater Jakarta",
        "+62 812 3456 7890",
        "buaran@consina.id",
        "-6.2088",
        "106.8456",
        "",
        "",
        "",
        "true",
      ].join(",") +
      "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stores-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);
    const errs: string[] = [];
    rows.forEach((r, idx) => {
      const line = idx + 2;
      if (!r.name) errs.push(`Row ${line}: name is required`);
      if (!r.address) errs.push(`Row ${line}: address is required`);
      if (!r.city) errs.push(`Row ${line}: city is required`);
      if (!r.region) errs.push(`Row ${line}: region is required`);
      if (!r.phone) errs.push(`Row ${line}: phone is required`);
      else if (!PHONE_RE.test(r.phone))
        errs.push(`Row ${line}: phone "${r.phone}" must be Indonesian format`);
      if (r.latitude || r.longitude) {
        const la = parseFloat(r.latitude);
        const lo = parseFloat(r.longitude);
        if (Number.isNaN(la) || Number.isNaN(lo))
          errs.push(`Row ${line}: coordinates must be numeric`);
        else if (!isInIndonesia(la, lo))
          errs.push(`Row ${line}: coordinates outside Indonesia`);
      }
    });
    setPreview(rows);
    setErrors(errs);
  }

  async function doImport() {
    if (!preview.length) return;
    if (errors.length) {
      toast.error("Fix validation errors before importing.");
      return;
    }
    setImporting(true);
    const payload = preview.map((r) => ({
      name: r.name,
      address: r.address || null,
      city: r.city || null,
      province: r.province || null,
      region: r.region || null,
      phone: r.phone || null,
      email: r.email || null,
      latitude: r.latitude ? parseFloat(r.latitude) : null,
      longitude: r.longitude ? parseFloat(r.longitude) : null,
      description_id: r.description_id || null,
      description_en: r.description_en || null,
      image_url: r.image_url || null,
      is_active: r.is_active ? r.is_active.toLowerCase() !== "false" : true,
    }));
    const { error } = await supabase.from("stores").insert(payload);
    setImporting(false);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${payload.length} stores`);
    setPreview([]);
    setErrors([]);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import stores from CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1.5" /> Download template
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1.5" /> Choose CSV file
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Columns: {CSV_HEADERS.join(", ")}
          </p>

          {preview.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-2 text-xs">
              <p className="font-medium">
                {preview.length} row{preview.length === 1 ? "" : "s"} ready to import
              </p>
              {errors.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto text-destructive">
                  {errors.slice(0, 20).map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                  {errors.length > 20 && <div>…and {errors.length - 20} more</div>}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setPreview([]);
              setErrors([]);
              onOpenChange(false);
            }}
          >
            Close
          </Button>
          <Button
            onClick={() => void doImport()}
            disabled={importing || !preview.length || errors.length > 0}
          >
            {importing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Import {preview.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Suppress unused-import warnings (kept for future symmetry with other admin pages)
void X;