import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Shield, FileText, Clock, Database } from "lucide-react";

export const Route = createFileRoute("/admin/settings/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy & Retention — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrivacyDocsPage,
});

type GdprRow = {
  id: string;
  request_type: string;
  customer_email: string;
  affected_count: number;
  notes: string | null;
  created_at: string;
};

function PrivacyDocsPage() {
  const [recent, setRecent] = useState<GdprRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("gdpr_requests")
        .select("id, request_type, customer_email, affected_count, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      setRecent((data ?? []) as GdprRow[]);
    })();
  }, []);

  return (
    <AdminShell>
      <div className="mb-4 flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-black tracking-tight text-primary">
          Privacy &amp; Data Retention
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section icon={Clock} title="Retention policy">
          <ul className="list-inside list-disc space-y-2 text-sm">
            <li>
              <strong>Inquiries</strong> are automatically anonymized after{" "}
              <strong>3 years</strong>. The record itself is preserved for business
              history, but customer name/email/phone/city/message are wiped.
            </li>
            <li>
              <strong>Activity log</strong> entries older than <strong>2 years</strong>{" "}
              are moved to a cold archive table (<code>activity_log_archive</code>).
            </li>
            <li>
              Retention runs automatically every day at <strong>03:15 UTC</strong> via{" "}
              <code>pg_cron</code> &rarr; <code>public.run_data_retention()</code>.
            </li>
            <li>
              Every auto-anonymization is logged in <code>gdpr_requests</code> with
              type <code>auto_retention</code>.
            </li>
          </ul>
        </Section>

        <Section icon={FileText} title="Data subject rights workflow">
          <ul className="list-inside list-disc space-y-2 text-sm">
            <li>
              <strong>Access / portability:</strong> open the customer detail page and
              click <em>Export data</em> to download a JSON snapshot.
            </li>
            <li>
              <strong>Erasure:</strong> click <em>Delete all data</em> &rarr; confirm
              the email &rarr; anonymizes every inquiry for that email.
            </li>
            <li>
              Verify the requester's identity by email before sending the file.
            </li>
            <li>
              The public privacy policy lives at <code>/id/privacy</code> and{" "}
              <code>/en/privacy</code>.
            </li>
          </ul>
        </Section>

        <Section icon={Database} title="What we store">
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li><code>inquiries</code>, <code>inquiry_items</code>, <code>inquiry_notes</code></li>
            <li><code>contact_inquiries</code></li>
            <li><code>notify_when_in_stock</code></li>
            <li><code>orders</code>, <code>order_items</code></li>
            <li><code>activity_log</code> (admin audit trail, IP anonymized to /24)</li>
          </ul>
        </Section>

        <Section icon={Shield} title="Cookies">
          <ul className="list-inside list-disc space-y-2 text-sm">
            <li>Essential only by default (session, <code>lang</code> preference).</li>
            <li>Analytics / non-essential cookies require explicit consent via the cookie banner.</li>
            <li>Consent is stored client-side in <code>cookie_consent</code> for 12 months.</li>
          </ul>
        </Section>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-white p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Recent GDPR requests
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Records</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4 font-medium">{r.request_type}</td>
                    <td className="py-2 pr-4">{r.customer_email}</td>
                    <td className="py-2 pr-4">{r.affected_count}</td>
                    <td className="py-2 text-muted-foreground">{r.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          See full activity at <Link to="/admin/activity" className="underline">/admin/activity</Link>.
        </p>
      </section>
    </AdminShell>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Shield;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}