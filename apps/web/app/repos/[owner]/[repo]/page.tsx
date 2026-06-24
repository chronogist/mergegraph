import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetch, type NodeSummary } from "@/lib/api";
import { getGitHubToken } from "@/lib/session";
import { SearchForm } from "./search-form";

type SearchNode = NodeSummary & { score?: number };

export default async function RepoPage({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const token = await getGitHubToken();
  if (!token) redirect("/");

  const { owner, repo } = await params;
  const { q } = await searchParams;
  const query = q?.trim();

  let recent: NodeSummary[] = [];
  let results: SearchNode[] = [];
  let error: string | null = null;

  try {
    if (query) {
      const data = (await apiFetch(
        `/api/repos/${owner}/${repo}/search?q=${encodeURIComponent(query)}`,
      )) as { nodes: SearchNode[] };
      results = data.nodes;
    } else {
      const data = (await apiFetch(
        `/api/repos/${owner}/${repo}/nodes`,
      )) as { nodes: NodeSummary[] };
      recent = data.nodes;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load nodes";
  }

  const nodes: SearchNode[] = query ? results : recent;

  return (
    <main className="container">
      <div className="header">
        <div className="brand">
          <Link href="/repos">MergeGraph</Link>
        </div>
      </div>

      <h1 style={{ marginTop: 0 }}>
        {owner}/{repo}
      </h1>
      <p className="lead">
        {query
          ? `Search results for “${query}”`
          : "Recent knowledge nodes captured from repository activity."}
      </p>

      <div style={{ marginBottom: "1.5rem" }}>
        <SearchForm owner={owner} repo={repo} initialQuery={query ?? ""} />
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="stack">
        {nodes.length === 0 && !error ? (
          <div className="card muted">
            {query
              ? "No matching knowledge nodes yet."
              : "No knowledge nodes yet. Merge PRs or close issues to populate the graph."}
          </div>
        ) : null}

        {nodes.map((node) => (
          <Link
            key={node.id}
            className="card"
            href={`/repos/${owner}/${repo}/nodes/${node.id}`}
          >
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <div className="title" style={{ margin: 0 }}>
                {node.title}
              </div>
              <span className="badge">{node.type}</span>
              {typeof node.score === "number" ? (
                <span className="badge">score {node.score.toFixed(2)}</span>
              ) : null}
            </div>
            <p className="muted" style={{ margin: "0.45rem 0 0" }}>
              {node.summary}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}