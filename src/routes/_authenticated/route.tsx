import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const auth = await getAuthState();
    if (!auth.authenticated) throw redirect({ to: "/auth" });
    return { user: auth };
  },
  component: () => <Outlet />,
});
