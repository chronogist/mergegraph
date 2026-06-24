#!/usr/bin/env node
/**
 * Simulates a signed GitHub webhook delivery for local testing.
 * Usage: node scripts/test-webhook.mjs [installation|pull_request|issue_comment]
 */
import crypto from "node:crypto";

const secret = process.env.WEBHOOK_SECRET ?? "mergegraph-test-secret";
const baseUrl = process.env.TEST_URL ?? "http://localhost:3000";
const scenario = process.argv[2] ?? "installation";

const payloads = {
  installation: {
    event: "installation",
    action: "created",
    body: {
      action: "created",
      installation: {
        id: 999001,
        account: { login: "test-org", type: "Organization" },
      },
      repositories: [{ id: 888001, full_name: "test-org/demo-repo" }],
    },
  },
  pull_request: {
    event: "pull_request",
    action: "closed",
    body: {
      action: "closed",
      installation: { id: 999001 },
      repository: {
        id: 888001,
        full_name: "test-org/demo-repo",
        name: "demo-repo",
        owner: { login: "test-org" },
      },
      pull_request: {
        merged: true,
        number: 42,
        html_url: "https://github.com/test-org/demo-repo/pull/42",
      },
    },
  },
  issue_comment: {
    event: "issue_comment",
    action: "created",
    body: {
      action: "created",
      installation: { id: 999001 },
      repository: {
        id: 888001,
        full_name: "test-org/demo-repo",
        name: "demo-repo",
        owner: { login: "test-org" },
      },
      issue: { number: 7 },
      comment: { body: "@mergegraph why was Redis chosen?" },
    },
  },
};

const { event, action, body } = payloads[scenario] ?? payloads.installation;
const deliveryId = crypto.randomUUID();
const raw = JSON.stringify(body);
const signature =
  "sha256=" +
  crypto.createHmac("sha256", secret).update(raw).digest("hex");

const res = await fetch(`${baseUrl}/api/webhook`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-GitHub-Event": event,
    "X-GitHub-Delivery": deliveryId,
    "X-Hub-Signature-256": signature,
  },
  body: raw,
});

const text = await res.text();
console.log(`POST /api/webhook [${scenario}] → ${res.status}`);
console.log(text);
console.log(`delivery_id: ${deliveryId}`);