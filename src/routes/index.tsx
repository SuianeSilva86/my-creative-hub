import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getHomeData } from "@/lib/api/database.functions";
import { signMediaUrl } from "@/lib/media";
import {
  ArrowUpRight,
  Camera,
  Facebook,
  Github,
  Globe,
  Heart,
  Image,
  Instagram,
  Link as LinkIcon,
  Linkedin,
  Mail,
  Music,
  Store,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";

const homeQueryOptions = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHomeData(),
});

const iconMap: Record<string, LucideIcon> = {
  camera: Camera,
  facebook: Facebook,
  github: Github,
  globe: Globe,
  heart: Heart,
  image: Image,
  instagram: Instagram,
  link: LinkIcon,
  linkedin: Linkedin,
  mail: Mail,
  music: Music,
  store: Store,
  twitter: Twitter,
  youtube: Youtube,
};

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQueryOptions),
  head: () => ({
    meta: [
      { title: "Meu link — todos os meus lugares" },
      { name: "description", content: "Currículo, redes, fotos e lojinha em um único lugar." },
      { property: "og:title", content: "Meu link" },
      {
        property: "og:description",
        content: "Currículo, redes, fotos e lojinha em um único lugar.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(homeQueryOptions);

  const [avatar, setAvatar] = useState<string>("");
  useEffect(() => {
    if (data?.profile?.avatar_url) signMediaUrl(data.profile.avatar_url).then(setAvatar);
  }, [data?.profile?.avatar_url]);

  if (!data?.profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="soft-card max-w-md p-10 text-center">
          <h1 className="text-3xl mb-3">Bem-vinda 💜</h1>
          <p className="text-muted-foreground mb-6">
            Seu site ainda não foi configurado. Faça login no painel pra começar.
          </p>
          <Link to="/auth" className="link-tile link-tile-hover justify-center">
            Entrar no painel
          </Link>
        </div>
      </div>
    );
  }

  const { profile, links, pages } = data;
  const pagesById = new Map(pages.map((p) => [p.id, p]));

  return (
    <main className="min-h-screen px-5 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md flex flex-col items-center">
        <div className="relative">
          <div
            className="absolute inset-0 -m-2 rounded-full blur-xl opacity-60"
            style={{ background: "var(--gradient-soft)" }}
          />
          <div className="relative h-28 w-28 rounded-full overflow-hidden border-4 border-card shadow-[var(--shadow-glow)]">
            {avatar ? (
              <img
                src={avatar}
                alt={profile.display_name}
                width={112}
                height={112}
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full" style={{ background: "var(--gradient-soft)" }} />
            )}
          </div>
        </div>

        <h1 className="mt-6 text-3xl text-center">{profile.display_name}</h1>
        {profile.bio && (
          <p className="mt-2 text-center text-muted-foreground leading-relaxed">{profile.bio}</p>
        )}

        <div className="mt-8 w-full flex flex-col gap-3">
          {links.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">Nenhum link ainda.</p>
          )}
          {links.map((link) => {
            const iconKey = (link.icon ?? "link").toLowerCase().replace(/[^a-z]/g, "");
            const Icon = iconMap[iconKey] ?? LinkIcon;
            if (link.kind === "external" && link.url) {
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-tile link-tile-hover"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="flex-1">{link.title}</span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </a>
              );
            }
            const page = link.page_id ? pagesById.get(link.page_id) : null;
            if (page) {
              return (
                <Link
                  key={link.id}
                  to="/p/$slug"
                  params={{ slug: page.slug }}
                  className="link-tile link-tile-hover"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="flex-1">{link.title}</span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            }
            return null;
          })}
        </div>

        <Link to="/auth" className="mt-10 text-xs text-muted-foreground/70 hover:text-primary">
          editar
        </Link>
      </div>
    </main>
  );
}
