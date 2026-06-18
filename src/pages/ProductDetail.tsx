import { useEffect, useMemo, useState } from "react";
import { Link, notFound, useNavigate } from "@tanstack/react-router";
import { Loader2, MapPin, Minus, Plus, BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LangProvider";
import { formatPrice, localizedField, hasTranslation } from "@/i18n/format";
import { MissingTranslationNotice } from "@/components/site/MissingTranslationNotice";
import { addToCart } from "@/lib/cart-store";
import { WishlistButton } from "@/components/site/WishlistButton";
import { FindInStore } from "@/components/site/FindInStore";
import { PriceDisplay } from "@/components/site/PriceDisplay";
import { SizeGuideDialog, type SizeGuide } from "@/components/site/SizeGuideDialog";
import { type CategoryNode } from "@/lib/public-products";

type Product = {
  id: string;
  sku: string;
  category_id: string | null;
  name_id: string;
  name_en: string;
  short_description_id: string | null;
  short_description_en: string | null;
  description_id: string | null;
  description_en: string | null;
  price_idr: number;
  original_price_idr: number | null;
  sale_price_idr: number | null;
  is_on_sale: boolean;
  discount_percent: number | string | null;
  size_guide_id: string | null;
  capacity: string | null;
  weight_grams: number | null;
  attributes: Record<string, string> | null;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  images?: string[] | null;
};

type ProductImage = {
  image_url: string;
  large_url: string | null;
  thumbnail_url: string | null;
  alt_text_id: string | null;
  alt_text_en: string | null;
  is_primary: boolean;
  sort_order: number;
};

type Category = {
  id: string;
  slug: string;
  name_id: string;
  name_en: string;
};

type ColorVariant = {
  id: string;
  color_name: string;
  color_hex: string;
  image_url: string | null;
  stock: number | null;
  sort_order: number;
};

type AttributeDef = {
  id: string;
  slug: string;
  name_id: string;
  name_en: string;
  type: "text" | "number" | "select";
  unit: string | null;
  options: string[];
};

export function ProductDetailPage({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [categoryAncestors, setCategoryAncestors] = useState<CategoryNode[]>([]);
  const [attrDefs, setAttrDefs] = useState<AttributeDef[]>([]);
  const [variants, setVariants] = useState<ColorVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [sizeOptionTypes, setSizeOptionTypes] = useState<Array<{ id: string; name: string; values: Array<{ id: string; value: string }> }>>([]);
  const [sizeVariants, setSizeVariants] = useState<Array<{ id: string; option_value_ids: string[]; price_idr: number | null; original_price_idr: number | null; stock: number }>>([]);
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [sizeGuide, setSizeGuide] = useState<SizeGuide | null>(null);
  const [related, setRelated] = useState<Array<{ id: string; sku: string; name_id: string; name_en: string; price_idr: number; thumb: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const [notifySaved, setNotifySaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMissing(false);

      const selectCols =
        "id,sku,category_id,name_id,name_en,short_description_id,short_description_en,description_id,description_en,price_idr,original_price_idr,sale_price_idr,is_on_sale,discount_percent,size_guide_id,capacity,weight_grams,attributes,stock_status,images,product_images(image_url,large_url,thumbnail_url,alt_text_id,alt_text_en,is_primary,sort_order)";

      // Prefer slug lookup; fall back to SKU so old URLs keep working.
      let { data: prods } = await supabase
        .from("products")
        .select(selectCols)
        .eq("slug", slug)
        .eq("is_active", true)
        .limit(1);

      if (!prods || prods.length === 0) {
        ({ data: prods } = await supabase
          .from("products")
          .select(selectCols)
          .ilike("sku", slug)
          .eq("is_active", true)
          .limit(1));
      }

      const prod = prods?.[0] as (Product & { product_images: ProductImage[] }) | undefined;
      if (cancelled) return;
      if (!prod) {
        setMissing(true);
        setLoading(false);
        return;
      }
      let imgs = (prod.product_images ?? []).slice().sort(
        (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order,
      );
      // Fallback to flat products.images[] (written by the New Product form)
      if (imgs.length === 0 && Array.isArray(prod.images) && prod.images.length > 0) {
        imgs = prod.images.map((url, i) => ({
          image_url: url,
          large_url: url,
          thumbnail_url: url,
          alt_text_id: null,
          alt_text_en: null,
          is_primary: i === 0,
          sort_order: i,
        }));
      }
      setProduct(prod);
      setImages(imgs);

      // Load color variants for this product (separate query keeps types simple).
      const { data: vRows } = await supabase
        .from("product_variants")
        .select("id,color_name,color_hex,image_url,stock,sort_order")
        .eq("product_id", prod.id)
        .order("sort_order");
      if (cancelled) return;
      const vs = (vRows ?? []) as ColorVariant[];
      setVariants(vs);
      setSelectedVariantId(vs[0]?.id ?? null);

      // Size variants (separate queries — no FK needed)
      const [{ data: otRows }, { data: svRows }] = await Promise.all([
        supabase
          .from("product_option_types" as never)
          .select("id,name,sort_order")
          .eq("product_id", prod.id)
          .order("sort_order"),
        supabase
          .from("product_size_variants" as never)
          .select("id,option_value_ids,price_idr,original_price_idr,stock,sort_order")
          .eq("product_id", prod.id)
          .order("sort_order"),
      ]);
      const types = ((otRows ?? []) as unknown as Array<{ id: string; name: string }>);
      let typesWithValues: Array<{ id: string; name: string; values: Array<{ id: string; value: string }> }> = [];
      if (types.length > 0) {
        const { data: ovRows } = await supabase
          .from("product_option_values" as never)
          .select("id,option_type_id,value,sort_order")
          .in("option_type_id", types.map((t) => t.id))
          .order("sort_order");
        const ovs = ((ovRows ?? []) as unknown as Array<{ id: string; option_type_id: string; value: string }>);
        typesWithValues = types.map((t) => ({
          id: t.id,
          name: t.name,
          values: ovs.filter((v) => v.option_type_id === t.id).map((v) => ({ id: v.id, value: v.value })),
        }));
      }
      if (cancelled) return;
      setSizeOptionTypes(typesWithValues);
      const svs = ((svRows ?? []) as unknown as Array<{ id: string; option_value_ids: string[]; price_idr: number | null; original_price_idr: number | null; stock: number }>);
      setSizeVariants(svs);
      setSelectedSizeId(svs[0]?.id ?? null);

      // Size guide
      if (prod.size_guide_id) {
        const { data: sg } = await supabase
          .from("size_guides" as never)
          .select("id,name,description,headers,rows")
          .eq("id", prod.size_guide_id)
          .maybeSingle();
        if (!cancelled && sg) {
          const r = sg as unknown as { id: string; name: string; description: string | null; headers: unknown; rows: unknown };
          setSizeGuide({
            id: r.id,
            name: r.name,
            description: r.description,
            headers: Array.isArray(r.headers) ? (r.headers as string[]) : [],
            rows: Array.isArray(r.rows) ? (r.rows as string[][]) : [],
          });
        }
      } else {
        setSizeGuide(null);
      }

      if (prod.category_id) {
        const [{ data: cat }, { data: catAttrs }, { data: rel }] = await Promise.all([
          supabase
            .from("categories")
            .select("id,slug,name_id,name_en")
            .eq("id", prod.category_id)
            .maybeSingle(),
          supabase
            .from("category_attributes")
            .select("sort_order, attribute:attributes(id, slug, name_id, name_en, type, unit, options)")
            .eq("category_id", prod.category_id)
            .order("sort_order"),
          supabase
            .from("products")
            .select("id,sku,name_id,name_en,price_idr,images,product_images(thumbnail_url,image_url,is_primary,sort_order)")
            .eq("category_id", prod.category_id)
            .eq("is_active", true)
            .neq("id", prod.id)
            .limit(4),
        ]);
        if (cancelled) return;
        setCategory((cat as Category) ?? null);
        // Walk ancestor chain via one extra cheap select of all active cats.
        const { data: allCats } = await supabase
          .from("categories")
          .select("id,slug,name_id,name_en,parent_category_id")
          .eq("is_active", true);
        if (!cancelled) {
          const nodes = (allCats ?? []) as CategoryNode[];
          const byId = new Map(nodes.map((c) => [c.id, c]));
          const anc: CategoryNode[] = [];
          let pid = byId.get(prod.category_id)?.parent_category_id ?? null;
          const seen = new Set<string>();
          while (pid && byId.has(pid) && !seen.has(pid)) {
            seen.add(pid);
            const p = byId.get(pid)!;
            anc.unshift(p);
            pid = p.parent_category_id;
          }
          setCategoryAncestors(anc);
        }
        const defs: AttributeDef[] = ((catAttrs ?? []) as unknown as Array<{ attribute: AttributeDef | null }>)
          .map((r) => r.attribute)
          .filter((a): a is AttributeDef => !!a)
          .map((a) => ({ ...a, options: Array.isArray(a.options) ? a.options : [] }));
        setAttrDefs(defs);
        setRelated(
          (rel ?? []).map((r) => {
            const ri = (r.product_images ?? []) as Array<{
              thumbnail_url: string | null;
              image_url: string;
              is_primary: boolean;
              sort_order: number;
            }>;
            ri.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order);
            const top = ri[0];
            const flat = Array.isArray((r as { images?: string[] }).images)
              ? (r as { images?: string[] }).images
              : null;
            return {
              id: r.id,
              sku: r.sku,
              name_id: r.name_id,
              name_en: r.name_en,
              price_idr: r.price_idr,
              thumb: top ? (top.thumbnail_url ?? top.image_url) : (flat && flat[0]) || null,
            };
          }),
        );
        // Pre-select existing attribute values from the product so user sees current config.
        const pre: Record<string, string> = {};
        for (const d of defs) {
          const v = prod.attributes?.[d.slug];
          if (v) pre[d.slug] = v;
        }
        setSelectedAttrs(pre);
      }

      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const nameField = useMemo(() => localizedField(product, "name", lang), [product, lang]);
  const shortDescField = useMemo(() => localizedField(product, "short_description", lang), [product, lang]);
  const descField = useMemo(() => localizedField(product, "description", lang), [product, lang]);

  const fallbackLang = product && !hasTranslation(product, ["name", "description"], lang);

  // Inquiry button removed — cart + wishlist + store finder remain

  function handleAddToCart() {
    if (!product) return;
    const top = images[0];
    addToCart({
      productId: product.id,
      slug: product.sku,
      sku: product.sku,
      name_id: product.name_id,
      name_en: product.name_en,
      price_idr: product.price_idr,
      weight_grams: product.weight_grams,
      thumbnail: top ? (top.thumbnail_url ?? top.image_url) : null,
      attributes: selectedAttrs,
      quantity,
      variantId: selectedVariantId ?? null,
      sizeVariantId: selectedSizeId ?? null,
    });
    toast.success(
      lang === "id" ? `Ditambahkan ke keranjang (${quantity})` : `Added to cart (${quantity})`,
      {
        action: {
          label: lang === "id" ? "Lihat keranjang" : "View cart",
          onClick: () => navigate({ to: "/cart" as never }),
        },
      },
    );
  }

  if (missing) throw notFound();

  if (loading || !product) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Nav />
        <div className="flex items-center justify-center py-32 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t("category_detail.loading")}
        </div>
        <Footer />
      </div>
    );
  }

  const stockBadge =
    product.stock_status === "in_stock"
      ? { text: t("labels.in_stock"), cls: "bg-secondary/15 text-secondary border-secondary/30" }
      : product.stock_status === "low_stock"
        ? { text: t("labels.low_stock"), cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" }
        : { text: t("labels.out_of_stock"), cls: "bg-destructive/15 text-destructive border-destructive/30" };

  const isOut = product.stock_status === "out_of_stock";
  const isLow = product.stock_status === "low_stock";

  async function submitNotify(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    const email = notifyEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t("product.notify_invalid_email"));
      return;
    }
    setNotifySubmitting(true);
    const { error } = await supabase
      .from("notify_when_in_stock")
      .insert({ product_id: product.id, email });
    setNotifySubmitting(false);
    if (error && !/duplicate|unique/i.test(error.message)) {
      toast.error(error.message);
      return;
    }
    setNotifySaved(true);
    toast.success(t("product.notify_saved"));
  }

  const mainImg = images[activeImage] ?? images[0];
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
  const variantImageUrl = selectedVariant?.image_url ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-12">
        {fallbackLang && (
          <div className="mb-4">
            <MissingTranslationNotice otherLang={lang === "id" ? "en" : "id"} />
          </div>
        )}

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">{t("nav.home")}</Link>
          {categoryAncestors.map((a) => (
            <span key={a.id} className="flex items-center gap-1.5">
              <span>/</span>
              <Link
                to={"/c/$slug" as never}
                params={{ slug: a.slug } as never}
                className="hover:text-foreground"
              >
                {localizedField(a, "name", lang).value}
              </Link>
            </span>
          ))}
          <span>/</span>
          {category && (
            <>
              <Link
                to={"/c/$slug" as never}
                params={{ slug: category.slug } as never}
                className="hover:text-foreground"
              >
                {localizedField(category, "name", lang).value}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-foreground">{nameField.value}</span>
        </nav>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
              {variantImageUrl ? (
                <img
                  src={variantImageUrl}
                  alt={selectedVariant?.color_name ?? nameField.value}
                  className="h-full w-full object-cover"
                />
              ) : mainImg ? (
                <img
                  src={mainImg.large_url ?? mainImg.image_url}
                  alt={(lang === "id" ? mainImg.alt_text_id : mainImg.alt_text_en) ?? nameField.value}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wider text-muted-foreground">
                  {t("product.no_image")}
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`aspect-square overflow-hidden rounded-lg border-2 bg-muted transition ${
                      i === activeImage ? "border-primary" : "border-transparent hover:border-border"
                    }`}
                  >
                    <img
                      src={img.thumbnail_url ?? img.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            {category && (
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">
                {localizedField(category, "name", lang).value}
              </p>
            )}
            <h1 className="mt-2 text-3xl font-black tracking-tight text-primary md:text-4xl">
              {nameField.value}
            </h1>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
              SKU: {product.sku}
            </p>

            {shortDescField.value && (
              <p className="mt-4 text-base text-muted-foreground">{shortDescField.value}</p>
            )}

            <div className="mt-5 flex items-center gap-3">
              <PriceDisplay
                product={{
                  price_idr: product.price_idr,
                  original_price_idr: product.original_price_idr,
                  sale_price_idr: product.sale_price_idr,
                  is_on_sale: product.is_on_sale,
                  discount_percent: product.discount_percent,
                  size_variants: sizeVariants.map((v) => ({
                    price_idr: v.price_idr,
                    original_price_idr: v.original_price_idr,
                    stock: v.stock,
                  })),
                }}
                lang={lang}
                size="lg"
              />
              <Badge variant="outline" className={`border ${stockBadge.cls}`}>
                {stockBadge.text}
              </Badge>
            </div>

            {isLow && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-800">
                {t("product.low_stock_notice")}
              </p>
            )}

            {/* Size variants */}
            {sizeOptionTypes.length > 0 && sizeVariants.length > 0 && (
              <div className="mt-6 space-y-4">
                {sizeOptionTypes.map((ot) => (
                  <div key={ot.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                        {ot.name}
                      </label>
                      {sizeGuide && (
                        <SizeGuideDialog
                          guide={sizeGuide}
                          triggerLabel={lang === "id" ? "Panduan Ukuran" : "Size Guide"}
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ot.values.map((val) => {
                        const matching = sizeVariants.find((sv) =>
                          sv.option_value_ids.includes(val.id),
                        );
                        const outOfStock = matching ? matching.stock <= 0 : true;
                        const active = matching?.id === selectedSizeId;
                        return (
                          <button
                            key={val.id}
                            type="button"
                            disabled={!matching || outOfStock}
                            onClick={() => matching && setSelectedSizeId(matching.id)}
                            className={
                              "min-w-[3rem] rounded-md border-2 px-3 py-2 text-sm font-semibold transition " +
                              (active
                                ? "border-primary bg-primary/10 text-primary"
                                : outOfStock
                                  ? "border-border bg-muted text-muted-foreground line-through opacity-60"
                                  : "border-border bg-background text-foreground hover:border-primary/50")
                            }
                            aria-pressed={active}
                          >
                            {val.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Color variants */}
            {variants.length > 0 && (
              <div className="mt-6">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground">
                  {lang === "id" ? "Warna" : "Color"}
                  {selectedVariant && (
                    <span className="ml-2 text-muted-foreground normal-case tracking-normal">
                      {selectedVariant.color_name}
                      {typeof selectedVariant.stock === "number" && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider">
                          · {selectedVariant.stock} {lang === "id" ? "stok" : "in stock"}
                        </span>
                      )}
                    </span>
                  )}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {variants.map((v) => {
                    const active = v.id === selectedVariantId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        title={v.color_name}
                        aria-label={v.color_name}
                        aria-pressed={active}
                        className={
                          "h-9 w-9 rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                          (active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50")
                        }
                        style={{ backgroundColor: v.color_hex }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Attribute selectors */}
            {attrDefs.length > 0 && (
              <div className="mt-6 space-y-4">
                {attrDefs.map((def) => {
                  const options = def.options?.length
                    ? def.options
                    : product.attributes?.[def.slug]
                      ? [product.attributes[def.slug]]
                      : [];
                  if (options.length === 0) return null;
                  return (
                    <div key={def.id}>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground">
                        {localizedField(def, "name", lang).value}
                        {def.unit ? ` (${def.unit})` : ""}
                      </label>
                      <Select
                        value={selectedAttrs[def.slug] ?? ""}
                        onValueChange={(v) =>
                          setSelectedAttrs((p) => ({ ...p, [def.slug]: v }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("product.select_placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quantity */}
            <div className="mt-6">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground">
                {t("product.quantity")}
              </label>
              <div className="inline-flex items-center rounded-md border border-input">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center text-foreground transition hover:bg-muted disabled:opacity-40"
                  disabled={quantity <= 1}
                  aria-label="-"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={quantity}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setQuantity(Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1);
                  }}
                  className="h-10 w-14 border-x border-input bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  className="flex h-10 w-10 items-center justify-center text-foreground transition hover:bg-muted disabled:opacity-40"
                  disabled={quantity >= 99}
                  aria-label="+"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-6 space-y-2">
              {!isOut && (
                <>
                  <Button
                    size="lg"
                    onClick={handleAddToCart}
                    className="h-12 w-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    {lang === "id" ? "Tambah ke Keranjang" : "Add to Cart"}
                  </Button>
                  <WishlistButton productId={product.id} variant="button" className="h-12 w-full text-base" />
                </>
              )}
              {isOut && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <BellRing className="h-4 w-4" />
                    {t("product.notify_title")}
                  </p>
                  {notifySaved ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("product.notify_saved")}
                    </p>
                  ) : (
                    <form onSubmit={submitNotify} className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Input
                        type="email"
                        required
                        placeholder={t("product.notify_email_ph")}
                        value={notifyEmail}
                        onChange={(e) => setNotifyEmail(e.target.value)}
                        maxLength={255}
                        className="flex-1"
                      />
                      <Button
                        type="submit"
                        disabled={notifySubmitting}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {notifySubmitting ? t("product.notify_sending") : t("product.notify_cta")}
                      </Button>
                    </form>
                  )}
                </div>
              )}
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 w-full border-primary/30 text-primary"
              >
                <Link
                  to={"/$lang/stores" as never}
                  params={{ lang } as never}
                  search={{ product: product.id } as never}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  {t("product.find_in_store")}
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Description + specs */}
        <div className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
          <article>
            <h2 className="text-2xl font-bold text-primary">
              {t("product.description")}
            </h2>
            {descField.value ? (
              <div
                className="prose prose-sm mt-4 max-w-none text-foreground/90"
                dangerouslySetInnerHTML={{ __html: descField.value }}
              />
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">{t("product.no_description")}</p>
            )}
          </article>
          <aside>
            <h2 className="text-2xl font-bold text-primary">
              {t("product.specs")}
            </h2>
            <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
              <SpecRow label="SKU" value={product.sku} />
              {product.capacity && <SpecRow label={t("product.capacity")} value={product.capacity} />}
              {product.weight_grams && (
                <SpecRow label={t("product.weight")} value={`${product.weight_grams} g`} />
              )}
              {attrDefs.map((d) => {
                const v = product.attributes?.[d.slug];
                if (!v) return null;
                return (
                  <SpecRow
                    key={d.id}
                    label={localizedField(d, "name", lang).value}
                    value={d.unit ? `${v} ${d.unit}` : v}
                  />
                );
              })}
            </dl>
          </aside>
        </div>

        {/* Find in store */}
        <FindInStore productId={product.id} lang={lang} />

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-2xl font-bold text-primary">
              {t("product.related")}
            </h2>
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {related.map((r) => {
                const rname = (lang === "id" ? r.name_id : r.name_en) || r.name_id || r.name_en;
                const prefix = lang === "id" ? "produk" : "products";
                return (
                  <li key={r.id}>
                    <Link
                      to={`/${lang}/${prefix}/${r.sku}` as never}
                      className="group block overflow-hidden rounded-xl border border-border bg-card"
                    >
                      <div className="aspect-square overflow-hidden bg-muted">
                        {r.thumb ? (
                          <img
                            src={r.thumb}
                            alt={rname}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : null}
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 text-sm font-medium text-foreground">{rname}</p>
                        <p className="mt-1 text-sm font-semibold text-primary">
                          {formatPrice(r.price_idr, lang)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}