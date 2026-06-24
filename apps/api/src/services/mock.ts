import { createHash } from "node:crypto";
import type { MergedPRContext } from "@mergegraph/github";

/** Deterministic pseudo-embedding for local retrieval testing. */
export function mockEmbed(text: string, dimensions = 1536): number[] {
  const vec = new Array<number>(dimensions).fill(0);
  const hash = createHash("sha256").update(text).digest();

  for (let i = 0; i < dimensions; i++) {
    vec[i] = (hash[i % hash.length] / 255) * 2 - 1;
  }

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function createMockCompute() {
  return {
    async chat(_system: string, user: string): Promise<string> {
      const { pr } = JSON.parse(user) as { pr: MergedPRContext };
      return JSON.stringify({
        nodes: [
          {
            type: "decision",
            title: `Use Redis for session cache (PR #${pr.number})`,
            summary:
              "The team chose Redis over Postgres for caching to reduce read latency.",
            body:
              pr.body ||
              "Mock extraction: Redis provides sub-millisecond reads suitable for session data.",
            confidence: 0.88,
            entities: {
              paths: pr.files.slice(0, 5),
              components: ["cache", "sessions"],
              people: pr.author ? [pr.author] : [],
              labels: pr.labels,
            },
          },
        ],
      });
    },

    async chatText(_system: string, user: string): Promise<string> {
      const { question, context } = JSON.parse(user) as {
        question: string;
        context: Array<{ title: string; summary: string }>;
      };
      const top = context[0];
      if (!top) {
        return "I don't have enough repository context to answer that yet.";
      }
      return (
        `Regarding "${question}": ${top.summary} ` +
        `This is documented in **${top.title}**. (DEV_MOCK response)`
      );
    },

    async embed(text: string): Promise<number[]> {
      return mockEmbed(text);
    },
  };
}

export function mockMergedPRContext(
  owner: string,
  repo: string,
  number: number,
  payload?: {
    title?: string;
    body?: string;
  },
): MergedPRContext {
  return {
    number,
    title: payload?.title ?? `Add Redis caching (PR #${number})`,
    body:
      payload?.body ??
      "We need faster session lookups. Redis gives us sub-ms reads vs Postgres.",
    url: `https://github.com/${owner}/${repo}/pull/${number}`,
    mergedAt: new Date().toISOString(),
    author: "dev-mock",
    labels: ["enhancement"],
    files: ["src/cache/redis.ts", "src/sessions/store.ts"],
    reviews: [
      {
        author: "reviewer-mock",
        body: "LGTM — Redis is the right call for hot session data.",
      },
    ],
    comments: [],
  };
}

export function logMockComment(repo: string, issueNumber: number, body: string) {
  console.info(`[dev-mock] Would post comment on ${repo}#${issueNumber}:\n${body}`);
}