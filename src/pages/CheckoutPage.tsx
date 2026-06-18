import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LangProvider";
import { formatPrice } from "@/i18n/format";
import {
  fetchShippingOptions,
  pickZone,
  quoteShipping,
  type ShippingMethod as ShipMethod,
  type ShippingZone,
} from "@/lib/shipping";
import { useServerFn } from "@tanstack/react-start";
import { getBiteshipRates, type BiteshipRate } from "@/lib/biteship.functions";
import { validateVoucher, redeemVoucher } from "@/lib/voucher.functions";
import { useCart, clearCart } from "@/lib/cart-store";
import { useCustomerAuth } from "@/hooks/use-customer-auth";

type PaymentMethod = "bank_transfer" | "midtrans" | "stripe";

function detectIsIndonesian(): boolean {
  if (typeof navigator === "undefined") return true;
  const langs = [navigator.language, ...(navigator.languages ?? [])]
    .filter(Boolean)
    .map((l) => l.toLowerCase());
  return langs.some((l) => l.startsWith("id"));
}

async function fetchUsdRate(): Promise<number | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const json = (await res.json()) as { rates?: { IDR?: number } };
    return json.rates?.IDR ?? null;
  } catch {
    return null;
  }
}

function useSearch(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

type InquiryRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_city: string | null;
};

type ItemRow = {
  id: string;
  quantity: number;
  notes: string | null;
  product: {
    id: string;
    sku: string;
    name_en: string;
    name_id: string;
    price_idr: number;
    weight_grams: number | null;
  } | null;
};

export function CheckoutPage() {
  const lang = useLang();
  const navigate = useNavigate();
  const search = useSearch();
  const inquiryId = search.inquiry || "";
  const isCart = search.cart === "1";
  const cart = useCart();

  const [loading, setLoading] = useState(true);
  const [inquiry, setInquiry] = useState<InquiryRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [shippingMethod, setShippingMethod] = useState<"pickup" | "delivery">("pickup");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPostal, setShippingPostal] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const isIndonesian = useMemo(detectIsIndonesian, []);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    isIndonesian ? "midtrans" : "stripe",
  );
  const [submitting, setSubmitting] = useState(false);
  const [usdPerIdr, setUsdPerIdr] = useState<number | null>(null);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [methods, setMethods] = useState<ShipMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");

  // Guest contact (cart mode)
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  // Logged-in customer (optional)
  const { user, profile } = useCustomerAuth();
  useEffect(() => {
    if (!isCart) return;
    if (profile?.email && !guestEmail) setGuestEmail(profile.email);
    if (profile?.full_name && !guestName) setGuestName(profile.full_name);
    if (profile?.phone && !guestPhone) setGuestPhone(profile.phone);
  }, [profile, isCart]);

  // Biteship live rates
  const [biteshipRates, setBiteshipRates] = useState<BiteshipRate[]>([]);
  const [biteshipLoading, setBiteshipLoading] = useState(false);
  const [biteshipError, setBiteshipError] = useState<string | null>(null);
  const [selectedBiteshipKey, setSelectedBiteshipKey] = useState<string>("");
  const fetchBiteship = useServerFn(getBiteshipRates);

  // Voucher
  const [voucherInput, setVoucherInput] = useState("");
  const [voucherApplying, setVoucherApplying] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string;
    discount_idr: number;
  } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const callValidateVoucher = useServerFn(validateVoucher);
  const callRedeemVoucher = useServerFn(redeemVoucher);

  // Inline form validation errors keyed by field id.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clearError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const errorInputClass = "border-destructive focus-visible:ring-destructive";

  useEffect(() => {
    if (isIndonesian) return;
    let cancelled = false;
    void fetchUsdRate().then((r) => {
      if (!cancelled && r) setUsdPerIdr(r);
    });
    return () => {
      cancelled = true;
    };
  }, [isIndonesian]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isCart) {
        // Cart mode — items come from localStorage cart; no inquiry record.
        setLoading(false);
        return;
      }
      if (!inquiryId) {
        setLoading(false);
        return;
      }
      const { data: inq } = await supabase
        .from("inquiries")
        .select("id, customer_name, customer_email, customer_phone, customer_city")
        .eq("id", inquiryId)
        .maybeSingle();
      const { data: its } = await supabase
        .from("inquiry_items")
        .select("id, quantity, notes, product:products(id, sku, name_en, name_id, price_idr, weight_grams)")
        .eq("inquiry_id", inquiryId);
      if (cancelled) return;
      setInquiry(inq as InquiryRow | null);
      setItems((its as unknown as ItemRow[]) ?? []);
      if (inq?.customer_city) setShippingCity(inq.customer_city);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [inquiryId, isCart]);

  useEffect(() => {
    let cancelled = false;
    void fetchShippingOptions().then((opts) => {
      if (cancelled) return;
      setZones(opts.zones);
      setMethods(opts.methods);
      if (opts.methods[0]) setSelectedMethodId(opts.methods[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Unified item shape (works for both inquiry-loaded and cart items).
  const cartLineItems = useMemo(() => {
    if (isCart) {
      return cart.items.map((c) => ({
        id: c.key,
        productId: c.productId,
        sku: c.sku,
        name_id: c.name_id,
        name_en: c.name_en,
        price_idr: c.price_idr,
        weight_grams: c.weight_grams ?? 500,
        quantity: c.quantity,
        attributes: c.attributes ?? null,
        variantId: c.variantId ?? null,
        sizeVariantId: c.sizeVariantId ?? null,
      }));
    }
    return items
      .filter((it) => it.product)
      .map((it) => ({
        id: it.id,
        productId: it.product!.id,
        sku: it.product!.sku,
        name_id: it.product!.name_id,
        name_en: it.product!.name_en,
        price_idr: it.product!.price_idr,
        weight_grams: it.product!.weight_grams ?? 500,
        quantity: it.quantity,
        attributes: null as Record<string, string> | null,
        variantId: null as string | null,
        sizeVariantId: null as string | null,
      }));
  }, [isCart, cart.items, items]);

  const subtotal = useMemo(
    () =>
      cartLineItems.reduce((s, it) => s + it.price_idr * it.quantity, 0),
    [cartLineItems],
  );

  const totalWeightGrams = useMemo(
    () =>
      cartLineItems.reduce(
        (s, it) => s + (it.weight_grams || 500) * it.quantity,
        0,
      ),
    [cartLineItems],
  );

  const matchedZone = useMemo(
    () => (zones.length ? pickZone(zones, shippingCity) : null),
    [zones, shippingCity],
  );

  const quotes = useMemo(() => {
    if (!matchedZone) return [];
    return methods.map((m) => quoteShipping(matchedZone, m, totalWeightGrams));
  }, [matchedZone, methods, totalWeightGrams]);

  const selectedQuote = useMemo(
    () => quotes.find((q) => q.method.id === selectedMethodId) ?? null,
    [quotes, selectedMethodId],
  );

  const selectedBiteshipRate = selectedBiteshipKey
    ? biteshipRates.find(
        (r) => `${r.courier_code}:${r.courier_service_code}` === selectedBiteshipKey,
      )
    : null;

  const shipping =
    shippingMethod === "delivery"
      ? selectedBiteshipRate
        ? selectedBiteshipRate.price
        : selectedQuote?.cost_idr ?? 0
      : 0;
  const discount = appliedVoucher?.discount_idr ?? 0;
  const total = Math.max(0, subtotal + shipping - discount);

  // Auto-fetch Biteship rates when city/postal entered.
  useEffect(() => {
    if (shippingMethod !== "delivery") return;
    if (cartLineItems.length === 0) return;
    if (!shippingPostal.trim() && !shippingCity.trim()) return;
    let cancelled = false;
    setBiteshipLoading(true);
    setBiteshipError(null);
    const itemsPayload = cartLineItems.map((it) => ({
      name: lang === "id" ? it.name_id : it.name_en,
      quantity: it.quantity,
      weight: it.weight_grams || 500,
      value: it.price_idr,
    }));
    fetchBiteship({
      data: {
        destination_postal_code: shippingPostal.trim() || undefined,
        destination_city: shippingCity.trim() || undefined,
        items: itemsPayload,
      },
    })
      .then((r) => {
        if (cancelled) return;
        setBiteshipRates(r.rates);
        if (r.error) {
          setBiteshipError(r.error);
          setSelectedBiteshipKey(""); // fall back to zone rate
        } else {
          setBiteshipError(null);
        }
        if (r.rates[0]) {
          setSelectedBiteshipKey(
            `${r.rates[0].courier_code}:${r.rates[0].courier_service_code}`,
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setBiteshipError((err as Error).message);
          setSelectedBiteshipKey(""); // fall back to zone rate
        }
      })
      .finally(() => {
        if (!cancelled) setBiteshipLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingMethod, shippingPostal, shippingCity, subtotal, totalWeightGrams]);

  async function applyVoucherCode() {
    if (!voucherInput.trim()) return;
    setVoucherApplying(true);
    setVoucherError(null);
    try {
      const res = await callValidateVoucher({
        data: { code: voucherInput.trim(), subtotal_idr: subtotal },
      });
      if (!res.ok) {
        setVoucherError(res.error ?? "Invalid voucher");
        setAppliedVoucher(null);
      } else {
        setAppliedVoucher({ code: res.code!, discount_idr: res.discount_idr! });
        toast.success(`Voucher ${res.code} diterapkan`);
      }
    } catch (err) {
      setVoucherError((err as Error).message);
    } finally {
      setVoucherApplying(false);
    }
  }

  async function handleConfirm() {
    if (!isCart && !inquiry) return;
    if (cartLineItems.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }

    const newErrors: Record<string, string> = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRe = /^[+\d][\d\s\-()]{6,}$/;

    if (isCart) {
      if (!guestName.trim()) newErrors.name = "Nama lengkap wajib diisi";
      if (!guestEmail.trim()) newErrors.email = "Email wajib diisi";
      else if (!emailRe.test(guestEmail.trim()))
        newErrors.email = "Format email tidak valid";
      if (!guestPhone.trim()) newErrors.phone = "No. telepon wajib diisi";
      else if (!phoneRe.test(guestPhone.trim()))
        newErrors.phone = "Format no. telepon tidak valid";
    }
    if (shippingMethod === "delivery") {
      if (!shippingCity.trim()) newErrors.city = "Kota wajib diisi";
      if (!shippingPostal.trim()) newErrors.postal = "Kode pos wajib diisi";
      if (!shippingAddress.trim())
        newErrors.address = "Alamat wajib diisi";
      else if (shippingAddress.trim().length < 10)
        newErrors.address = "Alamat terlalu pendek (minimal 10 karakter)";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const order = ["name", "email", "phone", "city", "postal", "address"];
      const first = order.find((k) => newErrors[k]);
      if (first && typeof document !== "undefined") {
        const el = document.getElementById(`co-${first}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => (el as HTMLInputElement).focus?.(), 250);
        }
      }
      toast.error("Lengkapi field yang wajib diisi");
      return;
    }

    if (shippingMethod === "delivery" && !selectedBiteshipKey && !selectedQuote) {
      toast.error("Pilih metode pengiriman");
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const selectedBiteship = biteshipRates.find(
        (r) => `${r.courier_code}:${r.courier_service_code}` === selectedBiteshipKey,
      );
      const shippingMethodName =
        shippingMethod === "delivery"
          ? selectedBiteship
            ? `${selectedBiteship.courier_name} — ${selectedBiteship.courier_service_name}`
            : selectedQuote?.method.name ?? null
          : null;

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          inquiry_id: isCart ? null : inquiry!.id,
          customer_user_id: user?.id ?? null,
          customer_name: isCart ? guestName.trim() : inquiry!.customer_name,
          customer_email: isCart ? guestEmail.trim() : inquiry!.customer_email,
          customer_phone: isCart
            ? guestPhone.trim()
            : (inquiry!.customer_phone ?? ""),
          customer_address: customerAddress || null,
          shipping_method: shippingMethod,
          shipping_address: shippingMethod === "delivery" ? shippingAddress : null,
          shipping_city: shippingMethod === "delivery" ? shippingCity || null : null,
          shipping_postal_code:
            shippingMethod === "delivery" ? shippingPostal || null : null,
          shipping_method_id:
            shippingMethod === "delivery" && !selectedBiteship
              ? selectedQuote?.method.id ?? null
              : null,
          shipping_method_name:
            shippingMethod === "delivery" ? shippingMethodName : null,
          shipping_zone_id:
            shippingMethod === "delivery" && !selectedBiteship
              ? selectedQuote?.zone.id ?? null
              : null,
          subtotal_idr: subtotal,
          shipping_idr: shipping,
          voucher_code: appliedVoucher?.code ?? null,
          voucher_discount_idr: discount,
          total_idr: total,
          payment_method: paymentMethod,
          payment_provider: paymentMethod,
          payment_status: "pending",
          status: "new",
          notes: orderNotes || null,
        })
        .select("id")
        .single();
      if (orderErr || !order) throw orderErr ?? new Error("Order failed");

      const rows = cartLineItems.map((it) => ({
        order_id: order.id,
        product_id: it.productId,
        product_name: lang === "id" ? it.name_id : it.name_en,
        sku: it.sku,
        quantity: it.quantity,
        unit_price_idr: it.price_idr,
        line_total_idr: it.price_idr * it.quantity,
        attributes: it.attributes ?? null,
        variant_id: it.variantId ?? null,
        size_variant_id: it.sizeVariantId ?? null,
      }));
      if (rows.length) {
        const { error: itErr } = await supabase.from("order_items").insert(rows);
        if (itErr) throw itErr;
      }

      if (appliedVoucher) {
        // Best-effort; ignore failure
        void callRedeemVoucher({ data: { code: appliedVoucher.code } });
      }
      if (isCart) clearCart();

      const path = lang === "id" ? `/id/order/${order.id}` : `/en/order/${order.id}`;
      navigate({ to: path as never });
    } catch (err) {
      console.error(err);
      toast.error("Could not create order");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isCart && !inquiry) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Inquiry not found</h1>
        <p className="mt-2 text-muted-foreground">
          The inquiry reference is invalid or has expired.
        </p>
      </div>
    );
  }

  if (isCart && cartLineItems.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Keranjang kosong</h1>
        <p className="mt-2 text-muted-foreground">
          Tambahkan produk ke keranjang sebelum checkout.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Checkout
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review your items and confirm your order.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <section className="space-y-8">
          <div className="rounded-lg border border-border">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">
              Items
            </div>
            <ul className="divide-y divide-border">
              {cartLineItems.map((it) => {
                const name = lang === "id" ? it.name_id : it.name_en;
                return (
                  <li key={it.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.sku} · ×{it.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatPrice(it.price_idr * it.quantity, lang)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">Shipping</h2>
            <RadioGroup
              value={shippingMethod}
              onValueChange={(v) => setShippingMethod(v as "pickup" | "delivery")}
              className="mt-3 space-y-3"
            >
              <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
                <RadioGroupItem value="pickup" id="pickup" className="mt-1" />
                <div>
                  <div className="text-sm font-medium">Pickup at store</div>
                  <div className="text-xs text-muted-foreground">
                    Free — collect at any Consina store
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
                <RadioGroupItem value="delivery" id="delivery" className="mt-1" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Home delivery</div>
                  <div className="text-xs text-muted-foreground">
                    Calculated from your city and order weight (
                    {(totalWeightGrams / 1000).toFixed(1)} kg)
                  </div>
                  {shippingMethod === "delivery" && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">City</Label>
                          <Input
                            id="co-city"
                            value={shippingCity}
                            onChange={(e) => {
                              setShippingCity(e.target.value);
                              clearError("city");
                            }}
                            placeholder="Jakarta"
                            className={errors.city ? errorInputClass : undefined}
                            aria-invalid={!!errors.city}
                          />
                          {errors.city && (
                            <p className="mt-1 text-xs text-destructive">{errors.city}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs">Postal code</Label>
                          <Input
                            id="co-postal"
                            value={shippingPostal}
                            onChange={(e) => {
                              setShippingPostal(e.target.value);
                              clearError("postal");
                            }}
                            placeholder="12345"
                            className={errors.postal ? errorInputClass : undefined}
                            aria-invalid={!!errors.postal}
                          />
                          {errors.postal && (
                            <p className="mt-1 text-xs text-destructive">{errors.postal}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Street address</Label>
                        <Textarea
                          id="co-address"
                          value={shippingAddress}
                          onChange={(e) => {
                            setShippingAddress(e.target.value);
                            clearError("address");
                          }}
                          rows={2}
                          placeholder="Street, building, unit"
                          className={errors.address ? errorInputClass : undefined}
                          aria-invalid={!!errors.address}
                        />
                        {errors.address && (
                          <p className="mt-1 text-xs text-destructive">{errors.address}</p>
                        )}
                      </div>

                      {(biteshipLoading || biteshipRates.length > 0) && (
                        <div className="rounded-md border border-border p-3">
                          <p className="text-xs font-medium">Pilih kurir (live ongkir)</p>
                          {biteshipLoading && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                              Menghitung ongkir…
                            </p>
                          )}
                          {biteshipRates.length > 0 && (
                            <RadioGroup
                              value={selectedBiteshipKey}
                              onValueChange={setSelectedBiteshipKey}
                              className="mt-2 space-y-2"
                            >
                              {biteshipRates.map((r) => {
                                const k = `${r.courier_code}:${r.courier_service_code}`;
                                return (
                                  <label
                                    key={k}
                                    className="flex items-center justify-between gap-3 rounded-md border border-border p-2 cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                      <RadioGroupItem value={k} id={k} />
                                      <div>
                                        <div className="text-sm font-medium">
                                          {r.courier_name} — {r.courier_service_name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {r.duration || r.shipment_duration_range}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-sm font-semibold">
                                      {formatPrice(r.price, lang)}
                                    </div>
                                  </label>
                                );
                              })}
                            </RadioGroup>
                          )}
                        </div>
                      )}

                      {biteshipRates.length === 0 && matchedZone && (
                        <div className="rounded-md border border-border p-3">
                          <p className="text-xs text-muted-foreground">
                            Shipping to <strong>{matchedZone.region_name}</strong>{" "}
                            zone
                          </p>
                          {biteshipError && (
                            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
                              <Info className="h-3 w-3 shrink-0" />
                              Live courier rates are temporarily unavailable. A flat rate has been applied.
                            </p>
                          )}
                          <RadioGroup
                            value={selectedMethodId}
                            onValueChange={setSelectedMethodId}
                            className="mt-2 space-y-2"
                          >
                            {quotes.map((q) => (
                              <label
                                key={q.method.id}
                                className="flex items-center justify-between gap-3 rounded-md border border-border p-2 cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem value={q.method.id} id={q.method.id} />
                                  <div>
                                    <div className="text-sm font-medium">
                                      {q.method.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {q.delivery_days_min}–{q.delivery_days_max} days
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm font-semibold">
                                  {formatPrice(q.cost_idr, lang)}
                                </div>
                              </label>
                            ))}
                          </RadioGroup>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">Payment method</h2>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="mt-3 space-y-2"
            >
              {(isIndonesian
                ? (["midtrans", "bank_transfer", "stripe"] as const)
                : (["stripe", "midtrans", "bank_transfer"] as const)
              ).map((method) => {
                const meta = {
                  bank_transfer: {
                    title: "Manual Bank Transfer",
                    desc: "Transfer to our bank account and upload proof",
                  },
                  midtrans: {
                    title: "Midtrans",
                    desc: "QRIS, GoPay, OVO, Dana, ShopeePay, credit card, or bank transfer",
                  },
                  stripe: {
                    title: isIndonesian
                      ? "Stripe (international cards)"
                      : "Stripe — recommended for international cards",
                    desc: "Pay with Visa, Mastercard, Amex. Charged in IDR.",
                  },
                }[method];
                return (
                  <label
                    key={method}
                    className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer"
                  >
                    <RadioGroupItem value={method} id={method} />
                    <div>
                      <div className="text-sm font-medium">{meta.title}</div>
                      <div className="text-xs text-muted-foreground">{meta.desc}</div>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">Customer</h2>
            {isCart ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Nama lengkap *</Label>
                  <Input
                    id="co-name"
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value);
                      clearError("name");
                    }}
                    maxLength={120}
                    className={errors.name ? errorInputClass : undefined}
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-destructive">{errors.name}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Email *</Label>
                  <Input
                    id="co-email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => {
                      setGuestEmail(e.target.value);
                      clearError("email");
                    }}
                    maxLength={255}
                    className={errors.email ? errorInputClass : undefined}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-destructive">{errors.email}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">No. telepon *</Label>
                  <Input
                    id="co-phone"
                    value={guestPhone}
                    onChange={(e) => {
                      setGuestPhone(e.target.value);
                      clearError("phone");
                    }}
                    maxLength={32}
                    className={errors.phone ? errorInputClass : undefined}
                    aria-invalid={!!errors.phone}
                  />
                  {errors.phone && (
                    <p className="mt-1 text-xs text-destructive">{errors.phone}</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm">{inquiry!.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {inquiry!.customer_email} · {inquiry!.customer_phone}
                </p>
              </>
            )}
            <div className="mt-3">
              <Label className="text-xs">Billing address (optional)</Label>
              <Input
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                maxLength={255}
              />
            </div>
            <div className="mt-3">
              <Label className="text-xs">Catatan pesanan (opsional)</Label>
              <Textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                rows={2}
                maxLength={500}
              />
            </div>
          </div>
        </section>

        <aside>
          <div className="sticky top-6 rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-bold">Order summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatPrice(subtotal, lang)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{shipping === 0 ? "Free" : formatPrice(shipping, lang)}</dd>
              </div>
              {appliedVoucher && (
                <div className="flex justify-between text-emerald-600">
                  <dt>Diskon ({appliedVoucher.code})</dt>
                  <dd>− {formatPrice(discount, lang)}</dd>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-border pt-3 text-base font-bold">
                <dt>Total</dt>
                <dd className="text-right">
                  <div>{formatPrice(total, lang)}</div>
                  {usdPerIdr && (
                    <div className="text-xs font-normal text-muted-foreground">
                      ≈ ${(total / usdPerIdr).toFixed(2)} USD
                    </div>
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-border pt-4">
              <Label className="text-xs">Kode voucher</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                  maxLength={64}
                  disabled={!!appliedVoucher}
                />
                {appliedVoucher ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAppliedVoucher(null);
                      setVoucherInput("");
                      setVoucherError(null);
                    }}
                  >
                    Hapus
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyVoucherCode}
                    disabled={voucherApplying || !voucherInput.trim()}
                  >
                    {voucherApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Terapkan"}
                  </Button>
                )}
              </div>
              {voucherError && (
                <p className="mt-1 text-xs text-destructive">{voucherError}</p>
              )}
            </div>
            <Button
              size="lg"
              className="mt-5 w-full"
              onClick={handleConfirm}
              disabled={submitting || cartLineItems.length === 0}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm order
            </Button>
            {Object.keys(errors).length > 0 && (
              <p className="mt-2 text-xs text-destructive">
                Lengkapi field yang wajib diisi
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              You'll see bank transfer instructions on the next page.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}