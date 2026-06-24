import "dotenv/config";
import { createDb } from "@mergegraph/db";
import { loadConfig } from "./config.js";
import { createQueue } from "./queue/boss.js";
import { createServer } from "./server.js";
import { startWorker } from "./worker/index.js";

async function main() {
  const env = loadConfig();
  const { db, client } = createDb(env.DATABASE_URL);
  const boss = await createQueue(env.DATABASE_URL);

  await startWorker(db, boss);

  const app = await createServer({ env, db, boss });

  const shutdown = async () => {
    console.info("Shutting down...");
    await app.close();
    await boss.stop();
    await client.end();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ port: env.PORT, host: env.HOST });
  console.info(`MergeGraph API listening on http://${env.HOST}:${env.PORT}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});