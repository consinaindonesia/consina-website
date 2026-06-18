import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/glossary")({
  head: () => ({ meta: [{ title: "Glossary — Admin" }, { name: "robots", content: "noindex" }] }),
  component: GlossaryPage,
});

type Entry = {
  id: string;
  term_en: string;
  term_id: string | null;
  never_translate: boolean;
  notes: string | null;
};

type Draft = {
  id?: string;
  term_en: string;
  term_id: string;
  never_translate: boolean;
  notes: string;
};

const EMPTY_DRAFT: Draft = { term_en: "", term_id: "", never_translate: true, notes: "" };

function GlossaryPage() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("brand_glossary")
      .select("id, term_en, term_id, never_translate, notes")
      .order("term_en");
    if (error) toast.error("Failed to load glossary");
    setRows((data ?? []) as Entry[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function openNew() {
    setDraft(EMPTY_DRAFT);
    setEditorOpen(true);
  }

  function openEdit(r: Entry) {
    setDraft({
      id: r.id,
      term_en: r.term_en,
      term_id: r.term_id ?? "",
      never_translate: r.never_translate,
      notes: r.notes ?? "",
    });
    setEditorOpen(true);
  }

  async function save() {
    if (!draft.term_en.trim()) {
      toast.error("English term is required");
      return;
    }
    const payload = {
      term_en: draft.term_en.trim(),
      term_id: draft.term_id.trim() || null,
      never_translate: draft.never_translate,
      notes: draft.notes.trim() || null,
    };
    const { error } = draft.id
      ? await supabase.from("brand_glossary").update(payload).eq("id", draft.id)
      : await supabase.from("brand_glossary").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(draft.id ? "Updated" : "Added");
    setEditorOpen(false);
    void load();
  }

  async function toggleNever(r: Entry, next: boolean) {
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, never_translate: next } : x)));
    const { error } = await supabase
      .from("brand_glossary")
      .update({ never_translate: next })
      .eq("id", r.id);
    if (error) {
      toast.error("Failed to update");
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, never_translate: !next } : x)));
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("brand_glossary").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      setRows((rs) => rs.filter((r) => r.id !== deleteId));
    }
    setDeleteId(null);
  }

  return (
    <AdminShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="text-xs text-muted-foreground">
            <Link to="/admin" className="hover:text-foreground">Dashboard</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Glossary</span>
          </nav>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-primary">
            Brand Glossary
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Terms here are passed to the AI translator. Use this to lock brand names and standardize translations.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Add term
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl bg-card shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="Package"
            title="No glossary terms yet"
            description="Add brand names or term translations to guide the AI translator."
            actionLabel="+ Add your first term"
            actionHref="/admin/glossary"
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">English</th>
                <th className="px-4 py-3">Indonesian</th>
                <th className="px-4 py-3">Never translate</th>
                <th className="px-4 py-3">Notes</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{r.term_en}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.term_id ?? (r.never_translate ? <Badge variant="secondary">Keep as-is</Badge> : "—")}
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={r.never_translate}
                      onCheckedChange={(c) => toggleNever(r, c)}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.notes ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteId(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-secondary/30 bg-secondary/5 p-3 text-xs text-muted-foreground">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
        <p>
          The glossary is automatically prepended to every AI translation request. Never-translate terms are preserved exactly; entries with an Indonesian value lock the chosen translation.
        </p>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit term" : "Add term"}</DialogTitle>
            <DialogDescription>
              Glossary entries guide the AI translator's output.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                English term
              </label>
              <Input
                value={draft.term_en}
                onChange={(e) => setDraft((d) => ({ ...d, term_en: e.target.value }))}
                placeholder="e.g. Responsible Trekker"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Indonesian translation <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <Input
                value={draft.term_id}
                onChange={(e) => setDraft((d) => ({ ...d, term_id: e.target.value }))}
                placeholder="e.g. Tas Carrier"
                disabled={draft.never_translate}
              />
            </div>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-semibold">Never translate</p>
                <p className="text-xs text-muted-foreground">
                  Keep this term exactly as written in all languages.
                </p>
              </div>
              <Switch
                checked={draft.never_translate}
                onCheckedChange={(c) => setDraft((d) => ({ ...d, never_translate: c }))}
              />
            </label>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <Textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Context for editors..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={save}>{draft.id ? "Save changes" : "Add term"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete glossary term?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}