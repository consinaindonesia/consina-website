import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Trash2, ShoppingBag } from "lucide-react";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useWishlist } from "@/lib/wishlist-store";
import { useLang } from "@/i18n/LangProvider";
import { formatPrice, localizedField } from "@/i18n/format";
import { addToCart } from "@/lib/cart-store";
import { toast } from "sonner";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Consina" }, { name: "robots", content: "noindex" }] }),
  component: WishlistPage,
});

type Prod = {
  id: string;
  slug: string;
  sku: string;
  name_id: string;
  name_en: string;
  price_idr: number;
  weight_grams: number | null;
  thumb: string | null;
};

function WishlistPage() {
  const lang = useLang();
  const { user, loading } = useCustomerAuth();
  const { ids, toggle } = useWishlist(user?.id ?? null);
  const [products, setProducts] = useState<Prod[]>([]);

  useEffect(() => {
    if (ids.length === 0) {
      setProducts([]);
      return;
    }
    void supabase
      .from("products")
      .select("id,slug,sku,name_id,name_en,price_idr,weight_grams,images,product_images(image_url,thumbnail_url,is_primary,sort_order)")
      .in("id", ids)
      .then(({ data, error }) => {
        if (error) {
          console.error("[wishlist] failed to load products", error);
          setProducts([]);
          return;
        }
        setProducts(
          (data ?? []).map((p: any) => {
            const imgs = (p.product_images ?? []).slice().sort((a: any, b: any) =>
              (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0),
            );
            const thumb =
              imgs[0]?.thumbnail_url ??
              imgs[0]?.image_url ??
              (Array.isArray(p.images) ? p.images[0] : null) ??
              null;
            return { ...p, thumb };
          }),
        );
        // Log any saved ids that didn't resolve (e.g. deleted products)
        const found = new Set((data ?? []).map((p: any) => p.id));
        const missing = ids.filter((id) => !found.has(id));
        if (missing.length > 0) {
          console.warn("[wishlist] skipping unresolved product ids", missing);
          // Prune so the badge count matches what's displayable.
          missing.forEach((id) => void toggle(id));
        }
      });
  }, [ids.join(",")]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Wishlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user ? "Produk yang kamu simpan." : "Disimpan di perangkat ini. Masuk untuk menyimpan di akun."}
        </p>

        {!loading && products.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <Heart className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-base text-muted-foreground">Wishlist kosong.</p>
            <Button asChild className="mt-6">
              <Link to="/catalog">Cari produk</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const name = localizedField(p as any, "name", lang).value;
              const to = lang === "id" ? "/id/produk/$slug" : "/en/products/$slug";
              return (
                <li key={p.id} className="overflow-hidden rounded-lg border border-border bg-card">
                  <Link to={to as never} params={{ slug: p.slug } as never} className="block">
                    {p.thumb ? (
                      <img src={p.thumb} alt={name} className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="aspect-square w-full bg-muted" />
                    )}
                  </Link>
                  <div className="p-4">
                    <p className="text-sm font-semibold line-clamp-2">{name}</p>
                    <p className="mt-1 text-sm">{formatPrice(p.price_idr, lang)}</p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          addToCart({
                            productId: p.id,
                            slug: p.slug,
                            sku: p.sku,
                            name_id: p.name_id,
                            name_en: p.name_en,
                            price_idr: p.price_idr,
                            weight_grams: p.weight_grams,
                            thumbnail: p.thumb,
                            attributes: {},
                          });
                          toast.success("Ditambahkan ke keranjang");
                        }}
                      >
                        <ShoppingBag className="h-3.5 w-3.5" /> Tambah
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggle(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Footer />
    </div>
  );
}