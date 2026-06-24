import { eq } from "drizzle-orm";
import { webhookDeliveries } from "@mergegraph/db";
import type { WebhookJobData } from "../queue/boss.js";
import type { Services } from "../services/context.js";
import { handleInstallationEvent } from "./handlers/installation.js";
import { handleIssueCommentEvent } from "./handlers/issue-comment.js";
import { handlePullRequestEvent } from "./handlers/pull-request.js";

export async function processEvent(services: Services, job: WebhookJobData) {
  const { deliveryId, event, action } = job;

  console.info(
    `[worker] Processing ${event}${action ? `.${action}` : ""} (${deliveryId})`,
  );

  try {
    switch (event) {
      case "installation":
      case "installation_repositories":
        await handleInstallationEvent(services.db, action, job.payload);
        break;
      case "pull_request":
        await handlePullRequestEvent(services, job);
        break;
      case "issue_comment":
        await handleIssueCommentEvent(services, job);
        break;
      default:
        console.info(`[worker] No handler for ${event} — skipped`);
    }

    await services.db
      .update(webhookDeliveries)
      .set({ processedAt: new Date(), error: null })
      .where(eq(webhookDeliveries.deliveryId, deliveryId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await services.db
      .update(webhookDeliveries)
      .set({ error: message })
      .where(eq(webhookDeliveries.deliveryId, deliveryId));

    throw error;
  }
}