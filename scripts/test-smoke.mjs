#!/usr/bin/env node
/**
 * Runs local smoke tests against a running MergeGraph server.
 */
import { execSync } from "node:child_process";

const baseUrl = process.env.TEST_URL ?? "http://localhost:3000";
let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.log(`  ✗ ${label}`);
  if (detail) console.log(`    ${detail}`);
  failed++;
}

async function checkHealth() {
  const res = await fetch(`${baseUrl}/health`);
  const data = await res.json();
  if (res.status === 200 && data.status === "ok") {
    ok(`GET /health → ${data.status} (queue pending: ${data.queue?.pending})`);
  } else {
    fail("GET /health", JSON.stringify(data));
  }
}

function checkDb(label, sql) {
  try {
    const out = execSync(
      `docker exec mergegraph_postgres_1 psql -U mergegraph -d mergegraph -t -A -c "${sql}"`,
      { encoding: "utf8" },
    ).trim();
    if (out && out !== "0" && !out.startsWith("0\n")) {
      ok(`${label} → ${out.split("\n")[0]}`);
    } else if (label.includes("empty") || out === "0") {
      fail(label, `query returned: ${out || "(empty)"}`);
    } else {
      ok(`${label} → ${out}`);
    }
  } catch (e) {
    fail(label, e.message);
  }
}

console.log("\nMergeGraph smoke tests\n");

await checkHealth();

// Allow worker time to process after webhook scripts run
await new Promise((r) => setTimeout(r, 2000));

checkDb(
  "installations row exists",
  "SELECT account_login FROM installations WHERE id = 999001",
);
checkDb(
  "webhook delivery processed",
  "SELECT event || '.' || COALESCE(action,'?') FROM webhook_deliveries WHERE processed_at IS NOT NULL ORDER BY received_at DESC LIMIT 1",
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);