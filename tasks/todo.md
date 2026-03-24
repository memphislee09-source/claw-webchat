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
- [x] Add a composer-side `T` button for the current agent thinking level
- [x] Expose a dedicated thinking-options/settings API for the current session
- [x] Verify the thinking picker flow with `npm run check` and `npm run selftest`
- [x] Investigate why `/model` and the model picker miss some models such as `gpt-5.4`
- [x] Investigate why `/model` and the model picker respond more slowly than the native OpenClaw Web UI
- [x] Implement and verify a fix for model list completeness and responsiveness
- [x] Mirror the `/model` picker responsiveness improvements onto the thinking (`T`) menu
- [x] Keep the thinking menu open after a successful level switch so the user can confirm the result
- [x] Verify the updated thinking menu behavior with checks
- [x] Remove the duplicate `/model` picker intro copy from the modal body
- [x] Update task/docs records for the `/model` picker copy follow-up
- [x] Verify the follow-up with `npm run check`
- [x] Commit and push the `/model` picker copy follow-up to GitHub
- [x] Audit public install docs against the two required install paths
- [x] Tighten bundle/network agent install guides so both are step-by-step with checks and low-capability fallback
- [x] Update public release docs/checklist to reflect the stronger install-doc requirement
- [x] Verify the doc-only follow-up and sync it to GitHub
- [x] Build the `0.1.6` release bundle artifact
- [x] Verify the release bundle archive and checksum contents
- [x] Create the first GitHub Release with downloadable bundle assets
- [x] Record the release result and sync it to GitHub
- [x] Re-time the promo video so the history/search narration stays on the history/search visuals
- [x] Replace the rich-media scene's old model-picker screenshot with `08-markdown.png`
- [x] Regenerate the promo voiceover with the updated `Markdown文件` narration
- [x] Re-render and verify the corrected promo video output
- [x] Restore the missing closing CTA narration and add a matching outro scene
- [x] Re-render and verify the final seconds of the promo video after the CTA restore
- [x] Replace the README screenshot section with the new promo video entry
- [x] Verify the README now points to the tracked promo video artifact instead of static screenshots
- [ ] Switch the README demo section from a local video link to a homepage-visible GitHub attachment embed
- [ ] Push the README embed update to GitHub and verify the new mainline commit

## Review
- Read `status.md`, `docs/HANDOFF-2026-03-24.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`,
  `docs/error.md`, `docs/REQUIREMENTS.md`, `docs/SECURITY_MODEL.md`, `docs/PROJECT_CHARTER.md`,
  `README.md`, and `package.json`.
- Current baseline is `main` at `0.1.6`; user-visible branding is `Claw WebChat`, while backend
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
- Thinking picker follow-up:
  - Added a dedicated `T` button to the right side of the composer, next to the existing slash and
    send controls, so users can change the current agent session's thinking level without typing
    `/think` manually.
  - The composer button label is now dynamic and reflects the current session thinking level as
    `T:Off`, `T:Min`, `T:L`, `T:M`, `T:H`, `T:X`, or `T:Ada` when available; binary providers also
    preserve `T:On` when the current model only exposes `off/on`.
  - Added session-scoped `GET /api/openclaw-webchat/sessions/:sessionKey/thinking-options` and
    `PATCH /api/openclaw-webchat/sessions/:sessionKey/thinking` endpoints, which reuse the current
    upstream session state and avoid polluting chat history with UI-only configuration changes.
  - The thinking menu is model-aware: it shows the current session model label plus the normalized
    thinking options for that model, including binary `off/on` providers and `xhigh`-capable
    models.
  - Verification passed: `npm run check`, LaunchAgent restart, `http://127.0.0.1:3770/healthz`,
    and `npm run selftest`.
- `/model` completeness + responsiveness follow-up:
  - Direct upstream probing confirmed that OpenClaw `models.list` already included `gpt-5.4`, so
    the missing-model complaint was not caused by the upstream runtime dropping that model.
  - The main latency cause was local: every `/model` open in Claw WebChat shelled out to the
    OpenClaw CLI twice (`sessions.list` + `models.list`) with no cache, which made the picker
    materially slower than the native OpenClaw Web UI.
  - Added short-lived in-memory caches for `models.list` and `sessions.list`, with automatic
    session-cache invalidation after `sessions.patch`, `sessions.reset`, and `sessions.compact`.
  - The model picker now reuses the most recent session payload for an instant reopen and silently
    refreshes only when that cached payload has gone stale.
  - `/model` list output was changed from a fixed top-10 truncation to a provider-grouped full
    summary, which keeps token usage compact while ensuring models like `gpt-5.4` are not hidden.
  - Follow-up reproduction across Athena and other agents showed that the data layer always still
    contained `gpt-5.4`; the remaining completeness issue was in the modal layout, where the
    model-picker card used a capped grid container without reserving a `1fr` row for the scroll
    region, so bottom options could be visually clipped instead of scrolling.
  - Fixed the picker layout by reserving the last grid row as `minmax(0, 1fr)` and constraining
    `.model-picker-list` to its own scroll box, so the last models remain reachable regardless of
    current model choice, viewport height, or browser zoom.
  - Verification passed: `npm run check`, LaunchAgent restart, `npm run selftest`, live `/model`
    response inspection showing `gpt-5.4`, and live `/model-options` timings improving from about
    `2533.8ms` on the first cold request to about `0.5–1.2ms` on warm repeats.
- Thinking menu follow-up:
  - Mirrored the model-picker warm-reopen pattern onto the `T` menu with a short-lived client-side
    cache for the current session’s thinking payload, so repeated opens do not blank the menu and
    wait for a network round-trip when the session/model has not changed.
  - Successful thinking-level changes now keep the menu open and show a visible success notice
    inside the menu, instead of closing immediately after the PATCH succeeds.
  - Existing background refresh hooks for `/think`, `/model`, `/new`, `/reset`, and model-button
    switches are preserved, so the cached menu payload stays aligned with upstream session state.
- `/model` picker copy follow-up:
  - The modal previously showed the same introductory sentence twice while idle: once in the fixed
    header copy and once again in the lower status/message area.
  - `renderModelPicker()` now leaves the lower message area empty when there is no loading state,
    success notice, warning, or error to show, so the top explanatory copy remains the only intro.
  - Synced the follow-up into `CHANGELOG.md`, `status.md`, and `docs/HANDOFF-2026-03-24.md`.
  - Verification passed: `npm run check`.
  - Synced to GitHub on `main` with commit `40e80e0` (`fix: remove duplicate model picker copy`).
- Public install-doc completeness follow-up:
  - Audited the public release path against the required two install methods: downloaded release
    bundle and network-based installation.
  - Tightened `docs/AGENT_INSTALL_BUNDLE.md` so the bundle path explicitly bounces missing
    Node/OpenClaw prerequisites to the network bootstrap path before returning.
  - Tightened `docs/AGENT_INSTALL_NETWORK.md` so it now covers official OpenClaw bootstrap and
    onboarding before downloading WebChat, keeps the one-step/one-check discipline, and avoids a
    hard `git` dependency by using tarball downloads for both release and `main`.
  - Updated `README.md`, `docs/PUBLIC_RELEASE_CHECKLIST.md`, `CHANGELOG.md`, and `status.md` so
    the public repo now states this install-doc standard explicitly.
  - Verification passed: `npm run check`.
  - Synced to GitHub on `main` with commit `dfa3089` (`docs: tighten public install guides`).
- First public GitHub Release follow-up:
  - Built the release bundle with `npm run bundle`, producing `dist/claw-webchat-v0.1.6-bundle.tar.gz`
    and `dist/claw-webchat-v0.1.6-bundle.sha256`.
  - Verified the archive root layout and confirmed the bundle contains `package.json`, `src/`,
    `public/`, `docs/`, and `scripts/`.
  - Published the first non-draft GitHub Release as `v0.1.6`, targeting commit `be4be55`, with
    both downloadable assets attached.
  - Release URL: `https://github.com/memphislee09-source/claw-webchat/releases/tag/v0.1.6`
  - Bundle download URL:
    `https://github.com/memphislee09-source/claw-webchat/releases/download/v0.1.6/claw-webchat-v0.1.6-bundle.tar.gz`
  - Checksum download URL:
    `https://github.com/memphislee09-source/claw-webchat/releases/download/v0.1.6/claw-webchat-v0.1.6-bundle.sha256`
- Promo video v3 follow-up:
  - Re-generated the voiceover as per-scene `scenes-v4` clips so each visual section now tracks its own
    narration instead of relying on one long track with hand-estimated cut points.
  - Updated the rich-media section to use `08-markdown.png` and changed the media copy from `文件` to
    `Markdown文件`.
  - Tightened the full composition from `1309` frames to `1019` frames and looped the background bed so the
    shorter new narration still ends cleanly.
  - Re-rendered the promo video as `media/video/remotion-promo/out/claw-webchat-promo-v3.mp4` and
    concatenated the new voice track as `media/audio/claw-webchat-promo-zh-v3.mp3`.
  - Verification passed:
    `ffprobe` confirms `1920x1080`, duration `34.026667s`, size about `7.8MB`.
  - Visual spot checks passed:
    `20s` frame stays on the history/search scene, `23s` frame enters rich-media, and `29s` frame shows the
    model + Think controls scene.
- Promo video v4 CTA restore:
  - Split the old final control narration into a dedicated control clip and a dedicated CTA clip, then
    reintroduced `OutroScene` as the final sequence so the last line has its own visual landing page.
  - Moved all promo audio references to `scenes-v5`, keeping scenes `01-05` unchanged and regenerating
    only scenes `06-07` for the fixed ending.
  - Re-rendered the promo video as `media/video/remotion-promo/out/claw-webchat-promo-v4.mp4` and
    concatenated the new voice track as `media/audio/claw-webchat-promo-zh-v4.mp3`.
  - Verification passed:
    `ffprobe` confirms `1920x1080`, duration `39.914667s`, size about `8.6MB`.
  - Tail-frame spot checks passed:
    `34s`, `37s`, and `39s` all land on the dedicated CTA outro instead of the preceding control scene.
- README demo-video swap:
  - Replaced the old four-image `Screenshots` section in `README.md` with a `Demo Video` section that
    points directly at the tracked promo video artifact.
  - Added `docs/media/claw-webchat-promo-v4.mp4` as the repository-stable path for the current promo cut.
  - Verification passed:
    `README.md` no longer references `docs/images/main-ui.png`, `docs/images/model-picker.png`,
    `docs/images/history-search.png`, or `docs/images/settings.png`.
  - Artifact verification passed:
    `ffprobe` confirms `docs/media/claw-webchat-promo-v4.mp4` is `1920x1080`, duration `39.914667s`,
    size about `9.0MB`.
