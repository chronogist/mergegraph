import PgBoss from "pg-boss";

export const PROCESS_EVENT_QUEUE = "process-event";
export const BACKFILL_REPO_QUEUE = "backfill-repo";

export type WebhookJobData = {
  deliveryId: string;
  event: string;
  action?: string;
  installationId?: number;
  payload: Record<string, unknown>;
};

export type BackfillJobData = {
  installationId: number;
  repoId: number;
  fullName: string;
};

export async function createQueue(databaseUrl: string) {
  const boss = new PgBoss(databaseUrl);
  boss.on("error", (error) => console.error("[pg-boss]", error));
  await boss.start();
  await boss.createQueue(PROCESS_EVENT_QUEUE);
  await boss.createQueue(BACKFILL_REPO_QUEUE);
  return boss;
}