import { buildMergeMetadataNode, extractFromMergedPR } from "@mergegraph/extractor";
import { fetchMergedPRContext, getInstallationOctokit } from "@mergegraph/github";
import type { Services } from "../../services/context.js";
import { assertCompute, assertGitHub } from "../../services/context.js";
import { persistKnowledgeNodes } from "../../services/ingest.js";
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
  const nodes = [buildMergeMetadataNode(prContext), ...extracted];

  const nodeIds = await persistKnowledgeNodes(
    services.db,
    compute,
    services.storage,
    services.env,
    {
      installationId,
      repoId: repo.id,
      repoFullName: repo.full_name,
      sourceEventType: "pull_request",
      sourceGithubId: pr.number,
      sourceUrl: prContext.url,
      deliveryId: job.deliveryId,
      webhookEvent: "pull_request.closed",
      validFrom: prContext.mergedAt ? new Date(prContext.mergedAt) : new Date(),
      rawContext: {
        title: prContext.title,
        body: prContext.body,
        author: prContext.author,
        mergedBy: prContext.mergedBy,
        mergedAt: prContext.mergedAt,
        reviews: prContext.reviews,
        comments: prContext.comments,
        files: prContext.files,
      },
    },
    nodes,
  );

  console.info(
    `[pull_request] Extracted ${nodeIds.length} nodes from PR #${pr.number} (${repo.full_name})`,
  );
}