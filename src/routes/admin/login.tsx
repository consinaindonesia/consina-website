import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAuthEvent } from "@/lib/activity-log.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin Sign In — Consina" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (search: Record<string, unknown>): { reset?: "1" } => {
    const isReset = search.reset === "1" || search.reset === 1;
    return isReset ? { reset: "1" } : {};
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { reset } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorTone, setErrorTone] = useState<"error" | "warning">("error");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const mountedAt = useRef<number>(Date.now());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Honeypot timing: reject submissions faster than 1s (likely bot)
    if (Date.now() - mountedAt.current < 1000) {
      setErrorTone("error");
      setError("Submission rejected. Please try again.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      void logAuthEvent({ data: { email, kind: "login_failed", metadata: { reason: err.message } } });
      const msg = err.message?.toLowerCase() ?? "";
      if (err.status === 429 || msg.includes("rate") || msg.includes("too many")) {
        setErrorTone("warning");
        setError("Too many failed attempts. Please wait 15 minutes.");
      } else {
        setErrorTone("error");
        setError("Email or password incorrect. Please try again.");
      }
      setBusy(false);
      return;
    }
    void logAuthEvent({ data: { email, kind: "login_success" } });
    navigate({ to: "/admin" });
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{
        backgroundColor: "#fafaf5",
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(26,58,46,0.06) 1px, transparent 0)",
        backgroundSize: "24px 24px",
      }}
    >
      <div
        className="w-[90%] max-w-[400px] rounded-[12px] bg-white p-8 shadow-[0_10px_40px_-12px_rgba(26,58,46,0.18)]"
      >
        <div className="flex flex-col items-center text-center">
          <span
            className="text-2xl font-black tracking-tight"
            style={{ color: "#1a3a2e" }}
          >
            CONSINA
          </span>
          <span
            className="mt-1 text-[10px] font-semibold tracking-[0.3em]"
            style={{ color: "#d4b896" }}
          >
            ADMIN
          </span>
        </div>

        <h1 className="mt-6 text-center text-xl font-semibold" style={{ color: "#1a3a2e" }}>
          Sign in to your account
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Internal use only. Authorized staff only.
        </p>

        {reset === "1" && !error && (
          <div
            role="status"
            className="mt-5 rounded-md px-3 py-2 text-sm"
            style={{ backgroundColor: "#eef6ef", color: "#1a3a2e", border: "1px solid #c7e0ca" }}
          >
            Password updated. Please sign in with your new password.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-md px-3 py-2 text-sm"
            style={
              errorTone === "warning"
                ? { backgroundColor: "#fff4e5", color: "#a15c00", border: "1px solid #f4c989" }
                : { backgroundColor: "#fdecec", color: "#b42318", border: "1px solid #f3b4b4" }
            }
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" aria-label="Admin sign in">
          <div>
            <label
              htmlFor="admin-email"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Email
            </label>
            <input
              id="admin-email"
              name="email"
              type="email"
              inputMode="email"
              required
              disabled={busy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1 h-12 w-full rounded-md border border-input bg-background px-3 text-base md:h-10 md:text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="admin-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={12}
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-12 w-full rounded-md border border-input bg-background px-3 pr-10 text-base md:h-10 md:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-2 flex items-center px-1 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-1 flex justify-end">
              <Link
                to="/admin/forgot-password"
                className="text-xs hover:underline"
                style={{ color: "#1a3a2e" }}
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60 md:h-10"
            style={{ backgroundColor: "#1a3a2e" }}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Need access? Contact your administrator.
          </p>
        </form>
      </div>
    </div>
  );
}