import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut, User, MapPin, Package, Heart } from "lucide-react";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/use-customer-auth";

export const Route = createFileRoute("/akun")({
  head: () => ({ meta: [{ title: "Akun Saya — Consina" }, { name: "robots", content: "noindex" }] }),
  component: AkunLayout,
});

function AkunLayout() {
  const { user, profile, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: pathname, mode: "login" } as never });
    }
  }, [loading, user, navigate, pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-muted-foreground">Memuat…</div>
        <Footer />
      </div>
    );
  }

  const tabs = [
    { to: "/akun", label: "Ringkasan", icon: User, exact: true },
    { to: "/akun/profile", label: "Profil", icon: User },
    { to: "/akun/addresses", label: "Alamat", icon: MapPin },
    { to: "/akun/orders", label: "Pesanan", icon: Package },
    { to: "/wishlist", label: "Wishlist", icon: Heart },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Akun Saya</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.full_name || profile?.email || user.email}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="h-4 w-4" /> Keluar
          </Button>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
          <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
            {tabs.map((t) => {
              const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to as never}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ${
                    active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                </Link>
              );
            })}
          </nav>
          <div>
            <Outlet />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}