import type { ComputeClient } from "@mergegraph/compute-0g";
import type {
  ClosedIssueContext,
  MergedPRContext,
  PublishedReleaseContext,
} from "@mergegraph/github";
import { z } from "zod";

const nodeTypeSchema = z.enum([
  "decision",
  "rationale",
  "tradeoff",
  "incident",
  "migration",
  "lesson",
  "release_note",
  "pr_merge",
  "issue_close",
]);

const extractedNodeSchema = z.object({
  type: nodeTypeSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  confidence: z.number().min(0).max(1),
  entities: z.object({
    paths: z.array(z.string()).default([]),
    components: z.array(z.string()).default([]),
    people: z.array(z.string()).default([]),
    labels: z.array(z.string()).default([]),
  }),
});

const extractionResultSchema = z.object({
  nodes: z.array(extractedNodeSchema).max(3),
});

export type ExtractedNode = z.infer<typeof extractedNodeSchema>;

function formatTimestamp(iso: string | null): string {
  if (!iso) return "unknown time";
  return new Date(iso).toUTCString();
}

export function buildMergeMetadataNode(pr: MergedPRContext): ExtractedNode {
  const mergedBy = pr.mergedBy ?? "unknown";
  const mergedAtLabel = formatTimestamp(pr.mergedAt);

  return {
    type: "pr_merge",
    title: `PR #${pr.number} merged by ${mergedBy}`,
    summary:
      `Pull request #${pr.number} ("${pr.title}") was merged by ${mergedBy} ` +
      `on ${mergedAtLabel}.`,
    body:
      `Merge metadata for PR #${pr.number}:\n` +
      `- Title: ${pr.title}\n` +
      `- Author: ${pr.author ?? "unknown"}\n` +
      `- Merged by: ${mergedBy}\n` +
      `- Merged at: ${mergedAtLabel}` +
      (pr.mergedAt ? ` (${pr.mergedAt})` : "") +
      `\n- URL: ${pr.url}`,
    confidence: 1,
    entities: {
      paths: pr.files,
      components: [],
      people: [mergedBy, pr.author].filter(
        (person): person is string => Boolean(person && person !== "unknown"),
      ),
      labels: pr.labels,
    },
  };
}

const EXTRACTION_SYSTEM = `You extract structured engineering knowledge from pull request activity.
Return JSON: { "nodes": [...] } with 0-3 nodes. Each node must have:
- type: one of decision, rationale, tradeoff, incident, migration, lesson, release_note
- title: short headline
- summary: 1-2 sentences
- body: fuller explanation
- confidence: 0-1 (low if ambiguous)
- entities: { paths, components, people, labels } from the PR context

Only extract knowledge clearly supported by the PR text, reviews, or comments.
If nothing substantive, return { "nodes": [] }.`;

export function buildIssueCloseMetadataNode(
  issue: ClosedIssueContext,
): ExtractedNode {
  const closedAtLabel = formatTimestamp(issue.closedAt);

  return {
    type: "issue_close",
    title: `Issue #${issue.number} closed`,
    summary:
      `Issue #${issue.number} ("${issue.title}") was closed on ${closedAtLabel}.`,
    body:
      `Close metadata for issue #${issue.number}:\n` +
      `- Title: ${issue.title}\n` +
      `- Author: ${issue.author ?? "unknown"}\n` +
      `- Closed at: ${closedAtLabel}` +
      (issue.closedAt ? ` (${issue.closedAt})` : "") +
      `\n- URL: ${issue.url}`,
    confidence: 1,
    entities: {
      paths: [],
      components: [],
      people: issue.author ? [issue.author] : [],
      labels: issue.labels,
    },
  };
}

export function buildReleaseMetadataNode(
  release: PublishedReleaseContext,
): ExtractedNode {
  const publishedAtLabel = formatTimestamp(release.publishedAt);

  return {
    type: "release_note",
    title: `Release ${release.tagName}`,
    summary:
      `${release.name} (${release.tagName}) was published on ${publishedAtLabel}.`,
    body:
      `Release metadata:\n` +
      `- Tag: ${release.tagName}\n` +
      `- Name: ${release.name}\n` +
      `- Author: ${release.author ?? "unknown"}\n` +
      `- Published at: ${publishedAtLabel}` +
      (release.publishedAt ? ` (${release.publishedAt})` : "") +
      `\n- URL: ${release.url}` +
      (release.body ? `\n\n${release.body}` : ""),
    confidence: 1,
    entities: {
      paths: [],
      components: [],
      people: release.author ? [release.author] : [],
      labels: [],
    },
  };
}

export async function extractFromMergedPR(
  compute: ComputeClient,
  pr: MergedPRContext,
): Promise<ExtractedNode[]> {
  const userPrompt = JSON.stringify({
    pr: {
      number: pr.number,
      title: pr.title,
      body: pr.body,
      url: pr.url,
      author: pr.author,
      labels: pr.labels,
      files: pr.files,
      reviews: pr.reviews,
      comments: pr.comments,
    },
  });

  const raw = await compute.chat(EXTRACTION_SYSTEM, userPrompt);
  const parsed = extractionResultSchema.parse(JSON.parse(raw));
  return parsed.nodes;
}

const ISSUE_EXTRACTION_SYSTEM = `You extract structured engineering knowledge from closed GitHub issues.
Return JSON: { "nodes": [...] } with 0-3 nodes. Each node must have:
- type: one of decision, rationale, tradeoff, incident, migration, lesson
- title: short headline
- summary: 1-2 sentences
- body: fuller explanation
- confidence: 0-1 (low if ambiguous)
- entities: { paths, components, people, labels } from the issue context

Only extract knowledge clearly supported by the issue text or comments.
If nothing substantive, return { "nodes": [] }.`;

export async function extractFromClosedIssue(
  compute: ComputeClient,
  issue: ClosedIssueContext,
): Promise<ExtractedNode[]> {
  const userPrompt = JSON.stringify({
    issue: {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      url: issue.url,
      author: issue.author,
      labels: issue.labels,
      comments: issue.comments,
    },
  });

  const raw = await compute.chat(ISSUE_EXTRACTION_SYSTEM, userPrompt);
  const parsed = extractionResultSchema.parse(JSON.parse(raw));
  return parsed.nodes;
}

const RELEASE_EXTRACTION_SYSTEM = `You extract structured engineering knowledge from published release notes.
Return JSON: { "nodes": [...] } with 0-3 nodes. Each node must have:
- type: one of decision, rationale, tradeoff, incident, migration, lesson, release_note
- title: short headline
- summary: 1-2 sentences
- body: fuller explanation
- confidence: 0-1 (low if ambiguous)
- entities: { paths, components, people, labels } from the release context

Only extract knowledge clearly supported by the release notes.
If nothing substantive, return { "nodes": [] }.`;

export async function extractFromPublishedRelease(
  compute: ComputeClient,
  release: PublishedReleaseContext,
): Promise<ExtractedNode[]> {
  const userPrompt = JSON.stringify({
    release: {
      id: release.id,
      tagName: release.tagName,
      name: release.name,
      body: release.body,
      url: release.url,
      author: release.author,
      publishedAt: release.publishedAt,
    },
  });

  const raw = await compute.chat(RELEASE_EXTRACTION_SYSTEM, userPrompt);
  const parsed = extractionResultSchema.parse(JSON.parse(raw));
  return parsed.nodes;
}

export function buildMergeSummaryMarkdown(
  pr: MergedPRContext,
  nodes: ExtractedNode[],
): string | null {
  const substantive = nodes.filter(
    (n) => n.type !== "pr_merge" && n.confidence >= 0.5,
  );
  if (substantive.length === 0) return null;

  const bullets = substantive
    .map((n) => `- **${n.title}** — ${n.summary}`)
    .join("\n");

  return (
    `### MergeGraph summary\n\n` +
    `Captured ${substantive.length} knowledge node(s) from PR #${pr.number}:\n\n` +
    `${bullets}\n\n` +
    `Ask \`@mergegraph\` on any issue or PR for cited answers from repo history.`
  );
}

const ANSWER_SYSTEM = `You answer engineering questions using ONLY the provided knowledge context.
Always cite sources as markdown links using the exact sourceUrl provided.
If the context is insufficient, say so honestly.
Return plain markdown (not JSON).`;

export async function answerQuestion(
  compute: ComputeClient,
  question: string,
  context: Array<{
    title: string;
    summary: string;
    body: string;
    sourceUrl: string;
    type: string;
  }>,
): Promise<string> {
  const userPrompt = JSON.stringify({ question, context });
  return compute.chatText(ANSWER_SYSTEM, userPrompt);
}