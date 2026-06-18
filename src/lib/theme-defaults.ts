// Default theme tokens (mirror src/styles.css :root values for the core set
// the Design editor can override).

export type ThemeSettings = {
  colors: {
    background: string;
    foreground: string;
    primary: string;
    accent: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  customFonts: CustomFont[];
  header: HeaderSettings;
  footer: FooterSettings;
};

export type CustomFont = {
  id: string;
  name: string;     // family name used in CSS (also the value selectable in dropdown)
  url: string;      // public URL of the font file
  format: "woff2" | "woff" | "truetype" | "opentype";
};

export type HeaderSettings = {
  logoText: string;
  logoUrl: string;
  bgColor: string; // empty => default (var(--background))
  linkColor: string; // empty => default
  showSinceTag: boolean;
  showSearch: boolean;
  showFindStore: boolean;
  showWishlist: boolean;
  showAccount: boolean;
  navLinks: NavLink[];
};

export type NavLink = {
  labelId: string;
  labelEn: string;
  href: string;
};

export type FooterSettings = {
  tagline: { id: string; en: string };
  blurb: { id: string; en: string };
  bgColor: string; // empty => default (var(--primary))
  textColor: string;
  taglineColor: string; // empty => default accent
  headingColor: string; // empty => default accent (column headings)
  linkColor: string;    // empty => inherits textColor
  logoUrl: string;       // optional dark/colored logo
  logoLightUrl: string;  // optional light/white logo for dark footers
  socials: { instagram: string; facebook: string; youtube: string };
  columns: FooterColumn[];
  legalLinks: NavLink[];
};

export type FooterColumn = {
  titleId: string;
  titleEn: string;
  items: NavLink[];
};

export const DEFAULT_HEADER: HeaderSettings = {
  logoText: "CONSINA",
  logoUrl: "",
  bgColor: "",
  linkColor: "",
  showSinceTag: true,
  showSearch: true,
  showFindStore: true,
  showWishlist: true,
  showAccount: true,
  navLinks: [
    { labelId: "Katalog", labelEn: "Catalog", href: "/catalog" },
    { labelId: "Toko", labelEn: "Stores", href: "/stores" },
    { labelId: "Cerita", labelEn: "Story", href: "/" },
  ],
};

export const DEFAULT_FOOTER: FooterSettings = {
  tagline: { id: "Outdoor Sejak 1999", en: "Outdoor Since 1999" },
  blurb: {
    id: "Perlengkapan untuk pendaki, penjelajah, pemanjat, dan pelari yang menjadikan Indonesia sebagai medan bermain.",
    en: "Gear for hikers, campers, climbers and runners who call Indonesia their playground.",
  },
  bgColor: "",
  textColor: "",
  taglineColor: "",
  headingColor: "",
  linkColor: "",
  logoUrl: "",
  logoLightUrl: "",
  socials: { instagram: "#", facebook: "#", youtube: "#" },
  columns: [
    {
      titleId: "Perusahaan",
      titleEn: "Company",
      items: [
        { labelId: "Cerita Kami", labelEn: "Our Story", href: "/" },
        { labelId: "Responsible Trekker", labelEn: "Responsible Trekker", href: "/" },
        { labelId: "Keberlanjutan", labelEn: "Sustainability", href: "/" },
        { labelId: "Karir", labelEn: "Careers", href: "/" },
        { labelId: "Pers", labelEn: "Press", href: "/" },
      ],
    },
    {
      titleId: "Bantuan",
      titleEn: "Support",
      items: [
        { labelId: "Lokasi Toko", labelEn: "Store Locator", href: "/stores" },
        { labelId: "Garansi", labelEn: "Warranty", href: "/" },
        { labelId: "Panduan Perawatan", labelEn: "Care Guides", href: "/" },
        { labelId: "Kontak", labelEn: "Contact", href: "/" },
        { labelId: "FAQ", labelEn: "FAQ", href: "/" },
      ],
    },
  ],
  legalLinks: [
    { labelId: "Privasi", labelEn: "Privacy", href: "/" },
    { labelId: "Ketentuan", labelEn: "Terms", href: "/" },
    { labelId: "Cookies", labelEn: "Cookies", href: "/" },
  ],
};

export const DEFAULT_THEME: ThemeSettings = {
  colors: {
    background: "oklch(0.975 0.012 90)",
    foreground: "oklch(0.18 0.005 60)",
    primary: "oklch(0.30 0.045 155)",
    accent: "oklch(0.80 0.055 80)",
  },
  fonts: {
    heading: "Space Grotesk",
    body: "Inter",
  },
  customFonts: [],
  header: DEFAULT_HEADER,
  footer: DEFAULT_FOOTER,
};

export const FONT_OPTIONS: { value: string; label: string; googleFamily: string }[] = [
  { value: "Archivo", label: "Archivo", googleFamily: "Archivo:wght@600;700;800;900" },
  { value: "Inter", label: "Inter", googleFamily: "Inter:wght@400;500;600;700" },
  { value: "Playfair Display", label: "Playfair Display", googleFamily: "Playfair+Display:wght@600;700;800" },
  { value: "Space Grotesk", label: "Space Grotesk", googleFamily: "Space+Grotesk:wght@500;600;700;900" },
  { value: "DM Sans", label: "DM Sans", googleFamily: "DM+Sans:wght@400;500;700" },
  { value: "Fraunces", label: "Fraunces", googleFamily: "Fraunces:wght@500;600;700;800" },
  { value: "Manrope", label: "Manrope", googleFamily: "Manrope:wght@400;500;600;700" },
  { value: "Work Sans", label: "Work Sans", googleFamily: "Work+Sans:wght@400;500;600;700" },
];

export function googleFontHref(theme: ThemeSettings): string {
  const wanted = new Set<string>();
  const customNames = new Set((theme.customFonts ?? []).map((f) => f.name));
  for (const family of [theme.fonts.heading, theme.fonts.body]) {
    if (customNames.has(family)) continue;
    const opt = FONT_OPTIONS.find((o) => o.value === family);
    if (opt) wanted.add(opt.googleFamily);
  }
  if (wanted.size === 0) return "";
  return `https://fonts.googleapis.com/css2?${Array.from(wanted)
    .map((f) => `family=${f}`)
    .join("&")}&display=optional`;
}

// Merge any partial settings stored in DB into the defaults.
export function mergeTheme(partial: unknown): ThemeSettings {
  const p = (partial ?? {}) as Partial<ThemeSettings>;
  const rawCustom = (p as { customFonts?: unknown }).customFonts;
  const customFonts: CustomFont[] = Array.isArray(rawCustom)
    ? (rawCustom as CustomFont[]).filter(
        (f) => f && typeof f.name === "string" && typeof f.url === "string",
      )
    : [];
  const partialHeader = (p as { header?: Partial<HeaderSettings> }).header ?? {};
  const partialFooter = (p as { footer?: Partial<FooterSettings> }).footer ?? {};
  const header: HeaderSettings = {
    ...DEFAULT_HEADER,
    ...partialHeader,
    navLinks: Array.isArray(partialHeader.navLinks)
      ? (partialHeader.navLinks as NavLink[])
      : DEFAULT_HEADER.navLinks,
  };
  const footer: FooterSettings = {
    ...DEFAULT_FOOTER,
    ...partialFooter,
    tagline: { ...DEFAULT_FOOTER.tagline, ...(partialFooter.tagline ?? {}) },
    blurb: { ...DEFAULT_FOOTER.blurb, ...(partialFooter.blurb ?? {}) },
    socials: { ...DEFAULT_FOOTER.socials, ...(partialFooter.socials ?? {}) },
    columns: Array.isArray(partialFooter.columns)
      ? (partialFooter.columns as FooterColumn[])
      : DEFAULT_FOOTER.columns,
    legalLinks: Array.isArray(partialFooter.legalLinks)
      ? (partialFooter.legalLinks as NavLink[])
      : DEFAULT_FOOTER.legalLinks,
  };
  return {
    colors: { ...DEFAULT_THEME.colors, ...(p.colors ?? {}) },
    fonts: { ...DEFAULT_THEME.fonts, ...(p.fonts ?? {}) },
    customFonts,
    header,
    footer,
  };
}

export function themeToCss(theme: ThemeSettings): string {
  const c = theme.colors;
  const faces = (theme.customFonts ?? [])
    .map(
      (f) =>
        `@font-face{font-family:"${escapeCss(f.name)}";src:url("${escapeCssUrl(f.url)}") format("${f.format}");font-display:swap;font-weight:100 900;font-style:normal;}`,
    )
    .join("");
  return `${faces}:root{--background:${c.background};--foreground:${c.foreground};--primary:${c.primary};--ring:${c.primary};--accent:${c.accent};}
body{font-family:"${theme.fonts.body}",ui-sans-serif,system-ui,sans-serif;}
h1,h2,h3,h4{font-family:"${theme.fonts.heading}","${theme.fonts.body}",ui-sans-serif,system-ui,sans-serif;}`;
}

function escapeCss(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}
function escapeCssUrl(s: string): string {
  return s.replace(/["\\)]/g, encodeURIComponent);
}

export function fontFormatFromUrl(url: string): CustomFont["format"] {
  const ext = (url.split("?")[0].split(".").pop() || "").toLowerCase();
  if (ext === "woff2") return "woff2";
  if (ext === "woff") return "woff";
  if (ext === "otf") return "opentype";
  return "truetype";
}