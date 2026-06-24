import type { Services } from "../../services/context.js";
import { ingestClosedIssue } from "../../services/ingest-sources.js";
import type { WebhookJobData } from "../../queue/boss.js";

type IssuePayload = {
  issue?: {
    number?: number;
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

  const nodeCount = await ingestClosedIssue(services, {
    installationId,
    repoId: repo.id,
    repoFullName: repo.full_name,
    issueNumber: issue.number,
    deliveryId: job.deliveryId,
  });

  console.info(
    `[issues] Extracted ${nodeCount} nodes from issue #${issue.number} (${repo.full_name})`,
  );
}