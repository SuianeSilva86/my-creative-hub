import { createClient, type Client } from "@libsql/client/web";

import { getServerConfig } from "@/lib/config.server";

let client: Client | undefined;

export function getTursoClient(): Client {
  if (client) return client;

  const { tursoDatabaseUrl, tursoAuthToken } = getServerConfig();
  if (!tursoDatabaseUrl) {
    throw new Error("Missing TURSO_DATABASE_URL environment variable.");
  }

  client = createClient({
    url: tursoDatabaseUrl,
    authToken: tursoAuthToken || undefined,
  });

  return client;
}
