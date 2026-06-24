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
4. **Query** — mention `@mergegraph` on any PR or issue, or use the web UI (`npm run dev:web`).

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

See [plan.md](./plan.md) for the full MVP checklist.

| Phase | Status |
|-------|--------|
| Architecture & design | Done |
| Phase 0 — GitHub App skeleton + webhook pipeline | **Done** |
| Phase 1 — PR extraction + `@mergegraph` Q&A | Done |
| Phase 2 — Backfill, issues/releases, web UI | **Done** |
| Phase 3 — Production hardening | Planned |

## Development

### Prerequisites

- Node.js 22+
- Docker (for local Postgres)
- A [GitHub App](https://docs.github.com/en/apps/creating-github-apps) — see [docs/GITHUB_APP.md](./docs/GITHUB_APP.md)

### Credentials

**Repo users never configure credentials** — they only install the GitHub App.

**You** (the server host) set secrets once. Webhooks tell MergeGraph *what* happened; the GitHub API keys let it *read PR details* and *post `@mergegraph` replies*.

| Variable | Purpose |
|----------|---------|
| `WEBHOOK_SECRET` | Verify webhooks are from GitHub |
| `APP_ID` + `PRIVATE_KEY_PATH` | Authenticate API calls as your GitHub App |
| `OG_COMPUTE_ROUTER_API_KEY` | AI extraction and Q&A |

Production: set these in your hosting dashboard (Render/Fly), not in git.

### Setup

```bash
git clone https://github.com/chronogist/mergegraph.git
cd mergegraph
npm install

cp .env.example .env
# Fill in WEBHOOK_SECRET, APP_ID, PRIVATE_KEY_PATH, OG_COMPUTE_ROUTER_API_KEY

docker compose up -d
npm run db:migrate
npm run dev
```

### Local webhooks (Smee.io)

```bash
# Terminal 1 — forward GitHub webhooks to your machine
npx smee -u https://smee.io/YOUR_CHANNEL -t http://localhost:3000/api/webhook

# Terminal 2
npm run dev
```

Set the Smee URL as the **Webhook URL** in your GitHub App settings.

### Verify

```bash
curl http://localhost:3000/health
# → { "status": "ok", "queue": { "name": "process-event", "pending": 0 }, ... }
```

Install the app on a test repo and trigger an event — check server logs for `[worker] Processing ...`.

### Web UI

```bash
# Terminal 3 — requires GITHUB_APP_CLIENT_ID/SECRET in .env
npm run dev:web
# → http://localhost:3001
```

Sign in with GitHub, pick a connected repo, and search knowledge nodes.

## License

TBD