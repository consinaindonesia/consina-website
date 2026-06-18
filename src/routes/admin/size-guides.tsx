import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Ruler } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/size-guides")({
  head: () => ({ meta: [{ title: "Size Guides — Admin" }, { name: "robots", content: "noindex" }] }),
  component: SizeGuidesPage,
});

type SizeGuide = {
  id: string;
  name: string;
  description: string | null;
  headers: string[];
  rows: string[][];
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  headers: string[];
  rows: string[][];
};

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  headers: ["Size", "Chest (cm)", "Length (cm)"],
  rows: [["S", "", ""], ["M", "", ""], ["L", "", ""]],
};

function SizeGuidesPage() {
  const [rows, setRows] = useState<SizeGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("size_guides")
      .select("id,name,description,headers,rows")
      .order("name");
    if (error) toast.error("Failed to load size guides");
    setRows(
      ((data ?? []) as unknown as Array<{
        id: string;
        name: string;
        description: string | null;
        headers: unknown;
        rows: unknown;
      }>).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        headers: Array.isArray(r.headers) ? (r.headers as string[]) : [],
        rows: Array.isArray(r.rows) ? (r.rows as string[][]) : [],
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function openNew() {
    setDraft({ ...EMPTY_DRAFT, headers: [...EMPTY_DRAFT.headers], rows: EMPTY_DRAFT.rows.map((r) => [...r]) });
    setEditorOpen(true);
  }

  function openEdit(r: SizeGuide) {
    setDraft({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      headers: r.headers.length ? [...r.headers] : ["Size"],
      rows: r.rows.length ? r.rows.map((row) => [...row]) : [[""]],
    });
    setEditorOpen(true);
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      headers: draft.headers,
      rows: draft.rows,
    };
    const { error } = draft.id
      ? await supabase.from("size_guides").update(payload).eq("id", draft.id)
      : await supabase.from("size_guides").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(draft.id ? "Updated" : "Added");
    setEditorOpen(false);
    void load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("size_guides").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      setRows((rs) => rs.filter((r) => r.id !== deleteId));
    }
    setDeleteId(null);
  }

  function updateHeader(i: number, value: string) {
    setDraft((d) => {
      const next = [...d.headers];
      next[i] = value;
      return { ...d, headers: next };
    });
  }

  function addColumn() {
    setDraft((d) => ({
      ...d,
      headers: [...d.headers, ""],
      rows: d.rows.map((r) => [...r, ""]),
    }));
  }

  function removeColumn(i: number) {
    setDraft((d) => ({
      ...d,
      headers: d.headers.filter((_, idx) => idx !== i),
      rows: d.rows.map((r) => r.filter((_, idx) => idx !== i)),
    }));
  }

  function updateCell(r: number, c: number, value: string) {
    setDraft((d) => {
      const next = d.rows.map((row) => [...row]);
      next[r][c] = value;
      return { ...d, rows: next };
    });
  }

  function addRow() {
    setDraft((d) => ({
      ...d,
      rows: [...d.rows, d.headers.map(() => "")],
    }));
  }

  function removeRow(i: number) {
    setDraft((d) => ({ ...d, rows: d.rows.filter((_, idx) => idx !== i) }));
  }

  return (
    <AdminShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="text-xs text-muted-foreground">
            <Link to="/admin" className="hover:text-foreground">Dashboard</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Size Guides</span>
          </nav>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-primary">
            Size Guides
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable size charts that can be assigned to products via the product form.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Add size guide
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl bg-card shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="Package"
            title="No size guides yet"
            description="Create a size guide to show on product pages."
            actionLabel="+ Add your first size guide"
            actionHref="/admin/size-guides"
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Columns</th>
                <th className="px-4 py-3">Rows</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.headers.length}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.rows.length}</td>
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
        <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
        <p>
          Assign a size guide to a product from the product edit form. It will appear as a "Size Guide" button next to the size selector.
        </p>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit size guide" : "Add size guide"}</DialogTitle>
            <DialogDescription>
              Define the column headers and rows of the size chart.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Name
              </label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Apparel — Adult Unisex"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Measurements in cm. Add 2cm for relaxed fit..."
                rows={2}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Chart
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addColumn}>
                    + Column
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addRow}>
                    + Row
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {draft.headers.map((h, i) => (
                        <th key={i} className="p-1.5">
                          <div className="flex items-center gap-1">
                            <Input
                              value={h}
                              onChange={(e) => updateHeader(i, e.target.value)}
                              placeholder={`Col ${i + 1}`}
                              className="h-8 text-xs"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeColumn(i)}
                              disabled={draft.headers.length <= 1}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </th>
                      ))}
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-border/60">
                        {draft.headers.map((_, ci) => (
                          <td key={ci} className="p-1.5">
                            <Input
                              value={row[ci] ?? ""}
                              onChange={(e) => updateCell(ri, ci, e.target.value)}
                              className="h-8 text-xs"
                            />
                          </td>
                        ))}
                        <td className="p-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeRow(ri)}
                            disabled={draft.rows.length <= 1}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={save}>{draft.id ? "Save changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete size guide?</DialogTitle>
            <DialogDescription>
              Products referencing this guide will lose the link. This cannot be undone.
            </DialogDescription>
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