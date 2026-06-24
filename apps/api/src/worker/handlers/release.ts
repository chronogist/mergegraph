import {
  buildReleaseMetadataNode,
  extractFromPublishedRelease,
} from "@mergegraph/extractor";
import {
  fetchPublishedReleaseContext,
  getInstallationOctokit,
} from "@mergegraph/github";
import type { Services } from "../../services/context.js";
import { assertCompute, assertGitHub } from "../../services/context.js";
import { persistKnowledgeNodes } from "../../services/ingest.js";
import type { WebhookJobData } from "../../queue/boss.js";

type ReleasePayload = {
  release?: {
    id?: number;
    html_url?: string;
    tag_name?: string;
    name?: string;
    body?: string;
    published_at?: string;
    author?: { login?: string };
  };
  repository?: {
    id?: number;
    full_name?: string;
  };
  installation?: { id?: number };
};

export async function handleReleaseEvent(services: Services, job: WebhookJobData) {
  if (job.action !== "published") return;

  const payload = job.payload as ReleasePayload;
  const release = payload.release;
  const repo = payload.repository;
  const installationId = job.installationId ?? payload.installation?.id;

  if (!release?.id || !repo?.id || !repo.full_name || !installationId) {
    return;
  }

  const [owner, repoName] = repo.full_name.split("/");
  if (!owner || !repoName) return;

  const github = assertGitHub(services);
  const compute = assertCompute(services);
  const octokit = await getInstallationOctokit(github, installationId);

  const releaseContext = await fetchPublishedReleaseContext(
    octokit,
    owner,
    repoName,
    release.id,
  );

  const extracted = await extractFromPublishedRelease(compute, releaseContext);
  const nodes = [buildReleaseMetadataNode(releaseContext), ...extracted];

  const nodeIds = await persistKnowledgeNodes(
    services.db,
    compute,
    services.storage,
    services.env,
    {
      installationId,
      repoId: repo.id,
      repoFullName: repo.full_name,
      sourceEventType: "release",
      sourceGithubId: release.id,
      sourceUrl: releaseContext.url,
      deliveryId: job.deliveryId,
      webhookEvent: "release.published",
      validFrom: releaseContext.publishedAt
        ? new Date(releaseContext.publishedAt)
        : new Date(),
      rawContext: {
        tagName: releaseContext.tagName,
        name: releaseContext.name,
        body: releaseContext.body,
        author: releaseContext.author,
        publishedAt: releaseContext.publishedAt,
      },
    },
    nodes,
  );

  console.info(
    `[release] Extracted ${nodeIds.length} nodes from release ${releaseContext.tagName} (${repo.full_name})`,
  );
}