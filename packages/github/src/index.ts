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

export type ClosedIssueContext = {
  number: number;
  title: string;
  body: string;
  url: string;
  closedAt: string | null;
  author: string | null;
  labels: string[];
  comments: Array<{ author: string | null; body: string }>;
};

export type PublishedReleaseContext = {
  id: number;
  tagName: string;
  name: string;
  body: string;
  url: string;
  publishedAt: string | null;
  author: string | null;
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

const CLOSED_ISSUE_QUERY = `
  query ($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        number
        title
        body
        url
        closedAt
        author { login }
        labels(first: 20) { nodes { name } }
        comments(last: 50) {
          nodes { body author { login } }
        }
      }
    }
  }
`;

export async function fetchClosedIssueContext(
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
  owner: string,
  repo: string,
  number: number,
): Promise<ClosedIssueContext> {
  const response = await octokit.graphql<{
    repository: {
      issue: {
        number: number;
        title: string;
        body: string | null;
        url: string;
        closedAt: string | null;
        author: { login: string } | null;
        labels: { nodes: Array<{ name: string }> };
        comments: {
          nodes: Array<{ body: string | null; author: { login: string } | null }>;
        };
      } | null;
    };
  }>(CLOSED_ISSUE_QUERY, { owner, repo, number });

  const issue = response.repository.issue;
  if (!issue) {
    throw new Error(`Issue #${number} not found in ${owner}/${repo}`);
  }

  return {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? "",
    url: issue.url,
    closedAt: issue.closedAt,
    author: issue.author?.login ?? null,
    labels: issue.labels.nodes.map((l) => l.name),
    comments: issue.comments.nodes
      .filter((c) => c.body)
      .map((c) => ({ author: c.author?.login ?? null, body: c.body! })),
  };
}

export async function fetchPublishedReleaseContext(
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
  owner: string,
  repo: string,
  releaseId: number,
): Promise<PublishedReleaseContext> {
  const { data } = await octokit.rest.repos.getRelease({
    owner,
    repo,
    release_id: releaseId,
  });

  return {
    id: data.id,
    tagName: data.tag_name,
    name: data.name ?? data.tag_name,
    body: data.body ?? "",
    url: data.html_url,
    publishedAt: data.published_at,
    author: data.author?.login ?? null,
  };
}

const MERGED_PRS_QUERY = `
  query ($owner: String!, $repo: String!, $first: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequests(
        states: MERGED
        first: $first
        orderBy: { field: UPDATED_AT, direction: DESC }
        after: $cursor
      ) {
        nodes { number }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const CLOSED_ISSUES_QUERY = `
  query ($owner: String!, $repo: String!, $first: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      issues(
        states: CLOSED
        first: $first
        orderBy: { field: UPDATED_AT, direction: DESC }
        after: $cursor
      ) {
        nodes {
          ... on Issue {
            number
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export async function listMergedPRNumbers(
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
  owner: string,
  repo: string,
  limit: number,
): Promise<number[]> {
  const numbers: number[] = [];
  let cursor: string | undefined;

  while (numbers.length < limit) {
    const pageSize = Math.min(50, limit - numbers.length);
    const response: {
      repository: {
        pullRequests: {
          nodes: Array<{ number: number }>;
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      };
    } = await octokit.graphql(MERGED_PRS_QUERY, {
      owner,
      repo,
      first: pageSize,
      cursor,
    });

    for (const node of response.repository.pullRequests.nodes) {
      numbers.push(node.number);
    }

    const { hasNextPage, endCursor } = response.repository.pullRequests.pageInfo;
    if (!hasNextPage || !endCursor) break;
    cursor = endCursor;
  }

  return numbers;
}

export async function listClosedIssueNumbers(
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
  owner: string,
  repo: string,
  limit: number,
): Promise<number[]> {
  const numbers: number[] = [];
  let cursor: string | undefined;

  while (numbers.length < limit) {
    const pageSize = Math.min(50, limit - numbers.length);
    const response: {
      repository: {
        issues: {
          nodes: Array<{ number?: number }>;
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      };
    } = await octokit.graphql(CLOSED_ISSUES_QUERY, {
      owner,
      repo,
      first: pageSize,
      cursor,
    });

    for (const node of response.repository.issues.nodes) {
      if (node.number) numbers.push(node.number);
    }

    const { hasNextPage, endCursor } = response.repository.issues.pageInfo;
    if (!hasNextPage || !endCursor) break;
    cursor = endCursor;
  }

  return numbers;
}

export async function verifyUserRepoAccess(
  userToken: string,
  owner: string,
  repo: string,
): Promise<{ login: string } | null> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        Authorization: `Bearer ${userToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) return null;

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${userToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!userResponse.ok) return null;

  const user = (await userResponse.json()) as { login?: string };
  if (!user.login) return null;

  return { login: user.login };
}