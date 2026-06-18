import { useMemo, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Trash2, X, Minus, Plus, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  useInquiry,
  removeFromInquiry,
  updateQuantity,
  clearInquiry,
} from "@/lib/inquiry-store";
import { useLang } from "@/i18n/LangProvider";
import { formatPrice } from "@/i18n/format";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const INDONESIAN_CITIES = [
  "Jakarta", "Bandung", "Surabaya", "Medan", "Semarang", "Yogyakarta",
  "Makassar", "Palembang", "Denpasar", "Bogor", "Depok", "Tangerang",
  "Bekasi", "Malang", "Solo", "Padang", "Pekanbaru", "Banjarmasin",
  "Balikpapan", "Samarinda", "Pontianak", "Manado", "Jayapura", "Ambon",
  "Kupang", "Mataram", "Banda Aceh",
];

const phoneRegex = /^(?:\+62|0)[1-9][0-9]{7,12}$/;

const formSchema = z.object({
  customer_name: z.string().trim().min(1, "Required").max(120),
  customer_email: z.string().trim().email("Invalid email").max(255),
  customer_phone: z
    .string()
    .trim()
    .max(20)
    .regex(phoneRegex, "Use +62 or 0 prefix"),
  customer_city: z.string().trim().min(1, "Required").max(120),
  preferred_store_id: z.string().optional(),
  contact_method: z.enum(["whatsapp", "phone", "email"]),
  message: z.string().trim().max(2000).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Required" }) }),
});

type FormState = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_city: string;
  preferred_store_id: string;
  contact_method: "whatsapp" | "phone" | "email";
  message: string;
  consent: boolean;
};

export function InquiryPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const navigate = useNavigate();
  const { items, count } = useInquiry();

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.price_idr * i.quantity, 0),
    [items],
  );

  const productIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.productId))).filter(Boolean),
    [items],
  );

  const { data: stockMap = {} } = useQuery({
    queryKey: ["inquiry-stock", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, stock_status")
        .in("id", productIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const r of data ?? []) map[r.id] = r.stock_status;
      return map;
    },
  });

  const hasOutOfStock = useMemo(
    () => items.some((i) => stockMap[i.productId] === "out_of_stock"),
    [items, stockMap],
  );

  const { data: stores = [] } = useQuery({
    queryKey: ["active-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, city")
        .eq("is_active", true)
        .order("city")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState<FormState>({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_city: "",
    preferred_store_id: "",
    contact_method: "whatsapp",
    message: "",
    consent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const sentPath =
    lang === "id" ? "/id/permintaan/terkirim" : "/en/inquiry/sent";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error(t("inquiry_page.empty_submit"));
      return;
    }
    if (hasOutOfStock) {
      toast.error(t("inquiry_page.has_out_of_stock"));
      return;
    }
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as string] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const payload = parsed.data;
      const messageWithMethod = [
        payload.message?.trim(),
        `[contact: ${payload.contact_method}]`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const { data: inquiry, error: inqErr } = await supabase
        .from("inquiries")
        .insert({
          customer_name: payload.customer_name,
          customer_email: payload.customer_email,
          customer_phone: payload.customer_phone,
          customer_city: payload.customer_city,
          preferred_store_id: payload.preferred_store_id || null,
          message: messageWithMethod,
          status: "new",
        })
        .select("id")
        .single();
      if (inqErr || !inquiry) throw inqErr ?? new Error("Insert failed");

      const itemRows = items.map((it) => ({
        inquiry_id: inquiry.id,
        product_id: it.productId,
        quantity: it.quantity,
        notes: [
          Object.entries(it.attributes)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", "),
          `SKU: ${it.sku}`,
          `unit_idr: ${it.price_idr}`,
        ]
          .filter(Boolean)
          .join(" | "),
      }));
      if (itemRows.length) {
        const { error: itErr } = await supabase
          .from("inquiry_items")
          .insert(itemRows);
        if (itErr) throw itErr;
      }

      clearInquiry();
      const qs = new URLSearchParams({
        ref: inquiry.id,
        method: payload.contact_method,
      }).toString();
      navigate({ to: `${sentPath}?${qs}` as never });
    } catch (err) {
      console.error(err);
      toast.error(t("inquiry_page.submit_error"));
    } finally {
      setSubmitting(false);
    }
  }

  const continuePath = lang === "id" ? "/id/katalog" : "/en/catalog";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {t("inquiry_page.title")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("inquiry.items_count", { count })}
      </p>

      {hasOutOfStock && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="text-sm text-destructive">
            <p className="font-semibold">{t("inquiry_page.stock_warning_title")}</p>
            <p className="mt-0.5 text-destructive/80">
              {t("inquiry_page.stock_warning_body")}
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[3fr_2fr]">
        {/* LEFT — items */}
        <section>
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("inquiry.empty")}
              </p>
              <Link
                to={continuePath as never}
                className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("inquiry_page.continue_shopping")}
              </Link>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {items.map((item) => {
                  const name =
                    (lang === "id" ? item.name_id : item.name_en) ||
                    item.name_id ||
                    item.name_en;
                  const productPath =
                    lang === "id"
                      ? `/id/produk/${item.slug}`
                      : `/en/products/${item.slug}`;
                  const attrs = Object.entries(item.attributes);
                  const isOut = stockMap[item.productId] === "out_of_stock";
                  return (
                    <li key={item.key} className="flex gap-4 p-4">
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={name}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={productPath as never}
                              className="font-medium text-foreground hover:text-primary"
                            >
                              {name}
                            </Link>
                            {isOut && (
                              <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                                {t("inquiry_page.now_out_of_stock")}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromInquiry(item.key)}
                            className="text-muted-foreground transition hover:text-destructive"
                            aria-label={t("inquiry.remove")}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        {attrs.length > 0 && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {attrs.map(([k, v]) => `${k}: ${v}`).join(" · ")}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                          <div className="inline-flex items-center rounded-md border border-border">
                            <button
                              type="button"
                              className="px-2 py-1 text-foreground hover:bg-muted"
                              onClick={() =>
                                updateQuantity(item.key, item.quantity - 1)
                              }
                              aria-label="−"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              className="px-2 py-1 text-foreground hover:bg-muted"
                              onClick={() =>
                                updateQuantity(item.key, item.quantity + 1)
                              }
                              aria-label="+"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(item.price_idr, lang)}
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                              {formatPrice(
                                item.price_idr * item.quantity,
                                lang,
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex items-center justify-between text-sm">
                <Link
                  to={continuePath as never}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  ← {t("inquiry_page.continue_shopping")}
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-muted-foreground transition hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("inquiry.clear_all")}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("inquiry_page.clear_title")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("inquiry.confirm_clear")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {t("inquiry_page.cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction onClick={() => clearInquiry()}>
                        {t("inquiry.clear_all")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("inquiry_page.estimated_total")}
                  </span>
                  <span className="text-2xl font-bold tracking-tight">
                    {formatPrice(subtotal, lang)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("inquiry_page.price_disclaimer")}
                </p>
              </div>
            </>
          )}
        </section>

        {/* RIGHT — form */}
        <aside>
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-border bg-card p-6"
          >
            <h2 className="text-xl font-bold tracking-tight">
              {t("inquiry_page.your_details")}
            </h2>

            <div className="mt-4 space-y-4">
              <Field
                label={t("inquiry_page.full_name")}
                required
                error={errors.customer_name}
              >
                <Input
                  value={form.customer_name}
                  onChange={(e) =>
                    setForm({ ...form, customer_name: e.target.value })
                  }
                  maxLength={120}
                />
              </Field>
              <Field
                label={t("inquiry_page.email")}
                required
                error={errors.customer_email}
              >
                <Input
                  type="email"
                  value={form.customer_email}
                  onChange={(e) =>
                    setForm({ ...form, customer_email: e.target.value })
                  }
                  maxLength={255}
                />
              </Field>
              <Field
                label={t("inquiry_page.phone")}
                required
                error={errors.customer_phone}
                hint="+62 ... / 0 ..."
              >
                <Input
                  value={form.customer_phone}
                  onChange={(e) =>
                    setForm({ ...form, customer_phone: e.target.value })
                  }
                  maxLength={20}
                  placeholder="+62812..."
                />
              </Field>
              <Field
                label={t("inquiry_page.city")}
                required
                error={errors.customer_city}
              >
                <Input
                  list="indo-cities"
                  value={form.customer_city}
                  onChange={(e) =>
                    setForm({ ...form, customer_city: e.target.value })
                  }
                  maxLength={120}
                />
                <datalist id="indo-cities">
                  {INDONESIAN_CITIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>

              <Field label={t("inquiry_page.preferred_store")}>
                <Select
                  value={form.preferred_store_id || "none"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      preferred_store_id: v === "none" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("inquiry_page.preferred_store_ph")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("inquiry_page.no_preference")}
                    </SelectItem>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.city ? `${s.city} — ${s.name}` : s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div>
                <Label className="text-sm font-medium">
                  {t("inquiry_page.contact_method")}
                </Label>
                <RadioGroup
                  value={form.contact_method}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      contact_method: v as FormState["contact_method"],
                    })
                  }
                  className="mt-2 flex flex-wrap gap-4"
                >
                  {(["whatsapp", "phone", "email"] as const).map((m) => (
                    <label
                      key={m}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <RadioGroupItem value={m} id={`cm-${m}`} />
                      {t(`inquiry_page.method_${m}`)}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <Field label={t("inquiry_page.message")}>
                <Textarea
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  maxLength={2000}
                  rows={4}
                  placeholder={t("inquiry_page.message_ph")}
                />
              </Field>

              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={form.consent}
                  onCheckedChange={(c) =>
                    setForm({ ...form, consent: c === true })
                  }
                  className="mt-0.5"
                />
                <span className="text-muted-foreground">
                  {t("inquiry_page.consent")}
                </span>
              </label>
              {errors.consent && (
                <p className="-mt-2 text-xs text-destructive">
                  {errors.consent}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={submitting || items.length === 0 || hasOutOfStock}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {submitting
                  ? t("inquiry_page.sending")
                  : t("inquiry_page.send_inquiry")}
              </Button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && !error && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}