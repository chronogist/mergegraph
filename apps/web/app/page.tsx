import Link from "next/link";
import { getGitHubToken } from "@/lib/session";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const token = await getGitHubToken();
  const params = await searchParams;

  return (
    <main className="container">
      <div className="header">
        <div className="brand">MergeGraph</div>
        {token ? (
          <Link className="btn" href="/repos">
            Open repos
          </Link>
        ) : null}
      </div>

      <h1 style={{ marginTop: 0 }}>Repository knowledge graph</h1>
      <p className="lead">
        Search engineering decisions, incidents, and lessons extracted from
        merged PRs, closed issues, and releases.
      </p>

      {params.error ? (
        <p className="error">GitHub sign-in failed. Please try again.</p>
      ) : null}

      {token ? (
        <Link className="btn btn-primary" href="/repos">
          View connected repos
        </Link>
      ) : (
        <Link className="btn btn-primary" href="/api/auth/github">
          Sign in with GitHub
        </Link>
      )}
    </main>
  );
}