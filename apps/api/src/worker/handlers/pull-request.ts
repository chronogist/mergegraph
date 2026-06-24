import { eq } from "drizzle-orm";
import { knowledgeNodes } from "@mergegraph/db";
import { extractFromMergedPR } from "@mergegraph/extractor";
import {
  fetchMergedPRContext,
  getInstallationOctokit,
} from "@mergegraph/github";
import type { MemoryCapsule } from "@mergegraph/storage-0g";
import type { Services } from "../../services/context.js";
import { assertCompute, assertGitHub } from "../../services/context.js";
import type { WebhookJobData } from "../../queue/boss.js";

type PRPayload = {
  pull_request?: {
    merged?: boolean;
    number?: number;
    html_url?: string;
    title?: string;
    body?: string;
  };
  repository?: {
    id?: number;
    full_name?: string;
    name?: string;
    owner?: { login?: string };
  };
  installation?: { id?: number };
};

export async function handlePullRequestEvent(
  services: Services,
  job: WebhookJobData,
) {
  if (job.action !== "closed") return;

  const payload = job.payload as PRPayload;
  const pr = payload.pull_request;
  const repo = payload.repository;
  const installationId = job.installationId ?? payload.installation?.id;

  if (!pr?.merged || !pr.number || !repo?.id || !repo.full_name || !installationId) {
    return;
  }

  const [owner, repoName] = repo.full_name.split("/");
  if (!owner || !repoName) return;

  const github = assertGitHub(services);
  const compute = assertCompute(services);
  const octokit = await getInstallationOctokit(github, installationId);

  const prContext = await fetchMergedPRContext(
    octokit,
    owner,
    repoName,
    pr.number,
  );

  const extracted = await extractFromMergedPR(compute, prContext);
  if (extracted.length === 0) {
    console.info(`[pull_request] No knowledge extracted from PR #${pr.number}`);
    return;
  }

  const nodeIds: string[] = [];

  for (const node of extracted) {
    const textForEmbedding = `${node.title}\n${node.summary}\n${node.body}`;
    const embedding = await compute.embed(textForEmbedding);

    const [inserted] = await services.db
      .insert(knowledgeNodes)
      .values({
        installationId,
        repoId: repo.id,
        type: node.type,
        title: node.title,
        summary: node.summary,
        body: node.body,
        confidence: node.confidence,
        sourceEventType: "pull_request",
        sourceGithubId: pr.number,
        sourceUrl: prContext.url,
        entities: node.entities,
        embedding,
        validFrom: prContext.mergedAt ? new Date(prContext.mergedAt) : new Date(),
      })
      .returning({ id: knowledgeNodes.id });

    if (!inserted) continue;
    nodeIds.push(inserted.id);

    const capsule: MemoryCapsule = {
      version: 1,
      nodeId: inserted.id,
      installationId,
      repoFullName: repo.full_name,
      extractedAt: new Date().toISOString(),
      extractor: {
        model: services.env.OG_CHAT_MODEL,
        provider: "0g-compute-router",
      },
      source: {
        event: "pull_request.closed",
        deliveryId: job.deliveryId,
        githubUrls: [prContext.url],
      },
      node: { ...node, id: inserted.id },
      rawContext: {
        title: prContext.title,
        body: prContext.body,
        reviews: prContext.reviews,
        comments: prContext.comments,
        files: prContext.files,
      },
    };

    const stored = await services.storage.storeCapsule(capsule);

    await services.db
      .update(knowledgeNodes)
      .set({
        capsuleRootHash: stored.rootHash,
        capsulePayload: stored.payload,
      })
      .where(eq(knowledgeNodes.id, inserted.id));
  }

  console.info(
    `[pull_request] Extracted ${nodeIds.length} nodes from PR #${pr.number} (${repo.full_name})`,
  );
}