import { createMiddleware } from "@tanstack/react-start";

import { requireAdminSession } from "@/lib/auth.server";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await requireAdminSession();
  return next({ context: session });
});
