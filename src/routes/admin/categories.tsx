import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Folder,
  FolderOpen,
  GripVertical,
  Plus,
  Trash2,
  ImagePlus,
  X,
  Loader2,
  AlertTriangle,
  CornerDownRight,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAdminAuth } from "@/hooks/use-admin-auth";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({ meta: [{ title: "Categories — Admin" }, { name: "robots", content: "noindex" }] }),
  component: CategoriesPage,
});

const BUCKET = "category-images";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Category = {
  id: string;
  slug: string;
  name_id: string;
  name_en: string;
  description_id: string | null;
  description_en: string | null;
  image_url: string | null;
  parent_category_id: string | null;
  sort_order: number;
  is_active: boolean;
};

type Counts = Record<string, { total: number; active: number }>;

type FormState = {
  id: string | null;
  slug: string;
  name_id: string;
  name_en: string;
  description_id: string;
  description_en: string;
  image_url: string | null;
  parent_category_id: string | null;
  sort_order: number;
  is_active: boolean;
  // local UI:
  slugManuallyEdited: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  slug: "",
  name_id: "",
  name_en: "",
  description_id: "",
  description_en: "",
  image_url: null,
  parent_category_id: null,
  sort_order: 0,
  is_active: true,
  slugManuallyEdited: false,
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

// Build a depth-ordered flat list from categories grouped by parent.
function buildTree(cats: Category[]) {
  const byParent = new Map<string | null, Category[]>();
  for (const c of cats) {
    const k = c.parent_category_id;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(c);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sort_order - b.sort_order);

  const out: Array<{ cat: Category; depth: number }> = [];
  function walk(parent: string | null, depth: number) {
    const items = byParent.get(parent) ?? [];
    for (const c of items) {
      out.push({ cat: c, depth });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}

function CategoriesPage() {
  const { profile } = useAdminAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const refresh = useCallback(async () => {
    const [{ data: cats, error: e1 }, { data: prods, error: e2 }] = await Promise.all([
      supabase
        .from("categories")
        .select(
          "id,slug,name_id,name_en,description_id,description_en,image_url,parent_category_id,sort_order,is_active",
        )
        .order("sort_order"),
      supabase.from("products").select("category_id,is_active"),
    ]);
    if (e1) toast.error(e1.message);
    if (e2) toast.error(e2.message);
    const cc: Counts = {};
    for (const p of prods ?? []) {
      if (!p.category_id) continue;
      const slot = (cc[p.category_id] ??= { total: 0, active: 0 });
      slot.total += 1;
      if (p.is_active) slot.active += 1;
    }
    setCounts(cc);
    setCategories((cats ?? []) as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tree = useMemo(() => buildTree(categories), [categories]);

  // Selection sync
  useEffect(() => {
    if (!selectedId) {
      if (!isCreating) {
        setForm(EMPTY_FORM);
        setOriginal(EMPTY_FORM);
      }
      return;
    }
    const cat = categories.find((c) => c.id === selectedId);
    if (!cat) return;
    const f: FormState = {
      id: cat.id,
      slug: cat.slug,
      name_id: cat.name_id,
      name_en: cat.name_en,
      description_id: cat.description_id ?? "",
      description_en: cat.description_en ?? "",
      image_url: cat.image_url,
      parent_category_id: cat.parent_category_id,
      sort_order: cat.sort_order,
      is_active: cat.is_active,
      slugManuallyEdited: true,
    };
    setForm(f);
    setOriginal(f);
    setIsCreating(false);
  }, [selectedId, categories, isCreating]);

  const dirty = useMemo(
    () => JSON.stringify({ ...form, slugManuallyEdited: 0 }) !== JSON.stringify({ ...original, slugManuallyEdited: 0 }),
    [form, original],
  );

  // --- DnD ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overIdRaw = String(over.id);

    const activeCat = categories.find((c) => c.id === activeId);
    if (!activeCat) return;

    // NEST: dropped on a "nest-<id>" zone
    if (overIdRaw.startsWith("nest-")) {
      const parentId = overIdRaw.slice("nest-".length);
      if (parentId === activeId) return;
      if (isDescendantOf(categories, parentId, activeId)) {
        toast.error("Cannot nest a category under its own descendant.");
        return;
      }
      await moveTo(activeCat, parentId);
      return;
    }
    if (overIdRaw === "nest-root") {
      await moveTo(activeCat, null);
      return;
    }

    // REORDER: dropped on a sibling row
    const overCat = categories.find((c) => c.id === overIdRaw);
    if (!overCat) return;
    if (overCat.parent_category_id !== activeCat.parent_category_id) {
      // Treat cross-parent reorder as a move under the target's parent
      if (isDescendantOf(categories, overCat.parent_category_id ?? "", activeId)) {
        toast.error("Cannot move a category under its own descendant.");
        return;
      }
      await moveTo(activeCat, overCat.parent_category_id, overCat.id);
      return;
    }
    await reorderSiblings(activeCat, overCat);
  }

  async function reorderSiblings(active: Category, over: Category) {
    const siblings = categories
      .filter((c) => c.parent_category_id === active.parent_category_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const fromIdx = siblings.findIndex((c) => c.id === active.id);
    const toIdx = siblings.findIndex((c) => c.id === over.id);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...siblings];
    next.splice(toIdx, 0, next.splice(fromIdx, 1)[0]);
    // Optimistic
    setCategories((all) =>
      all.map((c) => {
        const idx = next.findIndex((s) => s.id === c.id);
        return idx >= 0 ? { ...c, sort_order: idx } : c;
      }),
    );
    const updates = await Promise.all(
      next.map((c, i) => supabase.from("categories").update({ sort_order: i }).eq("id", c.id)),
    );
    const err = updates.find((r) => r.error);
    if (err?.error) {
      toast.error("Reorder failed: " + err.error.message);
      await refresh();
    }
  }

  async function moveTo(cat: Category, newParent: string | null, insertBefore?: string) {
    const siblings = categories
      .filter((c) => c.parent_category_id === newParent && c.id !== cat.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    let insertIdx = siblings.length;
    if (insertBefore) {
      const i = siblings.findIndex((s) => s.id === insertBefore);
      if (i >= 0) insertIdx = i;
    }
    siblings.splice(insertIdx, 0, { ...cat, parent_category_id: newParent });
    const updates: Array<PromiseLike<unknown>> = [];
    siblings.forEach((s, i) => {
      if (s.id === cat.id) {
        updates.push(
          supabase.from("categories").update({ parent_category_id: newParent, sort_order: i }).eq("id", s.id),
        );
      } else if (s.sort_order !== i) {
        updates.push(supabase.from("categories").update({ sort_order: i }).eq("id", s.id));
      }
    });
    await Promise.all(updates);
    await refresh();
    toast.success(newParent ? "Nested under parent" : "Moved to top level");
  }

  // --- Image upload ---
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onPickImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${form.slug || "untitled"}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: pub.publicUrl }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    if (!form.image_url) return;
    const path = storagePathFromPublicUrl(form.image_url);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    setForm((f) => ({ ...f, image_url: null }));
  }

  // --- New category ---
  function startNew() {
    setSelectedId(null);
    const blank: FormState = {
      ...EMPTY_FORM,
      sort_order: categories.filter((c) => c.parent_category_id === null).length,
    };
    setForm(blank);
    setOriginal(blank);
    setIsCreating(true);
  }

  // --- Save ---
  async function save() {
    if (!form.name_en.trim() || !form.name_id.trim()) {
      toast.error("Both Indonesian and English names are required.");
      return;
    }
    const slug = form.slug.trim().toLowerCase();
    if (!slug) {
      toast.error("Slug is required.");
      return;
    }
    if (!SLUG_RE.test(slug)) {
      toast.error("Slug must contain only lowercase letters, numbers, and hyphens.");
      return;
    }

    // Uniqueness check
    const { data: dupRows, error: dupErr } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", slug);
    if (dupErr) {
      toast.error(dupErr.message);
      return;
    }
    if ((dupRows ?? []).some((r) => r.id !== form.id)) {
      toast.error("That slug is already used by another category.");
      return;
    }

    // Deactivation guard
    if (form.id && original.is_active && !form.is_active) {
      const activeCount = counts[form.id]?.active ?? 0;
      if (activeCount > 0) {
        toast.error(
          `${activeCount} active product${activeCount === 1 ? "" : "s"} use this category. Move them first or deactivate them.`,
        );
        return;
      }
    }

    // Prevent setting itself or a descendant as parent
    if (form.parent_category_id && form.id) {
      if (form.parent_category_id === form.id || isDescendantOf(categories, form.parent_category_id, form.id)) {
        toast.error("A category cannot be nested under itself or its descendants.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        slug,
        name_id: form.name_id.trim(),
        name_en: form.name_en.trim(),
        description_id: form.description_id.trim() || null,
        description_en: form.description_en.trim() || null,
        image_url: form.image_url,
        parent_category_id: form.parent_category_id,
        sort_order: form.sort_order,
        is_active: form.is_active,
      };
      let savedId = form.id;
      if (form.id) {
        const { error } = await supabase.from("categories").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("categories")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        savedId = data.id;
      }
      // Activity log
      if (profile?.id) {
        await supabase.from("activity_log").insert({
          admin_user_id: profile.id,
          action: form.id ? "updated" : "created",
          entity_type: "category",
          entity_id: savedId,
        });
      }
      toast.success(form.id ? "Category saved" : "Category created");
      await refresh();
      setIsCreating(false);
      setSelectedId(savedId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // --- Delete ---
  async function confirmDelete() {
    if (!form.id) return;
    const total = counts[form.id]?.total ?? 0;
    if (total > 0) {
      toast.error(
        `${total} product${total === 1 ? "" : "s"} still belong to this category. Move them first.`,
      );
      setDeleteOpen(false);
      return;
    }
    // Re-parent any children to root
    await supabase
      .from("categories")
      .update({ parent_category_id: null })
      .eq("parent_category_id", form.id);
    const { error } = await supabase.from("categories").delete().eq("id", form.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (profile?.id) {
      await supabase.from("activity_log").insert({
        admin_user_id: profile.id,
        action: "deleted",
        entity_type: "category",
        entity_id: form.id,
      });
    }
    toast.success("Category deleted");
    setSelectedId(null);
    setDeleteOpen(false);
    await refresh();
  }

  // --- Parent options ---
  const parentOptions = useMemo(() => {
    if (!form.id) {
      return categories.filter((c) => !c.parent_category_id || c.parent_category_id);
    }
    const blocked = new Set<string>([form.id]);
    // collect descendants
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of categories) {
        if (c.parent_category_id && blocked.has(c.parent_category_id) && !blocked.has(c.id)) {
          blocked.add(c.id);
          changed = true;
        }
      }
    }
    return categories.filter((c) => !blocked.has(c.id));
  }, [categories, form.id]);

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-primary">
            Categories
          </h1>
          <p className="text-sm text-muted-foreground">
            Organize products with a drag-and-drop category tree.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
        {/* LEFT PANE */}
        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Categories</h2>
            <Button size="sm" onClick={startNew}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          </header>
          <div className="p-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : categories.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Folder className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No categories yet</p>
                <Button size="sm" onClick={startNew}>
                  <Plus className="mr-1 h-4 w-4" /> Create your first category
                </Button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(e: DragStartEvent) => setActiveDragId(String(e.active.id))}
                onDragCancel={() => setActiveDragId(null)}
                onDragEnd={onDragEnd}
              >
                {activeDragId && (
                  <RootDropZone />
                )}
                <SortableContext
                  items={tree.map((t) => t.cat.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-1">
                    {tree.map(({ cat, depth }) => (
                      <TreeRow
                        key={cat.id}
                        cat={cat}
                        depth={depth}
                        selected={selectedId === cat.id}
                        counts={counts[cat.id]}
                        onSelect={() => setSelectedId(cat.id)}
                        isDragging={activeDragId === cat.id}
                        showNestZone={activeDragId !== null && activeDragId !== cat.id}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </section>

        {/* RIGHT PANE */}
        <section className="rounded-xl border border-border bg-card">
          {!form.id && !isCreating ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 p-10 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-base font-medium text-foreground">No category selected</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Pick a category from the tree to edit its details, or click <strong>+ New</strong>
                {" "}to create one. Drag a category onto another to nest it as a subcategory.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="flex h-full flex-col"
            >
              <header className="border-b border-border px-6 py-4">
                <h2 className="text-lg font-semibold text-foreground">
                  {form.id ? `Edit: ${form.name_en || form.name_id || "Untitled"}` : "New Category"}
                </h2>
              </header>

              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                {/* Slug */}
                <div className="space-y-1.5">
                  <Label htmlFor="cat-slug">
                    Slug <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cat-slug"
                    value={form.slug}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, slug: e.target.value, slugManuallyEdited: true }))
                    }
                    placeholder="climbing-gear"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lowercase letters, numbers, and hyphens. Used in the public URL.
                  </p>
                </div>

                {/* Names */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-name-id">
                      Name (Indonesian) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="cat-name-id"
                      value={form.name_id}
                      onChange={(e) => setForm((f) => ({ ...f, name_id: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-name-en">
                      Name (English) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="cat-name-en"
                      value={form.name_en}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((f) => ({
                          ...f,
                          name_en: v,
                          slug: f.slugManuallyEdited ? f.slug : slugify(v),
                        }));
                      }}
                    />
                  </div>
                </div>

                {/* Descriptions */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-desc-id">Description (Indonesian)</Label>
                    <Textarea
                      id="cat-desc-id"
                      rows={3}
                      value={form.description_id}
                      onChange={(e) => setForm((f) => ({ ...f, description_id: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-desc-en">Description (English)</Label>
                    <Textarea
                      id="cat-desc-en"
                      rows={3}
                      value={form.description_en}
                      onChange={(e) => setForm((f) => ({ ...f, description_en: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Image */}
                <div className="space-y-1.5">
                  <Label>Category banner</Label>
                  {form.image_url ? (
                    <div className="relative w-full max-w-md overflow-hidden rounded-lg border border-border">
                      <img
                        src={form.image_url}
                        alt={form.name_en}
                        className="aspect-[3/1] w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => void removeImage()}
                        className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 text-foreground shadow hover:bg-background"
                        aria-label="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex h-32 w-full max-w-md flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      {uploading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="h-5 w-5" />
                          <span className="text-sm">Click to upload (JPG/PNG, max 5 MB)</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onPickImage(f);
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* Parent */}
                <div className="space-y-1.5">
                  <Label>Parent category</Label>
                  <Select
                    value={form.parent_category_id ?? "__root"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, parent_category_id: v === "__root" ? null : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Top level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__root">— Top level —</SelectItem>
                      {parentOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort + active */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-sort">Sort order</Label>
                    <Input
                      id="cat-sort"
                      type="number"
                      value={form.sort_order}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Updated automatically when you drag in the tree.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Status</Label>
                    <div className="flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2">
                      <Switch
                        id="cat-active"
                        checked={form.is_active}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                      />
                      <Label htmlFor="cat-active" className="cursor-pointer text-sm">
                        {form.is_active ? "Active — visible on public site" : "Hidden from public site"}
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Delete (only when editing existing) */}
                {form.id && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                      <div className="flex-1 text-sm">
                        <p className="font-medium text-foreground">Danger zone</p>
                        <p className="text-muted-foreground">
                          Permanently delete this category. Only allowed when no products belong to it.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-6 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (form.id) {
                      setForm(original);
                    } else {
                      setIsCreating(false);
                      setForm(EMPTY_FORM);
                      setOriginal(EMPTY_FORM);
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || (!dirty && !!form.id)}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {form.id ? "Save" : "Create category"}
                </Button>
              </footer>
            </form>
          )}
        </section>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Any subcategories will be moved to the top level.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
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

function isDescendantOf(cats: Category[], maybeDescendant: string, ancestor: string): boolean {
  if (!maybeDescendant) return false;
  let cur: string | null = maybeDescendant;
  const seen = new Set<string>();
  while (cur) {
    if (cur === ancestor) return true;
    if (seen.has(cur)) return false;
    seen.add(cur);
    const next: Category | undefined = cats.find((c) => c.id === cur);
    cur = next?.parent_category_id ?? null;
  }
  return false;
}

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: "nest-root" });
  return (
    <div
      ref={setNodeRef}
      className={
        "mb-2 rounded-md border-2 border-dashed px-3 py-2 text-center text-xs transition-colors " +
        (isOver
          ? "border-primary bg-primary/10 text-primary"
          : "border-input text-muted-foreground")
      }
    >
      Drop here to move to top level
    </div>
  );
}

function TreeRow({
  cat,
  depth,
  selected,
  counts,
  onSelect,
  isDragging,
  showNestZone,
}: {
  cat: Category;
  depth: number;
  selected: boolean;
  counts: { total: number; active: number } | undefined;
  onSelect: () => void;
  isDragging: boolean;
  showNestZone: boolean;
}) {
  const sortable = useSortable({ id: cat.id });
  const nest = useDroppable({ id: `nest-${cat.id}` });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: isDragging ? 0.4 : 1,
    paddingLeft: depth * 20,
  };

  const total = counts?.total ?? 0;

  return (
    <li ref={sortable.setNodeRef} style={style}>
      <div
        className={
          "group relative flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors " +
          (selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted")
        }
      >
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Drag to reorder"
        >
          {depth > 0 ? (
            <CornerDownRight className="h-3.5 w-3.5" />
          ) : (
            <GripVertical className="h-4 w-4" />
          )}
        </button>
        <Folder className={"h-4 w-4 " + (cat.is_active ? "text-primary" : "text-muted-foreground/50")} />
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <div className="truncate font-medium text-foreground">
            {cat.name_en}
            {!cat.is_active && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                Hidden
              </span>
            )}
          </div>
          {cat.name_id !== cat.name_en && (
            <div className="truncate text-xs text-muted-foreground">{cat.name_id}</div>
          )}
        </button>
        <span
          className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          title={`${total} products`}
        >
          {total}
        </span>
        {showNestZone && (
          <div
            ref={nest.setNodeRef}
            className={
              "pointer-events-auto absolute inset-y-1 right-1 w-1/2 rounded-md transition-colors " +
              (nest.isOver ? "bg-primary/15 ring-2 ring-primary" : "")
            }
            aria-hidden
          >
            {nest.isOver && (
              <div className="flex h-full items-center justify-end pr-3 text-[11px] font-medium text-primary">
                Nest under {cat.name_en}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
