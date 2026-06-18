import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, FileJson } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/customers/$email/export")({
  head: () => ({
    meta: [
      { title: "Export customer data — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExportPage,
});

type ExportPayload = {
  generated_at: string;
  customer_email: string;
  inquiries: unknown[];
  contact_inquiries: unknown[];
  notify_when_in_stock: unknown[];
  orders: unknown[];
};

function ExportPage() {
  const { email } = Route.useParams();
  const decoded = decodeURIComponent(email);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ExportPayload | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [inq, contact, notify, orders] = await Promise.all([
        supabase
          .from("inquiries")
          .select("*, inquiry_items(*), inquiry_notes(*)")
          .ilike("customer_email", decoded),
        supabase.from("contact_inquiries").select("*").ilike("email", decoded),
        supabase.from("notify_when_in_stock").select("*").ilike("email", decoded),
        supabase.from("orders").select("*, order_items(*)").ilike("customer_email", decoded),
      ]);
      setLoading(false);
      const err = inq.error || contact.error || notify.error || orders.error;
      if (err) return toast.error(err.message);
      setPayload({
        generated_at: new Date().toISOString(),
        customer_email: decoded,
        inquiries: inq.data ?? [],
        contact_inquiries: contact.data ?? [],
        notify_when_in_stock: notify.data ?? [],
        orders: orders.data ?? [],
      });
    })();
  }, [decoded]);

  async function handleExport() {
    if (!payload) return;
    setExporting(true);
    try {
      const inquiryIds = (payload.inquiries as { id: string }[]).map((i) => i.id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeEmail = decoded.replace(/[^a-z0-9]/gi, "_");
      a.download = `customer-data-${safeEmail}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Log the export request
      const { data: me } = await supabase.auth.getUser();
      let performedBy: string | null = null;
      if (me.user?.email) {
        const { data: adminRow } = await supabase
          .from("admin_users")
          .select("id")
          .eq("email", me.user.email)
          .maybeSingle();
        performedBy = adminRow?.id ?? null;
      }
      const { error: logErr } = await supabase.from("gdpr_requests").insert({
        request_type: "export",
        customer_email: decoded,
        performed_by: performedBy,
        affected_inquiry_ids: inquiryIds,
        affected_count: inquiryIds.length,
        notes: "Admin-initiated JSON export (downloaded)",
      });
      if (logErr) throw logErr;
      toast.success("Data exported and logged for compliance.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const counts = payload && {
    inquiries: payload.inquiries.length,
    contact: payload.contact_inquiries.length,
    notify: payload.notify_when_in_stock.length,
    orders: payload.orders.length,
  };

  return (
    <AdminShell>
      <Link
        to="/admin/customers/$email"
        params={{ email }}
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to customer
      </Link>
      <div className="rounded-lg border border-border bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <FileJson className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-black tracking-tight text-primary">
              Export customer data
            </h1>
            <p className="text-sm text-muted-foreground">{decoded}</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Generates a JSON file containing every record we hold for this email address
          (inquiries, items, internal notes, contact form submissions, restock alerts,
          and orders). Provide it to the customer after verifying their identity by email.
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Gathering data…
          </div>
        ) : !payload ? (
          <div className="text-sm text-muted-foreground">No data found.</div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Inquiries" value={counts!.inquiries} />
              <Stat label="Contact form" value={counts!.contact} />
              <Stat label="Restock alerts" value={counts!.notify} />
              <Stat label="Orders" value={counts!.orders} />
            </div>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting…</>
              ) : (
                <><Download className="mr-2 h-4 w-4" /> Download JSON</>
              )}
            </Button>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}