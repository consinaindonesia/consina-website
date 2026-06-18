import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, Save } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/account")({
  head: () => ({
    meta: [
      { title: "Account — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

type Prefs = {
  notification_email_scope: "all" | "assigned" | "none";
  browser_notifications_enabled: boolean;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
};

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function AccountPage() {
  const { profile } = useAdminAuth();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("admin_users")
        .select(
          "notification_email_scope, browser_notifications_enabled, quiet_hours_start, quiet_hours_end"
        )
        .eq("id", profile.id)
        .maybeSingle();
      setLoading(false);
      if (data) {
        setPrefs(data as Prefs);
        setQuietEnabled(
          data.quiet_hours_start != null && data.quiet_hours_end != null
        );
      }
    })();
  }, [profile?.id]);

  async function save() {
    if (!profile?.id || !prefs) return;
    setSaving(true);
    const payload = {
      ...prefs,
      quiet_hours_start: quietEnabled ? prefs.quiet_hours_start ?? 22 : null,
      quiet_hours_end: quietEnabled ? prefs.quiet_hours_end ?? 7 : null,
    };
    const { error } = await supabase
      .from("admin_users")
      .update(payload)
      .eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Preferences saved");
  }

  return (
    <AdminShell>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/admin" className="hover:text-foreground">Dashboard</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">My account</span>
      </div>

      <h1 className="mb-1 text-2xl font-black tracking-tight text-primary">
        My account
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Signed in as <strong>{profile?.full_name ?? profile?.email}</strong>
      </p>

      {loading || !prefs ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <section className="rounded-lg border border-border bg-white p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Notifications
            </h2>

            <div className="space-y-5">
              <div>
                <Label className="mb-1.5 block">Email notifications</Label>
                <Select
                  value={prefs.notification_email_scope}
                  onValueChange={(v) =>
                    setPrefs({
                      ...prefs,
                      notification_email_scope: v as Prefs["notification_email_scope"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All inquiries</SelectItem>
                    <SelectItem value="assigned">Only assigned to me</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Browser notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    In-app toasts when a new inquiry arrives.
                  </p>
                </div>
                <Switch
                  checked={prefs.browser_notifications_enabled}
                  onCheckedChange={(v) =>
                    setPrefs({ ...prefs, browser_notifications_enabled: v })
                  }
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <Label>Quiet hours</Label>
                    <p className="text-xs text-muted-foreground">
                      Don't notify between these hours.
                    </p>
                  </div>
                  <Switch checked={quietEnabled} onCheckedChange={setQuietEnabled} />
                </div>
                {quietEnabled && (
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Label className="mb-1.5 block text-xs">Start</Label>
                      <Select
                        value={String(prefs.quiet_hours_start ?? 22)}
                        onValueChange={(v) =>
                          setPrefs({ ...prefs, quiet_hours_start: Number(v) })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, "0")}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="mb-1.5 block text-xs">End</Label>
                      <Select
                        value={String(prefs.quiet_hours_end ?? 7)}
                        onValueChange={(v) =>
                          setPrefs({ ...prefs, quiet_hours_end: Number(v) })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, "0")}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save preferences
              </Button>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}