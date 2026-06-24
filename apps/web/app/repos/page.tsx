import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetch, type RepoSummary } from "@/lib/api";
import { getGitHubToken } from "@/lib/session";

export default async function ReposPage() {
  const token = await getGitHubToken();
  if (!token) redirect("/");

  let repos: RepoSummary[] = [];
  let error: string | null = null;

  try {
    const data = (await apiFetch("/api/repos")) as { repos: RepoSummary[] };
    repos = data.repos;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load repos";
  }

  return (
    <main className="container">
      <div className="header">
        <div className="brand">MergeGraph</div>
        <form action="/api/auth/logout" method="post">
          <button className="btn" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <h1 style={{ marginTop: 0 }}>Connected repositories</h1>
      <p className="lead">
        Repositories where the MergeGraph GitHub App is installed and you have
        access.
      </p>

      {error ? <p className="error">{error}</p> : null}

      <div className="stack">
        {repos.length === 0 && !error ? (
          <div className="card muted">
            No connected repositories yet. Install the MergeGraph GitHub App on
            a repo you can access.
          </div>
        ) : null}

        {repos.map((repo) => (
          <Link
            key={repo.id}
            className="card"
            href={`/repos/${repo.owner}/${repo.name}`}
          >
            <div className="title">{repo.fullName}</div>
            <div className="muted">Browse knowledge nodes</div>
          </Link>
        ))}
      </div>
    </main>
  );
}