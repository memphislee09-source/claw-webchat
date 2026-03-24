# Task Todo

## Current Task
- [x] Confirm repository path and current branch baseline
- [x] Read handoff and core project documentation
- [x] Summarize current architecture, shipped capabilities, and open risks
- [x] Add a short review/result note for this reading pass
- [x] Investigate why Athena did not send images correctly in Claw WebChat
- [x] Tighten and shorten the hidden media bootstrap contract
- [x] Add regression coverage for local and remote media fallback directives
- [x] Verify with `npm run check` and `npm run selftest`
- [x] Update status, handoff, changelog, and error-log docs for the media protocol fix
- [x] Commit and push the media protocol fix to GitHub
- [x] Investigate why wangyuyan news-brief images appear shrunken in Claw WebChat
- [x] Create experimental branch for desktop media default max-width = 70vw
- [x] Verify and hand off the 70vw desktop media experiment branch
- [x] Revert the mixed-media bubble experiment back to the previous 70vw-only branch state
- [ ] Re-verify and restart the service for user testing

## Review
- Read `status.md`, `docs/HANDOFF-2026-03-24.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`,
  `docs/error.md`, `docs/REQUIREMENTS.md`, `docs/SECURITY_MODEL.md`, `docs/PROJECT_CHARTER.md`,
  `README.md`, and `package.json`.
- Current baseline is `main` at `0.1.5`; user-visible branding is `Claw WebChat`, while backend
  technical identifiers intentionally remain `openclaw-webchat`.
- Current architecture remains a lightweight Node/Express adapter plus static frontend, with local
  JSONL history, per-agent session binding, media proxy/signing, and a narrow OpenClaw gateway
  integration surface.
- The main unresolved product risks are still mobile history loading stability, media bubble/manual
  visual regression, multi-agent late-reply regression coverage, audio transcription success-path
  validation, and the next batch of history-search polish.
- Athena image-send investigation:
  - `main`/Athena has the current bootstrap marker in `data/session-bindings.json`
    (`bootstrapVersion: 2026-03-16.phase2`), so this was not a missing-bootstrap case.
  - Raw upstream history shows Athena (`gpt-5.4`) generated the image successfully, then tried the
    `message` tool with `channel: "webchat"` and got `Unknown channel: webchat`, after which it
    told the user it could not send the image.
  - A successful Baichai case shows the model returning a plain text reply ending with
    `MEDIA:/absolute/path.png`, which WebChat parses into an image block.
  - Current hidden bootstrap explains `MEDIA:` / `mediaUrl:` fallback, but it is not explicit
    enough to steer Athena away from an unsupported `message` tool path.
- Media protocol follow-up:
  - Refreshed `BOOTSTRAP_VERSION` to `2026-03-24.media-v1` so existing sessions can pick up the
    tighter media contract on the next open/send after version mismatch.
  - Shortened the bootstrap text while making the contract stricter: local files and direct
    remote `http/https` media URLs should use the `MEDIA:` / `mediaUrl:` fallback, and agents are
    told not to use the unsupported `message` tool / `webchat` channel path.
  - Added selftest coverage for both local-path and remote-URL fallback directives, plus a static
    assertion that the bootstrap contract keeps the new media guidance.
  - Verification passed: `npm run check`, `npm run selftest`.
  - Synced to GitHub on `main` with commit `59aa488` (`fix: tighten webchat media bootstrap`).
- Wangyuyan news-brief image sizing investigation:
  - The reproduced message is the long March 24 news brief with alternating text/image blocks in
    a single assistant message.
  - That message does not enter the `visual-media-bubble` branch because
    `shouldUseVisualMediaBubble(...)` falls back to a regular bubble whenever total text length is
    greater than `220`.
  - In the regular bubble branch, images and video are globally capped at `max-width: min(420px, 100%)`,
    so large remote news images from BBC/MS NOW are intentionally shrunk on desktop.
- 70vw experiment setup:
  - Created branch `codex/desktop-media-70vw`.
  - In the regular media branch only, desktop/default image and video max-width was changed from
    `min(420px, 100%)` to `min(70vw, 100%)` for visual comparison, without changing the
    `visual-media-bubble` decision logic.
  - Verification passed: `npm run check`.
- Mixed-media bubble rollback:
  - The follow-up experiment that forced all text+media messages into visual-media bubbles was
    reverted at the user's request.
  - The branch is now back to the previous experiment state: keep the desktop/default `70vw`
    media cap experiment, but preserve the original mixed-media bubble gating behavior.
