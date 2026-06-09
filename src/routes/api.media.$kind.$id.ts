import { Buffer } from "node:buffer";
import { createFileRoute } from "@tanstack/react-router";

import { getTursoClient } from "@/integrations/turso/client.server";

const dataUrlPattern = /^data:([^;,]+);base64,([\s\S]+)$/;

export const Route = createFileRoute("/api/media/$kind/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { kind, id } = params;
        if (kind !== "profile" && kind !== "item") {
          return new Response("Not found", { status: 404 });
        }

        const result = await getTursoClient().execute({
          sql:
            kind === "profile"
              ? "SELECT avatar_url AS media FROM profiles WHERE id = ? LIMIT 1"
              : "SELECT image_url AS media FROM items WHERE id = ? LIMIT 1",
          args: [id],
        });
        const media = result.rows[0]?.media;
        if (typeof media !== "string" || !media) {
          return new Response("Not found", { status: 404 });
        }

        if (/^https?:\/\//i.test(media)) {
          return Response.redirect(media, 302);
        }

        const match = dataUrlPattern.exec(media);
        if (!match) {
          return new Response("Invalid media", { status: 500 });
        }

        return new Response(Buffer.from(match[2], "base64"), {
          headers: {
            "content-type": match[1],
            "cache-control":
              kind === "item"
                ? "public, max-age=31536000, immutable"
                : "public, max-age=300, stale-while-revalidate=86400",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
