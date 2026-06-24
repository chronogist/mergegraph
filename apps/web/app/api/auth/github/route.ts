import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireOAuthEnv } from "@/lib/env";
import { OAUTH_STATE_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function GET() {
  const { clientId, appUrl } = requireOAuthEnv();
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${appUrl}/api/auth/callback`;

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    ...sessionCookieOptions(600),
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user",
    state,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`,
  );
}