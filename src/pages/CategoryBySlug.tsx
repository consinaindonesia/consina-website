import { Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Filter, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LangProvider";
import { formatPrice, localizedField } from "@/i18n/format";
import { collectDescendantIds, type CategoryNode } from "@/lib/public-products";

type Category = {
  id: string;
  slug: string;
  name_id: string;
  name_en: string;
  description_id: string | null;
  description_en: string | null;
  image_url: string | null;
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

type ProductRow = {
  id: string;
  slug: string | null;
  sku: string;
  name_en: string;
  name_id: string;
  price_idr: number;
  attributes: Record<string, string> | null;
  product_images: Array<{ thumbnail_url: string | null; image_url: string }>;
};

export function CategoryPage({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const [category, setCategory] = useState<Category | null>(null);
  const [ancestors, setAncestors] = useState<CategoryNode[]>([]);
  const [attrDefs, setAttrDefs] = useState<AttributeDef[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);

      // 1. Resolve slug → category, following redirects if needed.
      let { data: cat } = await supabase
        .from("categories")
        .select("id,slug,name_id,name_en,description_id,description_en,image_url")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (!cat) {
        const { data: redirect } = await supabase
          .from("category_slug_redirects")
          .select("new_slug")
          .eq("old_slug", slug)
          .maybeSingle();
        if (redirect?.new_slug) {
          // Client-side redirect to the canonical slug
          window.history.replaceState({}, "", `/c/${redirect.new_slug}`);
          const again = await supabase
            .from("categories")
            .select("id,slug,name_id,name_en,description_id,description_en,image_url")
            .eq("slug", redirect.new_slug)
            .eq("is_active", true)
            .maybeSingle();
          cat = again.data ?? null;
        }
      }

      if (cancelled) return;
      if (!cat) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setCategory(cat as Category);

      // 1b. Load full category tree (small table) to compute ancestors + descendants.
      const { data: allCats } = await supabase
        .from("categories")
        .select("id,slug,name_id,name_en,parent_category_id")
        .eq("is_active", true);
      const nodes = (allCats ?? []) as CategoryNode[];
      const byId = new Map(nodes.map((c) => [c.id, c]));
      const anc: CategoryNode[] = [];
      let parentId = (byId.get(cat.id) ?? null)?.parent_category_id ?? null;
      const seen = new Set<string>();
      while (parentId && byId.has(parentId) && !seen.has(parentId)) {
        seen.add(parentId);
        const p = byId.get(parentId)!;
        anc.unshift(p);
        parentId = p.parent_category_id;
      }
      if (cancelled) return;
      setAncestors(anc);
      const descendantIds = collectDescendantIds(cat.id, nodes);

      // 2. Load attribute schema for this category.
      const { data: catAttrs } = await supabase
        .from("category_attributes")
        .select("sort_order, attribute:attributes(id, slug, name_id, name_en, type, unit, options)")
        .eq("category_id", cat.id)
        .order("sort_order");
      const defs: AttributeDef[] = ((catAttrs ?? []) as unknown as Array<{
        attribute: AttributeDef | null;
      }>)
        .map((r) => r.attribute)
        .filter((a): a is AttributeDef => !!a)
        .map((a) => ({ ...a, options: Array.isArray(a.options) ? a.options : [] }));
      if (cancelled) return;
      setAttrDefs(defs);

      // 3. Load products: include products in this category OR any descendant
      //    category, via both the primary FK and the new product_categories join.
      const [{ data: prodsByFk }, { data: linked }] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,sku,name_en,name_id,price_idr,attributes,product_images(thumbnail_url,image_url,is_primary,sort_order)",
          )
          .in("category_id", descendantIds)
          .eq("is_active", true)
          .order("name_en"),
        supabase
          .from("product_categories")
          .select(
            "product_id, products!inner(id,sku,name_en,name_id,price_idr,attributes,is_active,product_images(thumbnail_url,image_url,is_primary,sort_order))",
          )
          .in("category_id", descendantIds),
      ]);
      type LinkedRow = {
        products: {
          id: string;
          sku: string;
          name_en: string;
          name_id: string;
          price_idr: number;
          attributes: Record<string, string> | null;
          is_active: boolean;
          product_images: Array<{
            thumbnail_url: string | null;
            image_url: string;
            is_primary: boolean;
            sort_order: number;
          }> | null;
        } | null;
      };
      const dedup = new Map<string, NonNullable<typeof prodsByFk>[number]>();
      (prodsByFk ?? []).forEach((p) => dedup.set(p.id, p));
      ((linked ?? []) as unknown as LinkedRow[]).forEach((r) => {
        const p = r.products;
        if (p && p.is_active) dedup.set(p.id, p as never);
      });
      const prods = Array.from(dedup.values());
      if (cancelled) return;
      const normalized: ProductRow[] = (prods ?? []).map((p) => {
        const imgs = (p.product_images ?? []) as Array<{
          thumbnail_url: string | null;
          image_url: string;
          is_primary: boolean;
          sort_order: number;
        }>;
        imgs.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order);
        return {
          id: p.id,
          slug: null,
          sku: p.sku,
          name_en: p.name_en,
          name_id: p.name_id,
          price_idr: p.price_idr,
          attributes: (p.attributes as Record<string, string> | null) ?? null,
          product_images: imgs.slice(0, 1) };
      });
      setProducts(normalized);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Build filters: only show attributes that products in this category actually use,
  // with the actual values found across those products.
  const dynamicFilters = useMemo(() => {
    const out: Array<{ def: AttributeDef; values: string[] }> = [];
    for (const def of attrDefs) {
      const seen = new Set<string>();
      for (const p of products) {
        const v = p.attributes?.[def.slug];
        if (v && v.trim()) seen.add(v.trim());
      }
      if (seen.size > 0) {
        out.push({
          def,
          values: Array.from(seen).sort((a, b) => {
            const an = parseFloat(a);
            const bn = parseFloat(b);
            if (!isNaN(an) && !isNaN(bn)) return an - bn;
            return a.localeCompare(b);
          }) });
      }
    }
    return out;
  }, [attrDefs, products]);

  const filtered = useMemo(() => {
    const active = Object.entries(filters).filter(([, set]) => set.size > 0);
    if (active.length === 0) return products;
    return products.filter((p) =>
      active.every(([slug, set]) => {
        const v = p.attributes?.[slug];
        return v ? set.has(v) : false;
      }),
    );
  }, [products, filters]);

  function toggleFilter(attrSlug: string, value: string) {
    setFilters((prev) => {
      const next = { ...prev };
      const set = new Set(next[attrSlug] ?? []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      next[attrSlug] = set;
      return next;
    });
  }

  function clearFilters() {
    setFilters({});
  }

  const activeFilterCount = Object.values(filters).reduce((sum, s) => sum + s.size, 0);

  if (missing) {
    throw notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <header className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-[1280px] px-4 py-12 md:px-8 md:py-16">
          {category ? (
            <>
              {ancestors.length > 0 && (
                <nav className="mb-3 text-xs text-muted-foreground" aria-label="Breadcrumb">
                  <Link to="/" className="hover:text-foreground">Home</Link>
                  {ancestors.map((a) => (
                    <span key={a.id}>
                      <span className="mx-1.5">/</span>
                      <Link
                        to={"/c/$slug" as never}
                        params={{ slug: a.slug } as never}
                        className="hover:text-foreground"
                      >
                        {localizedField(a, "name", lang).value}
                      </Link>
                    </span>
                  ))}
                  <span className="mx-1.5">/</span>
                  <span className="text-foreground">{localizedField(category, "name", lang).value}</span>
                </nav>
              )}
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">
                {t("category_detail.eyebrow")}
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-primary md:text-5xl">
                {localizedField(category, "name", lang).value}
              </h1>
              {localizedField(category, "description", lang).value && (
                <p className="mt-3 max-w-2xl text-base text-muted-foreground">
                  {localizedField(category, "description", lang).value}
                </p>
              )}
            </>
          ) : (
            <div className="h-20 animate-pulse rounded bg-muted" />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-10 md:px-8 md:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
          {/* Filters */}
          <aside>
            <div className="sticky top-20">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
                  <Filter className="h-4 w-4" /> {t("category_detail.filters_title")}
                </h2>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
                    {t("category_detail.clear")} ({activeFilterCount})
                  </button>
                )}
              </div>

              {dynamicFilters.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("category_detail.no_filters")}</p>
              ) : (
                <div className="space-y-5">
                  {dynamicFilters.map(({ def, values }) => (
                    <div key={def.id}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                        {localizedField(def, "name", lang).value}
                        {def.unit ? ` (${def.unit})` : ""}
                      </h3>
                      <ul className="space-y-1.5">
                        {values.map((v) => {
                          const active = filters[def.slug]?.has(v) ?? false;
                          return (
                            <li key={v}>
                              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground hover:text-primary">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-input"
                                  checked={active}
                                  onChange={() => toggleFilter(def.slug, v)}
                                />
                                <span>{v}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Product grid */}
          <section>
            {loading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("category_detail.loading")}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-input bg-card py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  {products.length === 0
                    ? t("category_detail.no_products")
                    : t("category_detail.no_matching")}
                </p>
                {activeFilterCount > 0 && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                    <X className="mr-1 h-4 w-4" /> {t("category_detail.clear_filters")}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  {t("category_detail.products_count", { count: filtered.length })}
                </p>
                <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((p) => {
                    const img = p.product_images[0];
                    const name = localizedField(p, "name", lang).value;
                    return (
                      <li key={p.id} className="group overflow-hidden rounded-xl border border-border bg-card">
                        <div className="aspect-square overflow-hidden bg-muted">
                          {img ? (
                            <img
                              src={img.thumbnail_url ?? img.image_url}
                              alt={name}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="h-full w-full bg-muted" />
                          )}
                        </div>
                        <div className="p-4">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.sku}</p>
                          <h3 className="mt-1 font-medium text-foreground">{name}</h3>
                          <p className="mt-2 font-semibold text-primary">{formatPrice(p.price_idr, lang)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
