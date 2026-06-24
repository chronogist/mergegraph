import { and, sql, eq, inArray } from "drizzle-orm";
import { knowledgeEdges, knowledgeNodes, type Database } from "./index.js";

export type RetrievedNode = {
  id: string;
  title: string;
  summary: string;
  body: string;
  type: string;
  sourceUrl: string;
  score: number;
};

export async function hybridRetrieve(
  db: Database,
  repoId: number,
  embedding: number[],
  limit = 8,
): Promise<RetrievedNode[]> {
  const embeddingLiteral = `[${embedding.join(",")}]`;

  const vectorHits = await db.execute<{
    id: string;
    title: string;
    summary: string;
    body: string;
    type: string;
    source_url: string;
    score: number;
  }>(sql`
    SELECT id, title, summary, body, type, source_url,
           1 - (embedding <=> ${embeddingLiteral}::vector) AS score
    FROM knowledge_nodes
    WHERE repo_id = ${repoId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingLiteral}::vector
    LIMIT ${limit}
  `);

  const seedIds = vectorHits.map((r) => r.id);
  if (seedIds.length === 0) return [];

  const expanded = await db
    .select({
      id: knowledgeNodes.id,
      title: knowledgeNodes.title,
      summary: knowledgeNodes.summary,
      body: knowledgeNodes.body,
      type: knowledgeNodes.type,
      sourceUrl: knowledgeNodes.sourceUrl,
    })
    .from(knowledgeEdges)
    .innerJoin(knowledgeNodes, eq(knowledgeEdges.toNodeId, knowledgeNodes.id))
    .where(inArray(knowledgeEdges.fromNodeId, seedIds));

  const byId = new Map<string, RetrievedNode>();

  for (const row of vectorHits) {
    byId.set(row.id, {
      id: row.id,
      title: row.title,
      summary: row.summary,
      body: row.body,
      type: row.type,
      sourceUrl: row.source_url,
      score: row.score,
    });
  }

  for (const row of expanded) {
    if (!byId.has(row.id)) {
      byId.set(row.id, { ...row, score: 0.5 });
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export type KnowledgeNodeDetail = {
  id: string;
  type: string;
  title: string;
  summary: string;
  body: string;
  confidence: number;
  sourceEventType: string;
  sourceGithubId: number | null;
  sourceUrl: string;
  entities: unknown;
  validFrom: Date | null;
  createdAt: Date;
};

export type NeighborNode = {
  id: string;
  type: string;
  title: string;
  summary: string;
  sourceUrl: string;
  relation: string;
  direction: "outgoing" | "incoming";
};

export async function getNodeWithNeighbors(
  db: Database,
  repoId: number,
  nodeId: string,
): Promise<{ node: KnowledgeNodeDetail; neighbors: NeighborNode[] } | null> {
  const [node] = await db
    .select({
      id: knowledgeNodes.id,
      type: knowledgeNodes.type,
      title: knowledgeNodes.title,
      summary: knowledgeNodes.summary,
      body: knowledgeNodes.body,
      confidence: knowledgeNodes.confidence,
      sourceEventType: knowledgeNodes.sourceEventType,
      sourceGithubId: knowledgeNodes.sourceGithubId,
      sourceUrl: knowledgeNodes.sourceUrl,
      entities: knowledgeNodes.entities,
      validFrom: knowledgeNodes.validFrom,
      createdAt: knowledgeNodes.createdAt,
    })
    .from(knowledgeNodes)
    .where(
      and(eq(knowledgeNodes.id, nodeId), eq(knowledgeNodes.repoId, repoId)),
    )
    .limit(1);

  if (!node) return null;

  const outgoing = await db
    .select({
      id: knowledgeNodes.id,
      type: knowledgeNodes.type,
      title: knowledgeNodes.title,
      summary: knowledgeNodes.summary,
      sourceUrl: knowledgeNodes.sourceUrl,
      relation: knowledgeEdges.relation,
    })
    .from(knowledgeEdges)
    .innerJoin(knowledgeNodes, eq(knowledgeEdges.toNodeId, knowledgeNodes.id))
    .where(eq(knowledgeEdges.fromNodeId, nodeId));

  const incoming = await db
    .select({
      id: knowledgeNodes.id,
      type: knowledgeNodes.type,
      title: knowledgeNodes.title,
      summary: knowledgeNodes.summary,
      sourceUrl: knowledgeNodes.sourceUrl,
      relation: knowledgeEdges.relation,
    })
    .from(knowledgeEdges)
    .innerJoin(knowledgeNodes, eq(knowledgeEdges.fromNodeId, knowledgeNodes.id))
    .where(eq(knowledgeEdges.toNodeId, nodeId));

  const neighbors: NeighborNode[] = [
    ...outgoing.map((n) => ({
      ...n,
      direction: "outgoing" as const,
    })),
    ...incoming.map((n) => ({
      ...n,
      direction: "incoming" as const,
    })),
  ];

  return { node, neighbors };
}