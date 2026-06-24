import { eq } from "drizzle-orm";
import { webhookDeliveries, type Database } from "@mergegraph/db";
import type { WebhookJobData } from "../queue/boss.js";
import { handleInstallationEvent } from "./handlers/installation.js";

export async function processEvent(db: Database, job: WebhookJobData) {
  const { deliveryId, event, action, payload } = job;

  console.info(`[worker] Processing ${event}${action ? `.${action}` : ""} (${deliveryId})`);

  try {
    if (event === "installation" || event === "installation_repositories") {
      await handleInstallationEvent(db, action, payload);
    } else {
      console.info(`[worker] No handler for ${event} yet — logged only`);
    }

    await db
      .update(webhookDeliveries)
      .set({ processedAt: new Date(), error: null })
      .where(eq(webhookDeliveries.deliveryId, deliveryId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(webhookDeliveries)
      .set({ error: message })
      .where(eq(webhookDeliveries.deliveryId, deliveryId));

    throw error;
  }
}