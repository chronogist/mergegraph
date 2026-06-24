import {
  buildIssueCloseMetadataNode,
  extractFromClosedIssue,
} from "@mergegraph/extractor";
import { fetchClosedIssueContext, getInstallationOctokit } from "@mergegraph/github";
import type { Services } from "../../services/context.js";
import { assertCompute, assertGitHub } from "../../services/context.js";
import { persistKnowledgeNodes } from "../../services/ingest.js";
import type { WebhookJobData } from "../../queue/boss.js";

type IssuePayload = {
  issue?: {
    number?: number;
    html_url?: string;
    pull_request?: unknown;
  };
  repository?: {
    id?: number;
    full_name?: string;
  };
  installation?: { id?: number };
};

export async function handleIssueEvent(services: Services, job: WebhookJobData) {
  if (job.action !== "closed") return;

  const payload = job.payload as IssuePayload;
  const issue = payload.issue;
  const repo = payload.repository;
  const installationId = job.installationId ?? payload.installation?.id;

  if (
    !issue?.number ||
    issue.pull_request ||
    !repo?.id ||
    !repo.full_name ||
    !installationId
  ) {
    return;
  }

  const [owner, repoName] = repo.full_name.split("/");
  if (!owner || !repoName) return;

  const github = assertGitHub(services);
  const compute = assertCompute(services);
  const octokit = await getInstallationOctokit(github, installationId);

  const issueContext = await fetchClosedIssueContext(
    octokit,
    owner,
    repoName,
    issue.number,
  );

  const extracted = await extractFromClosedIssue(compute, issueContext);
  const nodes = [buildIssueCloseMetadataNode(issueContext), ...extracted];

  const nodeIds = await persistKnowledgeNodes(
    services.db,
    compute,
    services.storage,
    services.env,
    {
      installationId,
      repoId: repo.id,
      repoFullName: repo.full_name,
      sourceEventType: "issue",
      sourceGithubId: issue.number,
      sourceUrl: issueContext.url,
      deliveryId: job.deliveryId,
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

  console.info(
    `[issues] Extracted ${nodeIds.length} nodes from issue #${issue.number} (${repo.full_name})`,
  );
}