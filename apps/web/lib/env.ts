export function getWebEnv() {
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  const apiUrl = process.env.MERGEGRAPH_API_URL ?? "http://localhost:3000";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

  return { clientId, clientSecret, apiUrl, appUrl };
}

export function requireOAuthEnv() {
  const env = getWebEnv();
  if (!env.clientId || !env.clientSecret) {
    throw new Error(
      "GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET are required for web OAuth",
    );
  }
  return { ...env, clientId: env.clientId, clientSecret: env.clientSecret };
}