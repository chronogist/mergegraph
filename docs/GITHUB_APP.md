# GitHub App Setup

MergeGraph runs as a **GitHub App**.

## Who configures credentials?

| Person | What they do | Needs `.env`? |
|--------|--------------|---------------|
| **Repo user** (your teammate) | Installs the app on their repo | **No** — click "Install" in GitHub |
| **MergeGraph operator** (you, hosting the server) | Runs the backend | **Yes** — secrets on the server only |
| **Local developer** | Tests without real APIs | **No** — use `DEV_MOCK=true` (2 vars only) |

End users never see or touch credentials. They install a GitHub App like any other (Dependabot, Codecov, etc.).

Production secrets belong in your **hosting provider's environment** (Render, Fly, Railway) — not committed to git.

## Local testing without credentials

```bash
# .env — only these two are required with mock mode
DATABASE_URL=postgresql://mergegraph:mergegraph@localhost:5432/mergegraph
WEBHOOK_SECRET=local-test-secret
DEV_MOCK=true
```

Then run `node scripts/test-webhook.mjs pull_request` and `node scripts/test-webhook.mjs issue_comment` — full Phase 1 loop, no GitHub or 0G keys.

---

Not every credential is needed on day one — it depends on what you're testing.

## What each credential does

| Variable | Required when | Purpose |
|----------|---------------|---------|
| `WEBHOOK_SECRET` | **Always** (any phase) | Verifies incoming webhooks are from GitHub, not an imposter |
| `APP_ID` | **Phase 1+** | Identifies your app when requesting API access tokens |
| `PRIVATE_KEY` | **Phase 1+** | Signs JWTs to generate installation access tokens |
| `DATABASE_URL` | **Always** | Postgres for index, queue, and app state |

### Why Phase 0 only needs `WEBHOOK_SECRET`

Phase 0 receives webhooks and reads data **from the webhook payload itself** (installation ID, account name, repo list). It never calls GitHub's API.

```
GitHub → webhook POST → MergeGraph verifies signature → done
```

No `APP_ID` or `PRIVATE_KEY` required to test that pipeline.

### Why Phase 1 needs `APP_ID` + `PRIVATE_KEY`

Phase 1 **calls GitHub's API** to:

1. **Read** merged PR bodies, review comments, and changed files (not fully included in webhooks)
2. **Write** `@mergegraph` reply comments on issues and PRs

GitHub Apps authenticate to the API by signing a JWT with your private key:

```
PRIVATE_KEY → short-lived JWT → installation access token → Octokit API calls
```

Without these credentials, webhooks still arrive but extraction and replies cannot run.

## Register the app

1. Go to [GitHub Developer Settings → GitHub Apps → New](https://github.com/settings/apps/new)
2. Set **Webhook URL** to your Smee.io channel (local) or production URL
3. Set **Webhook secret** — copy to `WEBHOOK_SECRET` in `.env`
4. Generate a **private key** — save the `.pem` file, set `PRIVATE_KEY_PATH` in `.env`
5. Copy the **App ID** to `APP_ID` in `.env`

## Permissions (Phase 1)

| Permission | Access | Why |
|------------|--------|-----|
| Metadata | Read | Required |
| Pull requests | Read | PR body, reviews, merge state |
| Issues | Read & write | Issues + posting `@mergegraph` replies (PRs use the issues API) |
| Contents | Read | Changed file paths from diffs |

## Webhook events

Subscribe to:

- [x] Installation
- [x] Installation repositories
- [x] Pull request
- [x] Issue comment
- [ ] Issues (Phase 2)
- [ ] Release (Phase 2)

## Install on a test repo

1. Open your app's **Public page** → **Install App**
2. Select a test repository
3. Merge a PR or comment `@mergegraph why was this built?` to test Phase 1