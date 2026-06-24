import type PgBoss from "pg-boss";
import {
  PROCESS_EVENT_QUEUE,
  type WebhookJobData,
} from "../queue/boss.js";
import type { Services } from "../services/context.js";
import { processEvent } from "./process-event.js";

export async function startWorker(services: Services, boss: PgBoss) {
  await boss.work<WebhookJobData>(
    PROCESS_EVENT_QUEUE,
    { batchSize: 1 },
    async ([job]) => {
      await processEvent(services, job.data);
    },
  );

  console.info(`[worker] Listening on queue "${PROCESS_EVENT_QUEUE}"`);
}