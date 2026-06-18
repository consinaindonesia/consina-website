import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Bell,
  Clock,
  ExternalLink,
  Folder,
  Tag,
  Globe,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  BookOpen,
  Package,
  Search,
  User as UserIcon,
  Users,
  X,
  BellRing,
  ShoppingBag,
  Truck,
  Ruler,
  Ticket,
  Palette,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { supabase } from "@/integrations/supabase/client";

type NavItem = {
  label: string;
  to: string;
  icon: typeof LayoutGrid;
  adminOnly?: boolean;
  badge?: "inquiries";
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/admin", icon: LayoutGrid },
  { label: "Design", to: "/admin/design", icon: Palette },
  { label: "Products", to: "/admin/products", icon: Package },
  { label: "Categories", to: "/admin/categories", icon: Folder },
  { label: "Attributes", to: "/admin/attributes", icon: Tag },
  { label: "Size guides", to: "/admin/size-guides", icon: Ruler },
  { label: "Inquiries", to: "/admin/inquiries", icon: MessageSquare, badge: "inquiries" },
  { label: "Orders", to: "/admin/orders", icon: ShoppingBag },
  { label: "Vouchers", to: "/admin/vouchers", icon: Ticket, adminOnly: true },
  { label: "Customers", to: "/admin/customers", icon: UserIcon },
  { label: "Restock alerts", to: "/admin/restocks", icon: BellRing },
  { label: "Stores", to: "/admin/stores", icon: MapPin },
  { label: "Shipping", to: "/admin/shipping", icon: Truck, adminOnly: true },
  { label: "Languages", to: "/admin/languages", icon: Globe },
  { label: "Glossary", to: "/admin/glossary", icon: BookOpen },
  { label: "Users", to: "/admin/users", icon: Users, adminOnly: true },
  { label: "Notifications", to: "/admin/settings/notifications", icon: Bell, adminOnly: true },
  { label: "Activity Log", to: "/admin/activity", icon: Clock, adminOnly: true },
];

const SIDEBAR_BG = "#2a1a3a";
const SIDEBAR_HOVER = "rgba(255,255,255,0.06)";
const SIDEBAR_ACTIVE = "rgba(255,255,255,0.10)";
const ACCENT = "#d4b896";

function useNewInquiryCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { count: c } = await supabase
        .from("inquiries")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (!cancelled) setCount(c ?? 0);
    };
    void load();
    const channel = supabase
      .channel("admin-inquiries-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, () => void load())
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);
  return count;
}

type Prefs = {
  notification_email_scope: "all" | "assigned" | "none";
  browser_notifications_enabled: boolean;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
};

function isInQuietHours(p: Prefs, now = new Date()) {
  const s = p.quiet_hours_start;
  const e = p.quiet_hours_end;
  if (s == null || e == null || s === e) return false;
  const h = now.getHours();
  if (s < e) return h >= s && h < e;
  // crosses midnight (e.g. 22 → 7)
  return h >= s || h < e;
}

function useNewInquiryToasts(adminId: string | null, navigate: ReturnType<typeof useNavigate>) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    if (!adminId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("admin_users")
        .select(
          "notification_email_scope, browser_notifications_enabled, quiet_hours_start, quiet_hours_end"
        )
        .eq("id", adminId)
        .maybeSingle();
      if (!cancelled && data) setPrefs(data as Prefs);
    })();
    return () => {
      cancelled = true;
    };
  }, [adminId]);

  useEffect(() => {
    if (!prefs || !prefs.browser_notifications_enabled) return;
    const channel = supabase
      .channel("admin-inquiries-toast")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiries" },
        (payload) => {
          if (isInQuietHours(prefs)) return;
          const row = payload.new as { id: string; customer_name: string };
          toast(`New inquiry from ${row.customer_name}`, {
            action: {
              label: "View",
              onClick: () =>
                navigate({ to: "/admin/inquiries/$id", params: { id: row.id } }),
            },
          });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [prefs, navigate]);
}

function buildCrumbs(pathname: string): { label: string; to?: string }[] {
  const parts = pathname.split("/").filter(Boolean); // ["admin", "products", ...]
  if (parts[0] !== "admin") return [];
  const crumbs: { label: string; to?: string }[] = [{ label: "Dashboard", to: "/admin" }];
  let acc = "/admin";
  for (let i = 1; i < parts.length; i++) {
    acc += "/" + parts[i];
    const seg = parts[i].replace(/-/g, " ");
    const label = seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({ label, to: i === parts.length - 1 ? undefined : acc });
  }
  return crumbs;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { loading, session, profile } = useAdminAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const newInquiries = useNewInquiryCount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useNewInquiryToasts(profile?.id ?? null, navigate);

  // Global tab title badge ("Consina Admin (3 new)")
  useEffect(() => {
    if (typeof document === "undefined") return;
    const base = document.title.replace(/\s*\(\d+\s+new\)\s*$/, "");
    document.title = newInquiries > 0 ? `${base} (${newInquiries} new)` : base;
  }, [newInquiries]);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/admin/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="text-sm">Signed in, but this account isn't registered as a Consina admin.</p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/admin/login" });
            }}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  };

  const visibleItems = NAV_ITEMS.filter((i) => !i.adminOnly || profile.role === "admin");
  const crumbs = buildCrumbs(pathname);
  const initials = (profile.full_name ?? profile.email)
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const Sidebar = (
    <aside
      className="flex h-full w-[240px] flex-col text-white"
      style={{ backgroundColor: SIDEBAR_BG }}
    >
      <div className="flex items-center justify-between px-5 py-5">
        <Link to="/admin" className="block">
          <div className="text-xl font-black tracking-tight">CONSINA</div>
          <div
            className="mt-0.5 text-[10px] font-semibold tracking-[0.3em]"
            style={{ color: ACCENT }}
          >
            ADMIN
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden rounded p-1 hover:bg-white/10"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-2">
          {visibleItems.map((item) => {
            const active =
              item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
            const Icon = item.icon;
            const badgeCount = item.badge === "inquiries" ? newInquiries : 0;
            return (
              <li key={item.to} className="relative">
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r"
                    style={{ backgroundColor: ACCENT }}
                  />
                )}
                <Link
                  to={item.to}
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors duration-200"
                  style={{
                    backgroundColor: active ? SIDEBAR_ACTIVE : "transparent",
                    fontWeight: active ? 700 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = SIDEBAR_HOVER;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {badgeCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
            style={{ backgroundColor: ACCENT, color: SIDEBAR_BG }}
          >
            {initials || "A"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile.full_name ?? "Admin"}</p>
            <p className="truncate text-[11px] text-white/60">{profile.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#f5f5f5" }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:shrink-0">{Sidebar}</div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="relative z-10">{Sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header
          className="flex h-[60px] shrink-0 items-center gap-3 bg-white px-4 lg:px-6"
          style={{ borderBottom: "1px solid #e0e0e0" }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden rounded p-2 text-foreground hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumbs */}
          <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground">/</span>}
                {c.to ? (
                  <Link to={c.to} className="text-muted-foreground hover:text-primary">
                    {c.label}
                  </Link>
                ) : (
                  <span className="truncate font-semibold text-primary">{c.label}</span>
                )}
              </span>
            ))}
          </nav>

          {/* Search (desktop) */}
          <div className="mx-4 hidden max-w-md flex-1 lg:flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search products, categories, inquiries..."
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <a
              href="https://consina.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary transition-colors duration-200 hover:bg-muted lg:inline-flex"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View Public Site
            </a>
            <a
              href="https://consina.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-primary hover:bg-muted lg:hidden"
              aria-label="View public site"
            >
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              type="button"
              className="relative rounded-md p-2 text-foreground transition-colors duration-200 hover:bg-muted"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {newInquiries > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "#1a3a2e" }}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {initials || "A"}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div
                    role="menu"
                    className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-md border border-border bg-white shadow-lg"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate({ to: "/admin/account" });
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <UserIcon className="h-4 w-4" /> My Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <MessageSquare className="h-4 w-4" /> Help
                    </button>
                    <div className="h-px bg-border" />
                    <button
                      type="button"
                      onClick={signOut}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}