import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, X, GripVertical, Folder, AlertTriangle } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/attributes")({
  head: () => ({ meta: [{ title: "Attributes — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AttributesPage,
});

type AttributeType = "text" | "number" | "select";

type Attribute = {
  id: string;
  slug: string;
  name_id: string;
  name_en: string;
  type: AttributeType;
  unit: string | null;
  options: string[];
};

type Category = { id: string; name_en: string; sort_order: number };

type CategoryAttribute = {
  id: string;
  category_id: string;
  attribute_id: string;
  is_required: boolean;
  sort_order: number;
};

const SLUG_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function AttributesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [attrs, setAttrs] = useState<Attribute[]>([]);
  const [catAttrs, setCatAttrs] = useState<CategoryAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const [editing, setEditing] = useState<Attribute | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Attribute | null>(null);

  const refresh = useCallback(async () => {
    const [cats, atts, links] = await Promise.all([
      supabase.from("categories").select("id,name_en,sort_order").order("sort_order"),
      supabase
        .from("attributes")
        .select("id,slug,name_id,name_en,type,unit,options")
        .order("name_en"),
      supabase.from("category_attributes").select("*").order("sort_order"),
    ]);
    if (cats.error) toast.error(cats.error.message);
    if (atts.error) toast.error(atts.error.message);
    if (links.error) toast.error(links.error.message);
    const catList = (cats.data ?? []) as Category[];
    setCategories(catList);
    setAttrs(
      ((atts.data ?? []) as Array<Omit<Attribute, "options"> & { options: unknown }>).map((a) => ({
        ...a,
        options: Array.isArray(a.options) ? (a.options as string[]) : [],
      })),
    );
    setCatAttrs((links.data ?? []) as CategoryAttribute[]);
    if (!activeCat && catList.length) setActiveCat(catList[0].id);
    setLoading(false);
  }, [activeCat]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attrById = useMemo(() => {
    const m = new Map<string, Attribute>();
    attrs.forEach((a) => m.set(a.id, a));
    return m;
  }, [attrs]);

  const assignedToActive = useMemo(() => {
    if (!activeCat) return [] as Array<{ link: CategoryAttribute; attr: Attribute }>;
    return catAttrs
      .filter((l) => l.category_id === activeCat)
      .map((l) => ({ link: l, attr: attrById.get(l.attribute_id)! }))
      .filter((x) => x.attr)
      .sort((a, b) => a.link.sort_order - b.link.sort_order);
  }, [catAttrs, attrById, activeCat]);

  const unassignedToActive = useMemo(() => {
    if (!activeCat) return [] as Attribute[];
    const assigned = new Set(assignedToActive.map((x) => x.attr.id));
    return attrs.filter((a) => !assigned.has(a.id));
  }, [attrs, assignedToActive, activeCat]);

  // --- Assignment ---
  async function assignAttribute(attributeId: string, required: boolean) {
    if (!activeCat) return;
    const sort_order = assignedToActive.length;
    const { error } = await supabase
      .from("category_attributes")
      .insert({ category_id: activeCat, attribute_id: attributeId, is_required: required, sort_order });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Attribute added to category");
    setAssignOpen(false);
    await refresh();
  }

  async function unassign(linkId: string) {
    const { error } = await supabase.from("category_attributes").delete().eq("id", linkId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  }

  async function toggleRequired(link: CategoryAttribute, required: boolean) {
    setCatAttrs((prev) =>
      prev.map((l) => (l.id === link.id ? { ...l, is_required: required } : l)),
    );
    const { error } = await supabase
      .from("category_attributes")
      .update({ is_required: required })
      .eq("id", link.id);
    if (error) {
      toast.error(error.message);
      await refresh();
    }
  }

  async function moveAttr(linkId: string, dir: -1 | 1) {
    const list = [...assignedToActive];
    const idx = list.findIndex((x) => x.link.id === linkId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    [list[idx], list[swap]] = [list[swap], list[idx]];
    setCatAttrs((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      list.forEach((x, i) => {
        const cur = map.get(x.link.id);
        if (cur) map.set(x.link.id, { ...cur, sort_order: i });
      });
      return Array.from(map.values());
    });
    await Promise.all(
      list.map((x, i) =>
        supabase.from("category_attributes").update({ sort_order: i }).eq("id", x.link.id),
      ),
    );
  }

  // --- Editor ---
  function openNew() {
    setEditing({
      id: "",
      slug: "",
      name_id: "",
      name_en: "",
      type: "text",
      unit: "",
      options: [],
    });
    setEditorOpen(true);
  }

  function openEdit(a: Attribute) {
    setEditing({ ...a, unit: a.unit ?? "", options: [...a.options] });
    setEditorOpen(true);
  }

  async function saveAttr() {
    if (!editing) return;
    const name_en = editing.name_en.trim();
    const name_id = editing.name_id.trim();
    if (!name_en || !name_id) {
      toast.error("Both Indonesian and English names are required.");
      return;
    }
    const slug = editing.slug.trim() || slugify(name_en);
    if (!SLUG_RE.test(slug)) {
      toast.error("Slug must be lowercase letters, numbers and underscores.");
      return;
    }
    if (editing.type === "select" && editing.options.filter((o) => o.trim()).length === 0) {
      toast.error("Select-type attributes need at least one option.");
      return;
    }

    const payload = {
      slug,
      name_id,
      name_en,
      type: editing.type,
      unit: editing.unit?.trim() || null,
      options:
        editing.type === "select" ? editing.options.map((o) => o.trim()).filter(Boolean) : [],
    };

    if (editing.id) {
      const { error } = await supabase.from("attributes").update(payload).eq("id", editing.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("attributes").insert(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success("Attribute saved");
    setEditorOpen(false);
    setEditing(null);
    await refresh();
  }

  async function deleteAttr() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("attributes").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Attribute deleted");
    setDeleteTarget(null);
    await refresh();
  }

  return (
    <AdminShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-primary">Attributes</h1>
          <p className="text-sm text-muted-foreground">
            Define product properties and assign them to categories. Used to render product specs and storefront filters.
          </p>
        </div>
        <Button onClick={openNew} variant="outline">
          <Plus className="mr-1 h-4 w-4" /> New attribute
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-input bg-card p-10 text-center">
          <Folder className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Create at least one category before assigning attributes.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Category tabs */}
          <nav className="flex flex-wrap gap-2 border-b border-border pb-2">
            {categories.map((c) => {
              const count = catAttrs.filter((l) => l.category_id === c.id).length;
              const active = c.id === activeCat;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCat(c.id)}
                  className={
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
                    (active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted/70")
                  }
                >
                  {c.name_en}
                  <span
                    className={
                      "ml-2 rounded-full px-1.5 py-0.5 text-[10px] " +
                      (active ? "bg-primary-foreground/20" : "bg-background")
                    }
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="rounded-xl border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">
                Attributes for{" "}
                <span className="text-primary">
                  {categories.find((c) => c.id === activeCat)?.name_en}
                </span>
              </h2>
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Add attribute to category
              </Button>
            </header>

            {assignedToActive.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No attributes assigned to this category yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {assignedToActive.map(({ link, attr }, idx) => (
                  <li key={link.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => moveAttr(link.id, -1)}
                        disabled={idx === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <GripVertical className="h-3 w-3 rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveAttr(link.id, 1)}
                        disabled={idx === assignedToActive.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <GripVertical className="h-3 w-3 -rotate-90" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{attr.name_en}</span>
                        <span className="text-xs text-muted-foreground">/ {attr.name_id}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {attr.type}
                          {attr.unit ? ` · ${attr.unit}` : ""}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        slug: <code className="font-mono">{attr.slug}</code>
                        {attr.type === "select" && attr.options.length > 0 && (
                          <> · options: {attr.options.join(", ")}</>
                        )}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={link.is_required}
                        onCheckedChange={(v) => toggleRequired(link, v)}
                      />
                      <span className={link.is_required ? "text-foreground" : "text-muted-foreground"}>
                        Required
                      </span>
                    </label>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(attr)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => unassign(link.id)}
                      aria-label="Remove from category"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* All attributes (library) */}
          <div className="rounded-xl border border-border bg-card">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">All attributes</h2>
              <p className="text-xs text-muted-foreground">
                Reusable across any category. Deleting one removes it from every category it's assigned to.
              </p>
            </header>
            {attrs.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No attributes defined yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {attrs.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{a.name_en}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {a.type}
                        {a.unit ? ` · ${a.unit}` : ""} · {a.slug}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(a)}
                      aria-label="Delete attribute"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit attribute" : "New attribute"}</DialogTitle>
            <DialogDescription>
              Attributes are shared across categories. Slug must be unique and is used as the JSON key on products.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name (Indonesian) *</Label>
                  <Input
                    value={editing.name_id}
                    onChange={(e) => setEditing({ ...editing, name_id: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Name (English) *</Label>
                  <Input
                    value={editing.name_en}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditing({
                        ...editing,
                        name_en: v,
                        slug: editing.slug || slugify(v),
                      });
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Slug *</Label>
                  <Input
                    value={editing.slug}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                    placeholder="capacity_liters"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit (optional)</Label>
                  <Input
                    value={editing.unit ?? ""}
                    onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                    placeholder="L, g, cm…"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={editing.type}
                  onValueChange={(v) => setEditing({ ...editing, type: v as AttributeType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="select">Select (predefined options)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editing.type === "select" && (
                <div className="space-y-1.5">
                  <Label>Options</Label>
                  <div className="space-y-2">
                    {editing.options.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={opt}
                          onChange={(e) => {
                            const next = [...editing.options];
                            next[i] = e.target.value;
                            setEditing({ ...editing, options: next });
                          }}
                          placeholder={`Option ${i + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setEditing({
                              ...editing,
                              options: editing.options.filter((_, j) => j !== i),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing({ ...editing, options: [...editing.options, ""] })}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Add option
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAttr}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add attribute to category</DialogTitle>
            <DialogDescription>
              Pick an existing attribute, or create a new one first.
            </DialogDescription>
          </DialogHeader>
          {unassignedToActive.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every attribute is already assigned to this category. Create a new one from the top right.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-input">
              {unassignedToActive.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{a.name_en}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.type}
                      {a.unit ? ` · ${a.unit}` : ""}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => assignAttribute(a.id, false)}>
                    Optional
                  </Button>
                  <Button size="sm" onClick={() => assignAttribute(a.id, true)}>
                    Required
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Delete this attribute?
            </AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name_en}" will be removed from every category it's assigned to. Existing values stored on
              products are kept but will no longer appear as labelled specs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAttr}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
