import type { Database } from "@mergegraph/db";
import type PgBoss from "pg-boss";
import {
  PROCESS_EVENT_QUEUE,
  type WebhookJobData,
} from "../queue/boss.js";
import { processEvent } from "./process-event.js";

export async function startWorker(db: Database, boss: PgBoss) {
  await boss.work<WebhookJobData>(
    PROCESS_EVENT_QUEUE,
    { batchSize: 1 },
    async ([job]) => {
      await processEvent(db, job.data);
    },
  );

  console.info(`[worker] Listening on queue "${PROCESS_EVENT_QUEUE}"`);
}