import { desc, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  getNodeWithNeighbors,
  hybridRetrieve,
  knowledgeNodes,
  repositories,
  type Database,
} from "@mergegraph/db";
import { verifyUserRepoAccess } from "@mergegraph/github";
import type { Services } from "../services/context.js";
import { assertCompute } from "../services/context.js";
import {
  requireGitHubAuth,
  requireRepoAccess,
} from "../middleware/github-auth.js";

type RepoRouteDeps = {
  db: Database;
  services: Services;
};

async function resolveRepo(
  db: Database,
  owner: string,
  repo: string,
) {
  const fullName = `${owner}/${repo}`;
  const [row] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.fullName, fullName))
    .limit(1);

  if (!row || row.removedAt) return null;
  return row;
}

export async function registerRepoRoutes(
  app: FastifyInstance,
  { db, services }: RepoRouteDeps,
) {
  app.get("/api/repos", async (request, reply) => {
    const authed = await requireGitHubAuth(request, reply);
    if (!authed) return;

    const rows = await db
      .select()
      .from(repositories)
      .where(isNull(repositories.removedAt));

    const accessible = [];

    for (const row of rows) {
      const [owner, repoName] = row.fullName.split("/");
      if (!owner || !repoName) continue;

      const access = await verifyUserRepoAccess(
        authed.githubToken,
        owner,
        repoName,
      );
      if (!access) continue;

      accessible.push({
        id: row.id,
        fullName: row.fullName,
        owner,
        name: repoName,
        installationId: row.installationId,
      });
    }

    return { repos: accessible };
  });

  app.get<{ Params: { owner: string; repo: string } }>(
    "/api/repos/:owner/:repo/nodes",
    async (request, reply) => {
      const authed = await requireGitHubAuth(request, reply);
      if (!authed) return;

      const { owner, repo } = request.params;
      if (!(await requireRepoAccess(authed, reply, owner, repo))) return;

      const repoRow = await resolveRepo(db, owner, repo);
      if (!repoRow) {
        return reply.code(404).send({ error: "Repository not connected" });
      }

      const nodes = await db
        .select({
          id: knowledgeNodes.id,
          type: knowledgeNodes.type,
          title: knowledgeNodes.title,
          summary: knowledgeNodes.summary,
          sourceUrl: knowledgeNodes.sourceUrl,
          sourceEventType: knowledgeNodes.sourceEventType,
          validFrom: knowledgeNodes.validFrom,
          createdAt: knowledgeNodes.createdAt,
        })
        .from(knowledgeNodes)
        .where(eq(knowledgeNodes.repoId, repoRow.id))
        .orderBy(desc(knowledgeNodes.createdAt))
        .limit(50);

      return { nodes };
    },
  );

  app.get<{ Params: { owner: string; repo: string }; Querystring: { q?: string } }>(
    "/api/repos/:owner/:repo/search",
    async (request, reply) => {
      const authed = await requireGitHubAuth(request, reply);
      if (!authed) return;

      const { owner, repo } = request.params;
      const query = request.query.q?.trim();

      if (!query) {
        return reply.code(400).send({ error: "Missing query parameter q" });
      }

      if (!(await requireRepoAccess(authed, reply, owner, repo))) return;

      const repoRow = await resolveRepo(db, owner, repo);
      if (!repoRow) {
        return reply.code(404).send({ error: "Repository not connected" });
      }

      const compute = assertCompute(services);
      const embedding = await compute.embed(query, "query");
      const nodes = await hybridRetrieve(db, repoRow.id, embedding);

      return { query, nodes };
    },
  );

  app.get<{ Params: { owner: string; repo: string; id: string } }>(
    "/api/repos/:owner/:repo/nodes/:id",
    async (request, reply) => {
      const authed = await requireGitHubAuth(request, reply);
      if (!authed) return;

      const { owner, repo, id } = request.params;
      if (!(await requireRepoAccess(authed, reply, owner, repo))) return;

      const repoRow = await resolveRepo(db, owner, repo);
      if (!repoRow) {
        return reply.code(404).send({ error: "Repository not connected" });
      }

      const detail = await getNodeWithNeighbors(db, repoRow.id, id);
      if (!detail) {
        return reply.code(404).send({ error: "Knowledge node not found" });
      }

      return detail;
    },
  );
}