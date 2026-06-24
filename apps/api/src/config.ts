import { readFileSync } from "node:fs";
import { z } from "zod";

const envSchema = z.object({
  APP_ID: z.coerce.number().optional(),
  WEBHOOK_SECRET: z.string().min(1),
  PRIVATE_KEY: z.string().optional(),
  PRIVATE_KEY_PATH: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  OG_COMPUTE_ROUTER_URL: z.string().url().optional(),
  OG_COMPUTE_ROUTER_API_KEY: z.string().optional(),
  OG_CHAT_MODEL: z.string().default("glm-5.1"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z
    .string()
    .url()
    .default("https://openrouter.ai/api/v1"),
  OPENROUTER_EMBEDDING_MODEL: z
    .string()
    .default("nvidia/llama-nemotron-embed-vl-1b-v2:free"),
  SKIP_0G_STORAGE: z
    .enum(["true", "false", "1", "0"])
    .default("true")
    .transform((v) => v === "true" || v === "1"),
  OG_RPC_URL: z.string().url().optional(),
  OG_INDEXER_URL: z.string().url().optional(),
  OG_STORAGE_PRIVATE_KEY: z.string().optional(),
  MERGE_SUMMARY_COMMENT: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  BACKFILL_PR_LIMIT: z.coerce.number().int().positive().default(200),
  BACKFILL_ISSUE_LIMIT: z.coerce.number().int().positive().default(100),
  GITHUB_APP_CLIENT_ID: z.string().optional(),
  GITHUB_APP_CLIENT_SECRET: z.string().optional(),
  WEB_UI_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadConfig(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export function loadPrivateKey(env: Env): string | undefined {
  if (env.PRIVATE_KEY) {
    return env.PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  if (env.PRIVATE_KEY_PATH) {
    return readFileSync(env.PRIVATE_KEY_PATH, "utf8");
  }
  return undefined;
}

export function requireGitHubCredentials<T>(github: T | null, _env: Env): T {
  if (!github) {
    throw new Error(
      "GitHub API credentials missing. Set APP_ID and PRIVATE_KEY_PATH in .env — " +
        "required to fetch PR context and post @mergegraph replies. " +
        "See docs/GITHUB_APP.md",
    );
  }
  return github;
}

export function requireComputeCredentials<T>(compute: T | null, _env: Env): T {
  if (!compute) {
    throw new Error(
      "0G Compute credentials missing. Set OG_COMPUTE_ROUTER_URL and " +
        "OG_COMPUTE_ROUTER_API_KEY in .env — required for extraction and Q&A.",
    );
  }
  return compute;
}