import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { useCart, removeFromCart, updateCartQuantity } from "@/lib/cart-store";
import { useLang } from "@/i18n/LangProvider";
import { formatPrice } from "@/i18n/format";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Keranjang — Consina" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const lang = useLang();
  const navigate = useNavigate();
  const { items, subtotal, count } = useCart();
  const checkoutPath = lang === "id" ? "/id/checkout?cart=1" : "/en/checkout?cart=1";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Keranjang
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{count} item</p>

        {items.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-base text-muted-foreground">
              Keranjang kamu kosong.
            </p>
            <Button asChild className="mt-6">
              <Link to="/catalog">Lanjut belanja</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[3fr_2fr]">
            <ul className="divide-y divide-border rounded-lg border border-border">
              {items.map((it) => {
                const name = lang === "id" ? it.name_id : it.name_en;
                return (
                  <li key={it.key} className="flex gap-4 p-4">
                    {it.thumbnail ? (
                      <img
                        src={it.thumbnail}
                        alt={name}
                        className="h-24 w-24 rounded object-cover"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">{it.sku}</p>
                      {Object.keys(it.attributes).length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {Object.entries(it.attributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-3">
                        <div className="inline-flex items-center rounded border border-border">
                          <button
                            onClick={() => updateCartQuantity(it.key, it.quantity - 1)}
                            className="px-2.5 py-1.5 hover:bg-muted disabled:opacity-40"
                            disabled={it.quantity <= 1}
                            aria-label="-"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[32px] px-2 text-center text-sm">
                            {it.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(it.key, it.quantity + 1)}
                            className="px-2.5 py-1.5 hover:bg-muted disabled:opacity-40"
                            disabled={it.quantity >= 99}
                            aria-label="+"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(it.key)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Hapus
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatPrice(it.price_idr * it.quantity, lang)}
                    </p>
                  </li>
                );
              })}
            </ul>

            <aside className="h-fit rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Ringkasan</h2>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatPrice(subtotal, lang)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Ongkir dan diskon dihitung di langkah berikutnya.
              </p>
              <Button
                className="mt-5 h-11 w-full"
                onClick={() => navigate({ to: checkoutPath as never })}
              >
                Lanjut ke checkout
              </Button>
            </aside>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}