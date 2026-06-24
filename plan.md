# MergeGraph MVP Plan

Four phases from skeleton to production-ready. Check items off as they ship.

**Done when (overall MVP):** Install the app on a repo, merge a PR, ask `@mergegraph` a question, get a cited answer — with history backfilled and a minimal web UI.

---

## Phase 0 — Skeleton

**Goal:** Webhook in → job enqueued → worker logs it. GitHub App plumbing works end-to-end.

**Done when:** A webhook is received, persisted, enqueued, and processed without blocking the HTTP response.

- [ ] `plan.md` — MVP broken into 4 phases
- [ ] Monorepo scaffold (npm workspaces, TypeScript, docker-compose)
- [ ] PostgreSQL schema — installations, webhook deliveries
- [ ] pg-boss job queue wired to Postgres
- [ ] Fastify HTTP server
- [ ] `GET /health` — DB connectivity + queue depth
- [ ] `POST /api/webhook` — signature verification, idempotency, enqueue
- [ ] Worker — `process-event` job consumer
- [ ] `installation` event handler (created / deleted)
- [ ] `.env.example` + local dev instructions (Smee.io)

---

## Phase 1 — Core Loop

**Goal:** Merge a PR → knowledge extracted → `@mergegraph` returns a cited answer.

**Done when:** Merged PR produces knowledge nodes; a mention on an issue/PR gets a grounded reply with GitHub links.

- [ ] GitHub App permissions + webhook subscriptions for PRs and comments
- [ ] GraphQL fetcher for merged PR context (body, reviews, files)
- [ ] 0G Compute Router client + structured extraction prompts (Zod)
- [ ] 0G Storage Memory Capsule upload
- [ ] `knowledge_nodes` + `knowledge_edges` schema + pgvector embeddings
- [ ] `pull_request` closed/merged → extraction pipeline
- [ ] Hybrid retrieval (vector + 1-hop edges)
- [ ] `issue_comment` → `@mergegraph` query handler + cited reply

---

## Phase 2 — Coverage + UX

**Goal:** More event types, historical backfill, lightweight web UI.

**Done when:** New repo install backfills recent history; web UI search returns nodes.

- [ ] Closed issues extraction pipeline
- [ ] `release.published` extraction pipeline
- [ ] Backfill job on repo install (last N PRs + issues)
- [ ] Optional merge summary comment on PR merge
- [ ] Minimal web UI — repo list, search, node detail
- [ ] GitHub OAuth via App for web UI auth

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

## Commit log (Phase 0)

| Commit | Description |
|--------|-------------|
| — | _filled in as commits land_ |