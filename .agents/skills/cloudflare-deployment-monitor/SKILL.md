---
name: cloudflare-deployment-monitor
description: Invoke after every push to monitor the correct Cloudflare Worker build and deployment for sids.in.
---

# Cloudflare Deployment Monitor

Monitor the Cloudflare Workers build triggered by a push and verify that the pushed commit reached the live sids.in deployment.

## When to Use

Invoke this skill after **every** `git push` from the sids.in repository, regardless of whether the push changes content, application code, configuration, tests, or project documentation.

Do not use a check run from another commit as evidence. Every query must be scoped to the SHA that was just pushed.

## Workflow

### 1. Identify and Verify the Pushed Commit

Run immediately after a successful push:

```bash
COMMIT=$(git rev-parse HEAD)
BRANCH=$(git branch --show-current)
REMOTE_COMMIT=$(git ls-remote origin "refs/heads/$BRANCH" | cut -f1)
printf 'local=%s\nremote=%s\n' "$COMMIT" "$REMOTE_COMMIT"
test "$COMMIT" = "$REMOTE_COMMIT"
```

If the SHAs differ, stop. The local commit was not the commit pushed to that remote branch, so monitoring it would give a misleading result.

### 2. Poll the Commit-Specific Workers Build

Query the exact pushed SHA:

```bash
gh api "repos/sids/sids.in/commits/$COMMIT/check-runs" \
  --jq '.check_runs[] | select(.name == "Workers Builds: sids-in") | [.name, .status, (.conclusion // "pending"), .details_url] | @tsv'
```

Poll about every 15 seconds:

- No matching check yet: keep waiting; Cloudflare may not have created it.
- `queued`, `waiting`, or `in_progress`: keep waiting.
- `completed` with `success`: continue to deployment verification.
- `completed` with any other conclusion: report failure and stop.
- No matching check after 10 minutes: report a timeout; do not claim deployment succeeded.

On failure or timeout, retrieve the check summary and dashboard URL:

```bash
gh api "repos/sids/sids.in/commits/$COMMIT/check-runs" \
  --jq '.check_runs[] | select(.name == "Workers Builds: sids-in") | {status, conclusion, details_url, summary: .output.summary}'
```

### 3. Capture Deployment Evidence

After a successful check, retrieve its details:

```bash
gh api "repos/sids/sids.in/commits/$COMMIT/check-runs" \
  --jq '.check_runs[] | select(.name == "Workers Builds: sids-in") | {status, conclusion, details_url, summary: .output.summary}'
```

The summary should identify the Cloudflare build ID and deployed Worker version ID. Keep the `details_url` for the final report.

### 4. Smoke-Test Production

Verify that the deployed Worker responds successfully:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://sids.in/
```

Expect HTTP `200`. When the push changes a specific route or page, also verify that URL and its change-specific behavior. A home-page response alone does not prove that a changed feature works.

### 5. Report the Result

Report:

- Pushed commit SHA
- Cloudflare check conclusion
- Build ID and Worker version ID when available
- Cloudflare dashboard URL
- Production smoke-test result
- Change-specific preview or verification URL when applicable

## Failure Rules

- Never equate a successful `git push` with a successful deployment.
- Never monitor `HEAD`, the latest workflow, or another branch after recording the pushed SHA; use the recorded commit throughout.
- Never report success while the check is absent, queued, or in progress.
- If Cloudflare succeeds but the production smoke test fails, report deployment verification as failed and investigate before finishing.

## Verification Checklist

- [ ] Local SHA equals the remote branch SHA
- [ ] Check run belongs to that exact SHA
- [ ] `Workers Builds: sids-in` completed successfully
- [ ] Build and Worker version details captured when available
- [ ] `https://sids.in/` returned HTTP 200
- [ ] Changed route or behavior smoke-tested when applicable
- [ ] Deployment result reported with the dashboard URL
