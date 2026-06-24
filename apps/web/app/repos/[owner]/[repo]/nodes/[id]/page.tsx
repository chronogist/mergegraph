import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getGitHubToken } from "@/lib/session";

type Neighbor = {
  id: string;
  type: string;
  title: string;
  summary: string;
  sourceUrl: string;
  relation: string;
  direction: "outgoing" | "incoming";
};

export default async function NodeDetailPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string; id: string }>;
}) {
  const token = await getGitHubToken();
  if (!token) redirect("/");

  const { owner, repo, id } = await params;

  let detail: {
    node: {
      id: string;
      type: string;
      title: string;
      summary: string;
      body: string;
      confidence: number;
      sourceEventType: string;
      sourceGithubId: number | null;
      sourceUrl: string;
      validFrom: string | null;
      createdAt: string;
    };
    neighbors: Neighbor[];
  } | null = null;
  let error: string | null = null;

  try {
    detail = await apiFetch(`/api/repos/${owner}/${repo}/nodes/${id}`);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load node";
  }

  if (error || !detail) {
    return (
      <main className="container">
        <p className="error">{error ?? "Node not found"}</p>
        <Link href={`/repos/${owner}/${repo}`}>Back to repo</Link>
      </main>
    );
  }

  const { node, neighbors } = detail;

  return (
    <main className="container">
      <div className="header">
        <div className="brand">
          <Link href={`/repos/${owner}/${repo}`}>
            {owner}/{repo}
          </Link>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <h1 className="title" style={{ fontSize: "1.35rem" }}>
            {node.title}
          </h1>
          <span className="badge">{node.type}</span>
        </div>
        <p className="muted">{node.summary}</p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            margin: "1rem 0 0",
            fontFamily: "inherit",
            lineHeight: 1.5,
          }}
        >
          {node.body}
        </pre>
        <p className="muted" style={{ marginTop: "1rem" }}>
          Source:{" "}
          <a href={node.sourceUrl} target="_blank" rel="noreferrer">
            {node.sourceUrl}
          </a>
        </p>
      </div>

      <h2 style={{ marginTop: "2rem" }}>Neighbors</h2>
      <div className="stack">
        {neighbors.length === 0 ? (
          <div className="card muted">No graph neighbors indexed yet.</div>
        ) : (
          neighbors.map((neighbor) => (
            <Link
              key={`${neighbor.direction}-${neighbor.id}`}
              className="card"
              href={`/repos/${owner}/${repo}/nodes/${neighbor.id}`}
            >
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <div className="title" style={{ margin: 0 }}>
                  {neighbor.title}
                </div>
                <span className="badge">{neighbor.type}</span>
                <span className="badge">
                  {neighbor.direction} · {neighbor.relation}
                </span>
              </div>
              <p className="muted" style={{ margin: "0.45rem 0 0" }}>
                {neighbor.summary}
              </p>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}