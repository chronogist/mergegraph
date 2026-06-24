import { getGitHubToken } from "./session";
import { getWebEnv } from "./env";

export async function apiFetch(path: string, init?: RequestInit) {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const { apiUrl } = getWebEnv();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body}`);
  }

  return response.json();
}

export type RepoSummary = {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  installationId: number;
};

export type NodeSummary = {
  id: string;
  type: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceEventType: string;
  validFrom: string | null;
  createdAt: string;
};