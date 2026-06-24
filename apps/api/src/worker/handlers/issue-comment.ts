import { hybridRetrieve } from "@mergegraph/db";
import { answerQuestion } from "@mergegraph/extractor";
import {
  getInstallationOctokit,
  parseMergeGraphQuestion,
  postIssueComment,
} from "@mergegraph/github";
import type { Services } from "../../services/context.js";
import { assertCompute, assertGitHub } from "../../services/context.js";

import type { WebhookJobData } from "../../queue/boss.js";

type CommentPayload = {
  comment?: {
    body?: string;
    user?: { type?: string; login?: string };
  };
  issue?: { number?: number };
  repository?: {
    id?: number;
    full_name?: string;
    owner?: { login?: string };
    name?: string;
  };
  installation?: { id?: number };
};

export async function handleIssueCommentEvent(
  services: Services,
  job: WebhookJobData,
) {
  if (job.action !== "created") return;

  const payload = job.payload as CommentPayload;
  const body = payload.comment?.body;
  const issueNumber = payload.issue?.number;
  const repo = payload.repository;
  const installationId = job.installationId ?? payload.installation?.id;

  if (!body || !issueNumber || !repo?.id || !repo.owner?.login || !repo.name || !installationId) {
    return;
  }

  const authorType = payload.comment?.user?.type;
  const authorLogin = payload.comment?.user?.login?.toLowerCase();
  if (authorType === "Bot" || authorLogin?.endsWith("[bot]")) {
    return;
  }

  const question = parseMergeGraphQuestion(body);
  if (!question) return;

  const github = assertGitHub(services);
  const compute = assertCompute(services);

  const embedding = await compute.embed(question, "query");
  const nodes = await hybridRetrieve(services.db, repo.id, embedding);

  if (nodes.length === 0) {
    const emptyReply =
      "### MergeGraph\n\nNo relevant knowledge found yet for this repository. " +
      "Knowledge is captured when PRs are merged — try again after your next merge.";

    const octokit = await getInstallationOctokit(github, installationId);
    await postIssueComment(
      octokit,
      repo.owner.login,
      repo.name,
      issueNumber,
      emptyReply,
    );
    return;
  }

  const answer = await answerQuestion(
    compute,
    question,
    nodes.map((n) => ({
      title: n.title,
      summary: n.summary,
      body: n.body,
      sourceUrl: n.sourceUrl,
      type: n.type,
    })),
  );

  const sources = [...new Set(nodes.map((n) => n.sourceUrl))]
    .map((url) => `- ${url}`)
    .join("\n");

  const reply = `### MergeGraph\n\n${answer}\n\n**Sources**\n${sources}`;

  const octokit = await getInstallationOctokit(github, installationId);
  await postIssueComment(
    octokit,
    repo.owner.login,
    repo.name,
    issueNumber,
    reply,
  );

  console.info(
    `[issue_comment] Answered @mergegraph on ${repo.full_name}#${issueNumber}`,
  );
}