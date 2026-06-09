import {
  clearSession,
  getSession,
  updateSession,
  type SessionConfig,
} from "@tanstack/react-start/server";

import { getServerConfig } from "@/lib/config.server";

export interface AdminSession {
  userId: string;
  email: string;
}

const SESSION_NAME = "creative-hub-admin";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function getSessionConfig(): SessionConfig {
  const { sessionSecret, nodeEnv } = getServerConfig();
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return {
    name: SESSION_NAME,
    password: sessionSecret,
    maxAge: SESSION_MAX_AGE,
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: nodeEnv === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    },
  };
}

export async function getAdminSession() {
  return getSession<AdminSession>(getSessionConfig());
}

export async function setAdminSession(data: AdminSession) {
  return updateSession<AdminSession>(getSessionConfig(), data);
}

export async function clearAdminSession() {
  return clearSession(getSessionConfig());
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session.data.userId || !session.data.email) {
    throw new Error("Unauthorized");
  }
  return session.data as AdminSession;
}
