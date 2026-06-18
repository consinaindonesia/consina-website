import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, Youtube } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { usePublicCategories } from "@/hooks/use-public-categories";
import { useLang } from "@/i18n/LangProvider";
import { localizedField } from "@/i18n/format";
import { useSiteSettings } from "@/hooks/use-site-settings";

export function Footer() {
  const { t } = useTranslation();
  const lang = useLang();
  const { data: categories } = usePublicCategories();
  const site = useSiteSettings();
  const footer = site.footer;
  const footerLogo = footer.logoLightUrl || footer.logoUrl || site.header.logoUrl || "";
  // Use the saved footer fields directly so admin edits always win.
  // Only fall back to the i18n string when the saved value is undefined
  // (never set). Explicit empty string => render empty (intentional clear).
  const taglineRaw = lang === "en" ? footer.tagline.en : footer.tagline.id;
  const blurbRaw = lang === "en" ? footer.blurb.en : footer.blurb.id;
  const tagline = typeof taglineRaw === "string" ? taglineRaw : t("footer.tagline");
  const blurb = typeof blurbRaw === "string" ? blurbRaw : t("footer.blurb");
  const taglineStyle = footer.taglineColor ? { color: footer.taglineColor } : undefined;
  const headingStyle = footer.headingColor ? { color: footer.headingColor } : undefined;
  const linkStyle = footer.linkColor ? { color: footer.linkColor } : undefined;
  const shopLinks = (categories ?? []).map((c) => ({
    label: localizedField(c, "name", lang).value,
    slug: c.slug,
  }));
  const pickLabel = (id: string, en: string) =>
    (lang === "en" ? en : id) || en || id || "";
  const cols = (footer.columns ?? []).map((c) => ({
    title: pickLabel(c.titleId, c.titleEn),
    items: (c.items ?? []).map((it) => ({
      label: pickLabel(it.labelId, it.labelEn),
      href: it.href || "/",
    })).filter((x) => x.label),
  })).filter((c) => c.title || c.items.length > 0);
  const legalLinks = (footer.legalLinks ?? []).map((it) => ({
    label: pickLabel(it.labelId, it.labelEn),
    href: it.href || "/",
  })).filter((x) => x.label);

  return (
    <footer
      className="mt-24 border-t border-border bg-primary text-primary-foreground"
      style={{
        ...(footer.bgColor ? { backgroundColor: footer.bgColor } : {}),
        ...(footer.textColor ? { color: footer.textColor } : {}),
      }}
    >
      <div className="mx-auto max-w-[1280px] px-4 py-16 md:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link to="/" aria-label={site.header.logoText || "CONSINA"} className="inline-block">
              {footerLogo ? (
                <img
                  src={footerLogo}
                  alt={site.header.logoText || "CONSINA"}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <div className="text-3xl font-black tracking-tight">
                  {site.header.logoText || "CONSINA"}
                </div>
              )}
            </Link>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.25em] text-accent" style={taglineStyle}>
              {tagline}
            </p>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-primary-foreground/70" style={linkStyle}>
              {blurb}
            </p>
            <div className="mt-6 flex gap-3">
              {([
                { Icon: Instagram, href: footer.socials.instagram, label: "Instagram" },
                { Icon: Facebook, href: footer.socials.facebook, label: "Facebook" },
                { Icon: Youtube, href: footer.socials.youtube, label: "YouTube" },
              ] as const)
                .filter((s) => s.href && s.href !== "")
                .map(({ Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-foreground/20 text-primary-foreground transition hover:border-accent hover:text-accent"
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent" style={headingStyle}>
              {t("footer.shop")}
            </h4>
            <ul className="mt-5 space-y-3">
              {shopLinks.map((l) => (
                <li key={l.slug}>
                  <Link
                    to={"/c/$slug" as never}
                    params={{ slug: l.slug } as never}
                    className="text-sm text-primary-foreground/75 transition hover:text-primary-foreground"
                    style={linkStyle}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent" style={headingStyle}>
                {c.title}
              </h4>
              <ul className="mt-5 space-y-3">
                {c.items.map((i, idx) => (
                  <li key={`${i.label}-${idx}`}>
                    <a href={i.href} className="text-sm text-primary-foreground/75 transition hover:text-primary-foreground" style={linkStyle}>
                      {i.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-primary-foreground/10 pt-6 text-xs text-primary-foreground/55 md:flex-row md:items-center md:justify-between">
          <span>{t("footer.copyright", { year: new Date().getFullYear() })}</span>
          <div className="flex flex-wrap items-center gap-5">
            {legalLinks.map((l, i) => (
              <a key={`${l.label}-${i}`} href={l.href} style={linkStyle}>{l.label}</a>
            ))}
            <LanguageSwitcher className="ml-auto" />
          </div>
        </div>
      </div>
    </footer>
  );
}