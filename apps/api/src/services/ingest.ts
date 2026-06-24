import { and, eq } from "drizzle-orm";
import type { ComputeClient } from "@mergegraph/compute-0g";
import { knowledgeNodes, type Database } from "@mergegraph/db";
import type { ExtractedNode } from "@mergegraph/extractor";
import type { StorageClient, MemoryCapsule } from "@mergegraph/storage-0g";
import type { Env } from "../config.js";

export type IngestSource = {
  installationId: number;
  repoId: number;
  repoFullName: string;
  sourceEventType: "pull_request" | "issue" | "release";
  sourceGithubId: number;
  sourceUrl: string;
  deliveryId: string;
  webhookEvent: string;
  validFrom?: Date;
  rawContext: Record<string, unknown>;
};

export async function sourceAlreadyIngested(
  db: Database,
  repoId: number,
  sourceEventType: string,
  sourceGithubId: number,
): Promise<boolean> {
  const existing = await db
    .select({ id: knowledgeNodes.id })
    .from(knowledgeNodes)
    .where(
      and(
        eq(knowledgeNodes.repoId, repoId),
        eq(knowledgeNodes.sourceEventType, sourceEventType),
        eq(knowledgeNodes.sourceGithubId, sourceGithubId),
      ),
    )
    .limit(1);

  return existing.length > 0;
}

export async function persistKnowledgeNodes(
  db: Database,
  compute: ComputeClient,
  storage: StorageClient,
  env: Env,
  source: IngestSource,
  nodes: ExtractedNode[],
): Promise<string[]> {
  await db
    .delete(knowledgeNodes)
    .where(
      and(
        eq(knowledgeNodes.repoId, source.repoId),
        eq(knowledgeNodes.sourceEventType, source.sourceEventType),
        eq(knowledgeNodes.sourceGithubId, source.sourceGithubId),
      ),
    );

  const nodeIds: string[] = [];

  for (const node of nodes) {
    const textForEmbedding = `${node.title}\n${node.summary}\n${node.body}`;
    const embedding = await compute.embed(textForEmbedding, "document");

    const [inserted] = await db
      .insert(knowledgeNodes)
      .values({
        installationId: source.installationId,
        repoId: source.repoId,
        type: node.type,
        title: node.title,
        summary: node.summary,
        body: node.body,
        confidence: node.confidence,
        sourceEventType: source.sourceEventType,
        sourceGithubId: source.sourceGithubId,
        sourceUrl: source.sourceUrl,
        entities: node.entities,
        embedding,
        validFrom: source.validFrom ?? new Date(),
      })
      .returning({ id: knowledgeNodes.id });

    if (!inserted) continue;
    nodeIds.push(inserted.id);

    const capsule: MemoryCapsule = {
      version: 1,
      nodeId: inserted.id,
      installationId: source.installationId,
      repoFullName: source.repoFullName,
      extractedAt: new Date().toISOString(),
      extractor: {
        model: env.OG_CHAT_MODEL,
        provider: "0g-compute-router",
      },
      source: {
        event: source.webhookEvent,
        deliveryId: source.deliveryId,
        githubUrls: [source.sourceUrl],
      },
      node: { ...node, id: inserted.id },
      rawContext: source.rawContext,
    };

    const stored = await storage.storeCapsule(capsule);

    await db
      .update(knowledgeNodes)
      .set({
        capsuleRootHash: stored.rootHash,
        capsulePayload: stored.payload,
      })
      .where(eq(knowledgeNodes.id, inserted.id));
  }

  return nodeIds;
}