import PgBoss from "pg-boss";

export const PROCESS_EVENT_QUEUE = "process-event";

export type WebhookJobData = {
  deliveryId: string;
  event: string;
  action?: string;
  installationId?: number;
  payload: Record<string, unknown>;
};

export async function createQueue(databaseUrl: string) {
  const boss = new PgBoss(databaseUrl);
  boss.on("error", (error) => console.error("[pg-boss]", error));
  await boss.start();
  await boss.createQueue(PROCESS_EVENT_QUEUE);
  return boss;
}