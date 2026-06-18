import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/customers/$email/delete")({
  head: () => ({
    meta: [
      { title: "Delete customer data — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeletePage,
});

function DeletePage() {
  const { email } = Route.useParams();
  const decoded = decodeURIComponent(email);
  const navigate = useNavigate();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { count: c } = await supabase
        .from("inquiries")
        .select("id", { count: "exact", head: true })
        .ilike("customer_email", decoded);
      setCount(c ?? 0);
    })();
  }, [decoded]);

  const canSubmit = confirmEmail.trim().toLowerCase() === decoded.toLowerCase();

  async function handleDelete() {
    setBusy(true);
    try {
      const { data: ids, error } = await supabase
        .rpc("anonymize_customer_email", { _email: decoded });
      if (error) throw error;

      const inquiryIds = (ids ?? []).map((r: { inquiry_id: string }) => r.inquiry_id);

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
        request_type: "delete",
        customer_email: decoded,
        performed_by: performedBy,
        affected_inquiry_ids: inquiryIds,
        affected_count: inquiryIds.length,
        notes: notes || "Admin-initiated GDPR deletion (anonymization)",
      });
      if (logErr) throw logErr;

      toast.success(`Anonymized ${inquiryIds.length} inquiry record(s).`);
      navigate({ to: "/admin/customers" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deletion failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <Link
        to="/admin/customers/$email"
        params={{ email }}
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to customer
      </Link>

      <div className="rounded-lg border border-red-500/30 bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <div>
            <h1 className="text-xl font-black tracking-tight text-red-700">
              Delete customer data
            </h1>
            <p className="text-sm text-muted-foreground">{decoded}</p>
          </div>
        </div>

        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-800">
          <p className="font-semibold">This action anonymizes — it does not delete records.</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Name → <code>[deleted]</code></li>
            <li>Email → <code>deleted-&lt;uuid&gt;@anonymous.local</code></li>
            <li>Phone, city, message, internal notes → cleared</li>
            <li>Inquiry records themselves are preserved for business history</li>
            <li>Logged in <code>gdpr_requests</code> for compliance</li>
          </ul>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          {count === null ? "Counting…" : `${count} inquiry record(s) will be anonymized.`}
        </p>

        <label className="mb-1 block text-xs font-medium text-foreground">
          Type the customer email to confirm
        </label>
        <Input
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          placeholder={decoded}
          className="mb-3"
        />

        <label className="mb-1 block text-xs font-medium text-foreground">
          Reason / notes (optional)
        </label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="e.g. Customer requested deletion via email on 2026-06-02"
          className="mb-4"
        />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={!canSubmit || busy}>
              {busy ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Anonymizing…</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" /> Delete all data</>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anonymize all data for {decoded}?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. {count ?? 0} record(s) will be anonymized and a
                compliance entry will be written to <code>gdpr_requests</code>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Yes, anonymize
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminShell>
  );
}