import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/vouchers")({
  head: () => ({
    meta: [
      { title: "Vouchers — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VouchersPage,
});

type Voucher = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_spend_idr: number;
  usage_limit: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

type FormState = {
  id: string | null;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  min_spend_idr: string;
  usage_limit: string;
  expires_at: string;
  is_active: boolean;
};

const EMPTY: FormState = {
  id: null,
  code: "",
  discount_type: "percent",
  discount_value: "10",
  min_spend_idr: "0",
  usage_limit: "",
  expires_at: "",
  is_active: true,
};

function VouchersPage() {
  const [items, setItems] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("voucher_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as Voucher[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(v: Voucher) {
    setForm({
      id: v.id,
      code: v.code,
      discount_type: v.discount_type,
      discount_value: String(v.discount_value),
      min_spend_idr: String(v.min_spend_idr),
      usage_limit: v.usage_limit == null ? "" : String(v.usage_limit),
      expires_at: v.expires_at ? v.expires_at.slice(0, 10) : "",
      is_active: v.is_active,
    });
    setOpen(true);
  }

  async function save() {
    const code = form.code.trim().toUpperCase();
    if (!code) {
      toast.error("Code is required");
      return;
    }
    const discount_value = Math.max(0, parseInt(form.discount_value || "0", 10) || 0);
    if (!discount_value) {
      toast.error("Discount value must be > 0");
      return;
    }
    if (form.discount_type === "percent" && discount_value > 100) {
      toast.error("Percent must be ≤ 100");
      return;
    }
    const payload = {
      code,
      discount_type: form.discount_type,
      discount_value,
      min_spend_idr: Math.max(0, parseInt(form.min_spend_idr || "0", 10) || 0),
      usage_limit: form.usage_limit.trim() ? Math.max(0, parseInt(form.usage_limit, 10)) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_active: form.is_active,
    };
    setSaving(true);
    const { error } = form.id
      ? await supabase.from("voucher_codes").update(payload).eq("id", form.id)
      : await supabase.from("voucher_codes").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(form.id ? "Voucher updated" : "Voucher created");
    setOpen(false);
    void load();
  }

  async function remove(v: Voucher) {
    if (!window.confirm(`Delete voucher ${v.code}?`)) return;
    const { error } = await supabase.from("voucher_codes").delete().eq("id", v.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Voucher deleted");
    void load();
  }

  return (
    <AdminShell>
      <div className="px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Dashboard › Vouchers</p>
            <h1 className="text-2xl font-bold tracking-tight">
              Vouchers <span className="text-muted-foreground">({items.length})</span>
            </h1>
          </div>
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" /> New voucher
          </Button>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon="Tag"
              title="No vouchers yet"
              description="Create discount codes for your customers."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Code</th>
                    <th className="px-4 py-3 text-left font-medium">Discount</th>
                    <th className="px-4 py-3 text-left font-medium">Min spend</th>
                    <th className="px-4 py-3 text-left font-medium">Used / limit</th>
                    <th className="px-4 py-3 text-left font-medium">Expires</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono font-semibold">{v.code}</td>
                      <td className="px-4 py-3">
                        {v.discount_type === "percent"
                          ? `${v.discount_value}%`
                          : `Rp ${v.discount_value.toLocaleString("id-ID")}`}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        Rp {v.min_spend_idr.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {v.used_count} / {v.usage_limit ?? "∞"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {v.expires_at
                          ? new Date(v.expires_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            v.is_active
                              ? "border-green-500/30 bg-green-500/10 text-green-700"
                              : "border-border bg-muted text-muted-foreground"
                          }
                        >
                          {v.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(v)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit voucher" : "New voucher"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER10"
                className="mt-1 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select
                  value={form.discount_type}
                  onValueChange={(v) =>
                    setForm({ ...form, discount_type: v as "percent" | "fixed" })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (Rp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Value</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Min spend (Rp)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.min_spend_idr}
                  onChange={(e) => setForm({ ...form, min_spend_idr: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Usage limit</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.usage_limit}
                  onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                  placeholder="Unlimited"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Expires</Label>
              <Input
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label className="text-sm">Active</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}