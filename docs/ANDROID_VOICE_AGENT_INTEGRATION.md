# Android Voice Agent Integration

This document is for the Android-side coding agent that needs to replace the old gateway-direct voice path with the `openclaw-webchat` voice/chat session API now implemented in this repo.

Read this as an implementation guide, not as a product spec draft. The server behavior described here is already live in `claw-webchat`.

## One Rule First

Do not introduce a second chat source of truth.

Use `openclaw-webchat` for:

- contacts / agent list
- session identity
- chat history
- pending run state
- voice turn submission
- live assistant streaming

Do not keep a separate gateway-direct voice conversation timeline once this integration is switched over.

## What Exists Now

Android can keep using these existing endpoints:

- `GET /api/openclaw-webchat/agents`
- `POST /api/openclaw-webchat/agents/{agentId}/open`
- `GET /api/openclaw-webchat/agents/{agentId}/history?limit=...`
- `POST /api/openclaw-webchat/uploads`

Android should add these newer endpoints for voice/chat async turns:

- `GET /api/openclaw-webchat/sessions/{sessionKey}/events`
- `POST /api/openclaw-webchat/sessions/{sessionKey}/turns`
- `POST /api/openclaw-webchat/sessions/{sessionKey}/runs/{runId}/abort`

The old synchronous text endpoint still exists:

- `POST /api/openclaw-webchat/sessions/{sessionKey}/send`

For the new Android voice flow, prefer `/turns`, not `/send`.

## Recommended Android Flow

### 1. Open the agent normally

Call:

`POST /api/openclaw-webchat/agents/{agentId}/open`

Use the returned `sessionKey` as the stable key for:

- SSE subscription
- async turn submission
- run abort

### 2. Open one SSE stream per active session

Call:

`GET /api/openclaw-webchat/sessions/{sessionKey}/events?mode=voice`

Use standard Server-Sent Events semantics:

- keep the connection open
- reconnect on disconnect
- preserve the last seen event id if your client supports it
- optionally pass `Last-Event-ID` or `cursor` when reconnecting

The stream sends heartbeat comments automatically. Treat the SSE stream as the primary live output channel during voice mode.

### 3. Upload the raw user audio clip

Call:

`POST /api/openclaw-webchat/uploads`

Use:

- `kind = "audio"`
- a real audio mime such as `audio/mp4`, `audio/wav`, `audio/mpeg`, `audio/webm`, `audio/ogg`
- `durationMs`

The returned `upload.source` is what must go into the later `/turns` request. Do not replace it with a local path or a client-generated pseudo id.

### 4. Submit the voice turn asynchronously

Call:

`POST /api/openclaw-webchat/sessions/{sessionKey}/turns`

The request must contain:

- a session-unique `clientTurnId`
- `mode = "voice"`
- `text` set to the transcript text used for reasoning
- `blocks` containing:
  - one transcript text block
  - one raw audio block using the upload `source`

The server accepts the turn immediately, persists the user message into normal history, returns `runId`, and then continues assistant execution in the background.

### 5. Render live output from SSE

Consume these events:

- `ready`
- `run.accepted`
- `run.state`
- `assistant.delta`
- `assistant.final`
- `assistant.error`

For UI purposes:

- show pending/running state after `run.accepted` or `run.state = running`
- append or replace live text using `assistant.delta.text`
- commit the final assistant message from `assistant.final.message`
- clear pending state on `run.state = final|error|aborted`

### 6. Abort on barge-in or explicit stop

If the user starts speaking again while a reply is still running:

1. call `POST /api/openclaw-webchat/sessions/{sessionKey}/runs/{runId}/abort`
2. wait for `run.state = aborted`
3. upload the new audio clip
4. submit the next `/turns` request

If you already know the next turn should interrupt the previous one, also send:

```json
{
  "interrupt": {
    "policy": "abort_previous_if_running"
  }
}
```

in the new `/turns` request.

## Hard Integration Rules

### Voice user messages must stay in normal history

Do not create a parallel voice-history model on Android.

Voice-originated user turns are already persisted in standard chat history as a normal `role = "user"` message with:

- one transcript text block
- one raw audio block

That same message will come back from:

- `POST /api/openclaw-webchat/agents/{agentId}/open`
- `GET /api/openclaw-webchat/agents/{agentId}/history`

### `clientTurnId` is the idempotency key

If Android retries the same `/turns` request due to timeout or reconnect, reuse the same `clientTurnId`.

Server behavior:

- same `clientTurnId` plus same payload shape returns the original `runId` and `userMessageId`
- same `clientTurnId` plus different payload is treated as an error

Do not generate a fresh `clientTurnId` for network retries of the same logical turn.

### `assistant.final.message` is canonical

Use `assistant.delta` only for live preview.

The canonical assistant message is:

- `assistant.final.message`

That final message shape is the same shape that will later appear in normal history.

### Partial assistant output is not normal history

If a run is aborted or errors:

- do not persist partial deltas as a finished assistant message on Android
- wait for either:
  - `assistant.final`
  - `run.state = aborted`
  - `assistant.error`

## Actual Request / Response Shapes

### SSE `ready`

Example:

```json
{
  "sessionKey": "openclaw-webchat:mira",
  "streamVersion": 1,
  "mode": "voice"
}
```

### Upload response

Example:

```json
{
  "ok": true,
  "upload": {
    "kind": "audio",
    "source": "openclaw-upload:1774526208616-6a4e2f30064f-sample-voice.wav",
    "name": "sample-voice.wav",
    "size": 1086,
    "mimeType": "audio/wav",
    "durationMs": 2140,
    "transcriptStatus": "not_requested"
  },
  "block": {
    "type": "audio",
    "url": "/api/openclaw-webchat/media?token=...",
    "name": "sample-voice.wav",
    "mimeType": "audio/wav",
    "sizeBytes": 1086,
    "durationMs": 2140
  }
}
```

Important:

- use `upload.source` in `/turns`
- `block.url` is for rendering/playback

### Voice `/turns` request

Example:

```json
{
  "clientTurnId": "turn_001",
  "mode": "voice",
  "text": "帮我总结一下今天的日程。",
  "blocks": [
    {
      "type": "text",
      "text": "帮我总结一下今天的日程。"
    },
    {
      "type": "audio",
      "source": "openclaw-upload:1774526208616-6a4e2f30064f-sample-voice.wav",
      "name": "sample-voice.wav",
      "mimeType": "audio/wav",
      "sizeBytes": 1086,
      "durationMs": 2140
    }
  ],
  "transcript": {
    "text": "帮我总结一下今天的日程。",
    "source": "android-speech-recognizer",
    "locale": "zh-CN",
    "isFinal": true
  },
  "response": {
    "stream": true,
    "thinking": "low"
  },
  "interrupt": {
    "policy": "abort_previous_if_running"
  },
  "client": {
    "platform": "android",
    "app": "clawchat2",
    "appVersion": "0.2.3"
  }
}
```

### Voice `/turns` accepted response

Example:

```json
{
  "ok": true,
  "accepted": true,
  "sessionKey": "openclaw-webchat:mira",
  "clientTurnId": "turn_001",
  "userMessageId": "msg_user_1",
  "runId": "run_123",
  "status": "queued"
}
```

### SSE `run.accepted`

Example:

```json
{
  "sessionKey": "openclaw-webchat:mira",
  "clientTurnId": "turn_001",
  "runId": "run_123",
  "userMessageId": "msg_user_1"
}
```

### SSE `run.state`

Example:

```json
{
  "sessionKey": "openclaw-webchat:mira",
  "runId": "run_123",
  "state": "running"
}
```

Terminal states are:

- `final`
- `error`
- `aborted`

### SSE `assistant.delta`

Example:

```json
{
  "sessionKey": "openclaw-webchat:mira",
  "runId": "run_123",
  "sequence": 3,
  "textDelta": "，今天有三个安排",
  "text": "好的，今天有三个安排"
}
```

Rules:

- `sequence` increases within a run
- `text` is cumulative
- if one delta is missed, `text` is still enough to recover the visible live string
- a very fast run may go straight to `assistant.final`, so do not require at least one delta before finishing the turn

### SSE `assistant.final`

Example:

```json
{
  "sessionKey": "openclaw-webchat:mira",
  "runId": "run_123",
  "message": {
    "id": "msg_asst_1",
    "role": "assistant",
    "createdAt": "2026-03-26T11:56:51.560Z",
    "blocks": [
      {
        "type": "text",
        "text": "好的，今天有三个安排。"
      }
    ]
  }
}
```

Use this `message` directly as the assistant turn you commit into the Android UI state.

### Voice-originated history message

Example:

```json
{
  "id": "msg_user_1",
  "role": "user",
  "createdAt": "2026-03-26T11:56:48.620Z",
  "blocks": [
    {
      "type": "text",
      "text": "帮我总结一下今天的日程。"
    },
    {
      "type": "audio",
      "url": "/api/openclaw-webchat/media?token=...",
      "name": "sample-voice.wav",
      "mimeType": "audio/wav",
      "sizeBytes": 1086,
      "durationMs": 2140
    }
  ]
}
```

This is what Android should expect back from normal history APIs after a voice turn is submitted.

### Abort response

Example:

```json
{
  "ok": true,
  "sessionKey": "openclaw-webchat:mira",
  "runId": "run_456",
  "state": "aborted"
}
```

After that, expect:

```json
{
  "sessionKey": "openclaw-webchat:mira",
  "runId": "run_456",
  "state": "aborted"
}
```

from SSE `run.state`.

## Error Handling

Machine-readable error codes used by these APIs:

- `session_not_found`
- `invalid_upload_source`
- `unsupported_audio_mime`
- `duplicate_client_turn`
- `run_conflict`
- `run_not_found`
- `internal_error`

Android should branch on `error.code`, not only on HTTP status.

### Expected handling

- `session_not_found`
  - reopen the agent to get a fresh `sessionKey`
- `invalid_upload_source`
  - re-upload the clip, then retry `/turns` with the new `upload.source`
- `unsupported_audio_mime`
  - transcode on client or switch recorder/container config
- `duplicate_client_turn`
  - treat as client bug unless it is a same-payload retry flow
- `run_conflict`
  - abort current run first, or resubmit with `interrupt.policy = abort_previous_if_running`
- `run_not_found`
  - clear local pending state for that run
- `internal_error`
  - show failure state and allow retry

## Old Paths To Remove From Android

After this integration is complete, Android should stop depending on:

- a gateway-direct voice conversation path
- a second voice-only run timeline
- local-only tracking of assistant pending state that is disconnected from WebChat session state

The new source of truth should be:

- accepted `/turns` response
- session SSE events
- normal WebChat history APIs

## Minimal Kotlin-Level State Model

At minimum, keep these fields per active session:

- `sessionKey`
- `activeRunId`
- `lastSseEventId`
- `pendingUserMessageId`
- `streamedAssistantText`
- `connectionState`

At minimum, keep these fields per submitted turn:

- `clientTurnId`
- `runId`
- `userMessageId`
- `mode`
- `status`

This is enough to handle:

- retry-safe turn submission
- SSE reconnect
- live assistant rendering
- barge-in abort
- history refresh after reconnect or app resume

## Recommended Integration Sequence

1. Keep current text chat path unchanged.
2. Reuse `agents/{agentId}/open` and `history` as before.
3. Add session SSE consumption.
4. Add audio upload via `/uploads`.
5. Replace gateway-direct voice submit with `/turns`.
6. Replace gateway-direct stop with `/runs/{runId}/abort`.
7. Delete the old parallel voice conversation state once parity is confirmed.

## If You Need To Confirm Behavior

The server-side implementation lives in:

- `/Users/memphis/.openclaw/workspace-mira/claw-webchat/src/server.js`

Live regression coverage lives in:

- `/Users/memphis/.openclaw/workspace-mira/claw-webchat/scripts/selftest.mjs`

If Android sees behavior that differs from this doc, trust the server implementation and selftest first, then update this doc to match the shipped behavior.
