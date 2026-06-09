import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/integrations/auth/auth-middleware";

const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

const mediaSchema = z.object({
  name: z.string().min(1),
  type: z.string().regex(/^image\//),
  base64: z.string().min(1),
});

export const uploadMedia = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(mediaSchema)
  .handler(async ({ data }) => {
    const estimatedBytes = Math.ceil((data.base64.length * 3) / 4);
    if (estimatedBytes > MAX_MEDIA_BYTES) {
      throw new Error("A imagem deve ter no máximo 4 MB.");
    }
    return `data:${data.type};base64,${data.base64}`;
  });
