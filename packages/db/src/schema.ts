import { relations } from "drizzle-orm";
import {
  bigint,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const installations = pgTable("installations", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  accountLogin: text("account_login").notNull(),
  accountType: text("account_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const repositories = pgTable("repositories", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  installationId: bigint("installation_id", { mode: "number" })
    .notNull()
    .references(() => installations.id),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  deliveryId: text("delivery_id").primaryKey(),
  event: text("event").notNull(),
  action: text("action"),
  installationId: bigint("installation_id", { mode: "number" }),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"),
});

export const knowledgeNodes = pgTable("knowledge_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  installationId: bigint("installation_id", { mode: "number" }).notNull(),
  repoId: bigint("repo_id", { mode: "number" }).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  body: text("body").notNull(),
  confidence: real("confidence").notNull(),
  sourceEventType: text("source_event_type").notNull(),
  sourceGithubId: bigint("source_github_id", { mode: "number" }),
  sourceUrl: text("source_url").notNull(),
  entities: jsonb("entities").notNull(),
  embedding: vector("embedding", { dimensions: 2048 }),
  capsuleRootHash: text("capsule_root_hash"),
  capsulePayload: jsonb("capsule_payload"),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const knowledgeEdges = pgTable("knowledge_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  installationId: bigint("installation_id", { mode: "number" }).notNull(),
  fromNodeId: uuid("from_node_id")
    .notNull()
    .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
  toNodeId: uuid("to_node_id")
    .notNull()
    .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
  relation: text("relation").notNull(),
  weight: real("weight").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const knowledgeNodesRelations = relations(knowledgeNodes, ({ many }) => ({
  outgoingEdges: many(knowledgeEdges, { relationName: "fromNode" }),
  incomingEdges: many(knowledgeEdges, { relationName: "toNode" }),
}));

export const knowledgeEdgesRelations = relations(knowledgeEdges, ({ one }) => ({
  fromNode: one(knowledgeNodes, {
    fields: [knowledgeEdges.fromNodeId],
    references: [knowledgeNodes.id],
    relationName: "fromNode",
  }),
  toNode: one(knowledgeNodes, {
    fields: [knowledgeEdges.toNodeId],
    references: [knowledgeNodes.id],
    relationName: "toNode",
  }),
}));