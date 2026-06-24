# MergeGraph MVP Plan

Four phases from skeleton to production-ready. Check items off as they ship.

**Done when (overall MVP):** Install the app on a repo, merge a PR, ask `@mergegraph` a question, get a cited answer — with history backfilled and a minimal web UI.

---

## Phase 0 — Skeleton

**Goal:** Webhook in → job enqueued → worker logs it. GitHub App plumbing works end-to-end.

**Done when:** A webhook is received, persisted, enqueued, and processed without blocking the HTTP response.

- [x] `plan.md` — MVP broken into 4 phases
- [x] Monorepo scaffold (npm workspaces, TypeScript, docker-compose)
- [x] PostgreSQL schema — installations, webhook deliveries
- [x] pg-boss job queue wired to Postgres
- [x] Fastify HTTP server
- [x] `GET /health` — DB connectivity + queue depth
- [x] `POST /api/webhook` — signature verification, idempotency, enqueue
- [x] Worker — `process-event` job consumer
- [x] `installation` event handler (created / deleted)
- [x] `.env.example` + local dev instructions (Smee.io)

---

## Phase 1 — Core Loop

**Goal:** Merge a PR → knowledge extracted → `@mergegraph` returns a cited answer.

**Done when:** Merged PR produces knowledge nodes; a mention on an issue/PR gets a grounded reply with GitHub links.

- [x] GitHub App permissions + webhook subscriptions for PRs and comments — see [docs/GITHUB_APP.md](./docs/GITHUB_APP.md)
- [x] GraphQL fetcher for merged PR context (body, reviews, files)
- [x] 0G Compute Router client + structured extraction prompts (Zod)
- [x] 0G Storage Memory Capsule upload (`SKIP_0G_STORAGE=true` for local dev)
- [x] `knowledge_nodes` + `knowledge_edges` schema + pgvector embeddings
- [x] `pull_request` closed/merged → extraction pipeline
- [x] Hybrid retrieval (vector + 1-hop edges)
- [x] `issue_comment` → `@mergegraph` query handler + cited reply

---

## Phase 2 — Coverage + UX

**Goal:** More event types, historical backfill, lightweight web UI.

**Done when:** New repo install backfills recent history; web UI search returns nodes.

- [x] Closed issues extraction pipeline
- [x] `release.published` extraction pipeline
- [x] Backfill job on repo install (last N PRs + issues)
- [x] Optional merge summary comment on PR merge
- [x] Minimal web UI — repo list, search, node detail
- [x] GitHub OAuth via App for web UI auth

---

## Phase 3 — Production Hardening

**Goal:** Safe for public GitHub Marketplace listing.

**Done when:** Private repos encrypted, PR checks live, usage limits enforced.

- [ ] Per-installation AES encryption for private repo capsules
- [ ] PR context Check on `pull_request.opened`
- [ ] Installation data deletion on uninstall
- [ ] Rate limits + usage caps per installation
- [ ] Structured logging + error tracking (Sentry)
- [ ] TEE verification option (0G Compute Direct) — optional enterprise path
- [ ] GitHub Marketplace listing assets + privacy policy

---

## Commit log

### Phase 0

| Commit | Description |
|--------|-------------|
| `7ab4247` | docs: add MVP plan with 4 phases |
| `b854c0d` | chore: scaffold monorepo and local dev infrastructure |
| `8fa0ed0` | feat(db): add Drizzle schema for installations and webhooks |
| `d250064` | feat(api): add webhook receiver, health check, and pg-boss worker |
| `6a7e083` | docs: mark Phase 0 complete and add dev setup guide |

### Phase 1

| Commit | Description |
|--------|-------------|
| `5736399` | docs: explain when GitHub credentials are required |
| `208b050` | feat(db): add knowledge graph schema with pgvector |
| `951f554` | feat(github): add Octokit App client and PR GraphQL fetcher |
| `cf75ffd` | feat: add 0G Compute, Storage, and extractor packages |
| `89134a2` | feat(worker): add merged PR extraction and @mergegraph Q&A |
| `74da8c5` | docs: mark Phase 1 complete |

### Phase 2

| Commit | Description |
|--------|-------------|
| `b060ad8` | feat(github): add issue, release, and backfill list fetchers |
| `d3ef3bc` | feat(extractor): add issue and release extraction pipelines |
| `554484d` | feat(api): add shared knowledge ingestion service |
| `89f098f` | feat(worker): add closed issue and release extraction handlers |
| `2f7ac61` | feat(worker): add repo backfill on installation |
| `4820cc6` | feat(worker): add optional merge summary comment on PR merge |
| `5c74edf` | feat(api): add authenticated repo search and node routes |
| `fa9ee9d` | feat(web): add minimal Next.js UI with GitHub OAuth |