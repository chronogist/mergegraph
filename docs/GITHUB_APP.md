# GitHub App Setup

MergeGraph runs as a **GitHub App**. You register one app; your server runs it; users install it on their repos.

## Who configures what?

| Person | What they do | Needs secrets? |
|--------|--------------|----------------|
| **Repo user** | Clicks "Install MergeGraph" on their org/repo | **No** |
| **You (server host)** | Runs the MergeGraph backend | **Yes** — once, on your server |

Repo users never see API keys. They install the app the same way they install Dependabot or Codecov.

## Why does the host need GitHub keys?

Webhooks only tell you *that* something happened. They don't include everything MergeGraph needs.

| Action | Webhook gives you | GitHub API needed? |
|--------|-------------------|-------------------|
| PR merged | PR number, repo name | **Yes** — fetch full body, reviews, changed files |
| `@mergegraph` question | Comment text | **Yes** — post the reply comment back |

Your server must **authenticate as the GitHub App** to make those API calls. That's what `APP_ID` + `PRIVATE_KEY` do:

```
PRIVATE_KEY  →  sign a JWT  →  installation access token  →  Octokit API calls
```

Without them, MergeGraph can receive webhooks but cannot read PR details or post answers.

`WEBHOOK_SECRET` is separate — it only verifies that incoming webhooks are genuinely from GitHub.

## Register the app

1. Go to [GitHub Developer Settings → GitHub Apps → New](https://github.com/settings/apps/new)
2. Set **Webhook URL** to your Smee.io channel (local) or production URL
3. Set **Webhook secret** → `WEBHOOK_SECRET` on your server
4. Generate a **private key** → save `.pem`, set `PRIVATE_KEY_PATH` on your server
5. Copy **App ID** → `APP_ID` on your server

In production, set these in your hosting dashboard (Render, Fly, etc.) — not in git.

## Permissions

| Permission | Access | Why |
|------------|--------|-----|
| Metadata | Read | Required |
| Pull requests | Read | PR body, reviews, merge state |
| Issues | Read & write | Post `@mergegraph` replies (PRs use the issues API) |
| Contents | Read | Changed file paths |

## Webhook events

- Installation
- Installation repositories
- Pull request
- Issue comment

## Install on a test repo

1. App **Public page** → **Install App** → pick a test repo
2. Merge a PR with a meaningful description
3. Comment `@mergegraph why was this built?` on an issue or PR