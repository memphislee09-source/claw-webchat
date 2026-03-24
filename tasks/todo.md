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
- [x] Re-verify and restart the service for user testing
- [x] Diagnose why the right-side message pane scroll position jumps while scrolling
- [x] Fix the right-side message pane scroll jumping behavior
- [x] Update docs for the scroll fix and current branch state
- [x] Commit and push the branch updates to GitHub
- [x] Merge `codex/desktop-media-70vw` back into `main`
- [x] Update docs so `main` becomes the new development baseline
- [x] Verify merged `main` and sync it to GitHub

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
- Right-side scroll jump diagnosis:
  - Primary cause 1: `loadOlderHistory()` restores scroll position with
    `nextHeight - previousHeight` only, but does not add the pre-load `scrollTop`, so prepending
    history near the top shifts the viewport and produces a visible jump.
  - Primary cause 2: `shouldKeepConversationPinnedAfterRender()` returns `true` whenever the active
    session is busy, so any render while the agent is processing can force a bottom re-scroll even
    after the user has manually scrolled away from the bottom.
  - Secondary risk: the message list uses `scroll-behavior: smooth`, while code paths also use
    `scrollIntoView(...)`, `scrollTo(...)`, and direct `scrollTop` reassignment; these animation
    modes can overlap and make jumps feel more dramatic.
  - Secondary risk: polling refresh can force `openAgent(... forceReload: true, preserveScrollBottom: true)`
    for the current conversation, which rebuilds the message DOM without preserving the user's
    current non-bottom scroll offset.
- Right-side scroll jump fix:
  - `loadOlderHistory()` now captures the pre-load `scrollTop` and restores the viewport with
    `previousTop + (nextHeight - previousHeight)`, so prepending older history keeps the user's
    current visible content stable.
  - `shouldKeepConversationPinnedAfterRender()` now respects only `state.autoScrollPinned`, so a
    busy agent no longer overrides a deliberate manual scroll-away from the bottom.
  - `.message-list` now uses `scroll-behavior: auto`, which removes overlapping smooth-scroll
    animations from manual scroll, prepended-history restoration, and explicit bottom sync calls.
  - Static selftest coverage now checks the preserved scroll-offset formula, the tightened
    auto-pin condition, and the direct scroll behavior.
  - Verification passed: `npm run check`, `npm run selftest`, LaunchAgent restart, and
    `http://127.0.0.1:3770/healthz`.
- Mainline merge follow-up:
  - Fast-forward merged `codex/desktop-media-70vw` into `main`, so the `70vw` desktop media cap
    change and the right-side scroll stabilization are now the official development baseline.
  - Updated `CHANGELOG.md`, `status.md`, and `docs/HANDOFF-2026-03-24.md` to remove the old
    “experimental branch only” wording and mark `main` as the branch to continue from.
