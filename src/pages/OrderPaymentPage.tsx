import { useEffect, useRef, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Copy, Loader2, Upload, CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LangProvider";
import { formatPrice } from "@/i18n/format";
import { createMidtransSnap, getMidtransConfig } from "@/lib/midtrans.functions";
import { createStripeCheckoutSession } from "@/lib/stripe.functions";

type OrderRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  total_idr: number;
  subtotal_idr: number;
  shipping_idr: number;
  shipping_method: string;
  payment_method: string;
  payment_status: string;
  payment_proof_url: string | null;
  created_at: string;
};

const BANKS = [
  { name: "BCA", account: "123 456 7890", holder: "PT Consina Indonesia" },
  { name: "Mandiri", account: "987 654 3210", holder: "PT Consina Indonesia" },
  { name: "BNI", account: "555 666 7777", holder: "PT Consina Indonesia" },
];

function shortRef(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function deadlineFrom(createdAt: string): string {
  const d = new Date(createdAt);
  d.setHours(d.getHours() + 24);
  return d.toLocaleString();
}

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        },
      ) => void;
    };
  }
}

function loadSnapJs(clientKey: string, isProduction: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.snap) return resolve();
    const src = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("snap.js failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.setAttribute("data-client-key", clientKey);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("snap.js failed to load"));
    document.head.appendChild(s);
  });
}

export function OrderPaymentPage() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const lang = useLang();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const createSnap = useServerFn(createMidtransSnap);
  const fetchMidtransConfig = useServerFn(getMidtransConfig);
  const createStripe = useServerFn(createStripeCheckoutSession);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      const { data } = await supabase
        .from("orders")
        .select(
          "id, customer_name, customer_email, total_idr, subtotal_idr, shipping_idr, shipping_method, payment_method, payment_status, payment_proof_url, created_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (!cancelled) {
        setOrder(data as OrderRow | null);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleUpload(file: File) {
    if (!order) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${order.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(path);
      const proofUrl = pub.publicUrl;
      const { error: updErr } = await supabase
        .from("orders")
        .update({
          payment_proof_url: proofUrl,
          payment_status: "awaiting_proof",
          payment_reference: shortRef(order.id),
        })
        .eq("id", order.id);
      if (updErr) throw updErr;
      setOrder({
        ...order,
        payment_proof_url: proofUrl,
        payment_status: "awaiting_proof",
      });
      toast.success("Payment proof uploaded. We'll verify shortly.");
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center px-4 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Order not found</h1>
      </div>
    );
  }

  const ref = shortRef(order.id);
  const isPaid = order.payment_status === "paid";
  const hasProof = !!order.payment_proof_url;
  const isMidtrans = order.payment_method === "midtrans";
  const isStripe = order.payment_method === "stripe";

  async function handlePayMidtrans() {
    if (!order) return;
    setRedirecting(true);
    try {
      const [{ token }, cfg] = await Promise.all([
        createSnap({ data: { orderId: order.id } }),
        fetchMidtransConfig(),
      ]);
      if (!cfg.clientKey) throw new Error("Midtrans client key missing");
      await loadSnapJs(cfg.clientKey, cfg.isProduction);
      if (!window.snap) throw new Error("Snap.js not available");
      window.snap.pay(token, {
        onSuccess: () => {
          toast.success("Payment successful");
          setOrder((o) => (o ? { ...o, payment_status: "paid" } : o));
          setRedirecting(false);
        },
        onPending: () => {
          toast.info("Payment pending verification");
          setOrder((o) => (o ? { ...o, payment_status: "verifying" } : o));
          setRedirecting(false);
        },
        onError: () => {
          toast.error("Payment failed");
          setRedirecting(false);
        },
        onClose: () => {
          setRedirecting(false);
        },
      });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not start payment");
      setRedirecting(false);
    }
  }

  async function handlePayStripe() {
    if (!order) return;
    setRedirecting(true);
    try {
      const { redirectUrl } = await createStripe({
        data: { orderId: order.id, origin: window.location.origin },
      });
      window.location.href = redirectUrl;
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not start payment");
      setRedirecting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Order reference
        </p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-wider">{ref}</p>

        <div className="mt-6 rounded-md bg-primary/5 p-5 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Amount to transfer
          </p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-primary">
            {formatPrice(order.total_idr, lang)}
          </p>
        </div>

        {isPaid ? (
          <div className="mt-6 flex items-center gap-3 rounded-md border border-green-500/40 bg-green-500/10 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-700">Payment confirmed</p>
              <p className="text-xs text-green-700/80">
                Your order is now being prepared.
              </p>
            </div>
          </div>
        ) : isStripe ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              You'll be redirected to Stripe to complete payment securely with
              an international credit or debit card. Charged in IDR.
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={handlePayStripe}
              disabled={redirecting}
            >
              {redirecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Pay with Stripe
            </Button>
            {order.payment_status === "verifying" && (
              <p className="text-xs text-amber-700">
                We're verifying your last payment. Refresh in a moment.
              </p>
            )}
          </div>
        ) : isMidtrans ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              You'll be redirected to Midtrans to complete payment with QRIS,
              GoPay, OVO, Dana, ShopeePay, credit card, or bank transfer.
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={handlePayMidtrans}
              disabled={redirecting}
            >
              {redirecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Pay now
            </Button>
            {order.payment_status === "verifying" && (
              <p className="text-xs text-amber-700">
                We're verifying your last payment. Refresh in a moment.
              </p>
            )}
          </div>
        ) : (
          <>
            <h2 className="mt-8 text-sm font-semibold">Transfer to one of:</h2>
            <ul className="mt-3 divide-y divide-border rounded-md border border-border">
              {BANKS.map((b) => (
                <li
                  key={b.name}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="font-mono text-base">{b.account}</p>
                    <p className="text-xs text-muted-foreground">{b.holder}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(b.account.replace(/\s/g, ""));
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-md bg-muted/40 p-4 text-sm">
              <p>
                <strong>Include reference:</strong>{" "}
                <span className="font-mono">{ref}</span>
              </p>
              <p className="mt-1 text-muted-foreground">
                Transfer before <strong>{deadlineFrom(order.created_at)}</strong>{" "}
                or the order will be cancelled.
              </p>
            </div>

            <div className="mt-6">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
              />
              {hasProof ? (
                <div className="rounded-md border border-border p-4">
                  <p className="text-sm font-medium">
                    Proof uploaded — awaiting verification
                  </p>
                  <a
                    href={order.payment_proof_url!}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    View uploaded file
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-3"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    Replace
                  </Button>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload payment proof
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}