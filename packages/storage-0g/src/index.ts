import { MemData, Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";

export type MemoryCapsule = {
  version: 1;
  nodeId: string;
  installationId: number;
  repoFullName: string;
  extractedAt: string;
  extractor: {
    model: string;
    provider: "0g-compute-router";
  };
  source: {
    event: string;
    deliveryId: string;
    githubUrls: string[];
  };
  node: Record<string, unknown>;
  rawContext: Record<string, unknown>;
};

export type StorageConfig = {
  rpcUrl: string;
  indexerUrl: string;
  privateKey: string;
  skipUpload: boolean;
};

export type StorageResult = {
  rootHash: string | null;
  payload: MemoryCapsule;
};

export function createStorageClient(config: StorageConfig) {
  return {
    async storeCapsule(capsule: MemoryCapsule): Promise<StorageResult> {
      if (config.skipUpload) {
        return { rootHash: null, payload: capsule };
      }

      const json = JSON.stringify(capsule);
      const data = new TextEncoder().encode(json);
      const memData = new MemData(data);
      const [, treeErr] = await memData.merkleTree();
      if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`);

      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const signer = new ethers.Wallet(config.privateKey, provider);
      const indexer = new Indexer(config.indexerUrl);

      const [tx, uploadErr] = await indexer.upload(
        memData,
        config.rpcUrl,
        signer as unknown as Parameters<Indexer["upload"]>[2],
      );
      if (uploadErr) throw new Error(`0G upload error: ${uploadErr}`);

      const rootHash = "rootHash" in tx ? tx.rootHash : tx.rootHashes?.[0];
      if (!rootHash) throw new Error("0G upload returned no root hash");

      return { rootHash, payload: capsule };
    },
  };
}

export type StorageClient = ReturnType<typeof createStorageClient>;