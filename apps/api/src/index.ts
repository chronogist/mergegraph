import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
import { createQueue } from "./queue/boss.js";
import { createServer } from "./server.js";
import { createServices } from "./services/context.js";
import { startWorker } from "./worker/index.js";

async function main() {
  const services = createServices();
  const boss = await createQueue(services.env.DATABASE_URL);

  await startWorker(services, boss);

  const app = await createServer({
    env: services.env,
    db: services.db,
    boss,
  });

  const shutdown = async () => {
    console.info("Shutting down...");
    await app.close();
    await boss.stop();
    await services.dbClient.end();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ port: services.env.PORT, host: services.env.HOST });
  console.info(
    `MergeGraph API listening on http://${services.env.HOST}:${services.env.PORT}`,
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});