import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Database } from "@mergegraph/db";
import type PgBoss from "pg-boss";
import { PROCESS_EVENT_QUEUE } from "../queue/boss.js";

type HealthDeps = {
  db: Database;
  boss: PgBoss;
};

export async function registerHealthRoutes(
  app: FastifyInstance,
  { db, boss }: HealthDeps,
) {
  app.get("/health", async () => {
    await db.execute(sql`SELECT 1`);

    let queueDepth = 0;
    try {
      queueDepth = await boss.getQueueSize(PROCESS_EVENT_QUEUE);
    } catch {
      queueDepth = -1;
    }

    return {
      status: "ok",
      queue: {
        name: PROCESS_EVENT_QUEUE,
        pending: queueDepth,
      },
      timestamp: new Date().toISOString(),
    };
  });
}