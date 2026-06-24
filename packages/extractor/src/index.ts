import type { ComputeClient } from "@mergegraph/compute-0g";
import type { MergedPRContext } from "@mergegraph/github";
import { z } from "zod";

const nodeTypeSchema = z.enum([
  "decision",
  "rationale",
  "tradeoff",
  "incident",
  "migration",
  "lesson",
  "release_note",
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