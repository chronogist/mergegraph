import { eq } from "drizzle-orm";
import { installations, repositories, type Database } from "@mergegraph/db";

type InstallationPayload = {
  action?: string;
  installation?: {
    id: number;
    account?: { login?: string; type?: string };
  };
  repositories?: Array<{ id: number; full_name: string }>;
  repositories_added?: Array<{ id: number; full_name: string }>;
  repositories_removed?: Array<{ id: number; full_name: string }>;
};

export async function handleInstallationEvent(
  db: Database,
  action: string | undefined,
  payload: Record<string, unknown>,
) {
  const data = payload as InstallationPayload;
  const installation = data.installation;

  if (!installation?.id || !installation.account?.login) {
    console.warn("[installation] Missing installation data in payload");
    return;
  }

  const accountType = installation.account.type ?? "Unknown";

  if (action === "deleted") {
    await db
      .update(installations)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(installations.id, installation.id));

    console.info(
      `[installation] Deleted installation ${installation.id} (${installation.account.login})`,
    );
    return;
  }

  if (action === "created" || action === "new_permissions_accepted") {
    await db
      .insert(installations)
      .values({
        id: installation.id,
        accountLogin: installation.account.login,
        accountType,
        deletedAt: null,
      })
      .onConflictDoUpdate({
        target: installations.id,
        set: {
          accountLogin: installation.account.login,
          accountType,
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

    console.info(
      `[installation] Upserted installation ${installation.id} (${installation.account.login})`,
    );
  }

  const initialRepos =
    action === "created" && data.repositories?.length
      ? data.repositories
      : [];

  if (initialRepos.length) {
    for (const repo of initialRepos) {
      await db
        .insert(repositories)
        .values({
          id: repo.id,
          installationId: installation.id,
          fullName: repo.full_name,
          removedAt: null,
        })
        .onConflictDoUpdate({
          target: repositories.id,
          set: {
            installationId: installation.id,
            fullName: repo.full_name,
            removedAt: null,
          },
        });
    }

    console.info(
      `[installation] Registered ${initialRepos.length} repos on create for installation ${installation.id}`,
    );
  }

  if (action === "added" && data.repositories_added?.length) {
    for (const repo of data.repositories_added) {
      await db
        .insert(repositories)
        .values({
          id: repo.id,
          installationId: installation.id,
          fullName: repo.full_name,
          removedAt: null,
        })
        .onConflictDoUpdate({
          target: repositories.id,
          set: {
            installationId: installation.id,
            fullName: repo.full_name,
            removedAt: null,
          },
        });
    }

    console.info(
      `[installation] Added ${data.repositories_added.length} repos to installation ${installation.id}`,
    );
  }

  if (action === "removed" && data.repositories_removed?.length) {
    for (const repo of data.repositories_removed) {
      await db
        .update(repositories)
        .set({ removedAt: new Date() })
        .where(eq(repositories.id, repo.id));
    }

    console.info(
      `[installation] Removed ${data.repositories_removed.length} repos from installation ${installation.id}`,
    );
  }
}