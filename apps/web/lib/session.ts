import { cookies } from "next/headers";

export const SESSION_COOKIE = "mg_github_token";
export const OAUTH_STATE_COOKIE = "mg_oauth_state";

export async function getGitHubToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export function sessionCookieOptions(maxAge = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}