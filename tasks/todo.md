# Task Todo

## Current Task
- [x] Refactor `POST /api/openclaw-webchat/agents/:agentId/open` so it returns local history immediately instead of synchronously waiting on upstream history reconciliation
- [x] Keep open-time upstream reconciliation as a background repair path with per-agent dedupe / short TTL so rapid contact switching does not spam slow `chat.history` calls
- [x] Make background reconciliation-triggered `conversation-update` events refresh the active conversation safely without regressing reading-position behavior
- [x] Update selftest coverage and source assertions for the non-blocking open flow
- [x] Re-run project verification and record the result in the review section
- [x] Create a dedicated feature branch from `main@432ee3a` for the unified attachment-delivery fix
- [x] Implement a server-side attachment materialization helper so upstream messages receive agent-readable sources instead of raw `openclaw-upload:*` ids
- [x] Extend `/api/openclaw-webchat/uploads` beyond image/audio to support generic file attachments while preserving current image/audio metadata behavior
- [x] Route sync `/send` and async session `/turns` attachment delivery through the same unified materialization path
- [x] Update the composer upload path to support generic files without regressing existing image/audio flows
- [x] Add regression coverage for real frontend-style attachment sends so upstream `chat.history` no longer contains raw `openclaw-upload:*` identifiers
- [x] Verify with `npm run check` and `npm run selftest` before considering merge
- [x] Investigate why image and other attachments can be uploaded in WebChat but agents only receive a placeholder instead of readable content
- [x] Trace the attachment flow across `/uploads`, local history persistence, present-block normalization, and upstream message construction
- [x] Compare the payload that WebChat stores/renders with the payload actually delivered to the upstream agent session for image attachments
- [x] Form a concrete root-cause hypothesis with evidence and propose a fix plan for discussion before implementation
- [x] Add an Android-agent handoff doc that explains how to integrate with the new voice session API
- [x] Verify the new Android-agent handoff doc matches the shipped server behavior and sample payloads
- [x] Read the Android voice session API spec and map it to the current `openclaw-webchat` server architecture
- [x] Design a session-scoped async run model that reuses the existing chat session/history source of truth
- [x] Add `GET /api/openclaw-webchat/sessions/{sessionKey}/events` SSE with `ready`, `run.accepted`, `run.state`, `assistant.delta`, `assistant.final`, and `assistant.error`
- [x] Add `POST /api/openclaw-webchat/sessions/{sessionKey}/turns` with idempotent async acceptance and voice/text block persistence
- [x] Add `POST /api/openclaw-webchat/sessions/{sessionKey}/runs/{runId}/abort` with idempotent run-state handling
- [x] Ensure voice-originated turns persist as normal chat history containing both transcript text and raw audio blocks
- [x] Keep `agents/{agentId}/open` and `agents/{agentId}/history` compatible with the new voice-originated messages
- [x] Add or extend self-tests for the voice session API contract and run lifecycle
- [x] Verify with project checks and capture example responses for Android handoff
- [x] Confirm the active worktree is `/Users/memphis/.openclaw/workspace-mira/claw-webchat`
- [x] Re-read the core project docs (`status.md`, latest handoff, architecture, roadmap, requirements, error log, README, package manifest)
- [x] Reconfirm the development baseline, naming constraints, and current branch/remote state
- [x] Record a short project-status snapshot for the next implementation turn
- [x] Check the current local vs GitHub sync state for `main`
- [x] Mark the local `media/` directory as ignored-only and keep it out of sync checks
- [x] Reduce visible agent-switch lag caused by the dynamic `T` thinking button
- [x] Show current model and thinking level next to the active agent name in the chat header
- [x] Verify the UI changes with project checks
- [x] Update project docs for the thinking-button/header follow-up
- [x] Sync the follow-up to GitHub
- [x] Investigate why the current conversation can suddenly jump to several-days-old history while reading Wangyuyan news
- [x] Explain the root cause before making any fix
- [x] Rework the conversation pane scroll model around pinned-bottom vs history-reading states
- [x] Preserve the visible anchor during current-conversation refresh and re-render
- [x] Add keyboard support for `Home`, `End`, `PageUp`, and `PageDown` in the message list
- [x] Verify the conversation-pane follow-up and update docs
- [x] Investigate why Wangyuyan reports that mp3 files cannot be sent back in Claw WebChat
- [x] Fix the mp3 return path if the issue is in WebChat's media protocol or rendering
- [x] Tighten the hidden media bootstrap so local audio/mp3 outputs are explicitly sent back via `MEDIA:` / `mediaUrl:`
- [x] Refresh existing sessions onto the new bootstrap contract and add regression coverage for audio fallback guidance
- [x] Verify the mp3 send-path fix and record the result in docs/review notes
- [x] Sync the current mainline fixes/docs to GitHub before starting the event-driven refresh follow-up
- [x] Create a new feature branch from updated `main` for the event-driven refresh implementation
- [x] Replace the 10s agent polling loop with an event-driven update path while keeping a safe fallback
- [x] Verify the event-driven refresh branch and update docs with the new architecture/behavior
- [x] Investigate the new message-list bug where manually returning to bottom can snap back to an older reading position
- [x] Fix the stale media-load anchor restore so follow-bottom wins after the user scrolls back down
- [x] Verify the bottom-return scroll fix and record the result in docs/review notes
- [x] Rework the conversation scroll implementation around a unified viewport controller with preserve-position as the default
- [x] Route render, media resize, history prepend, current-session refresh, and explicit jumps through the unified viewport policy
- [x] Verify the scroll-controller refactor and update docs with the new model/results
- [x] Investigate why Athena replies visible in native OpenClaw Web UI around 22:32 and 22:33 are missing from Claw WebChat
- [x] Trace the assistant-reply matching / late-reply code path and record the concrete root cause before any fix
- [x] Investigate why some Athena replies visible in native OpenClaw Web UI are missing in Claw WebChat
- [x] Identify whether the missing Athena replies are lost at upstream fetch, local persistence, or frontend render time
- [x] Record the Athena missing-reply investigation result before any fix
- [x] Fix assistant turn completion so progress/tool-phase messages are not persisted as the final reply too early
- [x] Add open-time upstream history reconciliation so missing assistant completions are backfilled into local JSONL
- [x] Verify the fix against the known `main`/Athena and `wangyuyan` missing-reply cases
- [x] Restart the Claw WebChat service and confirm health before handing testing back
- [x] Bump the project version for the missing-reply fix follow-up
- [x] Update changelog/status/handoff/README notes to reflect the `0.1.7` branch state and verification result
- [x] Verify the version/doc follow-up, then commit and push `codex/sse-event-refresh` to GitHub
- [x] Merge `codex/sse-event-refresh` into `main`
- [x] Verify merged `main`, update baseline notes, and push the new mainline commit to GitHub

## Current Review
- Contact-switch latency follow-up now removes the slow upstream `chat.history` reconcile from the synchronous `POST /api/openclaw-webchat/agents/:agentId/open` path.
- `open` still returns the same local first-page history payload, but it now schedules `scheduleBindingHistoryReconciliation(...)` on the background side after responding, so users can enter a conversation without waiting on the slow gateway round-trip.
- Background open-time reconciliation now has per-agent in-flight dedupe plus a short cooldown (`OPENCLAW_WEBCHAT_HISTORY_RECONCILE_COOLDOWN_MS`, default `15000`) to avoid repeated `chat.history` calls when users switch between contacts quickly.
- No frontend code changes were required for safe refresh behavior: background reconciliation still appends to local history via the existing broadcast path, and the current SSE + `refreshAgents(...)` logic already decides between auto-refresh-at-bottom vs. pending-refresh notice while reading history.
- Selftest source assertions now lock in the new non-blocking contract by checking for the background scheduler/cooldown instead of the old synchronous `await reconcileBindingHistory(...)` open path.
- After restarting the LaunchAgent onto this build, direct timing against `POST /api/openclaw-webchat/agents/mira/open` measured about `0.012s`, `0.008s`, and `0.019s`, which is consistent with the blocking `chat.history` round-trip having been removed from the request path.
- Verification for this follow-up passed with:
  - `npm run check`
  - `launchctl kickstart -k gui/$(id -u)/ai.openclaw.webchat`
  - `npm run selftest`
- The branch has now been version-bumped to `0.1.8`, including `package.json`, the top-level `package-lock.json` metadata, server/app version fallbacks, and the public docs that surface the current branch version.
- `README.md`, `status.md`, `docs/HANDOFF-2026-03-24.md`, and `CHANGELOG.md` now record the unified attachment-delivery work as mainline behavior: generic attachment uploads, server-side upstream source materialization, and the continued distinction between stable local `openclaw-upload:*` storage and agent-readable delivery sources.
- Release verification for the `0.1.8` branch state passed with:
  - `npm run check`
  - `launchctl kickstart -k gui/$(id -u)/ai.openclaw.webchat`
  - `curl -sf http://127.0.0.1:3770/healthz`
  - `curl -sf http://127.0.0.1:3770/api/openclaw-webchat/settings` returning `.projectInfo.version == 0.1.8`
  - `npm run selftest`
- Unified attachment-delivery fix is now implemented on branch `codex/unified-attachment-delivery`.
- Uploads now support generic attachment kinds in addition to the existing image/audio path, while local persistence still keeps `openclaw-upload:*` as the stable source of truth.
- The upstream-send path no longer forwards raw `openclaw-upload:*` ids. Managed uploads and signed WebChat media URLs are materialized into agent-readable local file paths at send time, while direct `http/https` sources still pass through unchanged.
- The attachment wrapper sent to upstream now explicitly says the listed sources are directly readable by the runtime, and includes consistent metadata such as mime type, byte size, and media duration where relevant.
- The composer upload entry point now accepts generic attachments instead of only image/audio, and pending-upload UI copy/hints cover image, audio, video, and generic file cases without regressing the existing audio transcription flow.
- Regression coverage now includes:
  - generic `file` uploads through `/api/openclaw-webchat/uploads`
  - a real frontend-style `/send` that passes `openclaw-upload:*` sources, then verifies upstream `chat.history` contains resolved local attachment paths instead of opaque upload ids
- Verification passed with:
  - `npm run check`
  - `launchctl kickstart -k gui/$(id -u)/ai.openclaw.webchat`
  - `curl -sf http://127.0.0.1:3770/healthz`
  - `npm run selftest`
- Attachment receive investigation result for the reported `wangyuyan` image send around 2026-03-26 19:55 CST:
  - Local WebChat history persisted the user turn correctly as `text + image` blocks with the stable upload source `openclaw-upload:1774526111174-1dffb33890c3-image-15939.jpg`.
  - The upstream `chat.history` entry for the same turn proves `buildUpstreamMessage(...)` flattened that attachment into plain text only:
    `- image: image-15939.jpg (openclaw-upload:1774526111174-1dffb33890c3-image-15939.jpg)`.
  - `wangyuyan` then explicitly reported it could only see the filename and upload identifier, and upstream tool calls show it unsuccessfully tried to locate/open that opaque `openclaw-upload:` value as if it were a real file.
  - Root cause: WebChat keeps the opaque upload source as the canonical stored value, but the upstream-send path forwards that opaque identifier verbatim instead of resolving it to an agent-readable local path or other readable media source first.
  - A contrasting local repro under `mira` showed that when the outgoing attachment source was already a readable `/api/openclaw-webchat/media?token=...` URL, the upstream user message reflected that readable source instead of `openclaw-upload:...`.
  - Important constraint: changing clients to send signed `/api/openclaw-webchat/media?...` URLs directly is the wrong layer, because those URLs are short-lived, can be blocked by optional light auth, and would break the current stable `upload.upload.source` / Android voice contract.
  - Proposed fix direction for discussion: keep local persistence and public API contracts unchanged (`openclaw-upload:*` remains the stable stored source), but add a server-side upstream materialization step inside `buildUpstreamMessage(...)` so uploaded attachments are resolved to an agent-readable source at send time. Prefer resolved absolute local file paths for managed uploads so the path survives light-auth setups and does not depend on expiring signed URLs; keep direct `http/https` sources as-is.
  - Proposed regression coverage after implementation: verify that a real frontend-style upload/send no longer emits `openclaw-upload:` inside upstream `chat.history`, and add a focused check around the source-materialization helper so future refactors cannot regress this edge.
- Android voice session API follow-up is now implemented on top of the existing `openclaw-webchat` session/history truth:
  `GET /api/openclaw-webchat/sessions/{sessionKey}/events`, `POST /sessions/{sessionKey}/turns`, and
  `POST /sessions/{sessionKey}/runs/{runId}/abort` are live without introducing WebRTC or a second voice-only session model.
- Session-scoped SSE now keeps per-session ordering and emits `ready`, `run.accepted`, `run.state`, `assistant.delta`,
  `assistant.final`, and `assistant.error`; reconnect can replay recent session events via `cursor` / `Last-Event-ID`.
- Async voice turns are idempotent by `clientTurnId`, preserve a normal user history row with both transcript text and
  raw audio blocks, and reuse the same agent history returned by `agents/{agentId}/open` and `agents/{agentId}/history`.
- Audio uploads now preserve `durationMs` in both the upload response and persisted/presented history blocks, which keeps
  the Android-side voice clip metadata intact.
- Verification passed with `npm run check`, `launchctl kickstart -k gui/$(id -u)/ai.openclaw.webchat`, and
  `npm run selftest`, including live coverage for the new session event stream, async `/turns`, duplicate
  `clientTurnId` idempotency, voice history persistence, and `/runs/{runId}/abort`.
- Verified the active repository is `claw-webchat` at `/Users/memphis/.openclaw/workspace-mira/claw-webchat`.
- Verified `main` is the only development baseline; local `HEAD` and `origin/main` both point to `f4c8bd8`
  (`docs: record shared dev repo bootstrap`), while `ee656ce` is no longer the latest pushed commit.
- Reconfirmed the naming rule: user-facing branding should stay `Claw WebChat`, but backend technical
  identifiers intentionally remain `openclaw-webchat`, including `/api/openclaw-webchat/*`,
  `OPENCLAW_WEBCHAT_*`, and namespace/service identifiers.
- Current shipped baseline remains `0.1.6` with history search phase-2 first batch, session-scoped
  `/model` picker, session-scoped `T:*` thinking menu, send/stop dual-state composer, tightened media
  fallback bootstrap, desktop media `70vw` cap, and stabilized right-pane scrolling.
- The next unresolved priorities still match the latest handoff: mobile history loading stability,
  visual media bubble/manual comparison, broader multi-agent late-reply regression, audio transcription
  success-path validation, and the next round of history-search polish.
- The local `media/` directory is now ignored through `.git/info/exclude`, so it stays in the worktree
  without becoming a repo-tracked or GitHub-synced path.
- The thinking button follow-up now avoids blocking `openAgent(...)`: session switching no longer waits for
  the thinking-options request before rendering the conversation, the composer button has been simplified
  back to a static `T`, and the active session's model / thinking state is shown beside the header title.
- The header-side thinking state now uses the full level name (for example `off`, `minimal`, `medium`)
  instead of the abbreviated `T:*` label form.
- Verification passed for this UI follow-up with `npm run check` and `npm run selftest`.
- Root cause of the Wangyuyan history jump was confirmed before the fix: background polling could reopen the
  current conversation after agent summary/presence changes, but that reload path only knew how to preserve
  pinned-bottom behavior and did not preserve the user's non-bottom reading position.
- The conversation pane now distinguishes bottom-following vs history-reading states, keeps a visible-message
  anchor across current-conversation re-renders, defers background conversation refresh into an explicit
  notice while the user is reading history, and adds `Home` / `End` / `PageUp` / `PageDown` navigation.
- Verification for the conversation-pane follow-up passed with `npm run check` and `npm run selftest`.
- Wangyuyan mp3 send regression is not caused by frontend audio rendering: history already contains a prior successful
  mp3 attachment reply, and both the server and `public/message-blocks.js` still classify `.mp3` as `audio`.
- The latest Wangyuyan reply instead shows an agent-compliance failure: it generated a local mp3 file path but claimed
  WebChat could not receive it, which points back to the hidden media fallback contract not being explicit enough for
  locally generated audio outputs such as TTS results.
- The hidden bootstrap now explicitly names generated local `.mp3` / `.wav` output and tells agents to return it with
  `MEDIA:` / `mediaUrl:` instead of claiming Claw WebChat cannot receive the file; `BOOTSTRAP_VERSION` was bumped so
  existing sessions will re-ingest that stricter rule on their next open/send path.
- Verification passed for the mp3 follow-up with `npm run check` and `npm run selftest`.
- The local LaunchAgent service was restarted successfully and `http://127.0.0.1:3770/healthz` returned `{ "ok": true }`;
  Wangyuyan's binding remains on the older bootstrap until the next user turn triggers reinjection.
- The next requested follow-up is to first sync the current mainline state to GitHub, then branch off and implement
  an event-driven refresh path in place of the fixed 10-second polling model.
- Mainline sync completed on `main` with commit `3fd80c8` (`fix: stabilize conversation refresh behavior`), then the
  event-driven follow-up branch was created as `codex/sse-event-refresh`.
- The event-driven refresh branch now exposes `/api/openclaw-webchat/events` as an SSE stream, broadcasts binding/history
  changes from the server, subscribes from the browser with `EventSource`, and reduces the old fixed 10-second polling
  loop to a 60-second fallback safety net.
- Verification for the event-driven follow-up passed with `npm run check`, `npm run selftest`, LaunchAgent restart +
  `http://127.0.0.1:3770/healthz`, and a direct SSE smoke test that returned the `connected` event frame.
- The latest regression report points to stale media-load anchor restoration: if a message captured a history-reading
  anchor at render time and the user later scrolled back to bottom before the media finished loading, the delayed
  load callback could still restore the old anchor and yank the viewport upward again.
- The media-load pinning callback now re-evaluates follow-bottom mode at load time and ignores the old render-time
  anchor once the user has moved since that render; this prevents late image/video/audio metadata loads from snapping
  the viewport back to a stale reading position after the user has already returned to bottom.
- Verification for the bottom-return scroll fix passed with `npm run check` and `npm run selftest`.
- The next agreed follow-up is a deeper scroll-controller refactor: preserve the current viewport by default, make
  bottom-follow an explicit state, and stop letting render-time, media-load, and refresh callbacks compete to set
  `scrollTop` independently.
- The scroll-controller refactor now introduces a unified viewport snapshot/restore path with revision invalidation and
  programmatic-scroll guards, so rerenders, delayed media loads, history prepends, and current-session refreshes all
  preserve the current viewport by default unless the user is explicitly in follow-bottom mode.
- Verification for the unified scroll-controller follow-up passed with `npm run check` and `npm run selftest`.
- Athena/native-WebUI missing-reply investigation:
  - Athena is the `main` agent in this repo (`data/agent-profiles.json`), so the relevant local history file is
    `data/history/main.jsonl`, not `data/history/athena.jsonl`.
  - Local WebChat history stops at the user row `2026-03-25T14:32:39.888Z` (`这个agent创建好没有？为什么要我一直追问？`) and does not contain the two assistant replies visible upstream around `22:32` and `22:33` Beijing time.
  - Upstream OpenClaw transcript and live `chat.history` both contain those missing assistant replies:
    `创建好了，已经按你说的设成...` at `2026-03-25T14:32:48.538Z` and
    `你说得对，不该让你一直追问...` at `2026-03-25T14:33:27.688Z` / `1774449196415`.
  - Root cause is in `waitForAssistantReply(...)`: when `findMatchingUserMessageIndex(...)` cannot yet find the current
    upstream user row, the code falls back to `scanStart = 0` and returns the latest assistant text after `minTimestampMs`.
    Because upstream `role:user` rows can land much later than the local send time (for example local send
    `14:22:32.490Z` maps to upstream user `14:31:38.512Z`, and local send `14:32:39.888Z` maps to upstream user
    `14:33:00.177Z`), WebChat can capture an earlier progress reply as if it were the final reply and then stop
    tracking the turn.
  - A second compounding issue is that late-reply reconciliation only starts when the initial wait returns `null`
    (`assistantRaw === null`). Once an early non-empty assistant text has already been accepted, later assistant
    messages in the same logical turn are not reconciled back into local WebChat history.
- The next investigation is an Athena missing-reply report: native OpenClaw Web UI shows replies around 22:32 and 22:33
  that are not present in Claw WebChat, so the evidence chain needs to compare upstream session history, local JSONL
  persistence, and the current reply-reconciliation path.
- The Athena/main missing-reply report is a local-persistence gap, not a frontend render gap: upstream
  `chat.history` contains the missing user/assistant pair (`2026-03-25T14:33:00.177Z` and
  `2026-03-25T14:33:16.415Z`), while local `data/history/main.jsonl` stops at the user row
  `2026-03-25T14:32:39.888Z` and the previous assistant `2026-03-25T14:24:38.691Z`.
- Root cause at architecture level: Claw WebChat only appends assistant messages when the send-time wait path or the
  in-memory late-reply reconciliation path succeeds; reopening a session later only replays local JSONL history and
  does not backfill missing upstream assistant messages, so any transient failure in those persistence paths leaves a
  permanent gap that native OpenClaw Web UI can still show from upstream history.
- Active fix plan:
  - Tighten assistant completion detection so `waitForAssistantReply(...)` does not accept tool-phase/progress assistant
    messages as the final persisted reply for a turn.
  - Add an open-time upstream reconciliation pass to backfill assistant completions that already exist upstream but are
    missing from local JSONL.
  - Re-verify using the known `main`/Athena and `wangyuyan` missing-reply timelines before restarting the service.
- Missing-reply fix implemented on `codex/sse-event-refresh`:
  - `waitForAssistantReply(...)` now waits until the current upstream user row is visible and only accepts the latest
    assistant after that user when it has persistable blocks and no `toolCall` markers, so progress/tool-phase updates
    no longer end the turn early.
  - Open-time `reconcileBindingHistory(...)` now pulls the current upstream session history and backfills missing
    user/assistant rows into local JSONL for turns that were missed by the synchronous or late-reply persistence path.
  - Late reply reconciliation now reuses the same persistable-assistant filter as the synchronous path, so the two code
    paths no longer disagree about what counts as a final assistant reply.
- Verification for the missing-reply fix passed with:
  - `npm run check`
  - `npm run selftest`
  - `launchctl kickstart -k gui/$(id -u)/ai.openclaw.webchat`
  - `curl -sf http://127.0.0.1:3770/healthz`
- Runtime validation:
  - Reopening `wangyuyan` now backfills the previously missing `2026-03-26T07:34:06.111Z` final news brief into local
    WebChat history, confirming that open-time upstream reconciliation repairs an actual missed assistant completion.
  - Replaying the current selection logic against the real upstream `wangyuyan` session now chooses the final brief
    instead of the earlier progress texts/tool phases, which matches the intended fix for premature turn completion.
  - The earlier `main`/Athena gap could not be re-backfilled during this verification run because `main` has since
    moved to a newer upstream generation and the older session no longer returns `chat.history`; the old failure mode is
    still covered by the same logic change, but only `wangyuyan` remained directly reproducible online.
- Current branch metadata/docs follow-up:
  - The branch version has been bumped to `0.1.7` in `package.json`, server-side fallback version reporting, and the
    frontend About/version fallbacks.
  - `CHANGELOG.md`, `status.md`, `docs/HANDOFF-2026-03-24.md`, and `README.md` now record the missing-reply fix and
    distinguish the current branch version `0.1.7` from the latest published GitHub Release bundle `0.1.6`.
  - Version/doc follow-up verification passed with `npm run check`, `npm run selftest`, and a live
    `GET /api/openclaw-webchat/settings -> .projectInfo.version == 0.1.7` check after LaunchAgent restart.
- Mainline baseline follow-up:
  - `codex/sse-event-refresh` has now been merged into `main`, so future work should use `main` as the baseline for the
    SSE refresh path, unified viewport controller, and missing-reply reconciliation fixes.
  - `status.md` and `docs/HANDOFF-2026-03-24.md` have been adjusted so these capabilities are described as part of the
    mainline baseline instead of as branch-only follow-ups.
  - Merged-main verification passed with `npm run check`, `npm run selftest`, `curl -sf http://127.0.0.1:3770/healthz`,
    and `GET /api/openclaw-webchat/settings -> .projectInfo.version == 0.1.7` after restarting the LaunchAgent.

## Previous Task Log
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
- [x] Switch the README demo section from a local video link to a homepage-visible GitHub attachment embed
- [x] Push the README embed update to GitHub and verify the new mainline commit
- [x] Rework the public README homepage into a bilingual landing page
- [x] Add one-click language switch links for Chinese and English on the GitHub repo homepage
- [x] Push the bilingual README update to GitHub and verify the new mainline commit
- [x] Create a `tools/` documentation folder for reusable tool-operation guides
- [x] Document the full narrated promo-video workflow for future reuse
- [x] Verify and sync the new tools docs to GitHub
- [x] Move non-project-specific tool docs out of the repo into the shared iCloud dev docs folder
- [x] Remove the repo-local `tools/` directory and sync the cleanup to GitHub
- [x] Create a private GitHub repo for the shared iCloud `dev` directory
- [x] Initialize and sync the entire `dev` directory to the new GitHub repo
- [x] Confirm the shared `dev` repo sync baseline for future updates

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
- README homepage embed follow-up:
  - Replaced the local-repo video link as the primary demo surface with the provided
    `github.com/user-attachments/assets/...` URL so the promo video can render directly on the GitHub
    repository homepage.
  - Kept the tracked repository copy as a secondary download link under the embedded video.
  - Synced to GitHub on `main` with commit `d10de51` (`docs: embed promo video on repo homepage`).
- README bilingual homepage follow-up:
  - Reworked `README.md` into a bilingual landing page with a shared top-level video area and explicit
    language-switch links: `简体中文` and `English`.
  - Added stable in-page anchors `#zh-cn` and `#en` so users can jump between the two language sections
    with one click from the GitHub repository homepage.
  - Mirrored the public-facing project overview, installation paths, quick start, capability summary,
    security notes, and docs navigation in both Chinese and English.
  - Synced to GitHub on `main` with commit `6ec7c14` (`docs: add bilingual repo homepage`).
- Tools docs follow-up:
  - Added `tools/README.md` as the entry point for reusable tool-operation guides.
  - Added `tools/VIDEO_PROMO_WORKFLOW.md` to capture the full narrated promo-video workflow, including
    script prep, screenshot collection, SiliconFlow CosyVoice scene-based TTS, Remotion rendering,
    FFmpeg verification, and GitHub README embedding.
  - Verified the documented reference paths exist for the current project state:
    `docs/media/claw-webchat-promo-v4.mp4`,
    `media/video/remotion-promo/src/PromoVideo.tsx`,
    `media/video/remotion-promo/src/Root.tsx`,
    and `media/video/source-shots/`.
  - Synced to GitHub on `main` with commit `e2b51df` (`docs: add tools video workflow guide`).
- Tools docs relocation follow-up:
  - Moved the entire repo-local `tools/` folder to the shared archive path:
    `/Users/memphis/Library/Mobile Documents/com~apple~CloudDocs/dev/codex-docs/claw-webchat/tools/`
  - Kept the original `tools/` structure in the archive so future reusable docs can continue to live
    there without being tied to the project repository.
  - Removed the repo-local `tools/` directory from `main` and synced the cleanup on commit `6818771`
    (`docs: move shared tools docs out of repo`).
- Shared `dev` repo bootstrap:
  - Created the private GitHub repo `memphis-dev-docs` for the entire shared iCloud dev archive.
  - Initialized `/Users/memphis/Library/Mobile Documents/com~apple~CloudDocs/dev` as a standalone git
    repository on branch `main`, with remote:
    `https://github.com/memphislee09-source/memphis-dev-docs.git`
  - Added a root `README.md` plus `.gitignore`, then pushed the initial baseline.
  - Added a workflow note in the dev repo root README that any edits under the `dev` directory should be
    followed by `git add -A`, `git commit`, and `git push`.
  - Verified the new repo is private, tracks `origin/main`, and currently has clean git status after sync.
