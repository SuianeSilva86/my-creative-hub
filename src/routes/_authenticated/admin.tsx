import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthState, logout } from "@/lib/api/auth.functions";
import { uploadMedia } from "@/lib/api/media.functions";
import {
  createItem,
  createLink,
  createPage,
  deleteItem,
  deleteLink,
  deletePage,
  getAdminItems,
  getAdminLinks,
  getAdminPages,
  getAdminProfile,
  updateItem as updateItemData,
  updateLink,
  updatePage as updatePageData,
  updateProfile,
} from "@/lib/api/database.functions";
import { signMediaUrl } from "@/lib/media";
import type { ItemRow, LinkRow, PageRow, Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, ExternalLink, LogOut, ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

const MAX_IMAGE_EDGE = 1600;
const IMAGE_QUALITY = 0.82;

async function optimizeImage(file: File) {
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return { file, type: file.type };
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Não foi possível preparar a imagem.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const type = "image/webp";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("Não foi possível comprimir a imagem.")),
      type,
      IMAGE_QUALITY,
    );
  });

  return {
    file: new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type }),
    type,
  };
}

async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Erro ao ler a imagem."));
    reader.readAsDataURL(file);
  });
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    getAuthState().then((auth) => setUserId(auth.userId ?? ""));
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await logout();
    navigate({ to: "/auth", replace: true });
  }

  if (!userId) return null;

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl">Painel</h1>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              ver meu site <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-1" /> sair
          </Button>
        </header>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="pages">Páginas</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-6">
            <ProfileTab userId={userId} />
          </TabsContent>
          <TabsContent value="links" className="mt-6">
            <LinksTab userId={userId} />
          </TabsContent>
          <TabsContent value="pages" className="mt-6">
            <PagesTab userId={userId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============= PROFILE ===========
function ProfileTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["admin-profile", userId],
    queryFn: () => getAdminProfile(),
  });

  const [form, setForm] = useState<Partial<Profile>>({});
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name,
        bio: profile.bio,
        whatsapp: profile.whatsapp,
        avatar_url: profile.avatar_url,
      });
      if (profile.avatar_url) signMediaUrl(profile.avatar_url).then(setAvatarUrl);
    }
  }, [profile]);

  async function uploadAvatar(file: File) {
    try {
      const optimized = await optimizeImage(file);
      const path = await uploadMedia({
        data: {
          name: optimized.file.name,
          type: optimized.type,
          base64: await fileToBase64(optimized.file),
        },
      });
      setForm((f) => ({ ...f, avatar_url: path }));
      setAvatarUrl(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar a imagem");
    }
  }

  async function save() {
    setSaving(true);
    try {
      await updateProfile({
        data: {
          display_name: form.display_name ?? "Seu Nome",
          bio: form.bio ?? "",
          whatsapp: form.whatsapp ?? null,
          avatar_url: form.avatar_url ?? null,
        },
      });
      toast.success("Perfil salvo!");
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["admin-profile", userId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="soft-card p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-full overflow-hidden bg-muted border-2 border-border">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: "var(--gradient-soft)" }} />
          )}
        </div>
        <label className="cursor-pointer text-sm text-primary hover:underline">
          Trocar foto
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
          />
        </label>
      </div>
      <div>
        <Label>Nome</Label>
        <Input
          value={form.display_name ?? ""}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
        />
      </div>
      <div>
        <Label>Bio</Label>
        <Textarea
          rows={3}
          value={form.bio ?? ""}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
      </div>
      <div>
        <Label>WhatsApp (com DDD, só números)</Label>
        <Input
          placeholder="5511999999999"
          value={form.whatsapp ?? ""}
          onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
        />
        <p className="text-xs text-muted-foreground mt-1">Usado nos botões "Quero!" da lojinha.</p>
      </div>
      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Salvando…" : "Salvar perfil"}
      </Button>
    </div>
  );
}

// ============= LINKS ===========
function LinksTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-links", userId],
    queryFn: () => getAdminLinks(),
  });

  async function addLink() {
    const pos = (data?.links.length ?? 0) + 1;
    try {
      await createLink({ data: { position: pos } });
      qc.invalidateQueries({ queryKey: ["admin-links", userId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar o link");
    }
  }

  async function update(id: string, patch: Partial<LinkRow>) {
    try {
      await updateLink({ data: { id, patch } });
      qc.invalidateQueries({ queryKey: ["admin-links", userId] });
      qc.invalidateQueries({ queryKey: ["home"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar o link");
    }
  }

  async function remove(id: string) {
    if (!confirm("Apagar este link?")) return;
    await deleteLink({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-links", userId] });
    qc.invalidateQueries({ queryKey: ["home"] });
  }

  return (
    <div className="space-y-3">
      <Button onClick={addLink} className="w-full">
        <Plus className="h-4 w-4 mr-2" /> Adicionar link
      </Button>
      {data?.links.map((link) => (
        <div key={link.id} className="soft-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={link.is_active}
              onCheckedChange={(v) => update(link.id, { is_active: v })}
            />
            <Input
              className="flex-1"
              value={link.title}
              onChange={(e) => update(link.id, { title: e.target.value })}
            />
            <Button variant="ghost" size="icon" onClick={() => remove(link.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={link.kind}
                onValueChange={(v) => update(link.id, { kind: v as "external" | "page" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="external">Link externo</SelectItem>
                  <SelectItem value="page">Página interna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ícone (Lucide)</Label>
              <Input
                value={link.icon ?? ""}
                onChange={(e) => update(link.id, { icon: e.target.value })}
                placeholder="instagram"
              />
            </div>
          </div>
          {link.kind === "external" ? (
            <div>
              <Label className="text-xs">URL</Label>
              <Input
                value={link.url ?? ""}
                onChange={(e) => update(link.id, { url: e.target.value })}
                placeholder="https://instagram.com/seu"
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs">Página</Label>
              <Select
                value={link.page_id ?? ""}
                onValueChange={(v) => update(link.id, { page_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma página" />
                </SelectTrigger>
                <SelectContent>
                  {data.pages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.pages.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Crie uma página na aba "Páginas".
                </p>
              )}
            </div>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Dica de ícones: instagram, linkedin, youtube, mail, music, camera, store, heart, image,
        link.
      </p>
    </div>
  );
}

// ============= PAGES ===========
function PagesTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [openPage, setOpenPage] = useState<PageRow | null>(null);

  const { data: pages } = useQuery({
    queryKey: ["admin-pages", userId],
    queryFn: () => getAdminPages(),
  });

  async function addPage() {
    const title = prompt("Título da página:")?.trim();
    if (!title) return;
    const kind = (
      prompt("Tipo: 'gallery' (galeria) ou 'shop' (lojinha)?", "gallery") ?? "gallery"
    ).trim() as "gallery" | "shop";
    if (kind !== "gallery" && kind !== "shop") {
      toast.error("Tipo inválido");
      return;
    }
    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    try {
      await createPage({ data: { slug, title, kind } });
      qc.invalidateQueries({ queryKey: ["admin-pages", userId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar a página");
    }
  }

  async function updatePage(id: string, patch: Partial<PageRow>) {
    try {
      await updatePageData({ data: { id, patch } });
      qc.invalidateQueries({ queryKey: ["admin-pages", userId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar a página");
    }
  }

  async function removePage(id: string) {
    if (!confirm("Apagar essa página e todos os itens dela?")) return;
    await deletePage({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-pages", userId] });
    setOpenPage(null);
  }

  if (openPage) {
    return (
      <ItemsEditor
        page={openPage}
        onBack={() => setOpenPage(null)}
        onUpdate={updatePage}
        onDelete={() => removePage(openPage.id)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <Button onClick={addPage} className="w-full">
        <Plus className="h-4 w-4 mr-2" /> Nova página
      </Button>
      {pages?.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhuma página ainda. Crie uma galeria de fotos ou lojinha!
        </p>
      )}
      {pages?.map((p) => (
        <button
          key={p.id}
          onClick={() => setOpenPage(p)}
          className="soft-card p-4 w-full text-left flex items-center justify-between hover:shadow-[var(--shadow-glow)] transition"
        >
          <div>
            <div className="font-semibold">{p.title}</div>
            <div className="text-xs text-muted-foreground">
              /p/{p.slug} • {p.kind === "gallery" ? "Galeria" : "Lojinha"}
            </div>
          </div>
          <ImageIcon className="h-5 w-5 text-primary" />
        </button>
      ))}
    </div>
  );
}

// ============ ITEMS EDITOR ===========
function ItemsEditor({
  page,
  onBack,
  onUpdate,
  onDelete,
}: {
  page: PageRow;
  onBack: () => void;
  onUpdate: (id: string, patch: Partial<PageRow>) => Promise<void>;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(page.title);
  const [description, setDescription] = useState(page.description ?? "");
  const [uploading, setUploading] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["admin-items", page.id],
    queryFn: async () => {
      const arr = await getAdminItems({ data: { pageId: page.id } });
      const signed = await Promise.all(arr.map((i) => signMediaUrl(i.image_url)));
      return arr.map((it, i) => ({ ...it, signedUrl: signed[i] }));
    },
  });

  async function uploadFiles(files: FileList) {
    setUploading(true);
    let pos = items?.length ?? 0;
    for (const file of Array.from(files)) {
      pos++;
      try {
        const optimized = await optimizeImage(file);
        const path = await uploadMedia({
          data: {
            name: optimized.file.name,
            type: optimized.type,
            base64: await fileToBase64(optimized.file),
          },
        });
        await createItem({ data: { page_id: page.id, image_url: path, position: pos } });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao enviar a imagem");
        continue;
      }
    }
    setUploading(false);
    qc.invalidateQueries({ queryKey: ["admin-items", page.id] });
    toast.success("Itens enviados!");
  }

  async function updateItem(id: string, patch: Partial<ItemRow>) {
    try {
      await updateItemData({ data: { id, patch } });
      qc.invalidateQueries({ queryKey: ["admin-items", page.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar o item");
    }
  }

  async function removeItem(id: string) {
    if (!confirm("Apagar este item?")) return;
    await deleteItem({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-items", page.id] });
  }

  async function savePageMeta() {
    await onUpdate(page.id, { title, description });
    toast.success("Página salva!");
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-primary">
        ← voltar pra lista de páginas
      </button>

      <div className="soft-card p-5 space-y-3">
        <div>
          <Label>Título da página</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button onClick={savePageMeta} className="flex-1">
            Salvar página
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="soft-card p-5">
        <Label className="cursor-pointer block">
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary transition">
            <Plus className="h-6 w-6 mx-auto mb-2 text-primary" />
            <span className="text-sm">
              {uploading ? "Enviando…" : "Adicionar fotos (várias de uma vez)"}
            </span>
          </div>
          <input
            type="file"
            multiple
            accept="image/*"
            hidden
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
        </Label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items?.map((it) => (
          <div key={it.id} className="soft-card overflow-hidden">
            {it.signedUrl && (
              <img src={it.signedUrl} alt="" className="aspect-square w-full object-cover" />
            )}
            <div className="p-2 space-y-1">
              <Input
                className="text-xs h-8"
                placeholder="Título"
                defaultValue={it.title ?? ""}
                onBlur={(e) => updateItem(it.id, { title: e.target.value })}
              />
              {page.kind === "shop" && (
                <Input
                  className="text-xs h-8"
                  placeholder="Preço em R$ (ex 49.90)"
                  type="number"
                  step="0.01"
                  defaultValue={it.price_cents != null ? (it.price_cents / 100).toString() : ""}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value);
                    updateItem(it.id, { price_cents: isNaN(v) ? null : Math.round(v * 100) });
                  }}
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => removeItem(it.id)}
              >
                <Trash2 className="h-3 w-3 mr-1" /> apagar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
