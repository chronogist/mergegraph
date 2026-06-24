import { App } from "octokit";

export type GitHubAppConfig = {
  appId: number;
  privateKey: string;
};

export type MergedPRContext = {
  number: number;
  title: string;
  body: string;
  url: string;
  mergedAt: string | null;
  mergedBy: string | null;
  author: string | null;
  labels: string[];
  files: string[];
  reviews: Array<{ author: string | null; body: string }>;
  comments: Array<{ author: string | null; body: string }>;
};

export function createGitHubApp(config: GitHubAppConfig): App {
  return new App({
    appId: config.appId,
    privateKey: config.privateKey,
  });
}

export async function getInstallationOctokit(
  app: App,
  installationId: number,
) {
  return app.getInstallationOctokit(installationId);
}

const MERGED_PR_QUERY = `
  query ($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        number
        title
        body
        url
        mergedAt
        mergedBy { login }
        author { login }
        labels(first: 20) { nodes { name } }
        files(first: 100) { nodes { path } }
        reviews(last: 20) {
          nodes { body author { login } }
        }
        comments(last: 50) {
          nodes { body author { login } }
        }
      }
    }
  }
`;

export async function fetchMergedPRContext(
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
  owner: string,
  repo: string,
  number: number,
): Promise<MergedPRContext> {
  const response = await octokit.graphql<{
    repository: {
      pullRequest: {
        number: number;
        title: string;
        body: string | null;
        url: string;
        mergedAt: string | null;
        mergedBy: { login: string } | null;
        author: { login: string } | null;
        labels: { nodes: Array<{ name: string }> };
        files: { nodes: Array<{ path: string }> };
        reviews: { nodes: Array<{ body: string | null; author: { login: string } | null }> };
        comments: { nodes: Array<{ body: string | null; author: { login: string } | null }> };
      };
    };
  }>(MERGED_PR_QUERY, { owner, repo, number });

  const pr = response.repository.pullRequest;

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body ?? "",
    url: pr.url,
    mergedAt: pr.mergedAt,
    mergedBy: pr.mergedBy?.login ?? null,
    author: pr.author?.login ?? null,
    labels: pr.labels.nodes.map((l) => l.name),
    files: pr.files.nodes.map((f) => f.path),
    reviews: pr.reviews.nodes
      .filter((r) => r.body)
      .map((r) => ({ author: r.author?.login ?? null, body: r.body! })),
    comments: pr.comments.nodes
      .filter((c) => c.body)
      .map((c) => ({ author: c.author?.login ?? null, body: c.body! })),
  };
}

export async function postIssueComment(
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
) {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

export const MERGEGRAPH_MENTION = /@mergegraph\b/i;

export function parseMergeGraphQuestion(commentBody: string): string | null {
  if (!MERGEGRAPH_MENTION.test(commentBody)) return null;
  return commentBody.replace(MERGEGRAPH_MENTION, "").trim();
}