import { verifyUserRepoAccess } from "@mergegraph/github";
import type { FastifyReply, FastifyRequest } from "fastify";

export type AuthenticatedRequest = FastifyRequest & {
  githubToken: string;
  githubLogin: string;
};

export function extractBearerToken(
  authorization: string | undefined,
): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export async function requireGitHubAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthenticatedRequest | null> {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    await reply.code(401).send({ error: "Missing Authorization: Bearer token" });
    return null;
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!userResponse.ok) {
    await reply.code(401).send({ error: "Invalid GitHub token" });
    return null;
  }

  const user = (await userResponse.json()) as { login?: string };
  if (!user.login) {
    await reply.code(401).send({ error: "Invalid GitHub user response" });
    return null;
  }

  const authed = request as AuthenticatedRequest;
  authed.githubToken = token;
  authed.githubLogin = user.login;
  return authed;
}

export async function requireRepoAccess(
  request: AuthenticatedRequest,
  reply: FastifyReply,
  owner: string,
  repo: string,
): Promise<boolean> {
  const access = await verifyUserRepoAccess(
    request.githubToken,
    owner,
    repo,
  );

  if (!access) {
    await reply.code(403).send({ error: "No access to this repository" });
    return false;
  }

  return true;
}