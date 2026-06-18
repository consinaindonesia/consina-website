import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, Mail, MessageCircle, Save } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsNotificationsPage,
});

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  notification_email_scope: "all" | "assigned" | "none";
  whatsapp_notifications_enabled: boolean;
  whatsapp_phone: string | null;
};

function SettingsNotificationsPage() {
  const { profile } = useAdminAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState("");
  const [waEnabled, setWaEnabled] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_users")
      .select(
        "id, email, full_name, role, notification_email_scope, whatsapp_notifications_enabled, whatsapp_phone"
      )
      .order("full_name");
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const me = rows.find((r) => r.id === profile?.id);
    if (me) {
      setWaPhone(me.whatsapp_phone ?? "");
      setWaEnabled(me.whatsapp_notifications_enabled);
    }
  }, [rows, profile?.id]);

  async function setScope(id: string, scope: Row["notification_email_scope"]) {
    setSavingId(id);
    const { error } = await supabase
      .from("admin_users")
      .update({ notification_email_scope: scope })
      .eq("id", id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, notification_email_scope: scope } : r))
    );
    toast.success("Updated");
  }

  async function saveWhatsApp() {
    if (!profile?.id) return;
    setSavingId(profile.id);
    const { error } = await supabase
      .from("admin_users")
      .update({
        whatsapp_notifications_enabled: waEnabled,
        whatsapp_phone: waPhone.trim() || null,
      })
      .eq("id", profile.id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("WhatsApp preferences saved");
    void load();
  }

  return (
    <AdminShell>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/admin" className="hover:text-foreground">Dashboard</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Notifications</span>
      </div>

      <h1 className="mb-1 text-2xl font-black tracking-tight text-primary">
        Notification settings
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Manage how the team is alerted about new customer inquiries.
      </p>

      {/* Email channel */}
      <section className="mb-6 rounded-lg border border-border bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Mail className="h-4 w-4" /> Email channel
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Every admin can choose what they receive. Defaults to all inquiries.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Admin</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Email notifications</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{r.full_name ?? r.email}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge variant="outline" className="capitalize">
                        {r.role}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(["all", "assigned", "none"] as const).map((s) => (
                          <button
                            key={s}
                            disabled={savingId === r.id}
                            onClick={() => setScope(r.id, s)}
                            className={
                              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition " +
                              (r.notification_email_scope === s
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-white hover:bg-muted")
                            }
                          >
                            {s === "all" ? "All" : s === "assigned" ? "Assigned" : "None"}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* WhatsApp channel (placeholder) */}
      <section className="mb-6 rounded-lg border border-border bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <MessageCircle className="h-4 w-4" /> WhatsApp channel
              <Badge variant="outline" className="ml-1 border-amber-500/30 bg-amber-500/10 text-amber-700">
                Coming soon
              </Badge>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Opt in to receive a WhatsApp ping for new inquiries. We'll wire this up
              to a sending service later — for now your preference is saved.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label>Enable WhatsApp alerts</Label>
              <p className="text-xs text-muted-foreground">For your account only.</p>
            </div>
            <Switch checked={waEnabled} onCheckedChange={setWaEnabled} />
          </div>
          <div>
            <Label className="mb-1.5 block">WhatsApp number</Label>
            <Input
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="+62 812 3456 7890"
              inputMode="tel"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveWhatsApp} disabled={savingId === profile?.id}>
            {savingId === profile?.id ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save WhatsApp preferences
          </Button>
        </div>
      </section>
    </AdminShell>
  );
}