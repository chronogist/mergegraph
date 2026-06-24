import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getWebEnv } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);

  const { appUrl } = getWebEnv();
  return NextResponse.redirect(`${appUrl}/`, { status: 303 });
}