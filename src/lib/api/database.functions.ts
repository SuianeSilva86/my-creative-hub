import { createServerFn } from "@tanstack/react-start";
import type { InValue } from "@libsql/client";
import { z } from "zod";

import { requireAuth } from "@/integrations/auth/auth-middleware";
import { getTursoClient } from "@/integrations/turso/client.server";
import type { ItemRow, LinkRow, PageRow, Profile } from "@/lib/types";

const idSchema = z.string().min(1);
const nullableText = z.string().nullable();

const profilePatchSchema = z.object({
  display_name: z.string().min(1),
  bio: z.string(),
  whatsapp: nullableText,
  avatar_url: nullableText,
});

const linkPatchSchema = z.object({
  title: z.string().optional(),
  icon: nullableText.optional(),
  kind: z.enum(["external", "page"]).optional(),
  url: nullableText.optional(),
  page_id: nullableText.optional(),
  position: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

const pagePatchSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: nullableText.optional(),
  kind: z.enum(["gallery", "shop"]).optional(),
});

const itemPatchSchema = z.object({
  title: nullableText.optional(),
  description: nullableText.optional(),
  price_cents: z.number().int().nullable().optional(),
  position: z.number().int().optional(),
});

function rowsAs<T>(rows: Array<Record<string, unknown>>): T[] {
  return rows.map((row) => ({
    ...row,
    ...(Object.hasOwn(row, "is_active") ? { is_active: Boolean(row.is_active) } : {}),
  })) as T[];
}

function placeholders(values: Record<string, unknown>) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return {
    entries,
    assignments: entries.map(([key]) => `${key} = ?`).join(", "),
    args: entries.map(
      ([, value]) => (typeof value === "boolean" ? Number(value) : value) as InValue,
    ),
  };
}

async function ensureProfile(userId: string, email?: string) {
  const displayName = email?.split("@")[0] || "Seu Nome";
  await getTursoClient().execute({
    sql: `INSERT OR IGNORE INTO profiles (id, display_name) VALUES (?, ?)`,
    args: [userId, displayName],
  });
}

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const db = getTursoClient();
  const [profileResult, linksResult, pagesResult] = await Promise.all([
    db.execute(
      `SELECT id, display_name, bio, avatar_url, whatsapp FROM profiles ORDER BY updated_at DESC LIMIT 1`,
    ),
    db.execute(`SELECT id, user_id, title, icon, kind, url, page_id, position, is_active
      FROM links WHERE is_active = 1 ORDER BY position`),
    db.execute(`SELECT id, user_id, slug, title, description, kind FROM pages`),
  ]);

  return {
    profile: rowsAs<Profile>(profileResult.rows)[0] ?? null,
    links: rowsAs<LinkRow>(linksResult.rows),
    pages: rowsAs<PageRow>(pagesResult.rows),
  };
});

export const getPublicPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = getTursoClient();
    const pageResult = await db.execute({
      sql: `SELECT id, user_id, slug, title, description, kind FROM pages WHERE slug = ? LIMIT 1`,
      args: [data.slug],
    });
    const page = rowsAs<PageRow>(pageResult.rows)[0] ?? null;
    if (!page) return null;

    const [itemsResult, profileResult] = await Promise.all([
      db.execute({
        sql: `SELECT id, page_id, user_id, image_url, title, description, price_cents, position
          FROM items WHERE page_id = ? ORDER BY position`,
        args: [page.id],
      }),
      db.execute({
        sql: `SELECT id, display_name, bio, avatar_url, whatsapp FROM profiles WHERE id = ? LIMIT 1`,
        args: [page.user_id],
      }),
    ]);

    return {
      page,
      items: rowsAs<ItemRow>(itemsResult.rows),
      profile: rowsAs<Profile>(profileResult.rows)[0] ?? null,
    };
  });

export const getAdminProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await ensureProfile(context.userId, context.email);
    const result = await getTursoClient().execute({
      sql: `SELECT id, display_name, bio, avatar_url, whatsapp FROM profiles WHERE id = ? LIMIT 1`,
      args: [context.userId],
    });
    return rowsAs<Profile>(result.rows)[0] ?? null;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(profilePatchSchema)
  .handler(async ({ data, context }) => {
    await ensureProfile(context.userId, context.email);
    await getTursoClient().execute({
      sql: `UPDATE profiles
        SET display_name = ?, bio = ?, whatsapp = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      args: [data.display_name, data.bio, data.whatsapp, data.avatar_url, context.userId],
    });
  });

export const getAdminLinks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = getTursoClient();
    const [linksResult, pagesResult] = await Promise.all([
      db.execute({
        sql: `SELECT id, user_id, title, icon, kind, url, page_id, position, is_active
          FROM links WHERE user_id = ? ORDER BY position`,
        args: [context.userId],
      }),
      db.execute({
        sql: `SELECT id, user_id, slug, title, description, kind FROM pages WHERE user_id = ?`,
        args: [context.userId],
      }),
    ]);
    return {
      links: rowsAs<LinkRow>(linksResult.rows),
      pages: rowsAs<PageRow>(pagesResult.rows),
    };
  });

export const createLink = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ position: z.number().int() }))
  .handler(async ({ data, context }) => {
    await ensureProfile(context.userId, context.email);
    await getTursoClient().execute({
      sql: `INSERT INTO links (id, user_id, title, icon, kind, url, position)
        VALUES (?, ?, 'Novo link', 'link', 'external', 'https://', ?)`,
      args: [crypto.randomUUID(), context.userId, data.position],
    });
  });

export const updateLink = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: idSchema, patch: linkPatchSchema }))
  .handler(async ({ data, context }) => {
    const update = placeholders(data.patch);
    if (!update.entries.length) return;
    await getTursoClient().execute({
      sql: `UPDATE links SET ${update.assignments}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
      args: [...update.args, data.id, context.userId],
    });
  });

export const deleteLink = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: idSchema }))
  .handler(async ({ data, context }) => {
    await getTursoClient().execute({
      sql: `DELETE FROM links WHERE id = ? AND user_id = ?`,
      args: [data.id, context.userId],
    });
  });

export const getAdminPages = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const result = await getTursoClient().execute({
      sql: `SELECT id, user_id, slug, title, description, kind
        FROM pages WHERE user_id = ? ORDER BY created_at`,
      args: [context.userId],
    });
    return rowsAs<PageRow>(result.rows);
  });

export const createPage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      slug: z.string().min(1),
      title: z.string().min(1),
      kind: z.enum(["gallery", "shop"]),
    }),
  )
  .handler(async ({ data, context }) => {
    await ensureProfile(context.userId, context.email);
    await getTursoClient().execute({
      sql: `INSERT INTO pages (id, user_id, slug, title, kind, description)
        VALUES (?, ?, ?, ?, ?, '')`,
      args: [crypto.randomUUID(), context.userId, data.slug, data.title, data.kind],
    });
  });

export const updatePage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: idSchema, patch: pagePatchSchema }))
  .handler(async ({ data, context }) => {
    const update = placeholders(data.patch);
    if (!update.entries.length) return;
    await getTursoClient().execute({
      sql: `UPDATE pages SET ${update.assignments}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
      args: [...update.args, data.id, context.userId],
    });
  });

export const deletePage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: idSchema }))
  .handler(async ({ data, context }) => {
    await getTursoClient().execute({
      sql: `DELETE FROM pages WHERE id = ? AND user_id = ?`,
      args: [data.id, context.userId],
    });
  });

export const getAdminItems = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator(z.object({ pageId: idSchema }))
  .handler(async ({ data, context }) => {
    const result = await getTursoClient().execute({
      sql: `SELECT id, page_id, user_id, image_url, title, description, price_cents, position
        FROM items WHERE page_id = ? AND user_id = ? ORDER BY position`,
      args: [data.pageId, context.userId],
    });
    return rowsAs<ItemRow>(result.rows);
  });

export const createItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      page_id: idSchema,
      image_url: z.string().min(1),
      position: z.number().int(),
    }),
  )
  .handler(async ({ data, context }) => {
    const page = await getTursoClient().execute({
      sql: `SELECT id FROM pages WHERE id = ? AND user_id = ? LIMIT 1`,
      args: [data.page_id, context.userId],
    });
    if (!page.rows.length) throw new Error("Page not found.");

    await getTursoClient().execute({
      sql: `INSERT INTO items (id, page_id, user_id, image_url, title, description, position)
        VALUES (?, ?, ?, ?, '', '', ?)`,
      args: [crypto.randomUUID(), data.page_id, context.userId, data.image_url, data.position],
    });
  });

export const updateItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: idSchema, patch: itemPatchSchema }))
  .handler(async ({ data, context }) => {
    const update = placeholders(data.patch);
    if (!update.entries.length) return;
    await getTursoClient().execute({
      sql: `UPDATE items SET ${update.assignments}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
      args: [...update.args, data.id, context.userId],
    });
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: idSchema }))
  .handler(async ({ data, context }) => {
    await getTursoClient().execute({
      sql: `DELETE FROM items WHERE id = ? AND user_id = ?`,
      args: [data.id, context.userId],
    });
  });
