import { readFileSync } from "node:fs";
import { z } from "zod";

const envSchema = z.object({
  APP_ID: z.coerce.number().optional(),
  WEBHOOK_SECRET: z.string().min(1),
  PRIVATE_KEY: z.string().optional(),
  PRIVATE_KEY_PATH: z.string().optional(),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
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