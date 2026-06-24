# MergeGraph

**Git stores code. MergeGraph stores context.**

MergeGraph is a GitHub App that turns repository activity into a living knowledge graph. It watches pull requests, issues, reviews, and releases — then extracts structured engineering knowledge so your team can ask *why*, not just *what*.

> Turn every merge into lasting engineering knowledge.

## The problem

Every day, valuable context is created inside PRs, issues, discussions, and release notes: architectural decisions, tradeoffs, incidents, migrations, lessons learned. That knowledge fragments over time and disappears when people leave.

New contributors end up digging through months of GitHub history instead of getting answers.

## What MergeGraph does

MergeGraph continuously watches repository events and uses verifiable AI on **0G Compute** to generate structured knowledge nodes from development activity. As the repo evolves, it builds an interconnected graph linking issues, PRs, commits, decisions, incidents, releases, and affected components.

Ask questions like:

- Why was this feature implemented?
- What problem did this migration solve?
- What incidents are related to this module?
- What architectural decisions affect this component?

MergeGraph traverses the knowledge graph and answers with citations grounded in your repository history.

## How it works

```
GitHub events → MergeGraph App → 0G Compute (extract) → 0G Storage (Memory Capsules)
                                        ↓
                              PostgreSQL (search index)
                                        ↓
                    @mergegraph on PRs/issues → cited answers
```

1. **Install** the GitHub App on your org or repo.
2. **Ingest** — merged PRs, closed issues, and releases are processed automatically in the background.
3. **Store** — knowledge is saved as durable Memory Capsules on 0G Storage; PostgreSQL indexes it for fast search.
4. **Query** — mention `@mergegraph` on any PR or issue, or use the web UI (coming soon).

## Built on 0G

| Layer | Role |
|-------|------|
| **0G Compute** | Verifiable AI for knowledge extraction and grounded Q&A |
| **0G Storage** | Durable, portable Memory Capsules — knowledge that outlasts contributor turnover |
| **PostgreSQL** | Fast index for graph traversal, vector search, and job queue |

## Stack

- **GitHub App** — Octokit, webhooks
- **Node.js / TypeScript** — API + background worker (single process in v1)
- **PostgreSQL + pgvector** — knowledge index, graph edges, embeddings
- **pg-boss** — Postgres-native job queue (no Redis)
- **0G Compute Router** — OpenAI-compatible inference
- **0G Storage SDK** — Memory Capsule upload/download

See [architecture.md](./architecture.md) for the full system design, data model, MVP phases, and deployment guide.

## Project status

Early development. Architecture is defined; implementation has not started.

| Phase | Status |
|-------|--------|
| Architecture & design | Done |
| Phase 0 — GitHub App skeleton + webhook pipeline | Planned |
| Phase 1 — PR extraction + `@mergegraph` Q&A | Planned |
| Phase 2 — Backfill, issues/releases, web UI | Planned |

## Development

```bash
git clone https://github.com/chronogist/mergegraph.git
cd mergegraph
```

Local setup and run instructions will be added as Phase 0 is implemented.

## License

TBD