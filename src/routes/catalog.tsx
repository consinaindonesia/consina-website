import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Loader2, ShoppingBag } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { usePublicProducts, type PublicProduct } from "@/lib/public-products";
import { useLang } from "@/i18n/LangProvider";
import { localizedField } from "@/i18n/format";
import { PriceDisplay } from "@/components/site/PriceDisplay";
import { addToCart } from "@/lib/cart-store";
import { WishlistButton } from "@/components/site/WishlistButton";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Catalog — Consina Outdoor Gear with Promo Prices" },
      { name: "description", content: "Browse the full Consina catalog — carriers, tents, apparel, footwear, camping cookware and accessories with discounted rupiah prices." },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const { products, loading } = usePublicProducts();

  const grouped = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; items: PublicProduct[] }>();
    for (const p of products) {
      const slug = p.category_slug ?? "uncategorized";
      const name = lang === "id"
        ? p.category_name_id ?? p.category_name_en ?? "Uncategorized"
        : p.category_name_en ?? p.category_name_id ?? "Uncategorized";
      const bucket = map.get(slug) ?? { slug, name, items: [] };
      bucket.items.push(p);
      map.set(slug, bucket);
    }
    return Array.from(map.values());
  }, [products, lang]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <header className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-[1280px] px-4 py-16 md:px-8 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">{t("catalog.eyebrow")}</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-primary md:text-6xl">
            {t("catalog.title")}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {t("catalog.subtitle_prefix", { count: products.length, groups: grouped.length })}{" "}
            <span className="font-semibold text-primary">{t("catalog.subtitle_currency")}</span>
            {t("catalog.subtitle_suffix")}
          </p>
          <nav className="mt-8 flex flex-wrap gap-2">
            {grouped.map((g) => (
              <a
                key={g.slug}
                href={`#${g.slug}`}
                className="rounded-full border border-border bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground"
              >
                {g.name} <span className="ml-1 text-[10px] text-muted-foreground">({g.items.length})</span>
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-16 md:px-8 md:py-24">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("category_detail.loading", { defaultValue: "Loading..." })}
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-xl border border-dashed border-input bg-card py-16 text-center text-sm text-muted-foreground">
            No products available yet.
          </div>
        ) : (
        <div className="space-y-24">
          {grouped.map(({ slug, name, items }) => {
            return (
              <section key={slug} id={slug} className="scroll-mt-24">
                <div className="flex flex-col gap-3 border-b-2 border-primary pb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">
                      {t("catalog.items_count", { count: items.length })}
                    </p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight text-primary md:text-5xl">
                      {name}
                    </h2>
                  </div>
                  <Link
                    to="/c/$slug"
                    params={{ slug }}
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-secondary hover:text-primary"
                  >
                    View all <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                  {items.map((p) => (
                    <ProductCard key={p.id} p={p} lang={lang} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function ProductCard({ p, lang }: { p: PublicProduct; lang: "id" | "en" }) {
  const name = localizedField(p, "name", lang).value;
  const prefix = lang === "id" ? "produk" : "products";
  const requiresChoice = p.variants.length > 0 || p.size_variants.length > 0;
  const detailHref = `/${lang}/${prefix}/${p.slug ?? p.sku}`;
  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      productId: p.id,
      slug: p.slug ?? p.sku,
      sku: p.sku,
      name_id: p.name_id,
      name_en: p.name_en,
      price_idr: p.price_idr,
      weight_grams: p.weight_grams,
      thumbnail: p.thumbnail_url ?? p.image_url,
      attributes: {},
      quantity: 1,
    });
    toast.success(lang === "id" ? "Ditambahkan ke keranjang" : "Added to cart");
  }
  return (
    <Link
      to={detailHref as never}
      className="group block"
    >
      <div className="relative aspect-square overflow-hidden rounded-none bg-muted">
        {p.image_url ? (
          <img
            src={p.thumbnail_url ?? p.image_url}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
        <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-primary-foreground opacity-0 transition group-hover:opacity-100" />
        <WishlistButton productId={p.id} className="absolute left-3 bottom-3" />
        {!requiresChoice && (
          <button
            type="button"
            onClick={handleAdd}
            aria-label={lang === "id" ? "Tambah ke Keranjang" : "Add to cart"}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground opacity-0 shadow transition group-hover:opacity-100 hover:bg-primary/90"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            {lang === "id" ? "Tambah" : "Add"}
          </button>
        )}
      </div>
      <div className="mt-4">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-primary">
          {name}
        </h3>
        {p.variants.length > 0 && (
          <div className="mt-2 flex items-center gap-1">
            {p.variants.slice(0, 5).map((v, i) => (
              <span
                key={i}
                title={v.color_name}
                className="h-3 w-3 rounded-full border border-border"
                style={{ backgroundColor: v.color_hex }}
              />
            ))}
            {p.variants.length > 5 && (
              <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                +{p.variants.length - 5}
              </span>
            )}
          </div>
        )}
        <PriceDisplay product={p} lang={lang} size="sm" className="mt-2" />
      </div>
    </Link>
  );
}
