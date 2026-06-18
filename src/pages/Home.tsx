import { Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { ArrowRight, ArrowUpRight, MapPin, Mountain, Leaf, Users, Mail, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { supabase } from "@/integrations/supabase/client";
import { products, categoryOrder } from "@/data/products";
import hero from "@/assets/hero-mountain.jpg";
import catCarriers from "@/assets/cat-carriers.jpg";
import catTents from "@/assets/cat-tents.jpg";
import catApparel from "@/assets/cat-apparel.jpg";
import catFootwear from "@/assets/cat-footwear.jpg";
import catAccessories from "@/assets/cat-accessories.jpg";
import story from "@/assets/story.jpg";
import communityCleanup from "@/assets/community-cleanup.jpg";
import storyHiker from "@/assets/story-hiker.jpg";
import prodCenturion from "@/assets/prod-centurion.jpg";
import prodRaptor from "@/assets/prod-raptor.jpg";
import prodStratus from "@/assets/prod-stratus.jpg";
import prodTrailwind from "@/assets/prod-trailwind.jpg";

const SITE_URL = "https://consina-website.lovable.app";

const faqs = [
  {
    q: "What does Consina sell?",
    a: "Consina sells outdoor gear designed for Indonesian adventurers: backpack carriers (35L–100L), tents and shelters, technical apparel like jackets and pants, hiking footwear, and outdoor accessories such as bottles, headlamps, and trekking poles." },
  {
    q: "Where is Consina based?",
    a: "Consina is headquartered in Jakarta, Indonesia, and has been designing outdoor gear in the country since 1999." },
  {
    q: "Are Consina products made in Indonesia?",
    a: "Yes. Consina products are designed in Jakarta and locally crafted in Indonesia, then tested on trails across the archipelago." },
  {
    q: "How can I find a Consina store near me?",
    a: "Consina operates more than 80 retail stores across Indonesia. You can use the Store Locator at /stores to search by city, province, or region — from Jakarta to Bali, Sumatra to Sulawesi." },
  {
    q: "Does Consina have a community program?",
    a: "Yes. The 'Responsible Trekker' community brings together hikers, climbers, and campers across Indonesia who share one promise: leave the trail better than you found it." },
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
    addressCountry: "ID" },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "hello@consina.com",
      telephone: "+62-21-345-6789",
      areaServed: "ID" },
  ],
  sameAs: [
    "https://www.instagram.com/consinaindonesia",
    "https://www.facebook.com/consinaindonesia",
  ] };

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a } })) };


function catStats(filter: string) {
  const items = products.filter((p) => p.category === filter);
  const max = items.length ? Math.max(...items.map((i) => i.discount)) : 0;
  return { count: items.length, max };
}
const categories = [
  { name: "Carriers", slug: "carriers", filter: "Bags & Carriers", desc: "Backpacks 40–100L for every adventure", img: catCarriers },
  { name: "Tents & Shelter", slug: "tents", filter: "Tents & Shelter", desc: "From solo overnighters to group expeditions", img: catTents },
  { name: "Apparel", slug: "apparel", filter: "Apparel", desc: "Jackets, pants, and shirts for the trail", img: catApparel },
  { name: "Footwear", slug: "footwear", filter: "Footwear", desc: "Trekking shoes built for Indonesian terrain", img: catFootwear },
  { name: "Accessories", slug: "accessories", filter: "Camping & Cookware", desc: "Bottles, headlamps, compasses, and more", img: catAccessories },
] as const;

const bestsellers = [
  { name: "Centurion 60L Carrier", desc: "Less-contact back system for long expeditions", price: "IDR 1,850,000", img: prodCenturion },
  { name: "Raptor 45L Carrier", desc: "Day-to-weekend hiking companion", price: "IDR 1,250,000", img: prodRaptor },
  { name: "Stratus 2P Tent", desc: "Lightweight 2-person shelter, 4-season rated", price: "IDR 2,100,000", img: prodStratus },
  { name: "Trailwind Jacket", desc: "Wind-resistant, water-repellent shell", price: "IDR 850,000", img: prodTrailwind },
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
        <Hero />
        <BrandStory />
        <Categories />
        <FeaturedProducts />
        <Community />
        <StoreLocator />
        <FAQSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  const { t } = useTranslation();
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img
          src={hero}
          alt="Indonesian volcanic mountain at dawn"
          width={1920}
          height={1080}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-primary/30 to-background" />
      </div>
      <div className="mx-auto flex min-h-[62vh] max-w-[1280px] flex-col justify-center px-4 pb-16 pt-32 md:px-8 md:pb-24">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
          {t("home.hero.tagline")}
        </p>
        <h1 className="mt-5 max-w-4xl font-[Archivo] text-5xl font-black leading-[0.95] tracking-tight text-primary-foreground md:text-7xl lg:text-[88px]">
          {t("home.hero.title_1")} <em className="not-italic text-accent">{t("home.hero.title_em")}</em>
          <br />
          {t("home.hero.title_2")}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-primary-foreground/85 md:text-lg">
          {t("home.hero.subtitle")}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            to="/catalog"
            className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wider text-accent-foreground transition hover:bg-accent/90"
          >
            {t("cta.explore_collection")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/stores"
            className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-primary-foreground/10"
          >
            {t("cta.find_store")}
          </Link>
        </div>
        <div className="mt-16 grid max-w-2xl grid-cols-3 gap-6 border-t border-primary-foreground/20 pt-6 text-[#1a3a2e]">
          {[
            ["25+", t("home.hero.stat_years")],
            ["150+", t("home.hero.stat_stores")],
            ["100%", t("home.hero.stat_local")],
          ].map(([n, l]) => (
            <div key={l}>
              <div className="font-[Archivo] text-2xl font-bold text-[#1a3a2e] md:text-3xl">{n}</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-[#1a3a2e]">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Brand Story ---------- */
function BrandStory() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const textWrapRef = useRef<HTMLDivElement>(null);

  const paragraphs = [
    t("home.story.p1"),
    t("home.story.p2"),
    t("home.story.p3"),
  ].filter(Boolean);

  const first = paragraphs[0] ?? "";
  const rest = paragraphs.slice(1);

  const handleToggle = () => {
    if (expanded && textWrapRef.current) {
      textWrapRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    setExpanded((v) => !v);
  };

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-12 lg:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* LEFT COLUMN — Image */}
        <div className="order-1">
          <div className="overflow-hidden rounded-2xl">
            <img
              src={storyHiker}
              alt="Hiker on an Indonesian mountain trail"
              width={1024}
              height={1280}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* RIGHT COLUMN — Text */}
        <div className="order-2" ref={textWrapRef}>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
            {t("home.story.eyebrow")}
          </p>
          <h2 className="mt-4 font-[Archivo] text-4xl font-black leading-[1.05] tracking-tight text-primary md:text-5xl">
            {t("home.story.title")}
          </h2>

          <div className="relative mt-6 md:mt-8">
            {/* Constrained width for comfortable reading */}
            <div className="max-w-prose">
              {/* Always-visible first paragraph */}
              <p className="text-base leading-[1.75] text-foreground/80 md:text-lg">
                {first}
              </p>

              {/* Collapsible remaining paragraphs */}
              <div
                className="grid transition-[grid-template-rows] duration-500 ease-out"
                style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="mt-5 space-y-5 text-base leading-[1.75] text-foreground/80 md:text-lg">
                    {rest.map((p, i) => (
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
                  Lebih Sedikit <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Lebih Detail <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-secondary"
          >
            {t("cta.learn_more")} <span className="text-base">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- Categories ---------- */
function Categories() {
  const { t } = useTranslation();
  const localizedCategories = categories.map((c) => ({
    ...c,
    name: t(`categories.${c.slug}` as const),
    desc: t(`home.categories.${c.slug}_desc` as const) }));
  return (
    <section className="bg-background py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Section heading */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a84c]">
            {t("home.categories.eyebrow")}
          </p>
          <h2 className="mt-3 font-[Archivo] text-4xl font-black leading-tight tracking-tight text-primary md:text-5xl">
            {t("home.categories.title")}
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            {t("home.categories.subtitle")}
          </p>
        </div>

        {/* Cards grid */}
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {localizedCategories.map((cat) => (
            <CategoryCard key={cat.slug} cat={cat} />
          ))}
        </div>
      </div>
    </section>
  );
}

type CategoryItem = {
  slug: (typeof categories)[number]["slug"];
  filter: string;
  img: string;
  name: string;
  desc: string;
};

function CategoryCard({ cat }: { cat: CategoryItem }) {
  const { t } = useTranslation();
  const stats = catStats(cat.filter);
  return (
    <Link
      to={`/${cat.slug}`}
      className="group flex aspect-square flex-col overflow-hidden rounded-xl border border-[#d4b896] bg-background transition duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      {/* Image area — top 60% */}
      <div className="relative h-[60%] overflow-hidden">
        <img
          src={cat.img}
          alt={cat.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {stats.max > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-[#1a3a2e] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            {t("labels.up_to_off", { percent: stats.max })}
          </span>
        )}
      </div>

      {/* Text area — bottom 40% */}
      <div className="flex h-[40%] flex-col justify-between p-4">
        <div>
          <h3 className="font-[Archivo] text-lg font-bold tracking-tight text-primary">
            {cat.name}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {cat.desc}{stats.count ? ` · ${stats.count} ${t("labels.items")}` : ""}
          </p>
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#1a3a2e] transition group-hover:gap-2">
          {t("cta.explore")} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

/* ---------- Featured Products ---------- */
function FeaturedProducts() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
      {/* Section heading */}
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a84c]">
          {t("home.featured.eyebrow")}
        </p>
        <h2 className="mt-3 font-[Archivo] text-4xl font-black leading-tight tracking-tight text-primary md:text-5xl">
          {t("home.featured.title")}
        </h2>
      </div>

      {/* Product grid */}
      <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {bestsellers.map((p) => (
          <div key={p.name} className="group">
            {/* Image — 4:5 aspect ratio */}
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
              <img
                src={p.img}
                alt={p.name}
                width={800}
                height={1000}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            {/* Text */}
            <div className="mt-4">
              <h3 className="font-[Archivo] text-base font-bold leading-snug text-primary">
                {p.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {p.desc}
              </p>
              <p className="mt-2 text-sm font-semibold text-primary">
                {p.price}
              </p>
              <Link
                to="/catalog"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#1a3a2e] transition group-hover:gap-2"
              >
                {t("cta.view_details")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Community ---------- */
function Community() {
  const { t } = useTranslation();
  return (
    <section className="bg-[#1a3a2e]">
      <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-4 py-24 md:grid-cols-2 md:px-8 md:py-32">
        {/* LEFT COLUMN — Text */}
        <div className="order-2 md:order-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#d4b896]">
            {t("home.community.eyebrow")}
          </p>
          <h2 className="mt-4 font-[Archivo] text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">
            {t("home.community.title")}
          </h2>
          <div className="mt-8 space-y-5 text-base leading-relaxed text-white/85 md:text-lg">
            <p>{t("home.community.p1")}</p>
            <p>{t("home.community.p2")}</p>
          </div>
          <Link
            to="/"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#d4b896] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-[#1a3a2e] transition hover:bg-[#c9a84c]"
          >
            {t("cta.join_community")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* RIGHT COLUMN — Image (desktop only) */}
        <div className="order-1 md:order-2">
          <div className="overflow-hidden rounded-2xl">
            <img
              src={communityCleanup}
              alt="Group of hikers cleaning up a trail"
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

/* ---------- Store Locator ---------- */
function StoreLocator() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">{t("home.store_locator.eyebrow")}</p>
          <h2 className="mt-3 font-[Archivo] text-4xl font-black leading-tight tracking-tight text-primary md:text-5xl">
            {t("home.store_locator.title")}
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            {t("home.store_locator.subtitle")}
          </p>
          <Link
            to="/stores"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-secondary"
          >
            <MapPin className="h-4 w-4" /> {t("cta.all_stores")}
          </Link>
        </div>
        <div className="lg:col-span-7">
          <ul className="divide-y divide-border border-y border-border">
            {stores.map((s) => (
              <li key={s.city} className="group grid grid-cols-[auto_1fr_auto] items-center gap-6 py-5">
                <span className="font-[Archivo] text-2xl font-black tracking-tight text-primary md:text-3xl">
                  {s.city}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.addr}</p>
                  <p className="text-xs text-muted-foreground">{s.phone}</p>
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
function ContactSection() {
  return <ContactSectionInner />;
}

/* ---------- FAQ ---------- */
function FAQSection() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-background py-24 md:py-32" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a84c]">{t("home.faq.eyebrow")}</p>
          <h2
            id="faq-heading"
            className="mt-3 font-[Archivo] text-4xl font-black leading-tight tracking-tight text-primary md:text-5xl"
          >
            {t("home.faq.title")}
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            {t("home.faq.subtitle")}
          </p>
        </div>

        <ul className="mt-12 divide-y divide-border border-y border-border">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <li key={f.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <h3 className="font-[Archivo] text-base font-bold text-primary md:text-lg">
                    {f.q}
                  </h3>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-primary transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="pb-5 pr-10 text-sm leading-relaxed text-muted-foreground md:text-base">
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

function ContactSectionInner() {
  const { t } = useTranslation();
  const subjects = [
    t("home.contact.subject_product"),
    t("home.contact.subject_wholesale"),
    t("home.contact.subject_press"),
    t("home.contact.subject_career"),
    t("home.contact.subject_other"),
  ];
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<string>(subjects[0]);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const resetForm = () => {
    setFullName(""); setEmail(""); setSubject(subjects[0]); setMessage("");
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
      full_name: name, email: mail, subject, message: msg });
    if (error) {
      setStatus("error");
      setErrorMsg(t("home.contact.submit_error"));
      return;
    }
    resetForm();
    setStatus("success");
  };

  return (
    <section className="bg-muted/60 py-24 md:py-32">
      <div className="mx-auto grid max-w-[1280px] gap-14 px-4 md:grid-cols-2 md:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">{t("home.contact.eyebrow")}</p>
          <h2 className="mt-3 font-[Archivo] text-4xl font-black leading-tight tracking-tight text-primary md:text-5xl">
            {t("home.contact.title_1")}<br />{t("home.contact.title_2")}
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            {t("home.contact.subtitle")}
          </p>
          <div className="mt-10 space-y-4 text-sm">
            <div className="flex items-center gap-3 text-foreground">
              <Mail className="h-4 w-4 text-secondary" /> hello@consina.com
            </div>
            <div className="flex items-center gap-3 text-foreground">
              <Phone className="h-4 w-4 text-secondary" /> +62 21 345 6789
            </div>
            <div className="flex items-center gap-3 text-foreground">
              <MapPin className="h-4 w-4 text-secondary" /> Jakarta, Indonesia
            </div>
          </div>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-sm border border-border bg-background p-6 md:p-8"
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
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
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
          >
            {status === "submitting" ? t("cta.sending") : t("cta.send_message")} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
  );
}

function Field({
  label, id, type = "text", value, onChange }: {
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
