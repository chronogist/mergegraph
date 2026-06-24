import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireOAuthEnv } from "@/lib/env";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";

export async function GET(request: NextRequest) {
  const { clientId, clientSecret, appUrl } = requireOAuthEnv();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const store = await cookies();
  const savedState = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${appUrl}/?error=oauth_state`);
  }

  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${appUrl}/api/auth/callback`,
      }),
    },
  );

  if (!tokenResponse.ok) {
    return NextResponse.redirect(`${appUrl}/?error=oauth_token`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/?error=oauth_token`);
  }

  store.set(SESSION_COOKIE, tokenData.access_token, sessionCookieOptions());

  return NextResponse.redirect(`${appUrl}/repos`);
}