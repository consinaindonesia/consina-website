import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, MapPin, Mountain, Leaf, Users, Mail, Phone, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { supabase } from "@/integrations/supabase/client";
import { loadHomeSections, type SerializedSectionRow } from "@/lib/page-sections.functions";
import { usePublicProducts, type PublicProduct, getSiteUrl } from "@/lib/public-products";
import { usePublicCategories, type PublicCategory } from "@/hooks/use-public-categories";
import { useLang } from "@/i18n/LangProvider";
import { formatPrice, localizedField } from "@/i18n/format";
import { PriceDisplay } from "@/components/site/PriceDisplay";
import { WishlistButton } from "@/components/site/WishlistButton";
import {
  DEFAULT_HOME_SECTIONS,
  SECTION_REGISTRY,
  mergeSettings,
  pickLocalized,
  styleToProps,
  type AnySectionSettings,
  type BrandStorySettings,
  type CategoriesSettings,
  type CommunitySettings,
  type FeaturedProductsSettings,
  type HeroSettings,
  type StatsSettings,
  type CTAConfig,
  type PageSectionRow,
  type SectionTypeId,
  type FaqCustomSettings,
  type NewsletterSettings,
  type ImageBannerSettings,
  type GallerySettings,
  type TestimonialsSettings,
  type SpacerSettings,
  type AnnouncementBarSettings,
  type StoreLocatorSettings,
  type FaqSettings,
  type ContactSettings,
  type CustomSectionSettings,
  type SectionStyle,
} from "@/lib/section-registry";
import { autoCompactStyle } from "@/lib/section-registry";
import hero from "@/assets/hero-mountain.jpg";
import catCarriers from "@/assets/cat-carriers.jpg";
import catTents from "@/assets/cat-tents.jpg";
import catApparel from "@/assets/cat-apparel.jpg";
import catFootwear from "@/assets/cat-footwear.jpg";
import catAccessories from "@/assets/cat-accessories.jpg";
import story from "@/assets/story.jpg";
import communityCleanup from "@/assets/community-cleanup.jpg";
import storyHiker from "@/assets/story-hiker.jpg";
const SITE_URL = getSiteUrl();

/* Per-text color helper. Returns inline style object when a per-element
 * color override exists in the section style, otherwise undefined so the
 * default Tailwind/theme color keeps applying. */
function tc(
  style: SectionStyle | undefined,
  key: "eyebrowColor" | "headingColor" | "bodyColor" | "ctaTextColor",
): React.CSSProperties | undefined {
  const v = style?.[key];
  return v ? { color: v } : undefined;
}

/* Text-alignment helper for body/description paragraphs. */
function ta(style: SectionStyle | undefined): React.CSSProperties | undefined {
  const v = style?.bodyAlign;
  return v ? { textAlign: v } : undefined;
}

/* Body-text picker that distinguishes "never set" (undefined → fall back to
 * the other language) from "explicitly cleared" (string "" → render empty). */
function pickBody(
  bodyId: string | undefined,
  bodyEn: string | undefined,
  lang: string,
): string {
  const primary = lang === "en" ? bodyEn : bodyId;
  if (typeof primary === "string") return primary;
  const other = lang === "en" ? bodyId : bodyEn;
  if (typeof other === "string") return other;
  return "";
}

const faqs = [
  {
    q: "What does Consina sell?",
    a: "Consina sells outdoor gear designed for Indonesian adventurers: backpack carriers (35L–100L), tents and shelters, technical apparel like jackets and pants, hiking footwear, and outdoor accessories such as bottles, headlamps, and trekking poles.",
  },
  {
    q: "Where is Consina based?",
    a: "Consina is headquartered in Jakarta, Indonesia, and has been designing outdoor gear in the country since 1999.",
  },
  {
    q: "Are Consina products made in Indonesia?",
    a: "Yes. Consina products are designed in Jakarta and locally crafted in Indonesia, then tested on trails across the archipelago.",
  },
  {
    q: "How can I find a Consina store near me?",
    a: "Consina operates more than 80 retail stores across Indonesia. You can use the Store Locator at /stores to search by city, province, or region — from Jakarta to Bali, Sumatra to Sulawesi.",
  },
  {
    q: "Does Consina have a community program?",
    a: "Yes. The 'Responsible Trekker' community brings together hikers, climbers, and campers across Indonesia who share one promise: leave the trail better than you found it.",
  },
];

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Consina",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.ico`,
  foundingDate: "1999",
  description:
    "Indonesian outdoor lifestyle brand designing carriers, tents, apparel, footwear and accessories since 1999.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Jakarta",
    addressCountry: "ID",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "hello@consina.com",
      telephone: "+62-21-345-6789",
      areaServed: "ID",
    },
  ],
  sameAs: [
    "https://www.instagram.com/consinaindonesia",
    "https://www.facebook.com/consinaindonesia",
  ],
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export const Route = createFileRoute("/")({
  loader: async (): Promise<{ sections: SerializedSectionRow[] }> => {
    try {
      const sections = await loadHomeSections();
      return { sections };
    } catch {
      return { sections: [] };
    }
  },
  head: () => ({
    meta: [
      { title: "Consina — The Outdoor Lifestyle | Indonesian Outdoor Gear Since 1999" },
      {
        name: "description",
        content: "Indonesian outdoor gear since 1999 — carriers, tents, apparel, footwear and accessories built for the archipelago's adventurers.",
      },
      { property: "og:title", content: "Consina — The Outdoor Lifestyle" },
      { property: "og:description", content: "Indonesian outdoor gear since 1999. Inspired by experience." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:image", content: `${SITE_URL}${hero}` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(organizationLd) },
      { type: "application/ld+json", children: JSON.stringify(faqLd) },
    ],
  }),
  component: HomePage,
});

const categories = [
  { name: "Carriers", slug: "carriers", desc: "Backpacks 40–100L for every adventure", img: catCarriers },
  { name: "Tents & Shelter", slug: "tents", desc: "From solo overnighters to group expeditions", img: catTents },
  { name: "Apparel", slug: "apparel", desc: "Jackets, pants, and shirts for the trail", img: catApparel },
  { name: "Footwear", slug: "footwear", desc: "Trekking shoes built for Indonesian terrain", img: catFootwear },
  { name: "Accessories", slug: "accessories", desc: "Bottles, headlamps, compasses, and more", img: catAccessories },
] as const;

const stores = [
  { city: "Jakarta", addr: "Pasar Baru Flagship", phone: "+62 21 345 6789" },
  { city: "Bandung", addr: "Jl. Sumatera No. 17", phone: "+62 22 723 1144" },
  { city: "Yogyakarta", addr: "Jl. Mangkubumi 22", phone: "+62 274 555 020" },
  { city: "Bali", addr: "Denpasar — Jl. Teuku Umar", phone: "+62 361 224 998" },
];

export function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <ComposedSections />
      </main>
      <Footer />
    </div>
  );
}

// Map registry IDs to the actual section components defined below. Each
// accepts a `settings` prop typed via SectionSettingsMap; defaults are merged
// in by `mergeSettings` before render.
type SectionCmp = (props: { settings: AnySectionSettings }) => React.JSX.Element;
const SECTION_COMPONENTS: Record<SectionTypeId, SectionCmp> = {
  hero: Hero as SectionCmp,
  brand_story: BrandStory as SectionCmp,
  categories: Categories as SectionCmp,
  featured_products: FeaturedProducts as SectionCmp,
  community: Community as SectionCmp,
  store_locator: StoreLocator as SectionCmp,
  faq: FAQSection as SectionCmp,
  contact: ContactSection as SectionCmp,
  stats: StatsSection as SectionCmp,
  faq_custom: FaqCustomSection as SectionCmp,
  newsletter: NewsletterSection as SectionCmp,
  image_banner: ImageBannerSection as SectionCmp,
  gallery: GallerySection as SectionCmp,
  testimonials: TestimonialsSection as SectionCmp,
  spacer: SpacerSection as SectionCmp,
  announcement_bar: AnnouncementBarSection as SectionCmp,
  custom: CustomSection as SectionCmp,
};

function ComposedSections() {
  const loaderData = Route.useLoaderData() as { sections: SerializedSectionRow[] };
  const initialSections = loaderData.sections;
  const initialRows = useMemo<PageSectionRow[]>(
    () =>
      initialSections.map((r) => ({
        id: r.id,
        page: r.page,
        section_type: r.section_type,
        position: r.position,
        enabled: r.enabled,
        settings: (() => {
          try {
            return JSON.parse(r.settings_json) as Record<string, unknown>;
          } catch {
            return {};
          }
        })(),
      })),
    [initialSections],
  );
  const [rows, setRows] = useState<PageSectionRow[]>(initialRows);

  // Live-refresh from DB after mount (admin preview postMessage or future edits).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("page_sections")
        .select("id,page,section_type,position,enabled,settings")
        .eq("page", "home")
        .eq("enabled", true)
        .order("position", { ascending: true });
      if (cancelled) return;
      if (!error && data) setRows(data as PageSectionRow[]);
    };
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type === "lovable-theme-refresh") void load();
    };
    window.addEventListener("message", onMsg);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMsg);
    };
  }, []);

  // While loading, render defaults so first paint matches existing site.
  const order: { key: string; type: SectionTypeId; settings: unknown }[] =
    rows.length === 0
      ? DEFAULT_HOME_SECTIONS.map((t) => ({ key: t, type: t, settings: {} }))
      : rows
          .filter((r): r is PageSectionRow & { section_type: SectionTypeId } =>
            (r.section_type as SectionTypeId) in SECTION_REGISTRY,
          )
          .map((r) => ({
            key: r.id,
            type: r.section_type as SectionTypeId,
            settings: r.settings ?? {},
          }));

  return (
    <>
      {order.map(({ key, type, settings }) => {
        const Comp = SECTION_COMPONENTS[type];
        if (!Comp) return null;
        const merged = mergeSettings(type, settings);
        return <Comp key={key} settings={merged} />;
      })}
    </>
  );
}

/* ---------- Hero ---------- */
function Hero({ settings }: { settings: HeroSettings }) {
  const lang = useLang();
  const s = settings;
  const heroImg = s.image && s.image.trim() ? s.image : hero;
  const overlayPct = Math.max(0, Math.min(100, s.overlay ?? 40));
  const heading = pickLocalized(s.heading, lang);
  const eyebrow = pickLocalized(s.eyebrow, lang);
  const subtitle = pickLocalized(s.subtitle, lang);
  // Heading supports {em}…{/em} for highlighted span and \n for line break.
  const headingParts = heading.split(/\{em\}|\{\/em\}/);
  return (
    <section
      className="relative isolate overflow-hidden"
      style={s.style?.bgColor ? { backgroundColor: s.style.bgColor } : undefined}
    >
      <div className="absolute inset-0 -z-10">
        <img
          src={heroImg}
          alt={pickLocalized(s.imageAlt, lang, "Hero background")}
          width={1920}
          height={1080}
          className="h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, rgba(26,58,46,${(overlayPct / 100).toFixed(2)}), rgba(26,58,46,${((overlayPct * 0.75) / 100).toFixed(2)}), var(--background))`,
          }}
        />
      </div>
      <div
        className="mx-auto flex min-h-[62vh] max-w-[1280px] flex-col justify-center px-4 py-20 md:min-h-[68vh] md:px-8 md:py-24 lg:min-h-[72vh] lg:py-28"
        style={s.style?.textColor ? { color: s.style.textColor } : undefined}
      >
        <div className="flex flex-col gap-5">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent" style={tc(s.style, "eyebrowColor")}>{eyebrow}</p>
          )}
          {heading && (
            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-primary-foreground md:text-7xl lg:text-[88px]" style={tc(s.style, "headingColor")}>
              {headingParts.map((part, i) =>
                i % 2 === 1 ? (
                  <em key={i} className="not-italic text-accent">{part}</em>
                ) : (
                  <span key={i}>{part.split("\n").map((ln, j) => (
                    <span key={j}>{j > 0 && <br />}{ln}</span>
                  ))}</span>
                ),
              )}
            </h1>
          )}
          {subtitle && (
            <p className="max-w-xl text-base leading-relaxed text-primary-foreground/85 md:text-lg" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <CTAButton cta={s.ctaPrimary} lang={lang} defaultStyle="primary" iconRight textStyle={tc(s.style, "ctaTextColor")} />
          <CTAButton cta={s.ctaSecondary} lang={lang} defaultStyle="outline" textStyle={tc(s.style, "ctaTextColor")} />
        </div>
        {s.stats && s.stats.length > 0 && (
          <div className="mt-16 grid max-w-2xl grid-cols-3 gap-6 border-t border-primary-foreground/20 pt-6 text-[#1a3a2e]">
            {s.stats.map((st, i) => (
              <div key={i}>
                <div className="text-2xl font-bold text-[#1a3a2e] md:text-3xl">{st.value}</div>
                <div className="mt-1 text-[11px] uppercase tracking-widest text-[#1a3a2e]">
                  {pickLocalized({ id: st.labelId, en: st.labelEn }, lang)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- CTA helper ---------- */
function CTAButton({
  cta,
  lang,
  defaultStyle = "primary",
  iconRight,
  textStyle,
}: {
  cta?: CTAConfig;
  lang: string;
  defaultStyle?: "primary" | "secondary" | "outline";
  iconRight?: boolean;
  textStyle?: React.CSSProperties;
}) {
  if (!cta) return null;
  const label = pickLocalized({ id: cta.labelId, en: cta.labelEn }, lang);
  if (!label) return null;
  const href = cta.href || "/";
  const style = cta.style ?? defaultStyle;
  const base = "group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wider transition";
  const cls =
    style === "primary"
      ? `${base} bg-accent text-accent-foreground hover:bg-accent/90`
      : style === "secondary"
        ? `${base} bg-[#d4b896] text-[#1a3a2e] hover:bg-[#c9a84c]`
        : `${base} border border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10`;
  return (
    <a href={href} className={cls} style={textStyle}>
      {label}
      {iconRight && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
    </a>
  );
}

/* ---------- Brand Story ---------- */
function BrandStory({ settings }: { settings: BrandStorySettings }) {
  const lang = useLang();
  const s = settings;
  const [expanded, setExpanded] = useState(false);
  const textWrapRef = useRef<HTMLDivElement>(null);
  const styleProps = styleToProps(s.style);

  const body = pickBody(s.bodyId, s.bodyEn, lang);
  const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  const handleToggle = () => {
    if (expanded && textWrapRef.current) {
      textWrapRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    setExpanded((v) => !v);
  };

  return (
    <section
      className={`mx-auto max-w-[1280px] px-4 md:px-8 ${styleProps.className}`}
      style={styleProps.inlineStyle}
    >
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* LEFT COLUMN — Image */}
        <div className="order-1">
          <div className="overflow-hidden rounded-2xl">
            <img
              src={s.image && s.image.trim() ? s.image : storyHiker}
              alt={pickLocalized(s.imageAlt, lang, "Hiker on an Indonesian mountain trail")}
              width={1024}
              height={1280}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* RIGHT COLUMN — Text */}
        <div className="order-2" ref={textWrapRef}>
          {(() => {
            const eyebrow = pickLocalized(s.eyebrow, lang);
            const heading = pickLocalized(s.heading, lang);
            if (!eyebrow && !heading) return null;
            return (
              <div className="flex flex-col gap-4">
                {eyebrow && (
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent" style={tc(s.style, "eyebrowColor")}>
                    {eyebrow}
                  </p>
                )}
                {heading && (
                  <h2 className="text-4xl font-black leading-[1.05] tracking-tight text-primary md:text-5xl" style={tc(s.style, "headingColor")}>
                    {heading}
                  </h2>
                )}
              </div>
            );
          })()}

          <div className="relative mt-6 md:mt-8">
            {/* Constrained width for comfortable reading */}
            <div className="max-w-prose">
              {/* Always-visible first paragraph */}
              <p className="text-base leading-[1.75] text-foreground/80 md:text-lg" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>
                {paragraphs[0] ?? ""}
              </p>

              {/* Collapsible remaining paragraphs */}
              <div
                className="grid transition-[grid-template-rows] duration-500 ease-out"
                style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="mt-5 space-y-5 text-base leading-[1.75] text-foreground/80 md:text-lg" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>
                    {paragraphs.slice(1).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fade gradient when collapsed */}
              {!expanded && (
                <div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 transition-opacity duration-300"
                  style={{
                    background:
                      "linear-gradient(to bottom, transparent, var(--background))",
                  }}
                />
              )}
            </div>

            {/* Toggle */}
            <button
              type="button"
              onClick={handleToggle}
              aria-expanded={expanded}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-primary transition hover:bg-primary/5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {expanded ? (
                <>
                  {pickLocalized(s.collapseLabel, lang, "Lebih Sedikit")} <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  {pickLocalized(s.expandLabel, lang, "Lebih Detail")} <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {s.cta && pickLocalized({ id: s.cta.labelId, en: s.cta.labelEn }, lang) && (
            <a
              href={s.cta.href || "/"}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-secondary"
              style={tc(s.style, "ctaTextColor")}
            >
              {pickLocalized({ id: s.cta.labelId, en: s.cta.labelEn }, lang)}{" "}
              <span className="text-base">→</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Categories ---------- */
const CATEGORY_IMAGE_MAP: Record<string, string> = {
  carriers: catCarriers,
  "tas-carrier": catCarriers,
  tents: catTents,
  tenda: catTents,
  apparel: catApparel,
  pakaian: catApparel,
  footwear: catFootwear,
  "alas-kaki": catFootwear,
  accessories: catAccessories,
  aksesori: catAccessories,
  daypack: catCarriers,
};

function Categories({ settings }: { settings: CategoriesSettings }) {
  const { t } = useTranslation();
  const lang = useLang();
  const { products } = usePublicProducts();
  const { data: cats } = usePublicCategories();
  const s = settings;
  const styleProps = styleToProps(s.style);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (!p.category_slug) continue;
      map.set(p.category_slug, (map.get(p.category_slug) ?? 0) + 1);
    }
    return map;
  }, [products]);

  // Newest product image per category slug (auto image source).
  const newestImageBySlug = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...products].sort((a, b) => {
      const at = a.created_at ?? "";
      const bt = b.created_at ?? "";
      return bt.localeCompare(at);
    });
    for (const p of sorted) {
      if (!p.category_slug || !p.image_url) continue;
      if (!map.has(p.category_slug)) map.set(p.category_slug, p.image_url);
    }
    return map;
  }, [products]);

  const items = useMemo(() => {
    const list = cats ?? [];
    let ordered = list;
    if (s.categorySlugs && s.categorySlugs.length > 0) {
      const bySlug = new Map(list.map((c) => [c.slug, c]));
      ordered = s.categorySlugs
        .map((slug) => bySlug.get(slug))
        .filter((c): c is PublicCategory => Boolean(c));
    }
    const overrides = s.categoryImages ?? {};
    return ordered.map((c) => {
      const override = overrides[c.slug];
      const mode = override?.mode ?? "auto";
      const manualSrc = override?.src?.trim();
      const autoSrc = newestImageBySlug.get(c.slug);
      const fallback = CATEGORY_IMAGE_MAP[c.slug] ?? catAccessories;
      const img =
        mode === "manual" && manualSrc
          ? manualSrc
          : autoSrc || fallback;
      const descOverride =
        (lang === "en" ? override?.descriptionEn : override?.descriptionId);
      const desc = typeof descOverride === "string"
        ? descOverride
        : ((t(`home.categories.${c.slug}_desc` as never, { defaultValue: "" }) as string) || "");
      return {
        slug: c.slug,
        name: localizedField(c, "name", lang).value,
        desc,
        img,
        count: counts.get(c.slug) ?? 0,
      };
    });
  }, [cats, counts, lang, t, s.categorySlugs, s.categoryImages, newestImageBySlug]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [snapCount, setSnapCount] = useState(1);
  const [activeIdx, setActiveIdx] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const recompute = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth));
    setSnapCount(pages);
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIdx(Math.min(pages - 1, Math.max(0, idx)));
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    recompute();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => recompute();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", recompute);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", recompute);
    };
  }, [recompute, items.length]);

  const scrollToPage = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const nudge = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <section
      className={`${styleProps.className}`}
      style={{ backgroundColor: s.style?.bgColor ?? "var(--background)", ...(s.style?.textColor ? { color: s.style.textColor } : {}) }}
    >
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Section heading */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2 text-left">
            {(() => {
              const eyebrow = pickLocalized(s.eyebrow, lang, t("home.categories.eyebrow"));
              const title = pickLocalized(s.title, lang, t("home.categories.title"));
              const subtitle = pickLocalized(s.subtitle, lang, t("home.categories.subtitle"));
              return (
                <>
                  {eyebrow && (
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a84c]" style={tc(s.style, "eyebrowColor")}>{eyebrow}</p>
                  )}
                  {title && (
                    <h2 className="text-3xl font-black leading-tight tracking-tight text-primary md:text-4xl lg:text-5xl" style={tc(s.style, "headingColor")}>{title}</h2>
                  )}
                  {subtitle && (
                    <p className="max-w-xl text-sm text-muted-foreground md:text-base" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>{subtitle}</p>
                  )}
                </>
              );
            })()}
          </div>
          {(() => {
            const label = pickLocalized(
              { id: s.viewAllCta?.labelId, en: s.viewAllCta?.labelEn },
              lang,
              t("cta.view_all", { defaultValue: "Lihat semua" }),
            );
            const href = s.viewAllCta?.href || "/catalog";
            if (!label) return null;
            return (
              <a
                href={href}
                className="hidden shrink-0 items-center gap-1 text-sm font-semibold uppercase tracking-wider text-primary transition hover:gap-2 md:inline-flex"
                style={tc(s.style, "ctaTextColor")}
              >
                {label}
                <ArrowRight className="h-4 w-4" />
              </a>
            );
          })()}
        </div>

        {/* Carousel */}
        <div className="group relative mt-5 md:mt-6">
          {/* Arrows (desktop) */}
          <button
            type="button"
            aria-label="Previous categories"
            onClick={() => nudge(-1)}
            disabled={!canPrev}
            className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-primary opacity-0 shadow transition group-hover:opacity-100 disabled:opacity-0 lg:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next categories"
            onClick={() => nudge(1)}
            disabled={!canNext}
            className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-primary opacity-0 shadow transition group-hover:opacity-100 disabled:opacity-0 lg:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            ref={scrollerRef}
            className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth scroll-pl-4 px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:-mx-8 md:px-8 md:scroll-pl-8 md:gap-5 [&::-webkit-scrollbar]:hidden"
          >
            {items.map((cat) => (
              <div
                key={cat.slug}
                className="w-[74%] shrink-0 snap-start sm:w-[44%] md:w-[34%] lg:w-[28%] xl:w-[24%]"
              >
                <CategoryCard cat={cat} />
              </div>
            ))}
          </div>
        </div>

        {/* Dots */}
        {snapCount > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {Array.from({ length: snapCount }).map((_, i) => {
              const active = i === activeIdx;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollToPage(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={active ? "true" : undefined}
                  className={
                    "rounded-full transition-all " +
                    (active
                      ? "h-2 w-5 bg-primary"
                      : "h-2 w-2 bg-primary/25 hover:bg-primary/50")
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

type CategoryItem = {
  slug: string;
  img: string;
  name: string;
  desc: string;
  count: number;
};

function CategoryCard({ cat }: { cat: CategoryItem }) {
  const { t } = useTranslation();
  return (
    <Link
      to={"/c/$slug" as never}
      params={{ slug: cat.slug } as never}
      className="group/card flex h-full flex-col overflow-hidden rounded-xl border border-[#d4b896] bg-background transition duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={cat.img}
          alt={cat.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover/card:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="text-base font-bold tracking-tight text-primary md:text-lg">
            {cat.name}
          </h3>
          {cat.desc && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {cat.desc}
            </p>
          )}
          {cat.count > 0 && (
            <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              {cat.count} {t("labels.items", { defaultValue: "produk" })}
            </p>
          )}
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#1a3a2e] transition group-hover/card:gap-2">
          {t("cta.explore")} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

/* ---------- Featured Products ---------- */
function FeaturedProducts({ settings }: { settings: FeaturedProductsSettings }) {
  const { t } = useTranslation();
  const lang = useLang();
  const { products } = usePublicProducts();
  const s = settings;
  const styleProps = styleToProps(s.style);
  const count = Math.max(1, Math.min(24, s.count ?? 8));
  const featured: PublicProduct[] = useMemo(() => {
    if (s.source === "manual" && s.productIds && s.productIds.length > 0) {
      const byId = new Map(products.map((p) => [p.id, p]));
      const list = s.productIds.map((id) => byId.get(id)).filter((p): p is PublicProduct => Boolean(p));
      return list.slice(0, count);
    }
    const f = products.filter((p) => p.is_featured);
    return (f.length ? f : products).slice(0, count);
  }, [products, s.source, s.productIds, count]);
  const prefix = lang === "id" ? "produk" : "products";

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [snapCount, setSnapCount] = useState(1);
  const [activeIdx, setActiveIdx] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const recompute = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth));
    setSnapCount(pages);
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIdx(Math.min(pages - 1, Math.max(0, idx)));
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    recompute();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => recompute();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", recompute);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", recompute);
    };
  }, [recompute, featured.length]);

  const scrollToPage = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const nudge = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <section
      className={`mx-auto max-w-[1280px] px-4 md:px-8 ${styleProps.className}`}
      style={styleProps.inlineStyle}
    >
      {/* Section heading */}
      <div className="flex flex-col gap-2 text-left">
        {(() => {
          const eyebrow = pickLocalized(s.subtitle, lang, t("home.featured.eyebrow"));
          const title = pickLocalized(s.title, lang, t("home.featured.title"));
          return (
            <>
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a84c]" style={tc(s.style, "eyebrowColor")}>{eyebrow}</p>
              )}
              {title && (
                <h2 className="text-3xl font-black leading-tight tracking-tight text-primary md:text-4xl lg:text-5xl" style={tc(s.style, "headingColor")}>{title}</h2>
              )}
            </>
          );
        })()}
      </div>

      {/* Carousel */}
      <div className="group relative mt-8 md:mt-10">
        {/* Arrows (desktop) */}
        <button
          type="button"
          aria-label="Previous products"
          onClick={() => nudge(-1)}
          disabled={!canPrev}
          className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-primary opacity-0 shadow transition group-hover:opacity-100 disabled:opacity-0 lg:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Next products"
          onClick={() => nudge(1)}
          disabled={!canNext}
          className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-primary opacity-0 shadow transition group-hover:opacity-100 disabled:opacity-0 lg:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div
          ref={scrollerRef}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth scroll-pl-4 px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:-mx-8 md:px-8 md:scroll-pl-8 md:gap-5 [&::-webkit-scrollbar]:hidden"
        >
          {featured.map((p) => {
            const name = localizedField(p, "name", lang).value;
            const desc = localizedField(p, "short_description", lang).value;
            return (
              <div
                key={p.id}
                className="group w-[74%] shrink-0 snap-start sm:w-[44%] md:w-[34%] lg:w-[28%] xl:w-[24%]"
              >
                <Link
                  to={`/${lang}/${prefix}/${p.slug ?? p.sku}` as never}
                  aria-label={name}
                  className="block relative aspect-square w-full max-w-[1080px] overflow-hidden rounded-xl bg-muted cursor-pointer"
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={name}
                      loading="lazy"
                      className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : null}
                  <WishlistButton productId={p.id} className="absolute left-3 bottom-3" />
                </Link>
                <div className="mt-4">
                  <h3 className="text-base font-bold leading-snug text-primary">{name}</h3>
                  {desc ? <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{desc}</p> : null}
                  <PriceDisplay product={p} lang={lang} size="sm" className="mt-2" />
                  <Link
                    to={`/${lang}/${prefix}/${p.slug ?? p.sku}` as never}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#1a3a2e] transition group-hover:gap-2"
                  >
                    {t("cta.view_details")} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dots */}
      {snapCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: snapCount }).map((_, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={i}
                type="button"
                onClick={() => scrollToPage(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={active ? "true" : undefined}
                className={
                  "rounded-full transition-all " +
                  (active
                    ? "h-2 w-5 bg-primary"
                    : "h-2 w-2 bg-primary/25 hover:bg-primary/50")
                }
              />
            );
          })}
        </div>
      )}
      {(() => {
        const label = pickLocalized(
          { id: s.viewAllCta?.labelId, en: s.viewAllCta?.labelEn },
          lang,
        );
        if (!label) return null;
        const href = s.viewAllCta?.href || "/catalog";
        return (
          <div className="mt-8 flex justify-center">
            <a
              href={href}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground"
              style={tc(s.style, "ctaTextColor")}
            >
              {label} <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        );
      })()}
    </section>
  );
}

/* ---------- Community ---------- */
function Community({ settings }: { settings: CommunitySettings }) {
  const lang = useLang();
  const s = settings;
  const styleProps = styleToProps(s.style);
  const body = pickBody(s.bodyId, s.bodyEn, lang);
  const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const imgRight = (s.imageSide ?? "right") === "right";
  const imgSrc = s.image && s.image.trim() ? s.image : communityCleanup;
  return (
    <section
      className={styleProps.className}
      style={{ backgroundColor: s.style?.bgColor ?? "#1a3a2e", color: s.style?.textColor ?? "#ffffff" }}
    >
      <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-4 md:grid-cols-2 md:px-8">
        {/* Text */}
        <div className={imgRight ? "order-2 md:order-1" : "order-2 md:order-2"}>
          {(() => {
            const eyebrow = pickLocalized(s.eyebrow, lang);
            const heading = pickLocalized(s.heading, lang);
            if (!eyebrow && !heading && paragraphs.length === 0) return null;
            return (
              <div className="flex flex-col gap-5">
                {(eyebrow || heading) && (
                  <div className="flex flex-col gap-4">
                    {eyebrow && (
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#d4b896]" style={tc(s.style, "eyebrowColor")}>{eyebrow}</p>
                    )}
                    {heading && (
                      <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl" style={tc(s.style, "headingColor")}>{heading}</h2>
                    )}
                  </div>
                )}
                {paragraphs.length > 0 && (
                  <div className="space-y-5 text-base leading-relaxed opacity-90 md:text-lg" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>
                    {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                )}
              </div>
            );
          })()}
          {s.cta && pickLocalized({ id: s.cta.labelId, en: s.cta.labelEn }, lang) && (
            <a
              href={s.cta.href || "/"}
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#d4b896] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-[#1a3a2e] transition hover:bg-[#c9a84c]"
              style={tc(s.style, "ctaTextColor")}
            >
              {pickLocalized({ id: s.cta.labelId, en: s.cta.labelEn }, lang)} <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </div>
        {/* Image */}
        <div className={imgRight ? "order-1 md:order-2" : "order-1 md:order-1"}>
          <div className="overflow-hidden rounded-2xl">
            <img
              src={imgSrc}
              alt={pickLocalized(s.imageAlt, lang, "Community")}
              width={1024}
              height={1280}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Stats ---------- */
function StatsSection({ settings }: { settings: StatsSettings }) {
  const lang = useLang();
  const s = settings;
  const styleProps = styleToProps(s.style);
  const items = s.items ?? [];
  if (items.length === 0) return <></>;
  return (
    <section className={styleProps.className} style={styleProps.inlineStyle}>
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {items.map((st, i) => (
            <div key={i} className="border-t border-border pt-4">
              <div className="text-3xl font-black tracking-tight text-primary md:text-4xl">{st.value}</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                {pickLocalized({ id: st.labelId, en: st.labelEn }, lang)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Store Locator ---------- */
function StoreLocator({ settings }: { settings: StoreLocatorSettings }) {
  const { t } = useTranslation();
  const lang = useLang();
  const s = settings;
  const styleProps = styleToProps(s.style);
  const eyebrow = pickLocalized(s.eyebrow, lang, t("home.store_locator.eyebrow"));
  const heading = pickLocalized(s.title, lang, t("home.store_locator.title"));
  const subtitle = pickLocalized(s.subtitle, lang, t("home.store_locator.subtitle"));
  const ctaLabel = pickLocalized({ id: s.cta?.labelId, en: s.cta?.labelEn }, lang, t("cta.all_stores"));
  const ctaHref = s.cta?.href || "/stores";
  const items = (s.stores && s.stores.length > 0)
    ? s.stores
    : stores.map((x) => ({ city: x.city, address: x.addr, phone: x.phone }));
  return (
    <section
      className={`mx-auto max-w-[1280px] px-4 md:px-8 ${styleProps.className}`}
      style={styleProps.inlineStyle}
    >
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          {(eyebrow || heading || subtitle) && (
            <div className="flex flex-col gap-2">
              {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary" style={tc(s.style, "eyebrowColor")}>{eyebrow}</p>}
              {heading && (
                <h2 className="text-3xl font-black leading-tight tracking-tight text-primary md:text-4xl lg:text-5xl" style={tc(s.style, "headingColor")}>
                  {heading}
                </h2>
              )}
              {subtitle && (
                <p className="max-w-md text-base leading-relaxed text-muted-foreground" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>{subtitle}</p>
              )}
            </div>
          )}
          {ctaLabel && (
            <a
              href={ctaHref}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-secondary"
              style={tc(s.style, "ctaTextColor")}
            >
              <MapPin className="h-4 w-4" /> {ctaLabel}
            </a>
          )}
        </div>
        <div className="lg:col-span-7">
          <ul className="divide-y divide-border border-y border-border">
            {items.map((st, i) => (
               <li key={`${st.city}-${i}`} className="group grid grid-cols-[auto_1fr_auto] items-center gap-6 py-5">
                 <span className="text-2xl font-black tracking-tight text-primary md:text-3xl" style={tc(s.style, "headingColor")}>
                   {st.city}
                 </span>
                 <div>
                   <p className="text-sm font-medium text-foreground" style={tc(s.style, "bodyColor")}>{st.address}</p>
                   <p className="text-xs text-muted-foreground" style={tc(s.style, "bodyColor")}>{st.phone}</p>
                 </div>
                <ArrowUpRight className="h-5 w-5 text-secondary transition group-hover:translate-x-1 group-hover:-translate-y-1" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- Contact ---------- */
function ContactSection({ settings }: { settings: ContactSettings }) {
  return <ContactSectionInner settings={settings} />;
}

/* ---------- FAQ ---------- */
function FAQSection({ settings }: { settings: FaqSettings }) {
  const { t } = useTranslation();
  const lang = useLang();
  const s = settings;
  const styleProps = styleToProps(s.style);
  const [open, setOpen] = useState<number | null>(0);
  const eyebrow = pickLocalized(s.eyebrow, lang, t("home.faq.eyebrow"));
  const heading = pickLocalized(s.title, lang, t("home.faq.title"));
  const subtitle = pickLocalized(s.subtitle, lang, t("home.faq.subtitle"));
  const customItems = (s.items ?? []).map((it) => ({
    q: pickLocalized({ id: it.questionId, en: it.questionEn }, lang),
    a: pickLocalized({ id: it.answerId, en: it.answerEn }, lang),
  })).filter((x) => x.q || x.a);
  const list = customItems.length > 0 ? customItems : faqs;
  return (
    <section
      className={`bg-background ${styleProps.className}`}
      style={styleProps.inlineStyle}
      {...(heading ? { "aria-labelledby": "faq-heading" } : { "aria-label": "FAQ" })}
    >
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <div className="flex flex-col items-center gap-2 text-center">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a84c]" style={tc(s.style, "eyebrowColor")}>{eyebrow}</p>}
          {heading && (
            <h2
              id="faq-heading"
              className="text-4xl font-black leading-tight tracking-tight text-primary md:text-5xl"
              style={tc(s.style, "headingColor")}
            >
              {heading}
            </h2>
          )}
          {subtitle && <p className="text-base text-muted-foreground" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>{subtitle}</p>}
        </div>

        <ul className="mt-8 md:mt-10 divide-y divide-border border-y border-border">
          {list.map((f, i) => {
            const isOpen = open === i;
            return (
              <li key={f.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <h3 className="text-base font-bold text-primary md:text-lg" style={tc(s.style, "headingColor")}>
                    {f.q}
                  </h3>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-primary transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="pb-5 pr-10 text-sm leading-relaxed text-muted-foreground md:text-base" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>
                    {f.a}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function ContactSectionInner({ settings }: { settings: ContactSettings }) {
  const { t } = useTranslation();
  const lang = useLang();
  const s = settings;
  const styleProps = styleToProps(s.style);
  // Preserve intentionally-emptied fields: use ?? semantics (treat ""
  // as a real value), and do NOT substitute translation fallbacks when
  // the localized object exists on the section settings.
  const locText = (l: { id?: string; en?: string } | undefined): string => {
    if (!l) return "";
    const v = lang === "en" ? l.en : l.id;
    return (v ?? l.en ?? l.id ?? "") as string;
  };
  const eyebrow = locText(s.eyebrow);
  const heading = locText(s.title);
  const subtitle = locText(s.subtitle);
  const addressTxt = s.address ?? "";
  // Build contacts list: prefer explicit contacts array, otherwise seed
  // from legacy single email/phone fields.
  const contacts: NonNullable<ContactSettings["contacts"]> = (() => {
    if (Array.isArray(s.contacts) && s.contacts.length > 0) {
      return s.contacts.slice(0, 3);
    }
    const seed: NonNullable<ContactSettings["contacts"]>[number] = {};
    if (s.email != null) seed.email = s.email;
    if (s.phone != null) seed.phone = s.phone;
    return Object.keys(seed).length > 0 ? [seed] : [];
  })();
  const subjects = [
    ...((s.subjects && s.subjects.length > 0)
      ? s.subjects.map((it) => {
          const label = pickLocalized({ id: it.labelId, en: it.labelEn }, lang);
          return { label, value: it.value || label };
        })
      : ([
          { label: t("home.contact.subject_product"), value: "product" },
          { label: t("home.contact.subject_wholesale"), value: "wholesale" },
          { label: t("home.contact.subject_press"), value: "press" },
          { label: t("home.contact.subject_career"), value: "career" },
          { label: t("home.contact.subject_other"), value: "other" },
        ] as { label: string; value: string }[])),
  ].filter((x) => x.label) as { label: string; value: string }[];
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<string>(subjects[0]?.value ?? "");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const resetForm = () => {
    setFullName(""); setEmail(""); setSubject(subjects[0]?.value ?? ""); setMessage("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (website.trim() !== "") {
      resetForm();
      setStatus("success");
      return;
    }

    const name = fullName.trim();
    const mail = email.trim();
    const msg = message.trim();
    if (!name || !mail || !msg || !subject) {
      setStatus("error");
      setErrorMsg(t("home.contact.fill_all"));
      return;
    }
    if (!emailRegex.test(mail)) {
      setStatus("error");
      setErrorMsg(t("home.contact.invalid_email"));
      return;
    }

    setStatus("submitting");
    const { error } = await supabase.from("contact_inquiries").insert({
      full_name: name, email: mail, subject, message: msg,
    });
    if (error) {
      setStatus("error");
      setErrorMsg(t("home.contact.submit_error"));
      return;
    }
    resetForm();
    setStatus("success");
  };

  return (
    <section
      className={`bg-muted/60 ${styleProps.className}`}
      style={styleProps.inlineStyle}
    >
      <div className="mx-auto grid max-w-[1280px] gap-14 px-4 md:grid-cols-2 md:px-8">
        <div>
          <div className="flex flex-col gap-2">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary" style={tc(s.style, "eyebrowColor")}>{eyebrow}</p>
            )}
            <h2 className="text-4xl font-black leading-tight tracking-tight text-primary md:text-5xl" style={tc(s.style, "headingColor")}>
              {heading ? heading : (<>{t("home.contact.title_1")}<br />{t("home.contact.title_2")}</>)}
            </h2>
            {subtitle && (
              <p className="max-w-md text-base leading-relaxed text-muted-foreground" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>{subtitle}</p>
            )}
          </div>
          <div className="mt-10 space-y-6 text-sm">
            {contacts.map((c, i) => (
              <div key={i} className="space-y-2">
                {c.name && (
                  <div className="font-semibold text-foreground" style={tc(s.style, "headingColor")}>
                    {c.name}
                    {c.role && <span className="ml-2 font-normal text-muted-foreground">— {c.role}</span>}
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-3 text-foreground" style={tc(s.style, "bodyColor")}>
                    <Phone className="h-4 w-4 text-secondary" /> {c.phone}
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-3 text-foreground" style={tc(s.style, "bodyColor")}>
                    <Mail className="h-4 w-4 text-secondary" /> {c.email}
                  </div>
                )}
              </div>
            ))}
            {addressTxt && (
              <div className="flex items-center gap-3 text-foreground" style={tc(s.style, "bodyColor")}>
                <MapPin className="h-4 w-4 text-secondary" /> {addressTxt}
              </div>
            )}
          </div>
        </div>
        <form
          onSubmit={onSubmit}
          className=""
        >
          {/* Honeypot — hidden from real users */}
          <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("labels.name")} id="name" value={fullName} onChange={setFullName} />
            <Field label={t("labels.email")} id="email" type="email" value={email} onChange={setEmail} />
          </div>
          <div className="mt-4">
            <label htmlFor="subject" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("labels.subject")}
            </label>
            <select
              id="subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-2 w-full border-b border-border bg-transparent py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              {subjects.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <label htmlFor="msg" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("labels.message")}
            </label>
            <textarea
              id="msg"
              rows={5}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-2 w-full resize-none border-b border-border bg-transparent py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          {status === "success" && (
            <p className="mt-6 rounded-sm border border-green-600/30 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              {t("home.contact.success")}
            </p>
          )}
          {status === "error" && errorMsg && (
            <p className="mt-6 rounded-sm border border-red-600/30 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {errorMsg}
            </p>
          )}
          <button
            type="submit"
            disabled={status === "submitting"}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-secondary disabled:opacity-60"
            style={tc(s.style, "ctaTextColor")}
          >
            {status === "submitting" ? t("cta.sending") : t("cta.send_message")} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
  );
}

function Field({
  label, id, type = "text", value, onChange,
}: {
  label: string; id: string; type?: string;
  value?: string; onChange?: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={value ?? ""}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="mt-2 w-full border-b border-border bg-transparent py-2 text-sm text-foreground outline-none focus:border-primary"
      />
    </div>
  );
}

/* ---------- FAQ (custom) ---------- */
function FaqCustomSection({ settings }: { settings: FaqCustomSettings }) {
  const lang = useLang();
  const s = settings;
  const styleProps = styleToProps(s.style);
  const items = s.items ?? [];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className={styleProps.className} style={styleProps.inlineStyle}>
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        {(() => {
          const eyebrow = pickLocalized(s.eyebrow, lang);
          const title = pickLocalized(s.title, lang);
          const subtitle = pickLocalized(s.subtitle, lang);
          if (!eyebrow && !title && !subtitle) return null;
          return (
            <div className="flex flex-col items-center gap-2 text-center">
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a84c]" style={tc(s.style, "eyebrowColor")}>{eyebrow}</p>
              )}
              {title && (
                <h2 className="text-4xl font-black leading-tight tracking-tight text-primary md:text-5xl" style={tc(s.style, "headingColor")}>{title}</h2>
              )}
              {subtitle && (
                <p className="text-base text-muted-foreground" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>{subtitle}</p>
              )}
            </div>
          );
        })()}
        <ul className="mt-8 md:mt-10 divide-y divide-border border-y border-border">
          {items.map((f, i) => {
            const q = pickLocalized({ id: f.questionId, en: f.questionEn }, lang);
            const a = pickLocalized({ id: f.answerId, en: f.answerEn }, lang);
            const isOpen = open === i;
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <h3 className="text-base font-bold text-primary md:text-lg" style={tc(s.style, "headingColor")}>{q}</h3>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-primary transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && a && (
                  <p className="pb-5 pr-10 text-sm leading-relaxed text-muted-foreground md:text-base" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>{a}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Newsletter ---------- */
function NewsletterSection({ settings }: { settings: NewsletterSettings }) {
  const lang = useLang();
  const s = settings;
  const styleProps = styleToProps(s.style);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setStatus("err");
      setErrMsg(pickLocalized(s.errorMessage, lang, "Invalid email"));
      return;
    }
    setStatus("loading");
    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: mail, source: "homepage", locale: lang });
    if (error && !/duplicate/i.test(error.message)) {
      setStatus("err");
      setErrMsg(error.message);
      return;
    }
    setStatus("ok");
    setEmail("");
  };
  return (
    <section
      className={styleProps.className}
      style={{ ...styleProps.inlineStyle, backgroundColor: s.style?.bgColor ?? styleProps.inlineStyle.backgroundColor ?? "#f5efe6" }}
    >
      <div className="mx-auto max-w-2xl px-4 text-center md:px-8">
        {(() => {
          const eyebrow = pickLocalized(s.eyebrow, lang);
          const heading = pickLocalized(s.heading, lang);
          const body = pickLocalized(s.body, lang);
          if (!eyebrow && !heading && !body) return null;
          return (
            <div className="flex flex-col items-center gap-2">
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent" style={tc(s.style, "eyebrowColor")}>{eyebrow}</p>
              )}
              {heading && (
                <h2 className="text-3xl font-black tracking-tight text-primary md:text-4xl" style={tc(s.style, "headingColor")}>{heading}</h2>
              )}
              {body && (
                <p className="text-base text-muted-foreground" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>{body}</p>
              )}
            </div>
          );
        })()}
        <form onSubmit={onSubmit} className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={pickLocalized(s.placeholder, lang, "Email")}
            className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="h-11 rounded-full bg-primary px-6 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-secondary disabled:opacity-60"
            style={tc(s.style, "ctaTextColor")}
          >
            {pickLocalized(s.buttonLabel, lang, "Subscribe")}
          </button>
        </form>
        {status === "ok" && (
          <p className="mt-3 text-sm font-medium text-green-700">{pickLocalized(s.successMessage, lang, "Thanks!")}</p>
        )}
        {status === "err" && errMsg && <p className="mt-3 text-sm text-red-700">{errMsg}</p>}
      </div>
    </section>
  );
}

/* ---------- Image Banner ---------- */
function ImageBannerSection({ settings }: { settings: ImageBannerSettings }) {
  const lang = useLang();
  const s = settings;
  const align = s.alignment ?? "center";
  const hasText = !!(
    pickLocalized(s.eyebrow, lang) || pickLocalized(s.heading, lang) || pickLocalized(s.body, lang)
  );
  const styleProps = styleToProps(autoCompactStyle(s.style, hasText));
  const alignClass =
    align === "left"
      ? "items-start text-left"
      : align === "right"
        ? "items-end text-right"
        : "items-center text-center";
  // Build slides list (backward compat with legacy `image`)
  const rawSlides = (s.slides && s.slides.length > 0)
    ? s.slides
    : s.image
      ? [{ image: s.image }]
      : [];
  const slides = rawSlides.filter((sl) => sl && sl.image);
  const aspect = s.aspectRatio ?? "16:9";
  const aspectClass =
    aspect === "1:1" ? "aspect-square" : aspect === "4:3" ? "aspect-[4/3]" : "aspect-[16/9]";
  const interval = typeof s.intervalMs === "number"
    ? Math.max(0, Math.min(10000, s.intervalMs))
    : 2000;
  return (
    <section className={styleProps.className} style={styleProps.inlineStyle}>
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className={`flex flex-col gap-6 ${alignClass}`}>
          {(pickLocalized(s.eyebrow, lang) || pickLocalized(s.heading, lang) || pickLocalized(s.body, lang) || s.cta?.href) && (
            <div className={`flex w-full flex-col gap-3 ${alignClass}`}>
              {pickLocalized(s.eyebrow, lang) && (
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent" style={tc(s.style, "eyebrowColor")}>{pickLocalized(s.eyebrow, lang)}</p>
              )}
              {pickLocalized(s.heading, lang) && (
                <h2 className="text-3xl font-black leading-tight tracking-tight text-primary md:text-5xl" style={tc(s.style, "headingColor")}>
                  {pickLocalized(s.heading, lang)}
                </h2>
              )}
              {pickLocalized(s.body, lang) && (
                <p className="max-w-2xl text-base text-muted-foreground" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>{pickLocalized(s.body, lang)}</p>
              )}
              {s.cta?.href && (
                <div className={align === "center" ? "mx-auto" : ""}>
                  <CTAButton cta={s.cta} lang={lang} defaultStyle="primary" iconRight textStyle={tc(s.style, "ctaTextColor")} />
                </div>
              )}
            </div>
          )}
          <PromoCarousel slides={slides} aspectClass={aspectClass} intervalMs={interval} />
        </div>
      </div>
    </section>
  );
}

function PromoCarousel({
  slides,
  aspectClass,
  intervalMs,
}: {
  slides: { image: string; href?: string; alt?: string }[];
  aspectClass: string;
  intervalMs: number;
}) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const count = slides.length;
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (count <= 1 || paused || reducedMotion || !intervalMs) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [count, paused, reducedMotion, intervalMs]);

  // Keep idx in range if slides change
  useEffect(() => {
    if (idx >= count) setIdx(0);
  }, [count, idx]);

  if (count === 0) {
    return (
      <div className={`w-full ${aspectClass} rounded-2xl bg-muted flex items-center justify-center text-sm text-muted-foreground`}>
        Add images in the Design editor.
      </div>
    );
  }

  const go = (next: number) => setIdx(((next % count) + count) % count);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchDeltaX.current = 0;
    setPaused(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    touchDeltaX.current = (e.touches[0]?.clientX ?? 0) - touchStartX.current;
  };
  const onTouchEnd = () => {
    const dx = touchDeltaX.current;
    touchStartX.current = null;
    touchDeltaX.current = 0;
    setPaused(false);
    if (Math.abs(dx) > 40) {
      if (dx < 0) go(idx + 1); else go(idx - 1);
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl bg-muted ${aspectClass}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      role="region"
      aria-roledescription="carousel"
    >
      {slides.map((sl, i) => {
        const visible = i === idx;
        const img = (
          <img
            src={sl.image}
            alt={sl.alt ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
            loading={i === 0 ? "eager" : "lazy"}
            draggable={false}
          />
        );
        return (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
            aria-hidden={!visible}
          >
            {sl.href ? (
              <a href={sl.href} className="block h-full w-full">{img}</a>
            ) : (
              img
            )}
          </div>
        );
      })}

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(idx - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background/80 p-2 text-foreground shadow hover:bg-background md:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(idx + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background/80 p-2 text-foreground shadow hover:bg-background md:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === idx}
                className={`h-2 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/80"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Gallery ---------- */
function GallerySection({ settings }: { settings: GallerySettings }) {
  const lang = useLang();
  const s = settings;
  const styleProps = styleToProps(s.style);
  const images = s.images ?? [];
  const cols = s.columns ?? 3;
  const gridClass =
    cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <section className={styleProps.className} style={styleProps.inlineStyle}>
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {pickLocalized(s.title, lang) && (
          <h2 className="text-3xl font-black tracking-tight text-primary md:text-4xl" style={tc(s.style, "headingColor")}>
            {pickLocalized(s.title, lang)}
          </h2>
        )}
        {pickLocalized(s.subtitle, lang) && (
          <p className="mt-2 text-base text-muted-foreground" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>{pickLocalized(s.subtitle, lang)}</p>
        )}
        <div className={`mt-6 grid grid-cols-1 gap-3 md:gap-4 ${gridClass}`}>
          {images.map((img, i) => {
            const tile = (
              <div className="aspect-square overflow-hidden rounded-xl bg-muted">
                <img src={img.src} alt={img.alt ?? ""} loading="lazy" className="h-full w-full object-cover transition hover:scale-[1.03]" />
              </div>
            );
            return img.href ? (
              <a key={i} href={img.href}>{tile}</a>
            ) : (
              <div key={i}>{tile}</div>
            );
          })}
          {images.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              Add images in the Design editor.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Testimonials ---------- */
function TestimonialsSection({ settings }: { settings: TestimonialsSettings }) {
  const lang = useLang();
  const s = settings;
  const styleProps = styleToProps(s.style);
  const items = s.items ?? [];
  return (
    <section className={styleProps.className} style={styleProps.inlineStyle}>
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="text-center">
          {pickLocalized(s.eyebrow, lang) && (
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent" style={tc(s.style, "eyebrowColor")}>{pickLocalized(s.eyebrow, lang)}</p>
          )}
          {pickLocalized(s.title, lang) && (
            <h2 className="mt-2 text-3xl font-black tracking-tight text-primary md:text-4xl" style={tc(s.style, "headingColor")}>
              {pickLocalized(s.title, lang)}
            </h2>
          )}
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => {
            const quote = pickLocalized({ id: it.quoteId, en: it.quoteEn }, lang);
            const rating = Math.max(0, Math.min(5, it.rating ?? 0));
            return (
              <figure key={i} className="rounded-xl border border-border bg-background p-6">
                {rating > 0 && (
                  <div className="mb-3 text-accent">{"★".repeat(rating)}{"☆".repeat(5 - rating)}</div>
                )}
                <blockquote className="text-base leading-relaxed text-foreground" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>“{quote}”</blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  {it.avatar && <img src={it.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />}
                  <div>
                    <div className="text-sm font-semibold text-primary" style={tc(s.style, "headingColor")}>{it.author}</div>
                    {it.role && <div className="text-xs text-muted-foreground" style={tc(s.style, "bodyColor")}>{it.role}</div>}
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Spacer ---------- */
function SpacerSection({ settings }: { settings: SpacerSettings }) {
  const s = settings;
  const h = Math.max(0, Math.min(400, s.height ?? 48));
  return (
    <div
      style={{ height: h, backgroundColor: s.style?.bgColor }}
      className="w-full"
    >
      {s.showDivider && (
        <div className="mx-auto h-full max-w-[1280px] px-4 md:px-8">
          <div className="h-full border-t border-border" style={{ marginTop: h / 2 }} />
        </div>
      )}
    </div>
  );
}

/* ---------- Announcement Bar ---------- */
function AnnouncementBarSection({ settings }: { settings: AnnouncementBarSettings }) {
  const lang = useLang();
  const s = settings;
  const msg = pickLocalized(s.message, lang);
  if (!msg) return <></>;
  const linkLabel = pickLocalized(s.linkLabel, lang);
  return (
    <div
      className="w-full px-4 py-2 text-center text-xs font-medium md:text-sm"
      style={{
        backgroundColor: s.bgColor ?? s.style?.bgColor ?? "#1a3a2e",
        color: s.style?.bodyColor ?? s.textColor ?? s.style?.textColor ?? "#ffffff",
      }}
    >
      <Typewriter text={msg} />
      {linkLabel && s.href && (
        <a href={s.href} className="ml-2 underline underline-offset-2 hover:opacity-80" style={tc(s.style, "ctaTextColor")}>
          {linkLabel}
        </a>
      )}
    </div>
  );
}

function Typewriter({ text }: { text: string }) {
  const [typed, setTyped] = useState("");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (reduced || !text) {
      setTyped(text);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const TYPE_MS = 55;
    const ERASE_MS = 28;
    const HOLD_MS = 2600;
    const GAP_MS = 600;

    const run = async () => {
      while (!cancelled) {
        for (let i = 1; i <= text.length; i++) {
          if (cancelled) return;
          setTyped(text.slice(0, i));
          await new Promise<void>((r) => { timer = setTimeout(r, TYPE_MS); });
        }
        await new Promise<void>((r) => { timer = setTimeout(r, HOLD_MS); });
        if (cancelled) return;
        for (let i = text.length; i >= 0; i--) {
          if (cancelled) return;
          setTyped(text.slice(0, i));
          await new Promise<void>((r) => { timer = setTimeout(r, ERASE_MS); });
        }
        await new Promise<void>((r) => { timer = setTimeout(r, GAP_MS); });
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [text, reduced]);

  return (
    <span aria-label={text}>
      <span aria-hidden={!reduced}>{typed}</span>
      {!reduced && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block w-[1px] align-baseline"
          style={{
            height: "1em",
            background: "currentColor",
            animation: "tw-cursor 1s steps(1) infinite",
            verticalAlign: "-0.15em",
          }}
        />
      )}
      <style>{`@keyframes tw-cursor{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
    </span>
  );
}

/* ---------- Custom (blank) Section ---------- */
function CustomSection({ settings }: { settings: CustomSectionSettings }) {
  const lang = useLang();
  const s = settings;
  const pos = s.imagePosition ?? "right";
  const eyebrow = pickLocalized(s.eyebrow, lang);
  const heading = pickLocalized(s.heading, lang);
  const body = pickLocalized(s.body, lang);
  const hasText = !!(eyebrow || heading || body);
  const styleProps = styleToProps(autoCompactStyle(s.style, hasText));
  const overlay = Math.max(0, Math.min(100, s.overlay ?? 35));
  // Backward-compatible: seed slides from legacy single `image` if no slides yet.
  const slides: { image: string; href?: string; alt?: string }[] =
    s.slides && s.slides.length > 0
      ? s.slides.filter((sl) => sl.image)
      : s.image
        ? [{ image: s.image, href: s.imageHref, alt: heading || "" }]
        : [];
  const interval = typeof s.intervalMs === "number"
    ? Math.max(0, Math.min(10000, s.intervalMs))
    : 2000;
  const aspect = s.aspectRatio ?? "16:9";
  const aspectClass =
    aspect === "1:1" ? "aspect-square" : aspect === "4:3" ? "aspect-[4/3]" : "aspect-[16/9]";
  const firstImage = slides[0]?.image;
  const renderMedia = (rounded = true) => {
    if (slides.length === 0) return null;
    if (slides.length === 1) {
      const sl = slides[0]!;
      const img = (
        <img src={sl.image} alt={sl.alt ?? heading ?? ""} className={`w-full ${aspectClass} object-cover ${rounded ? "rounded-2xl" : ""}`} />
      );
      return sl.href ? (
        <a href={sl.href} className="block h-full w-full">{img}</a>
      ) : img;
    }
    return (
      <PromoCarousel slides={slides} aspectClass={aspectClass} intervalMs={interval} />
    );
  };
  const ImageEl = slides.length > 0 ? renderMedia(true) : null;
  const Text = (
    <div>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent" style={tc(s.style, "eyebrowColor")}>
          {eyebrow}
        </p>
      )}
      {heading && (
        <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-primary md:text-4xl lg:text-5xl" style={tc(s.style, "headingColor")}>
          {heading}
        </h2>
      )}
      {body && (
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg" style={{ ...tc(s.style, "bodyColor"), ...ta(s.style) }}>
          {body}
        </p>
      )}
      <div className="mt-6">
        <CTAButton cta={s.cta} lang={lang} defaultStyle="primary" iconRight textStyle={tc(s.style, "ctaTextColor")} />
      </div>
    </div>
  );
  if (pos === "background") {
    return (
      <section className={styleProps.className} style={styleProps.inlineStyle}>
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="relative min-h-[360px] overflow-hidden rounded-2xl">
            {slides.length > 1 ? (
              <div className="absolute inset-0">
                <PromoCarousel slides={slides} aspectClass="h-full w-full" intervalMs={interval} />
              </div>
            ) : firstImage ? (
              <img src={firstImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${(overlay / 100).toFixed(2)})` }} />
            <div className="relative p-8 md:p-14 text-white">{Text}</div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className={`mx-auto max-w-[1280px] px-4 md:px-8 ${styleProps.className}`} style={styleProps.inlineStyle}>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {ImageEl ? (
          <>
            <div className={pos === "left" ? "order-1" : "order-1 lg:order-2"}>{ImageEl}</div>
            <div className={pos === "left" ? "order-2" : "order-2 lg:order-1"}>{Text}</div>
          </>
        ) : (
          <div className="lg:col-span-2">{Text}</div>
        )}
      </div>
    </section>
  );
}
