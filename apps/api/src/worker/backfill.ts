import {
  getInstallationOctokit,
  listClosedIssueNumbers,
  listMergedPRNumbers,
} from "@mergegraph/github";
import type PgBoss from "pg-boss";
import type { Services } from "../services/context.js";
import { assertGitHub } from "../services/context.js";
import { ingestClosedIssue, ingestMergedPR } from "../services/ingest-sources.js";
import { BACKFILL_REPO_QUEUE, type BackfillJobData } from "../queue/boss.js";

const BACKFILL_DELAY_MS = 750;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enqueueRepoBackfill(
  boss: PgBoss,
  job: BackfillJobData,
) {
  await boss.send(BACKFILL_REPO_QUEUE, job, {
    singletonKey: `backfill-${job.repoId}`,
    singletonSeconds: 60 * 60,
  });
}

export async function processRepoBackfill(
  services: Services,
  job: BackfillJobData,
) {
  const { installationId, repoId, fullName } = job;
  const [owner, repoName] = fullName.split("/");
  if (!owner || !repoName) return;

  const github = assertGitHub(services);
  const octokit = await getInstallationOctokit(github, installationId);

  const prNumbers = await listMergedPRNumbers(
    octokit,
    owner,
    repoName,
    services.env.BACKFILL_PR_LIMIT,
  );

  let prNodes = 0;
  for (const prNumber of prNumbers) {
    prNodes += await ingestMergedPR(services, {
      installationId,
      repoId,
      repoFullName: fullName,
      prNumber,
      deliveryId: `backfill-pr-${repoId}-${prNumber}`,
      skipIfExists: true,
    });
    await sleep(BACKFILL_DELAY_MS);
  }

  const issueNumbers = await listClosedIssueNumbers(
    octokit,
    owner,
    repoName,
    services.env.BACKFILL_ISSUE_LIMIT,
  );

  let issueNodes = 0;
  for (const issueNumber of issueNumbers) {
    issueNodes += await ingestClosedIssue(services, {
      installationId,
      repoId,
      repoFullName: fullName,
      issueNumber,
      deliveryId: `backfill-issue-${repoId}-${issueNumber}`,
      skipIfExists: true,
    });
    await sleep(BACKFILL_DELAY_MS);
  }

  console.info(
    `[backfill] ${fullName}: ${prNodes} PR nodes, ${issueNodes} issue nodes ` +
      `(${prNumbers.length} PRs, ${issueNumbers.length} issues scanned)`,
  );
}

type InstallationPayload = {
  action?: string;
  installation?: { id?: number };
  repositories?: Array<{ id: number; full_name: string }>;
  repositories_added?: Array<{ id: number; full_name: string }>;
};

export async function enqueueBackfillFromInstallation(
  boss: PgBoss,
  action: string | undefined,
  payload: Record<string, unknown>,
) {
  const data = payload as InstallationPayload;
  const installationId = data.installation?.id;
  if (!installationId) return;

  const repos: Array<{ id: number; full_name: string }> = [];

  if (action === "created" && data.repositories?.length) {
    repos.push(...data.repositories);
  }

  if (action === "added" && data.repositories_added?.length) {
    repos.push(...data.repositories_added);
  }

  for (const repo of repos) {
    await enqueueRepoBackfill(boss, {
      installationId,
      repoId: repo.id,
      fullName: repo.full_name,
    });
  }

  if (repos.length > 0) {
    console.info(
      `[backfill] Enqueued ${repos.length} repo(s) for installation ${installationId}`,
    );
  }
}