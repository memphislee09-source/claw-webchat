# Contributing

Thanks for considering a contribution to Claw WebChat.

This project is still in an alpha stage, so small, well-scoped, reviewable changes are strongly preferred over wide refactors.

## Before You Start
- Read [README.md](README.md) for the public project overview.
- Read [status.md](status.md) for the current mainline baseline and active priorities.
- If your change touches behavior, docs, or operational assumptions, update the relevant documentation in the same pull request.

## Development Setup
### Required
- Node.js `20+`
- `openclaw` CLI available on `PATH`

### Install
```bash
npm install
```

### Start Locally
```bash
npm start
```

Default address:

```text
http://127.0.0.1:3770
```

If you need LAN access while developing, set `OPENCLAW_WEBCHAT_HOST=0.0.0.0` explicitly rather than relying on implicit bind behavior.

## Checks
Run the lightweight checks before opening a pull request:

```bash
npm run check
```

Optional local smoke test:

```bash
npm run selftest
```

`selftest` expects a working local OpenClaw environment and may take longer than syntax checks.

## Branching And Pull Requests
- Branch from `main`.
- Keep each pull request focused on one concern when possible.
- Mention any user-facing behavior changes in [CHANGELOG.md](CHANGELOG.md).
- Include screenshots or short recordings for visible UI changes when feasible.
- If you are reviving a paused experiment branch, explain why it should re-enter the `main` roadmap before asking for merge.

## Coding Guidelines
- Keep the project independent from the internal OpenClaw frontend implementation.
- Prefer small, explicit adapter-layer changes over deep coupling to upstream internals.
- Preserve the current storage model: only persist user-visible messages to local history.
- Avoid adding heavy framework or build tooling dependencies without a clear maintenance reason.

## Documentation Expectations
- Update docs before or alongside code.
- Keep public-facing docs understandable to first-time users.
- Keep internal handoff and status docs accurate so future development can resume quickly.

## Reporting Bugs
- For normal defects and UX issues, open a GitHub issue with reproduction steps.
- For security-sensitive findings, follow the process in [SECURITY.md](SECURITY.md) instead of opening a full public report.
