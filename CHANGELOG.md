# Changelog

All notable user-facing changes to `openclaw-webchat` should be documented in this file.

The format is intentionally lightweight and follows a simple versioned release log.

## [Unreleased]

## [0.1.7] - 2026-03-26

### Fixed
- Stop persisting progress/tool-phase assistant updates as if they were the final reply for the current turn; the reply matcher now waits for the current upstream user row and only accepts the latest assistant after that row when it has persistable display blocks and no `toolCall` markers
- Add open-time upstream history reconciliation so replies that exist in the current upstream session but are missing from local JSONL are backfilled the next time that conversation is opened
- Reuse the same persistable-assistant filter in late-reply reconciliation, closing the earlier split where the synchronous path and late-reply path could disagree about what counts as the final assistant message
- Remove the duplicate idle-state helper copy from the `/model` picker modal so the introductory explanation is shown only once while no loading, success, or error message is active
- Preserve the reader's visible place when the current conversation re-renders, instead of letting background refresh jump the viewport into older history while the user is reading mid-timeline
- Clarify the hidden media bootstrap so agents treat generated local `.mp3` / `.wav` files as normal Claw WebChat media attachments via `MEDIA:` / `mediaUrl:` fallback, instead of claiming WebChat cannot receive the file

### Changed
- Add an SSE-based event stream for agent/session updates so the UI now refreshes primarily on real server-side changes, while the old fixed 10-second polling loop is reduced to a low-frequency safety net
- Rework the conversation viewport logic around a unified snapshot/restore controller so preserve-position is now the default for rerenders, media resizes, history prepends, and current-session refreshes, while follow-bottom remains an explicit mode
- Simplify the composer-side thinking control back to a static `T` button and move the current session status into the chat header, where the active model and full thinking level name are shown beside the agent title
- Refresh the hidden bootstrap version again so existing agent sessions re-ingest the stricter local-audio fallback guidance on their next open/send path
- Tighten the public agent-install docs so the release-bundle and network-install paths both use explicit step-by-step checks, lower-capability-agent fallback guidance, and a final completion gate; the network guide now also covers official OpenClaw bootstrap before fetching WebChat over the network

## [0.1.6] - 2026-03-24

### Changed
- Keep the `/model` picker open after a successful switch, reduce each row to a single-line label, and make the picker list reliably scroll so the final models are not visually clipped
- Mirror the same warm-reopen and post-switch confirmation behavior onto the composer-side `T:*` thinking menu, so repeated opens are faster and successful level switches stay visible until the user dismisses the menu

### Fixed
- Stop truncating no-argument `/model` output to a top-10 slice by summarizing the full available model catalog by provider, which keeps models such as `gpt-5.4` visible in the slash response
- Cache short-lived `models.list` and `sessions.list` gateway results so `/model` and the model picker no longer shell out twice on every open, closing much of the responsiveness gap versus the native OpenClaw Web UI

## [0.1.5] - 2026-03-24

### Added
- Add history search phase 2 first slice with date filters, `20 / 50 / 100` result limits, and stronger query matching for the current agent timeline
- Add an agent-scoped `/model` picker modal that shows the current model plus available `provider/model` choices and switches the current upstream session directly
- Add a session-scoped stop endpoint that aborts the current agent run through gateway `chat.abort`
- Add a release bundle build script plus agent-oriented install guides for bundle and network installation flows

### Changed
- Rename the display-facing product branding to `Claw WebChat` across the UI and public-facing docs while keeping backend identifiers, API paths, environment variables, and repository coordinates unchanged
- Refresh the hidden Claw WebChat bootstrap so agents get a shorter but stricter media contract for local files and direct remote `http/https` media URLs
- Widen the regular desktop image/video cap from `420px` to `70vw` while keeping the existing mixed-media bubble gating logic intact
- Add a composer-side thinking control with a model-aware popup and a dynamic `T:*` badge that reflects the current session thinking level, then tone the badge typography down so it reads as tool chrome instead of a primary action
- Improve search-result highlighting and search panel metadata so active date/limit filters stay visible
- Change no-argument `/model` and `/models` from a plain text status reply into a model-switching modal workflow for the current agent
- Keep the current conversation pinned to the bottom more reliably while the agent is still processing after a user send
- Replace the composer text send button with an icon button that switches to a stop icon while the current agent is processing
- Rewrite the README homepage for public release prep, including screenshots, install entry points, and a publish checklist

### Fixed
- Normalize stored `sessionKey` values to the `openclaw-webchat:*` prefix while still accepting legacy `claw-webchat:*` requests, so local selftest and existing browser sessions stay aligned
- Steer agents away from the unsupported `message` / `webchat` channel send path so generated local media and referenced remote media render correctly inside Claw WebChat without per-agent manual reminders
- Preserve the right-side conversation viewport when older history is prepended, stop forcing bottom pinning just because the active agent is busy, and remove overlapping smooth-scroll behavior that made manual scrolling jumpy
- Show the current app version in Settings → About by sourcing it from `package.json` through the settings API
- Make gateway CLI parsing resilient when plugin diagnostics are printed before JSON output, restoring slash-command stability for `/model`, `/think`, and related upstream queries
- Restore full local selftest coverage after `memory-lancedb-pro` installation by recording plugin install provenance in the local OpenClaw config
- Keep message avatars visually aligned with the sidebar avatar size
- Show a visible preview layer for videos before playback starts so users can identify the clip before pressing play
- Prevent stopped runs from continuing through late-reply reconciliation or from slipping through after attachment preparation has already begun
- Keep the fullscreen image viewer zoom readout in sync with the actual wheel-zoom scale instead of leaving the reset button stuck at `1:1`

## [0.1.4] - 2026-03-19

### Changed
- Bind the server explicitly to `127.0.0.1` by default, with `OPENCLAW_WEBCHAT_HOST` for intentional LAN access
- Return opaque upload source handles to the browser instead of absolute filesystem paths
- Add a settings-managed access mode switch for local-only versus LAN / Tailscale-friendly access
- Add optional light authentication for personal LAN-style deployments
- Reorganize settings into first-level sections for Contacts, Appearance, Access & Security, About, and Manual Start
- Add Simplified Chinese / English interface switching from the Appearance settings
- Add an About panel with project summary and GitHub link
- Add a Manual Start panel with install/start/restart command hints
- Align WebChat document-access messaging with the current OpenClaw configuration instead of a separate WebChat-only scope
- Remove the extra WebChat-side local media allowlist restriction so existing agent-generated images continue to render under the current instance auth boundary

## [0.1.3] - 2026-03-18

### Added
- History search for the current agent timeline
- Search result jump, keyword highlighting, and recent-search recall
- Theme preset variants with one dark preset and five light presets

### Changed
- Tightened visual media bubble behavior for long text plus small media combinations
- Tightened chat bubble shadow treatment for lighter themes
- Reduced mobile first-open history load to improve perceived performance
- Improved chat auto-scroll behavior with a unified pinned-bottom state
- Refined left agent list refresh to avoid unnecessary full rerenders

### Fixed
- Hardened local media secret handling and media path allowlist behavior
- Restricted file media URL schemes to trusted values
- Prevented timeout placeholder replies from polluting stored history
- Moved audio transcription off the synchronous request path
- Preserved compatibility for older avatar media tokens during migration
- Improved late-reply isolation and cross-agent session safety

## [0.1.2] - 2026-03-17

### Added
- launchd helper script for background macOS operation
- visual media bubble experiment with desktop fallback protection
- avatar persistence based on stable source paths instead of short-lived signed URLs

### Changed
- aligned project docs with the JavaScript-based implementation
- refined settings themes and default light appearance

### Fixed
- prevented long text plus small image messages from collapsing into overly narrow desktop bubbles
- fixed avatar expiry caused by persisting signed media URLs

## [0.1.1] - 2026-03-15

### Added
- standalone project structure, API namespace, and dedicated local history storage
- per-agent session binding and `/new` marker retention
- assistant rich media rendering for images, audio, video, and files
- user image and audio uploads
- responsive web UI with agent list, message timeline, and settings

### Fixed
- improved gateway retry behavior for temporary disconnects
- prevented stale upstream replies from leaking into reset sessions
