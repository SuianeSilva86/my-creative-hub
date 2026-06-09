import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getPublicPage } from "@/lib/api/database.functions";
import { signMany, formatBRL, buildWhatsappLink } from "@/lib/media";
import type { ItemRow, PageRow, Profile } from "@/lib/types";

export const Route = createFileRoute("/p/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Meu link` },
      { name: "description", content: "Veja meus trabalhos." },
    ],
  }),
  component: PageView,
});

function PageView() {
  const { slug } = Route.useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["page", slug],
    queryFn: async () => {
      const result = await getPublicPage({ data: { slug } });
      if (!result) throw notFound();
      const signed = await signMany(result.items.map((i) => i.image_url));
      return {
        page: result.page as PageRow,
        items: result.items as ItemRow[],
        signed,
        profile: result.profile as Profile | null,
      };
    },
  });

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  if (isError || !data)
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="soft-card p-8 text-center max-w-sm">
          <h1 className="text-2xl mb-2">Página não encontrada</h1>
          <Link to="/" className="link-tile link-tile-hover justify-center mt-4">
            Voltar
          </Link>
        </div>
      </div>
    );

  const { page, items, signed, profile } = data;

  return (
    <main className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> voltar
        </Link>

        <header className="mb-8">
          <h1 className="text-4xl sm:text-5xl">{page.title}</h1>
          {page.description && (
            <p className="mt-3 text-muted-foreground leading-relaxed max-w-prose">
              {page.description}
            </p>
          )}
        </header>

        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">Em breve, novidades por aqui ✨</p>
        ) : page.kind === "gallery" ? (
          <Gallery items={items} signed={signed} />
        ) : (
          <Shop items={items} signed={signed} whatsapp={profile?.whatsapp ?? null} />
        )}
      </div>
    </main>
  );
}

function Gallery({ items, signed }: { items: ItemRow[]; signed: Record<string, string> }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="columns-2 sm:columns-3 gap-3 [column-fill:_balance]">
        {items.map((item) => {
          const url = signed[item.image_url];
          return (
            <button
              key={item.id}
              onClick={() => url && setOpen(url)}
              className="mb-3 block w-full overflow-hidden rounded-2xl border border-border bg-card break-inside-avoid group"
            >
              {url ? (
                <img
                  src={url}
                  alt={item.title ?? ""}
                  loading="lazy"
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="aspect-square bg-muted animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
      {open && (
        <div
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img src={open} alt="" className="max-h-[92vh] max-w-full rounded-xl" />
        </div>
      )}
    </>
  );
}

function Shop({
  items,
  signed,
  whatsapp,
}: {
  items: ItemRow[];
  signed: Record<string, string>;
  whatsapp: string | null;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5">
      {items.map((item) => {
        const url = signed[item.image_url];
        const msg = `Oi! Tenho interesse em "${item.title || "uma peça"}"`;
        return (
          <article key={item.id} className="soft-card overflow-hidden flex flex-col">
            {url ? (
              <img
                src={url}
                alt={item.title ?? ""}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="aspect-square w-full bg-muted animate-pulse" />
            )}
            <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2">
              {item.title && (
                <h3 className="font-semibold text-sm sm:text-base leading-snug">{item.title}</h3>
              )}
              {item.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
              )}
              {item.price_cents != null && (
                <p className="text-primary font-bold text-base sm:text-lg mt-auto">
                  {formatBRL(item.price_cents)}
                </p>
              )}
              {whatsapp && (
                <a
                  href={buildWhatsappLink(whatsapp, msg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold py-2 px-3 hover:opacity-90 transition"
                >
                  <MessageCircle className="h-4 w-4" /> Quero!
                </a>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
