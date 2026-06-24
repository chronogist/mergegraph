import { createComputeClient } from "@mergegraph/compute-0g";
import { createDb, type Database } from "@mergegraph/db";
import { createGitHubApp } from "@mergegraph/github";
import { createStorageClient } from "@mergegraph/storage-0g";
import type { App } from "octokit";
import {
  loadConfig,
  loadPrivateKey,
  type Env,
  requireGitHubCredentials,
  requireComputeCredentials,
} from "../config.js";

export type Services = {
  env: Env;
  db: Database;
  dbClient: ReturnType<typeof createDb>["client"];
  github: App | null;
  compute: ReturnType<typeof createComputeClient> | null;
  storage: ReturnType<typeof createStorageClient>;
};

export function createServices(): Services {
  const env = loadConfig();
  const { db, client } = createDb(env.DATABASE_URL);

  const privateKey = loadPrivateKey(env);
  const github =
    env.APP_ID && privateKey
      ? createGitHubApp({ appId: env.APP_ID, privateKey })
      : null;

  const compute =
    env.OG_COMPUTE_ROUTER_API_KEY && env.OG_COMPUTE_ROUTER_URL
      ? createComputeClient({
          baseUrl: env.OG_COMPUTE_ROUTER_URL,
          apiKey: env.OG_COMPUTE_ROUTER_API_KEY,
          chatModel: env.OG_CHAT_MODEL,
          embeddingModel: env.OG_EMBEDDING_MODEL,
        })
      : null;

  const storage = createStorageClient({
    rpcUrl: env.OG_RPC_URL ?? "",
    indexerUrl: env.OG_INDEXER_URL ?? "",
    privateKey: env.OG_STORAGE_PRIVATE_KEY ?? "",
    skipUpload: env.SKIP_0G_STORAGE,
  });

  return { env, db, dbClient: client, github, compute, storage };
}

export function assertGitHub(services: Services): App {
  return requireGitHubCredentials(services.github, services.env);
}

export function assertCompute(services: Services) {
  return requireComputeCredentials(services.compute, services.env);
}