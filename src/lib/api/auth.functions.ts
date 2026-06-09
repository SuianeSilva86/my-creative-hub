import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { clearAdminSession, getAdminSession, setAdminSession } from "@/lib/auth.server";
import { getTursoClient } from "@/integrations/turso/client.server";
import { verifyPassword } from "@/lib/password.server";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAdminSession();
  return {
    authenticated: Boolean(session.data.userId),
    userId: session.data.userId ?? null,
    email: session.data.email ?? null,
  };
});

export const getAuthStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAdminSession();
  return { authenticated: Boolean(session.data.userId) };
});

export const login = createServerFn({ method: "POST" })
  .validator(credentialsSchema)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const result = await getTursoClient().execute({
      sql: `SELECT profile_id, email, password_hash, password_salt
        FROM admin_users WHERE email = ? LIMIT 1`,
      args: [email],
    });
    const admin = result.rows[0];
    const passwordMatches =
      typeof admin?.password_hash === "string" &&
      typeof admin.password_salt === "string" &&
      (await verifyPassword(data.password, admin.password_hash, admin.password_salt));

    if (!passwordMatches || typeof admin.profile_id !== "string") {
      throw new Error("Email ou senha inválidos.");
    }

    const storedEmail = typeof admin.email === "string" ? admin.email : email;
    await setAdminSession({ userId: admin.profile_id, email: storedEmail });
    return { userId: admin.profile_id, email: storedEmail };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await clearAdminSession();
});
