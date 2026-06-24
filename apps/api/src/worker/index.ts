import type PgBoss from "pg-boss";
import {
  BACKFILL_REPO_QUEUE,
  PROCESS_EVENT_QUEUE,
  type BackfillJobData,
  type WebhookJobData,
} from "../queue/boss.js";
import type { Services } from "../services/context.js";
import { processRepoBackfill } from "./backfill.js";
import { processEvent } from "./process-event.js";

export async function startWorker(services: Services, boss: PgBoss) {
  await boss.work<WebhookJobData>(
    PROCESS_EVENT_QUEUE,
    { batchSize: 1 },
    async ([job]) => {
      await processEvent(services, boss, job.data);
    },
  );

  await boss.work<BackfillJobData>(
    BACKFILL_REPO_QUEUE,
    { batchSize: 1 },
    async ([job]) => {
      await processRepoBackfill(services, job.data);
    },
  );

  console.info(
    `[worker] Listening on queues "${PROCESS_EVENT_QUEUE}", "${BACKFILL_REPO_QUEUE}"`,
  );
}