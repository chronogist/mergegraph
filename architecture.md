# MergeGraph Architecture

**Git stores code. MergeGraph stores context.**

This document describes the simplest production-ready way to build MergeGraph: a GitHub App that ingests repository activity, extracts structured knowledge with verifiable AI on 0G Compute, stores durable Memory Capsules on 0G Storage, and answers developer questions grounded in that history.

The design optimizes for **shipping a working product fast** while leaving clear upgrade paths. It deliberately avoids graph databases, custom ML pipelines, and multi-service microservice sprawl in v1.

### Decisions (locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary database | **PostgreSQL 16 + pgvector** | Fast graph + vector search, job queue (pg-boss), and app state in one place. Neon free tier for $0 bootstrap. |
| Job queue | **pg-boss** (Postgres-native) | No Redis — same database handles async work. |
| Archive store | **0G Storage** | Durable, portable Memory Capsules. Postgres is the index; 0G is source of truth. |

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [System Overview](#2-system-overview)
3. [Recommended Tech Stack](#3-recommended-tech-stack)
4. [Core Data Model](#4-core-data-model)
5. [Ingestion Pipeline](#5-ingestion-pipeline)
6. [Knowledge Extraction (0G Compute)](#6-knowledge-extraction-0g-compute)
7. [Memory Capsules (0G Storage)](#7-memory-capsules-0g-storage)
8. [Query & Answer Pipeline](#8-query--answer-pipeline)
9. [GitHub-Native Surfaces](#9-github-native-surfaces)
10. [Web UI (Phase 2)](#10-web-ui-phase-2)
11. [Security & Multi-Tenancy](#11-security--multi-tenancy)
12. [Deployment](#12-deployment)
13. [MVP Phases](#13-mvp-phases)
14. [What We Are NOT Building (Yet)](#14-what-we-are-not-building-yet)
15. [Repository Layout](#15-repository-layout)
16. [Open Questions](#16-open-questions)

---

## 1. Design Principles

| Principle | What it means in practice |
|-----------|---------------------------|
| **Boring infrastructure** | PostgreSQL only + one Node.js API. No Redis, Neo4j, Kafka, or k8s required for v1. |
| **GitHub webhooks, not polling** | Subscribe to events; never scrape the API on a schedule except for one-time backfill. |
| **Respond fast, process slow** | Webhook handler returns `200` within 10 seconds; all heavy work runs in a background queue. |
| **Postgres is the index, 0G is the archive** | Postgres holds searchable metadata, edges, and embeddings. 0G Storage holds the canonical, portable capsule payload. |
| **Structured LLM output** | Every extraction returns validated JSON — not free-form summaries stored as blobs. |
| **Citations are mandatory** | Every answer links back to GitHub URLs (PR, issue, commit, release). No uncited claims. |
| **Idempotent by delivery ID** | `X-GitHub-Delivery` is the deduplication key for every webhook job. |

---

## 2. System Overview

```mermaid
flowchart TB
    subgraph github [GitHub]
        Events[PR / Issue / Comment / Release events]
        API[GitHub REST API]
        Surfaces[PR comments · @mergegraph · Checks]
    end

    subgraph mergegraph [MergeGraph Backend]
        WH[Webhook Receiver]
        Q[pg-boss job queue]
        W[Worker]
        PG[(PostgreSQL + pgvector + jobs)]
        EX[Extractor Service]
        QA[Query Service]
    end

    subgraph zerog [0G Network]
        Compute[0G Compute Router]
        Storage[0G Storage]
    end

    Events -->|webhook POST| WH
    WH -->|enqueue| Q
    Q --> W
    W -->|fetch extra context| API
    W --> EX
    EX -->|structured extraction| Compute
    EX -->|upload capsule| Storage
    W -->|index nodes + edges + embeddings| PG

    Surfaces -->|@mention / check run| WH
    WH --> QA
    QA -->|hybrid retrieval| PG
    QA -->|load capsule proof| Storage
    QA -->|grounded answer| Compute
    QA -->|post comment| API
```

### Three runtime paths

1. **Ingest** — GitHub event → queue → fetch context → extract knowledge → store capsule → index in Postgres.
2. **Query** — User asks a question → retrieve relevant nodes → load capsules → LLM synthesizes cited answer.
3. **Backfill** — One-time job walks historical PRs/issues for a newly installed repo.

---

## 3. Recommended Tech Stack

### Core (v1)

| Layer | Choice | Why |
|-------|--------|-----|
| Language | **TypeScript (Node 22+)** | Same ecosystem as Octokit, 0G TS SDKs, and most GitHub App examples. |
| GitHub integration | **Octokit (`octokit` package)** | Official path; handles App auth, webhooks, and REST. |
| HTTP server | **Fastify** or **Hono** | Lightweight, fast, good TypeScript support. Avoid Express unless team preference. |
| Job queue | **pg-boss** (PostgreSQL-native) | Retries, scheduling, concurrency — uses the same Postgres you already need. **No Redis bill.** |
| Primary database | **PostgreSQL 16 + pgvector** (Neon free tier → paid as needed) | Nodes, edges, embeddings, installations, and the job queue — one DB for everything. |
| AI inference | **0G Compute Router** (`https://router-api.0g.ai/v1`) | OpenAI-compatible API, single API key, automatic failover. Simplest server-side path. |
| Durable storage | **0G Storage TS SDK** (`@0gfoundation/0g-storage-ts-sdk`) | Upload JSON Memory Capsules; store `rootHash` in Postgres. |
| Embeddings | **0G Router** (same API) or dedicated embedding model via Router | Keeps one integration surface. |
| Hosting | **Neon (Postgres) + Render/Fly free tier** | See [Zero-cost bootstrap](#zero-cost-bootstrap) below. One Node process runs API + worker together. |

### Why NOT these (for v1)

| Avoid | Use instead |
|-------|-------------|
| Neo4j / Neptune | `nodes` + `edges` tables in Postgres; 2-hop traversal is enough for MVP queries. |
| 0g-memory / EverMemOS full stack | Built for AI agent session memory (MongoDB + ES + Milvus). Far too heavy for repo knowledge. |
| 0G Compute Direct (wallet-per-provider) | Router is simpler for a server-side SaaS; add Direct + TEE verification in v2 for enterprise. |
| Microservices | Monorepo with `api` + `worker` processes, same codebase. |
| Real-time GraphQL subscriptions | Webhooks + polling on web UI is sufficient. |
| BullMQ + Redis | pg-boss on Postgres — same reliability pattern, zero extra service to pay for. |

### Why pg-boss instead of Redis

GitHub webhooks must return `200` in under 10 seconds, so LLM extraction cannot run inline. You still need a queue — but that queue does **not** have to be Redis.

**[pg-boss](https://github.com/timgit/pg-boss)** stores jobs in PostgreSQL using `SKIP LOCKED` polling. It gives you:

- Automatic retries with exponential backoff
- Job scheduling (delay backfill, debounce review events)
- Priority queues (`@mergegraph` queries ahead of backfill)
- Dead-letter / failed job inspection via SQL

Because MergeGraph already requires Postgres for nodes, edges, and pgvector, **the job queue is free infrastructure** — no second always-on service.

```typescript
import PgBoss from 'pg-boss';

const boss = new PgBoss(process.env.DATABASE_URL);
await boss.start();

// Webhook handler — returns in milliseconds
await boss.send('process-event', { deliveryId, event, payload }, {
  singletonKey: deliveryId,  // idempotent: same delivery won't enqueue twice
});

// Same Node process — starts with the API server
await boss.work('process-event', async (job) => {
  await processEvent(job.data);
});
```

For v1, run the worker **inside the same process** as the webhook API. Split into a separate worker process only when you need horizontal scaling (paid tier).

---

## 4. Core Data Model

### Knowledge Node

A **Knowledge Node** is one unit of extracted engineering context.

```typescript
type KnowledgeNode = {
  id: string;                    // uuid
  installationId: number;        // GitHub App installation
  repoId: number;                // GitHub repository id (stable)
  type: 'decision' | 'rationale' | 'tradeoff' | 'incident' | 'migration' | 'lesson' | 'release_note';
  title: string;
  summary: string;               // 1-3 sentences
  body: string;                  // fuller narrative
  confidence: number;            // 0-1, from extractor
  sourceEvent: {
    type: 'pull_request' | 'issue' | 'release' | 'discussion';
    githubId: number;
    url: string;
    action: string;              // e.g. 'closed', 'merged'
  };
  entities: {
    paths: string[];             // affected file paths / globs
    components: string[];       // logical names: 'auth', 'billing'
    people: string[];            // github logins
    labels: string[];
  };
  embedding: number[];           // stored in pgvector
  capsuleRootHash: string;       // 0G Storage merkle root
  createdAt: string;
  validFrom: string;             // when this knowledge became true (merge date, etc.)
};
```

### Edge (Graph Link)

```typescript
type Edge = {
  id: string;
  installationId: number;
  fromNodeId: string;
  toNodeId: string;
  relation: 'supersedes' | 'related_to' | 'caused_by' | 'implements' | 'affects' | 'discussed_in';
  weight: number;                // optional relevance score
};
```

### Memory Capsule (0G Storage payload)

A **Memory Capsule** is the canonical, portable, auditable record stored on 0G. Postgres holds a copy of key fields for speed; the capsule is source of truth.

```typescript
type MemoryCapsule = {
  version: 1;
  nodeId: string;
  installationId: number;
  repoFullName: string;
  extractedAt: string;
  extractor: {
    model: string;
    provider: '0g-compute-router';
    requestId?: string;          // for audit trail
  };
  source: {
    event: string;
    deliveryId: string;          // X-GitHub-Delivery
    payloadHash: string;         // sha256 of raw webhook + fetched context
    githubUrls: string[];
  };
  node: KnowledgeNode;           // full node at extraction time
  edges: Edge[];               // edges proposed at extraction time
  rawContext: {
    prBody?: string;
    reviewComments?: string[];
    issueBody?: string;
    diffSummary?: string;        // truncated, not full diff
  };
};
```

Capsules are uploaded as JSON via `MemData` / `ZgFile` to 0G Storage. The returned `rootHash` is stored in Postgres and never changes (append-only knowledge).

### Postgres schema (simplified)

```sql
-- installations, repos: track GitHub App state
-- webhook_deliveries: idempotency (delivery_id PK, processed_at)
-- knowledge_nodes: indexed fields + embedding vector(1536)
-- knowledge_edges: from_node_id, to_node_id, relation
-- capsule_refs: node_id → root_hash, uploaded_at
-- pgboss.*: job queue tables (created automatically by pg-boss)
```

---

## 5. Ingestion Pipeline

### GitHub App permissions (minimum viable)

| Permission | Access | Purpose |
|------------|--------|---------|
| Metadata | Read | Required baseline |
| Pull requests | Read | PR body, reviews, merge info |
| Issues | Read & Write | Issues + post answer comments |
| Contents | Read | File paths from diffs (not full file content in v1) |
| Commit statuses | Read & Write | Optional PR context check (Phase 2) |

### Webhook subscriptions (minimum viable)

| Event | Actions | Trigger |
|-------|---------|---------|
| `pull_request` | `closed` (merged) | Primary knowledge extraction |
| `pull_request_review` | `submitted` | Capture review rationale (debounced) |
| `issues` | `closed`, `opened` | Incidents, bugs, lessons |
| `issue_comment` | `created` | `@mergegraph` queries + discussion context |
| `release` | `published` | Release notes, migrations |
| `installation` | `created`, `deleted` | Tenant lifecycle |
| `installation_repositories` | `added`, `removed` | Repo scope changes |

### Webhook handler flow

```
1. Verify HMAC signature (webhook secret)
2. Check X-GitHub-Delivery not already processed → else return 200
3. Enqueue job { deliveryId, event, action, payload }
4. Return 200 immediately
```

GitHub requires a **2xx within 10 seconds**. Never run LLM calls in the webhook handler.

### Worker: `processEvent` job

```
1. Resolve installation → Octokit instance
2. Switch on event type:
   - pull_request.closed + merged → processMergedPR
   - issues.closed → processClosedIssue
   - release.published → processRelease
   - issue_comment.created → if @mergegraph → processQuery (fast path)
3. For extraction jobs:
   a. Fetch PR/issue details + review comments + labels + changed files (GraphQL preferred — one request)
   b. Build context bundle (cap size: ~32k tokens)
   c. Call Extractor (section 6)
   d. Upload Memory Capsule to 0G Storage
   e. Upsert node + edges + embedding in Postgres
   f. Mark delivery processed
```

### Fetching context efficiently

Use **GitHub GraphQL** for merged PRs — one query returns title, body, reviews, comments, files, commits:

```graphql
query ($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      title, body, mergedAt, merged
      files(first: 100) { nodes { path } }
      reviews(last: 20) { nodes { body, author { login } } }
      comments(last: 50) { nodes { body, author { login } } }
    }
  }
}
```

Do **not** download full diffs for every PR in v1. File paths + PR/review text are enough for 80% of knowledge extraction.

### Backfill job

When a repo is newly added to an installation:

```
1. Enqueue backfill job (low priority queue)
2. Paginate merged PRs (newest first, limit e.g. last 200 for MVP)
3. Paginate closed issues (last 100)
4. Process each with same extraction pipeline
5. Rate-limit: respect GitHub 5000 req/hr per installation token
```

---

## 6. Knowledge Extraction (0G Compute)

### Integration: 0G Compute Router

Use the Router for all LLM calls in v1:

- **Endpoint:** `https://router-api.0g.ai/v1` (mainnet) or testnet equivalent
- **Client:** Standard OpenAI SDK — `baseURL` + `apiKey` only
- **Models:** Pick one good instruction-following model from the Router catalog for extraction; same or larger model for Q&A

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: process.env.OG_COMPUTE_ROUTER_URL,
  apiKey: process.env.OG_COMPUTE_ROUTER_API_KEY,
});
```

### Extraction prompt strategy

Use **structured output** (JSON schema / `response_format: { type: 'json_object' }`) with a system prompt that:

1. Defines allowed `type` values
2. Requires `entities.paths` and `entities.components` from the diff/file list
3. Requires at least one `sourceEvent.url`
4. Sets `confidence` low when context is ambiguous
5. Proposes `edges` only to **existing node IDs** returned in the prompt context (last N related nodes for this repo)

### Two-pass extraction (optional, still simple)

| Pass | Purpose | Cost |
|------|---------|------|
| Pass 1 | Extract 0–3 knowledge nodes from event | Every event |
| Pass 2 | Propose edges to existing nodes | Only when Pass 1 finds something |

Skip Pass 2 in earliest MVP if needed — vector similarity can link nodes later.

### Verifiable AI (v1 vs v2)

| Version | Approach |
|---------|----------|
| **v1** | Router inference + store `requestId` / model in capsule metadata. Good enough for launch. |
| **v2** | 0G Compute Direct with `processResponse()` TEE verification; attach proof hash to capsule. Enterprise / audit customers. |

Do not block MVP on TEE verification. Design the capsule format to accept a `verification` field later.

---

## 7. Memory Capsules (0G Storage)

### Upload flow

```typescript
import { MemData, Indexer } from '@0gfoundation/0g-storage-ts-sdk';

async function storeCapsule(capsule: MemoryCapsule): Promise<string> {
  const json = JSON.stringify(capsule);
  const data = new TextEncoder().encode(json);
  const memData = new MemData(data);
  await memData.merkleTree();
  const [tx, err] = await indexer.upload(memData, RPC_URL, signer);
  if (err) throw err;
  return tx.rootHash;
}
```

### What goes on 0G vs Postgres

| Data | Postgres | 0G Storage |
|------|----------|------------|
| Node title, summary, type, entities | ✅ | ✅ (in capsule) |
| Embedding vector | ✅ | ❌ |
| Edge index for fast traversal | ✅ | ✅ (in capsule) |
| Raw PR/review text | ❌ (or truncated cache) | ✅ |
| Full audit payload | ❌ | ✅ |

Postgres is a **materialized index** over capsules. If Postgres is lost, reindex from 0G by `rootHash` list (slow but possible).

### Encryption

For private repos, encrypt capsules client-side before upload:

```typescript
indexer.upload(file, rpcUrl, signer, {
  encryption: { type: 'aes256', key: installationDerivedKey },
});
```

Derive per-installation keys from a master secret + `installationId`. Never store raw repo content unencrypted for private repos.

### Cost control

- One capsule per extraction event (not per comment)
- Cap `rawContext` size (truncate long review threads)
- Batch backfill with rate limits
- Start with last N events per repo, not full history

---

## 8. Query & Answer Pipeline

### Retrieval: hybrid search (no graph DB needed)

```sql
-- Step 1: vector similarity (top 20)
SELECT id, title, summary, capsule_root_hash
FROM knowledge_nodes
WHERE repo_id = $1
ORDER BY embedding <=> $2
LIMIT 20;

-- Step 2: graph expansion (1 hop)
SELECT n.*
FROM knowledge_edges e
JOIN knowledge_nodes n ON n.id = e.to_node_id
WHERE e.from_node_id = ANY($candidate_ids);

-- Step 3: optional path filter
AND $path LIKE ANY(entities_paths)
```

### Answer generation

```
1. User question + scope (repo, optional PR/issue/path)
2. Hybrid retrieval → top 5–10 nodes
3. Load full capsules from 0G for those rootHashes (parallel)
4. LLM prompt: "Answer using ONLY provided context. Cite as [PR #123](url)."
5. Return answer + citation list
```

### Query triggers

| Source | Latency target |
|--------|----------------|
| `@mergegraph` comment | < 30s (enqueue priority job) |
| Web UI search | < 5s (cached embeddings) |
| PR Check (Phase 2) | < 60s (runs on PR open) |

---

## 9. GitHub-Native Surfaces

### v1: `@mergegraph` mention handler

```
issue_comment.created
  → body matches /@mergegraph\b/i
  → enqueue query job { commentId, repo, question }
  → worker posts threaded reply with answer + links
```

Reply format:

```markdown
### MergeGraph

{answer paragraph}

**Sources**
- [PR #120: Add event sourcing](https://github.com/...)
- [Issue #445: Auth outage](https://github.com/...)
```

### v1 (optional): merge summary comment

On `pull_request.closed` + merged, if repo setting enabled:

```markdown
MergeGraph captured **2 decisions** and **1 tradeoff** from this PR.
- Decision: Use Redis for session cache (confidence: 0.87)
- Tradeoff: Accepted eventual consistency in exchange for lower latency

Ask `@mergegraph why was Redis chosen?` for details.
```

### Phase 2: PR Check

Create a check run on `pull_request.opened`:

```
MergeGraph Context ✓
3 related decisions · 1 incident · affects src/auth/
```

Links to web UI for full graph view.

---

## 10. Web UI (Phase 2)

Keep it minimal:

| Page | Purpose |
|------|---------|
| `/install` | GitHub App install callback |
| `/repos` | List connected repos |
| `/repos/:owner/:repo` | Search bar + recent knowledge nodes |
| `/repos/:owner/:repo/nodes/:id` | Node detail + graph neighbors (simple list, not D3 galaxy) |

**Stack:** Next.js on Vercel, GitHub OAuth via the App for user identity, API calls to the same backend.

The web UI reads from Postgres + 0G — same query pipeline as `@mergegraph`.

---

## 11. Security & Multi-Tenancy

### Tenant isolation

- Every row scoped by `installation_id` + `repo_id`
- Query jobs verify the comment author has repo access (public repos: anyone; private: via installation token check)
- Never leak nodes across repos or orgs

### Secrets

| Secret | Storage |
|--------|---------|
| GitHub App private key | Env / KMS (never in repo) |
| Webhook secret | Env |
| 0G Router API key | Env |
| 0G Storage wallet key | Env / KMS |
| DB URL | Managed Postgres env |

### Data deletion

On `installation.deleted`:

1. Delete all nodes, edges, embeddings for that `installation_id` in Postgres
2. Mark capsules as tombstoned (0G Storage is append-only — document that capsules may persist on-chain but are unreachable from the app)
3. Revoke installation token

### GitHub rate limits

- Cache installation tokens (1 hr TTL)
- Use conditional requests (`If-None-Match`)
- Backfill queue: max 1 concurrent job per installation

---

## 12. Deployment

### v1 topology (single region, no Redis)

```
┌─────────────────────────────────────┐
│  Single Node process: mergegraph  │
│  ├─ HTTP server (webhooks, health)  │
│  └─ pg-boss worker (same process)   │
└─────────────────────────────────────┘
              │
         PostgreSQL
    (pgvector + pg-boss jobs)
```

One process handles both webhooks and background jobs. Postgres is the only stateful dependency. Split into two processes later only if queue throughput demands it.

### Zero-cost bootstrap

If you have no budget for always-on paid services, this stack costs **$0/month** to start:

| Component | Free option | Caveat |
|-----------|-------------|--------|
| Postgres + pgvector | [Neon](https://neon.tech) free tier | 0.5 GB storage; sleeps after inactivity but wakes on connect |
| Node.js hosting | [Render](https://render.com) free web service | Spins down after ~15 min idle; **first webhook after sleep takes ~30s to cold-start** |
| Webhook dev tunnel | [smee.io](https://smee.io) | Free for local development |
| 0G Compute / Storage | 0G testnet | Testnet tokens via faucet; see 0G docs |

**Cold-start mitigation (still free):** Use [cron-job.org](https://cron-job.org) or GitHub Actions on a schedule to `GET /health` every 10 minutes. Keeps Render awake without paying.

**Alternative hosts:** Fly.io (free allowance), Railway (limited trial credits). All work with external Neon Postgres — you never need the host's paid Redis add-on.

**Safety net:** If your server is down, GitHub [automatically retries webhooks](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks#redeliver-missed-deliveries) for up to 24 hours. Jobs are also persisted in Postgres, so a restart resumes processing — nothing is lost.

### Environment variables

```bash
# GitHub App
APP_ID=
PRIVATE_KEY=
WEBHOOK_SECRET=

# Database (also used by pg-boss for the job queue)
DATABASE_URL=

# 0G Compute
OG_COMPUTE_ROUTER_URL=https://router-api.0g.ai/v1
OG_COMPUTE_ROUTER_API_KEY=

# 0G Storage
OG_RPC_URL=https://evmrpc.0g.ai
OG_INDEXER_URL=<turbo indexer from 0G network docs>
OG_STORAGE_PRIVATE_KEY=

# App
NODE_ENV=production
PORT=3000
```

### Observability (minimum)

- Structured JSON logs with `deliveryId`, `installationId`, `repoId`, `jobId`
- Error tracking (Sentry)
- Queue depth: `SELECT count(*) FROM pgboss.job WHERE state = 'created'` on health endpoint
- Webhook failure → GitHub auto-retries; log and alert on repeated failures

### Local development

```
smee.io → localhost:3000/api/webhook   (webhook forwarding)
docker compose up postgres                (local infra — no Redis needed)
npm run dev                             (API + worker in watch mode)
```

---

## 13. MVP Phases

### Phase 0 — Skeleton (1 week)

- [ ] GitHub App registration + webhook receiver
- [ ] Postgres schema + pg-boss job queue
- [ ] `installation` event handling
- [ ] Health check + Smee local dev loop

**Done when:** Webhook received, job enqueued, logged.

### Phase 1 — Core loop (2–3 weeks)

- [ ] Merged PR extraction pipeline
- [ ] 0G Compute Router integration (structured JSON extraction)
- [ ] 0G Storage capsule upload
- [ ] pgvector indexing
- [ ] `@mergegraph` query → cited reply comment

**Done when:** Merge a PR, ask `@mergegraph` a question, get a grounded answer with links.

### Phase 2 — Coverage + UX (2 weeks)

- [ ] Closed issues + releases
- [ ] Backfill last N PRs on install
- [ ] Optional merge summary comment
- [ ] Minimal web UI (search + node detail)

**Done when:** New repo install backfills history; web UI search works.

### Phase 3 — Production hardening (2 weeks)

- [ ] Per-installation encryption for private repos
- [ ] PR context Check
- [ ] TEE verification option (0G Compute Direct)
- [ ] Billing / usage limits per installation

**Done when:** Ready for public GitHub Marketplace listing.

---

## 14. What We Are NOT Building (Yet)

| Temptation | Why we defer |
|------------|--------------|
| Neo4j / dedicated graph DB | Postgres edges + pgvector handles MVP query patterns. Revisit at 1M+ nodes/repo. |
| Full diff / AST analysis | File paths + PR text capture most context; AST is expensive and noisy. |
| Real-time collaboration | Webhooks are minutes-fresh; that's fine for knowledge, not chat. |
| Multi-repo knowledge graph | Scope to one repo per query in v1. Cross-repo is Phase 4+. |
| Custom embedding model | Use Router-hosted embeddings. |
| Running our own 0G storage node | Use public indexer; self-host only if cost/latency requires it. |
| Redis / BullMQ | pg-boss on Postgres — avoids a separate always-paid service. |

---

## 15. Repository Layout

```
mergegraph/
├── apps/
│   ├── api/                 # Fastify webhook + query HTTP
│   └── worker/              # pg-boss handlers (merged into api process in v1)
├── packages/
│   ├── github/              # Octokit helpers, GraphQL queries
│   ├── extractor/           # LLM prompts + JSON validation (Zod)
│   ├── storage-0g/        # Capsule upload/download wrapper
│   ├── compute-0g/          # Router client wrapper
│   └── db/                  # Prisma or Drizzle schema + migrations
├── docker-compose.yml       # postgres only for local dev
├── architecture.md
└── README.md
```

Use **Drizzle ORM** or **Prisma** — both work well with pgvector. Pick one; don't hand-write SQL migrations.

---

## 16. Open Questions

| Question | Recommendation |
|----------|----------------|
| Public vs private repo data handling? | Encrypt private repo capsules; public repos can skip encryption for simpler audit. |
| Who pays for 0G Compute/Storage? | MergeGraph operator funds v1; per-installation billing in Phase 3. |
| How much history to backfill? | Default 200 merged PRs + 100 closed issues; configurable per repo. |
| Graph visualization? | Simple neighbor list in v2; force-directed graph is Phase 4 vanity. |
| Org-level vs repo-level install? | Support both via GitHub App standard install flow; scope all queries by repo. |

---

## Summary

The easiest production-ready path:

1. **GitHub App** (Octokit) with webhooks → **pg-boss** queue (same Postgres, no Redis)
2. **Worker** fetches PR/issue context → **0G Compute Router** extracts structured JSON
3. Upload **Memory Capsule** to **0G Storage**; index in **Postgres + pgvector**
4. Answer questions via **hybrid retrieval** + LLM with mandatory citations
5. Expose through **`@mergegraph` comments** first; add web UI and PR checks later

This ships a real product in ~6–8 weeks with one backend engineer, avoids premature infrastructure, and maps cleanly to the 0G stack without adopting the heavier 0g-memory agent framework.