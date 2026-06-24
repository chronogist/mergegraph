import {
  buildIssueCloseMetadataNode,
  buildMergeMetadataNode,
  extractFromClosedIssue,
  extractFromMergedPR,
  type ExtractedNode,
} from "@mergegraph/extractor";
import type { MergedPRContext } from "@mergegraph/github";
import {
  fetchClosedIssueContext,
  fetchMergedPRContext,
  getInstallationOctokit,
} from "@mergegraph/github";
import type { Services } from "./context.js";
import { assertCompute, assertGitHub } from "./context.js";
import { persistKnowledgeNodes, sourceAlreadyIngested } from "./ingest.js";

export type MergedPRIngestResult = {
  nodeCount: number;
  prContext?: MergedPRContext;
  nodes?: ExtractedNode[];
};

export async function ingestMergedPR(
  services: Services,
  params: {
    installationId: number;
    repoId: number;
    repoFullName: string;
    prNumber: number;
    deliveryId: string;
    skipIfExists?: boolean;
  },
): Promise<MergedPRIngestResult> {
  if (params.skipIfExists) {
    const exists = await sourceAlreadyIngested(
      services.db,
      params.repoId,
      "pull_request",
      params.prNumber,
    );
    if (exists) return { nodeCount: 0 };
  }

  const [owner, repoName] = params.repoFullName.split("/");
  if (!owner || !repoName) return { nodeCount: 0 };

  const github = assertGitHub(services);
  const compute = assertCompute(services);
  const octokit = await getInstallationOctokit(github, params.installationId);

  const prContext = await fetchMergedPRContext(
    octokit,
    owner,
    repoName,
    params.prNumber,
  );

  const extracted = await extractFromMergedPR(compute, prContext);
  const nodes = [buildMergeMetadataNode(prContext), ...extracted];

  const nodeIds = await persistKnowledgeNodes(
    services.db,
    compute,
    services.storage,
    services.env,
    {
      installationId: params.installationId,
      repoId: params.repoId,
      repoFullName: params.repoFullName,
      sourceEventType: "pull_request",
      sourceGithubId: params.prNumber,
      sourceUrl: prContext.url,
      deliveryId: params.deliveryId,
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

  return { nodeCount: nodeIds.length, prContext, nodes };
}

export async function ingestClosedIssue(
  services: Services,
  params: {
    installationId: number;
    repoId: number;
    repoFullName: string;
    issueNumber: number;
    deliveryId: string;
    skipIfExists?: boolean;
  },
): Promise<number> {
  if (params.skipIfExists) {
    const exists = await sourceAlreadyIngested(
      services.db,
      params.repoId,
      "issue",
      params.issueNumber,
    );
    if (exists) return 0;
  }

  const [owner, repoName] = params.repoFullName.split("/");
  if (!owner || !repoName) return 0;

  const github = assertGitHub(services);
  const compute = assertCompute(services);
  const octokit = await getInstallationOctokit(github, params.installationId);

  const issueContext = await fetchClosedIssueContext(
    octokit,
    owner,
    repoName,
    params.issueNumber,
  );

  const extracted = await extractFromClosedIssue(compute, issueContext);
  const nodes = [buildIssueCloseMetadataNode(issueContext), ...extracted];

  const nodeIds = await persistKnowledgeNodes(
    services.db,
    compute,
    services.storage,
    services.env,
    {
      installationId: params.installationId,
      repoId: params.repoId,
      repoFullName: params.repoFullName,
      sourceEventType: "issue",
      sourceGithubId: params.issueNumber,
      sourceUrl: issueContext.url,
      deliveryId: params.deliveryId,
      webhookEvent: "issues.closed",
      validFrom: issueContext.closedAt
        ? new Date(issueContext.closedAt)
        : new Date(),
      rawContext: {
        title: issueContext.title,
        body: issueContext.body,
        author: issueContext.author,
        closedAt: issueContext.closedAt,
        comments: issueContext.comments,
        labels: issueContext.labels,
      },
    },
    nodes,
  );

  return nodeIds.length;
}