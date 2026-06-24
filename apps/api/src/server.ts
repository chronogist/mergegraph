import Fastify from "fastify";
import type { Database } from "@mergegraph/db";
import type PgBoss from "pg-boss";
import type { Env } from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerWebhookRoutes } from "./routes/webhook.js";

type ServerDeps = {
  env: Env;
  db: Database;
  boss: PgBoss;
};

export async function createServer({ env, db, boss }: ServerDeps) {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await registerHealthRoutes(app, { db, boss });
  await registerWebhookRoutes(app, {
    db,
    boss,
    webhookSecret: env.WEBHOOK_SECRET,
  });

  return app;
}