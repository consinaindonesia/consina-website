import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, Search, MapPin, ChevronDown, Heart, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LangSuggestionBanner } from "./LangSuggestionBanner";
import { AnnouncementBar } from "./AnnouncementBar";
import { CartDrawer } from "./CartDrawer";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useWishlist } from "@/lib/wishlist-store";
import { usePublicCategories, type PublicCategory } from "@/hooks/use-public-categories";
import { useLang } from "@/i18n/LangProvider";
import { localizedField } from "@/i18n/format";
import { useSiteSettings } from "@/hooks/use-site-settings";

export function Nav() {
  const { t } = useTranslation();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [mobileShopOpen, setMobileShopOpen] = useState(false);
  const { data: categories, isLoading: catsLoading } = usePublicCategories();
  const { user } = useCustomerAuth();
  const { count: wishCount } = useWishlist(user?.id ?? null);
  const site = useSiteSettings();
  const header = site.header;
  const linkStyle = header.linkColor ? { color: header.linkColor } : undefined;
  // Always use a solid surface color for overlay dropdowns so they remain
  // readable regardless of the header's own background (which the user may
  // have set to a translucent or image-backed value).
  const dropdownStyle: React.CSSProperties = {
    backgroundColor: "var(--background)",
  };

  // Auto-hide on scroll-down, reveal on scroll-up. Always shown near top.
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY.current;
        if (y < 80) setHidden(false);
        else if (dy > 6) setHidden(true);
        else if (dy < -6) setHidden(false);
        lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keep header visible while a menu is open.
  const isHidden = hidden && !open && !mobileShopOpen;

  const catLabel = (c: PublicCategory) => localizedField(c, "name", lang).value;

  // Recursive child renderer — supports arbitrary nesting depth.
  const renderDesktopChildren = (children: PublicCategory[], depth: number) => (
    <div className={depth === 1 ? "ml-2 border-l border-border" : "ml-3 border-l border-border/60"}>
      {children.map((sub) => (
        <div key={sub.id}>
          <Link
            to={"/c/$slug" as never}
            params={{ slug: sub.slug } as never}
            className="block px-4 py-2 text-xs font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-primary"
          >
            {catLabel(sub)}
          </Link>
          {sub.children.length > 0 && renderDesktopChildren(sub.children, depth + 1)}
        </div>
      ))}
    </div>
  );

  const renderMobileChildren = (children: PublicCategory[], depth: number) => (
    <>
      {children.map((sub) => (
        <div key={sub.id} className="flex flex-col">
          <Link
            to={"/c/$slug" as never}
            params={{ slug: sub.slug } as never}
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-muted hover:text-primary"
            style={{ marginLeft: depth * 12 }}
          >
            {catLabel(sub)}
          </Link>
          {sub.children.length > 0 && renderMobileChildren(sub.children, depth + 1)}
        </div>
      ))}
    </>
  );

  const mainLinks = (header.navLinks && header.navLinks.length > 0
    ? header.navLinks.map((l, i) => ({
        key: `${l.href}-${i}`,
        to: l.href || "/",
        label: (lang === "en" ? l.labelEn : l.labelId) || l.labelEn || l.labelId || "",
      }))
    : [
        { key: "catalog", to: "/catalog", label: t("nav.catalog") },
        { key: "stores", to: "/stores", label: t("nav.stores") },
        { key: "story", to: "/", label: t("nav.story") },
      ]
  ).filter((l) => l.label);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-border/60 transition-transform duration-300 ease-out ${
        isHidden ? "-translate-y-full" : "translate-y-0"
      }`}
      style={{ backgroundColor: header.bgColor || "var(--background)" }}
    >
      <AnnouncementBar />
      <LangSuggestionBanner />
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center gap-2">
          {header.logoUrl ? (
            <img
              src={header.logoUrl}
              alt={header.logoText || "CONSINA"}
              className="h-8 w-auto object-contain md:h-9"
            />
          ) : (
            <span className="text-2xl font-black tracking-tight text-primary">
              {header.logoText || "CONSINA"}
            </span>
          )}
          {header.showSinceTag && (
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground md:inline">
              {t("nav.since")}
            </span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 lg:flex">
          {/* Shop dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setShopOpen(true)}
            onMouseLeave={() => setShopOpen(false)}
          >
            <button
              className="flex items-center gap-1 text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
              aria-expanded={shopOpen}
              aria-haspopup="true"
              style={linkStyle}
            >
              {t("nav.shop")}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${shopOpen ? "rotate-180" : ""}`} />
            </button>
            {shopOpen && (
              <div
                className="absolute -left-4 top-full min-w-[200px] rounded-xl border border-border py-2 shadow-xl"
                style={dropdownStyle}
              >
                {catsLoading ? (
                  <div className="space-y-2 px-4 py-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-4 w-32 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : !categories || categories.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-muted-foreground">
                    {t("nav.no_categories", { defaultValue: "No categories" })}
                  </div>
                ) : (
                  categories.map((cat) => (
                    <div key={cat.id}>
                      <Link
                        to={"/c/$slug" as never}
                        params={{ slug: cat.slug } as never}
                        className="block px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
                      >
                        {catLabel(cat)}
                      </Link>
                      {cat.children.length > 0 && renderDesktopChildren(cat.children, 1)}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {mainLinks.map((l) => (
            <Link
              key={l.key}
              to={l.to as never}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
              style={linkStyle}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <CartDrawer />
          {header.showWishlist && <Link
            to="/wishlist"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-muted hover:text-primary"
            aria-label="Wishlist"
          >
            <Heart className="h-4 w-4" />
            {wishCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {wishCount}
              </span>
            )}
          </Link>}
          {header.showAccount && <Link
            to={user ? "/akun" : "/auth"}
            className="hidden h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-muted hover:text-primary md:flex"
            aria-label={user ? "Akun saya" : "Masuk"}
          >
            <User className="h-4 w-4" />
          </Link>}
          <LanguageSwitcher className="hidden md:inline-flex" menuBg={header.bgColor} />
          {header.showSearch && <button className="hidden h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-muted hover:text-primary md:flex" aria-label={t("nav.search")}>
            <Search className="h-4 w-4" />
          </button>}
          {header.showFindStore && <Link
            to="/stores"
            className="hidden items-center gap-1.5 rounded-full border border-primary/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground md:inline-flex"
          >
            <MapPin className="h-3.5 w-3.5" />
            {t("nav.find_store")}
          </Link>}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label={t("nav.menu")}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <nav className="mx-auto flex max-w-[1280px] flex-col gap-1 px-4 py-4">
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t("nav.home")}
            </Link>

            {/* Mobile Shop accordion */}
            <button
              onClick={() => setMobileShopOpen(!mobileShopOpen)}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <span>{t("nav.shop")}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${mobileShopOpen ? "rotate-180" : ""}`} />
            </button>
            {mobileShopOpen && (
              <div className="ml-4 flex flex-col gap-1 border-l border-border pl-3">
                {(categories ?? []).map((cat) => (
                  <div key={cat.id} className="flex flex-col">
                    <Link
                      to={"/c/$slug" as never}
                      params={{ slug: cat.slug } as never}
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-primary"
                    >
                      {catLabel(cat)}
                    </Link>
                    {cat.children.length > 0 && renderMobileChildren(cat.children, 1)}
                  </div>
                ))}
              </div>
            )}

            {mainLinks.map((l) => (
              <Link
                key={l.key}
                to={l.to as never}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            <Link to="/wishlist" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
              Wishlist{wishCount > 0 ? ` (${wishCount})` : ""}
            </Link>
            <Link to={user ? "/akun" : "/auth"} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
              {user ? "Akun Saya" : "Masuk / Daftar"}
            </Link>
            <div className="mt-2 px-3">
              <LanguageSwitcher />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
