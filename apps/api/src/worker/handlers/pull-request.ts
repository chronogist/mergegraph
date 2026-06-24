import type { Services } from "../../services/context.js";
import { ingestMergedPR } from "../../services/ingest-sources.js";
import type { WebhookJobData } from "../../queue/boss.js";

type PRPayload = {
  pull_request?: {
    merged?: boolean;
    number?: number;
  };
  repository?: {
    id?: number;
    full_name?: string;
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

  const nodeCount = await ingestMergedPR(services, {
    installationId,
    repoId: repo.id,
    repoFullName: repo.full_name,
    prNumber: pr.number,
    deliveryId: job.deliveryId,
  });

  console.info(
    `[pull_request] Extracted ${nodeCount} nodes from PR #${pr.number} (${repo.full_name})`,
  );
}