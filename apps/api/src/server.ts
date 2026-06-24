import cors from "@fastify/cors";
import Fastify from "fastify";
import type { Database } from "@mergegraph/db";
import type PgBoss from "pg-boss";
import type { Env } from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerRepoRoutes } from "./routes/repos.js";
import { registerWebhookRoutes } from "./routes/webhook.js";
import type { Services } from "./services/context.js";

type ServerDeps = {
  env: Env;
  db: Database;
  boss: PgBoss;
  services: Services;
};

export async function createServer({ env, db, boss, services }: ServerDeps) {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  if (env.WEB_UI_URL) {
    await app.register(cors, {
      origin: env.WEB_UI_URL,
      credentials: true,
    });
  }

  await registerHealthRoutes(app, { db, boss });
  await registerWebhookRoutes(app, {
    db,
    boss,
    webhookSecret: env.WEBHOOK_SECRET,
  });
  await registerRepoRoutes(app, { db, services });

  return app;
}