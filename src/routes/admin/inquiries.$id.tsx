import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  ExternalLink,
  Trash2,
  Loader2,
  Plus,
  X,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  History,
  Save,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/inquiries/$id")({
  head: () => ({
    meta: [
      { title: "Inquiry — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InquiryDetailPage,
});

type Status = "new" | "contacted" | "in_progress" | "won" | "lost" | "spam";

type ItemRow = {
  id: string;
  quantity: number;
  notes: string | null;
  product: {
    id: string;
    sku: string;
    name_en: string | null;
    name_id: string | null;
    price_idr: number;
    attributes: Record<string, unknown> | null;
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
  updated_at: string;
  deleted_at: string | null;
  closing_notes: string | null;
  lost_reason: string | null;
  notes: string | null;
  inquiry_items: ItemRow[];
};

type AdminUser = { id: string; full_name: string | null; email: string };
type NoteRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  author?: AdminUser | null;
};
type ActivityRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  admin_user_id: string | null;
  created_at: string;
  admin?: AdminUser | null;
};

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  new: { label: "New", cls: "border-red-500/30 bg-red-500/10 text-red-700", dot: "bg-red-500" },
  contacted: { label: "Contacted", cls: "border-amber-500/30 bg-amber-500/10 text-amber-700", dot: "bg-amber-500" },
  in_progress: { label: "In Progress", cls: "border-blue-500/30 bg-blue-500/10 text-blue-700", dot: "bg-blue-500" },
  won: { label: "Closed — Won", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" },
  lost: { label: "Closed — Lost", cls: "border-zinc-400/40 bg-zinc-400/10 text-zinc-600", dot: "bg-zinc-400" },
  spam: { label: "Spam", cls: "border-zinc-400/40 bg-zinc-400/10 text-zinc-500 line-through", dot: "bg-zinc-400" },
};

function fmtIDR(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
}

function primaryImage(it: ItemRow): string | null {
  const imgs = it.product?.product_images ?? [];
  if (!imgs.length) return null;
  const p = imgs.find((i) => i.is_primary) ?? imgs[0];
  return p?.image_url ?? null;
}

function itemTotal(it: ItemRow) {
  return (it.product?.price_idr ?? 0) * it.quantity;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString();
}

function buildWhatsAppLink(phone: string, name: string, adminName: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "62");
  const msg = encodeURIComponent(
    `Hi ${name}, thanks for your inquiry to Consina. I'm ${adminName} and I'll be helping you with your request.`
  );
  return `https://wa.me/${digits}?text=${msg}`;
}

function InquiryDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { profile } = useAdminAuth();

  const [inquiry, setInquiry] = useState<InquiryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [newNote, setNewNote] = useState("");
  const [previousCount, setPreviousCount] = useState(0);
  const [previousInquiries, setPreviousInquiries] = useState<
    {
      id: string;
      status: Status;
      created_at: string;
      itemCount: number;
      total: number;
    }[]
  >([]);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [itemNoteDraft, setItemNoteDraft] = useState<Record<string, string>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [wonOpen, setWonOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");
  const [lostReason, setLostReason] = useState("price");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("inquiries")
      .select(
        `id, status, customer_name, customer_email, customer_phone, customer_city,
         message, assigned_to, preferred_store_id, created_at, updated_at,
         deleted_at, closing_notes, lost_reason, notes,
         inquiry_items(id, quantity, notes,
           product:products(id, sku, name_en, name_id, price_idr, attributes,
             product_images(image_url, is_primary)))`
      )
      .eq("id", id)
      .maybeSingle();
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data) return;
    const row = data as unknown as InquiryRow;
    setInquiry(row);
    const draft: Record<string, string> = {};
    row.inquiry_items.forEach((it) => {
      draft[it.id] = it.notes ?? "";
    });
    setItemNoteDraft(draft);

    // Previous inquiries from same email (summary cards)
    const { data: prev } = await supabase
      .from("inquiries")
      .select(
        `id, status, created_at,
         inquiry_items(quantity, product:products(price_idr))`
      )
      .eq("customer_email", row.customer_email)
      .neq("id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    const list = (prev ?? []).map((p) => {
      const items = (p.inquiry_items ?? []) as {
        quantity: number;
        product: { price_idr: number } | null;
      }[];
      const total = items.reduce(
        (s, it) => s + (it.product?.price_idr ?? 0) * it.quantity,
        0
      );
      const itemCount = items.reduce((s, it) => s + it.quantity, 0);
      return {
        id: p.id as string,
        status: p.status as Status,
        created_at: p.created_at as string,
        itemCount,
        total,
      };
    });
    setPreviousInquiries(list);
    setPreviousCount(list.length);
  }

  async function loadNotes() {
    const { data } = await supabase
      .from("inquiry_notes")
      .select("id, body, created_at, author_id")
      .eq("inquiry_id", id)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as NoteRow[];
    const authorIds = Array.from(new Set(list.map((n) => n.author_id).filter(Boolean) as string[]));
    if (authorIds.length) {
      const { data: users } = await supabase
        .from("admin_users")
        .select("id, full_name, email")
        .in("id", authorIds);
      const byId = new Map((users ?? []).map((u) => [u.id, u as AdminUser]));
      list.forEach((n) => {
        n.author = n.author_id ? byId.get(n.author_id) ?? null : null;
      });
    }
    setNotes(list);
  }

  async function loadActivity() {
    const { data } = await supabase
      .from("activity_log")
      .select("id, action, entity_type, entity_id, admin_user_id, created_at")
      .eq("entity_type", "inquiry")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    const list = (data ?? []) as ActivityRow[];
    const adminIds = Array.from(new Set(list.map((a) => a.admin_user_id).filter(Boolean) as string[]));
    if (adminIds.length) {
      const { data: users } = await supabase
        .from("admin_users")
        .select("id, full_name, email")
        .in("id", adminIds);
      const byId = new Map((users ?? []).map((u) => [u.id, u as AdminUser]));
      list.forEach((a) => {
        a.admin = a.admin_user_id ? byId.get(a.admin_user_id) ?? null : null;
      });
    }
    setActivity(list);
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
    void loadNotes();
    void loadActivity();
    void loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function logActivity(action: string) {
    if (!profile) return;
    await supabase.from("activity_log").insert({
      admin_user_id: profile.id,
      action,
      entity_type: "inquiry",
      entity_id: id,
    });
    void loadActivity();
  }

  type InquiryPatch = Partial<Omit<InquiryRow, "inquiry_items" | "id">>;
  async function updateInquiry(patch: InquiryPatch, activityAction?: string) {
    if (!inquiry) return;
    const { error } = await supabase.from("inquiries").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setInquiry({ ...inquiry, ...patch } as InquiryRow);
    toast.success("Saved");
    if (activityAction) await logActivity(activityAction);
  }

  async function changeStatus(next: Status, extra: InquiryPatch = {}) {
    await updateInquiry({ status: next, ...extra }, `status_changed_to_${next}`);
  }

  async function addNote() {
    const body = newNote.trim();
    if (!body) return;
    if (!profile) return toast.error("Not signed in");
    const { error } = await supabase
      .from("inquiry_notes")
      .insert({ inquiry_id: id, body, author_id: profile.id });
    if (error) return toast.error(error.message);
    setNewNote("");
    void loadNotes();
    await logActivity("note_added");
  }

  async function deleteNote(noteId: string) {
    if (!confirm("Delete this note?")) return;
    const { error } = await supabase.from("inquiry_notes").delete().eq("id", noteId);
    if (error) return toast.error(error.message);
    void loadNotes();
  }

  async function updateItemQty(itemId: string, qty: number) {
    if (qty < 1) qty = 1;
    const { error } = await supabase
      .from("inquiry_items")
      .update({ quantity: qty })
      .eq("id", itemId);
    if (error) return toast.error(error.message);
    setInquiry((prev) =>
      prev
        ? {
            ...prev,
            inquiry_items: prev.inquiry_items.map((it) =>
              it.id === itemId ? { ...it, quantity: qty } : it
            ),
          }
        : prev
    );
    void logActivity("item_updated");
  }

  async function saveItemNote(itemId: string) {
    setSavingItemId(itemId);
    const note = itemNoteDraft[itemId] ?? "";
    const { error } = await supabase
      .from("inquiry_items")
      .update({ notes: note })
      .eq("id", itemId);
    setSavingItemId(null);
    if (error) return toast.error(error.message);
    toast.success("Item note saved");
    setInquiry((prev) =>
      prev
        ? {
            ...prev,
            inquiry_items: prev.inquiry_items.map((it) =>
              it.id === itemId ? { ...it, notes: note } : it
            ),
          }
        : prev
    );
    void logActivity("item_note_updated");
  }

  async function removeItem(itemId: string) {
    if (!confirm("Remove this item from the inquiry?")) return;
    const { error } = await supabase.from("inquiry_items").delete().eq("id", itemId);
    if (error) return toast.error(error.message);
    setInquiry((prev) =>
      prev
        ? { ...prev, inquiry_items: prev.inquiry_items.filter((it) => it.id !== itemId) }
        : prev
    );
    void logActivity("item_removed");
  }

  async function softDelete() {
    if (!confirm("Move this inquiry to trash? It can be recovered for 30 days.")) return;
    const { error } = await supabase
      .from("inquiries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Moved to trash");
    navigate({ to: "/admin/inquiries" });
  }

  const total = useMemo(
    () => (inquiry ? inquiry.inquiry_items.reduce((s, it) => s + itemTotal(it), 0) : 0),
    [inquiry]
  );

  const assignee = useMemo(
    () =>
      inquiry?.assigned_to
        ? admins.find((a) => a.id === inquiry.assigned_to) ?? null
        : null,
    [inquiry?.assigned_to, admins]
  );

  if (loading || !inquiry) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      </AdminShell>
    );
  }

  const meta = STATUS_META[inquiry.status] ?? STATUS_META.new;
  const adminName = profile?.full_name ?? profile?.email?.split("@")[0] ?? "Consina";

  return (
    <AdminShell>
      {/* Breadcrumb */}
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/admin/inquiries" className="inline-flex items-center hover:text-foreground">
          <ArrowLeft className="mr-1 h-3 w-3" /> Inquiries
        </Link>
        <span>/</span>
        <span className="text-foreground">#{inquiry.id.slice(0, 8).toUpperCase()}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge variant="outline" className={meta.cls}>
            <span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </Badge>
          {previousCount > 0 && (
            <Badge
              variant="outline"
              className="ml-2 border-violet-500/30 bg-violet-500/10 text-violet-700"
            >
              Returning customer
            </Badge>
          )}
          <h1 className="mt-2 text-2xl font-black tracking-tight text-primary">
            {inquiry.customer_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Submitted {fmtTime(inquiry.created_at)}
          </p>
        </div>
      </div>

      <div className="space-y-6 pb-32">
        {/* SECTION 1 — Customer Info */}
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Customer
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a className="underline" href={`mailto:${inquiry.customer_email}`}>
                  {inquiry.customer_email}
                </a>
              </div>
              {inquiry.customer_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a className="underline" href={`tel:${inquiry.customer_phone}`}>
                    {inquiry.customer_phone}
                  </a>
                </div>
              )}
              <div className="text-muted-foreground">
                City: {inquiry.customer_city ?? "—"}
              </div>
              <div className="text-muted-foreground">
                Preferred contact: {inquiry.customer_phone ? "WhatsApp" : "Email"}
              </div>
              {previousCount > 0 && (
                <div>
                  <Link
                    to="/admin/inquiries"
                    search={{ q: inquiry.customer_email } as never}
                    className="text-xs font-medium text-primary underline"
                  >
                    {previousCount} previous inquir{previousCount === 1 ? "y" : "ies"} from this customer
                  </Link>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end md:items-start">
              {inquiry.customer_phone && (
                <a
                  href={buildWhatsAppLink(inquiry.customer_phone, inquiry.customer_name, adminName)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
                    <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                  </Button>
                </a>
              )}
              <a href={`mailto:${inquiry.customer_email}`}>
                <Button size="sm" variant="outline">
                  <Mail className="mr-1.5 h-4 w-4" /> Email
                </Button>
              </a>
              {inquiry.customer_phone && (
                <a href={`tel:${inquiry.customer_phone}`}>
                  <Button size="sm" variant="outline">
                    <Phone className="mr-1.5 h-4 w-4" /> Call
                  </Button>
                </a>
              )}
            </div>
          </div>
          {inquiry.message && (
            <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Customer message
              </div>
              {inquiry.message}
            </div>
          )}
        </section>

        {/* Previous inquiries */}
        {previousInquiries.length > 0 && (
          <section className="rounded-lg border border-border bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Previous inquiries ({previousInquiries.length})
              </h2>
              <Link
                to="/admin/customers/$email"
                params={{ email: inquiry.customer_email }}
                className="text-xs font-medium text-primary underline"
              >
                View customer profile
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {previousInquiries.map((p) => {
                const m = STATUS_META[p.status] ?? STATUS_META.new;
                return (
                  <Link
                    key={p.id}
                    to="/admin/inquiries/$id"
                    params={{ id: p.id }}
                    className="rounded-md border border-border p-3 transition hover:bg-muted/40"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="outline" className={m.cls}>
                        {m.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        #{p.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtTime(p.created_at)}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {p.itemCount} item{p.itemCount === 1 ? "" : "s"}
                      </span>
                      <span className="font-medium">{fmtIDR(p.total)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION 2 — Items */}
        <section className="rounded-lg border border-border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Inquired items ({inquiry.inquiry_items.length})
            </h2>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
            </Button>
          </div>

          <div className="space-y-3">
            {inquiry.inquiry_items.map((it) => {
              const src = primaryImage(it);
              const attrs =
                it.product?.attributes && typeof it.product.attributes === "object"
                  ? Object.entries(it.product.attributes)
                  : [];
              return (
                <div key={it.id} className="flex gap-4 rounded-md border border-border p-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded bg-muted">
                    {src && <img src={src} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {it.product ? (
                          <a
                            href={`/en/products/${it.product.sku}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                          >
                            {it.product.name_en ?? it.product.name_id}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">(deleted product)</span>
                        )}
                        {attrs.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {attrs.map(([k, v]) => (
                              <span
                                key={k}
                                className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                              >
                                {k}: {String(v)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(it.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove item"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="inline-flex items-center rounded border border-border">
                        <button
                          className="px-2 py-1 text-muted-foreground hover:text-foreground"
                          onClick={() => updateItemQty(it.id, it.quantity - 1)}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm">{it.quantity}</span>
                        <button
                          className="px-2 py-1 text-muted-foreground hover:text-foreground"
                          onClick={() => updateItemQty(it.id, it.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <span className="text-muted-foreground">
                        × {fmtIDR(it.product?.price_idr ?? 0)}
                      </span>
                      <span className="ml-auto font-semibold">{fmtIDR(itemTotal(it))}</span>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Internal note for this item</Label>
                      <div className="mt-1 flex gap-2">
                        <Input
                          value={itemNoteDraft[it.id] ?? ""}
                          onChange={(e) =>
                            setItemNoteDraft((p) => ({ ...p, [it.id]: e.target.value }))
                          }
                          placeholder="e.g. Customer asked about Stone Gray color"
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveItemNote(it.id)}
                          disabled={savingItemId === it.id}
                        >
                          {savingItemId === it.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {inquiry.inquiry_items.length === 0 && (
              <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No items.
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-between border-t border-border pt-4 text-sm font-semibold">
            <span>Total estimated value</span>
            <span>{fmtIDR(total)}</span>
          </div>
        </section>

        {/* SECTION 3 — Status, assignee, notes, activity */}
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Workflow
          </h2>

          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={inquiry.status}
                onValueChange={(v) => changeStatus(v as Status)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_META) as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Assigned to</Label>
              <Select
                value={inquiry.assigned_to ?? "__none"}
                onValueChange={(v) =>
                  updateInquiry({ assigned_to: v === "__none" ? null : v }, "assignment_changed")
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Unassigned</SelectItem>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name ?? a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignee && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Currently assigned to {assignee.full_name ?? assignee.email}
                </p>
              )}
            </div>
          </div>

          {(inquiry.closing_notes || inquiry.lost_reason) && (
            <div className="mb-5 rounded-md border border-border bg-muted/40 p-3 text-sm">
              {inquiry.lost_reason && (
                <div>
                  <strong>Lost reason:</strong> {inquiry.lost_reason}
                </div>
              )}
              {inquiry.closing_notes && (
                <div className="mt-1">
                  <strong>Closing notes:</strong> {inquiry.closing_notes}
                </div>
              )}
            </div>
          )}

          {/* Internal notes */}
          <div className="mb-5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Internal notes (not visible to customer)
            </Label>
            <div className="mt-2 flex gap-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add an internal note…"
                rows={2}
              />
              <Button onClick={addNote} disabled={!newNote.trim()}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {notes.length === 0 && (
                <p className="text-xs text-muted-foreground">No notes yet.</p>
              )}
              {notes.map((n) => (
                <div key={n.id} className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      <strong className="text-foreground">
                        {n.author?.full_name ?? n.author?.email ?? "Unknown"}
                      </strong>{" "}
                      · {fmtTime(n.created_at)}
                    </span>
                    {profile?.role === "admin" && (
                      <button
                        onClick={() => deleteNote(n.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Delete note"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{n.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              <History className="mr-1 inline h-3.5 w-3.5" />
              Activity
            </Label>
            <ol className="mt-2 space-y-2 border-l-2 border-border pl-4">
              {activity.map((a) => (
                <li key={a.id} className="relative text-xs">
                  <span className="absolute -left-[1.35rem] top-1 h-2 w-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">
                    {fmtTime(a.created_at)} ·{" "}
                  </span>
                  <span>
                    <strong className="text-foreground">
                      {a.admin?.full_name ?? a.admin?.email ?? "System"}
                    </strong>{" "}
                    {a.action.replace(/_/g, " ")}
                  </span>
                </li>
              ))}
              <li className="relative text-xs">
                <span className="absolute -left-[1.35rem] top-1 h-2 w-2 rounded-full bg-muted-foreground" />
                <span className="text-muted-foreground">
                  {fmtTime(inquiry.created_at)} · Inquiry submitted by customer
                </span>
              </li>
            </ol>
          </div>
        </section>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="text-xs text-muted-foreground">
            #{inquiry.id.slice(0, 8).toUpperCase()} · {fmtIDR(total)}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={inquiry.status !== "new"}
              onClick={() => changeStatus("contacted")}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark as contacted
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => changeStatus("in_progress")}
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" /> Move to In Progress
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                setClosingNotes(inquiry.closing_notes ?? "");
                setWonOpen(true);
              }}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Close as Won
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLostReason(inquiry.lost_reason ?? "price");
                setLostOpen(true);
              }}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Close as Lost
            </Button>
            {profile?.role === "admin" && (
              <Button
                size="sm"
                variant="outline"
                onClick={softDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Add item dialog */}
      <AddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        inquiryId={id}
        onAdded={async () => {
          await load();
          await logActivity("item_added");
        }}
      />

      {/* Close as Won dialog */}
      <Dialog open={wonOpen} onOpenChange={setWonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close as Won</DialogTitle>
          </DialogHeader>
          <Label className="text-xs text-muted-foreground">
            Closing notes (final price, payment method, pickup/delivery)
          </Label>
          <Textarea
            rows={4}
            value={closingNotes}
            onChange={(e) => setClosingNotes(e.target.value)}
            placeholder="e.g. Final IDR 1,850,000 — bank transfer — pickup at Jakarta store on 2026-05-28"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setWonOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={async () => {
                await changeStatus("won", { closing_notes: closingNotes });
                setWonOpen(false);
              }}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Confirm Won
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close as Lost dialog */}
      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close as Lost</DialogTitle>
          </DialogHeader>
          <Label className="text-xs text-muted-foreground">Reason</Label>
          <Select value={lostReason} onValueChange={setLostReason}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="out_of_stock">Out of stock</SelectItem>
              <SelectItem value="no_response">Customer didn't respond</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await changeStatus("lost", { lost_reason: lostReason });
                setLostOpen(false);
              }}
            >
              Confirm Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function AddItemDialog({
  open,
  onOpenChange,
  inquiryId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  inquiryId: string;
  onAdded: () => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; sku: string; name_en: string | null; name_id: string | null }[]
  >([]);
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const q = query.trim();
      const sb = supabase
        .from("products")
        .select("id, sku, name_en, name_id")
        .eq("is_active", true)
        .limit(20);
      const { data } = q
        ? await sb.or(`name_en.ilike.%${q}%,name_id.ilike.%${q}%,sku.ilike.%${q}%`)
        : await sb;
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  async function add() {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("inquiry_items")
      .insert({ inquiry_id: inquiryId, product_id: selected, quantity: qty });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Item added");
    onOpenChange(false);
    setSelected(null);
    setQuery("");
    setQty(1);
    await onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <FileText className="mr-2 inline h-4 w-4" /> Add item to inquiry
          </DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search by name or SKU…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-64 overflow-y-auto rounded border border-border">
          {results.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">No products found.</div>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={cn(
                  "block w-full border-b border-border px-3 py-2 text-left text-sm hover:bg-muted",
                  selected === p.id && "bg-muted"
                )}
              >
                <div className="font-medium">{p.name_en ?? p.name_id}</div>
                <div className="text-xs text-muted-foreground">SKU: {p.sku}</div>
              </button>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Quantity</Label>
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
            className="w-24"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={add} disabled={!selected || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}