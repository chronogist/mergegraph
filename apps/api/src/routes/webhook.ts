import { Webhooks } from "@octokit/webhooks";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { webhookDeliveries, type Database } from "@mergegraph/db";
import type PgBoss from "pg-boss";
import {
  PROCESS_EVENT_QUEUE,
  type WebhookJobData,
} from "../queue/boss.js";

type WebhookDeps = {
  db: Database;
  boss: PgBoss;
  webhookSecret: string;
};

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export async function registerWebhookRoutes(
  app: FastifyInstance,
  { db, boss, webhookSecret }: WebhookDeps,
) {
  const webhooks = new Webhooks({ secret: webhookSecret });

  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_request, body, done) => {
      try {
        _request.rawBody = body as Buffer;
        done(null, JSON.parse((body as Buffer).toString("utf8")));
      } catch (error) {
        done(error as Error, undefined);
      }
    },
  );

  app.post("/api/webhook", async (request, reply) => {
    const deliveryId = request.headers["x-github-delivery"];
    const event = request.headers["x-github-event"];
    const signature = request.headers["x-hub-signature-256"];

    if (typeof deliveryId !== "string" || typeof event !== "string") {
      return reply.code(400).send({ error: "Missing GitHub webhook headers" });
    }

    if (typeof signature !== "string" || !request.rawBody) {
      return reply.code(400).send({ error: "Missing signature or body" });
    }

    const valid = await webhooks.verify(
      request.rawBody.toString("utf8"),
      signature,
    );
    if (!valid) {
      return reply.code(401).send({ error: "Invalid webhook signature" });
    }

    const payload = request.body as Record<string, unknown>;
    const action =
      typeof payload.action === "string" ? payload.action : undefined;

    const installation =
      payload.installation as { id?: number } | undefined;
    const installationId = installation?.id;

    const [existing] = await db
      .select({ deliveryId: webhookDeliveries.deliveryId })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.deliveryId, deliveryId))
      .limit(1);

    if (existing) {
      request.log.info({ deliveryId, event }, "Duplicate webhook delivery");
      return reply.code(200).send({ ok: true, duplicate: true });
    }

    await db.insert(webhookDeliveries).values({
      deliveryId,
      event,
      action,
      installationId,
      payload,
    });

    const job: WebhookJobData = {
      deliveryId,
      event,
      action,
      installationId,
      payload,
    };

    await boss.send(PROCESS_EVENT_QUEUE, job, {
      singletonKey: deliveryId,
    });

    request.log.info({ deliveryId, event, action }, "Webhook enqueued");

    return reply.code(200).send({ ok: true });
  });
}