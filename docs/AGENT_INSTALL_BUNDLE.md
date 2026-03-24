# Agent Install Guide: Release Bundle

This guide is written for OpenClaw agents that need to install, configure, and enable `claw-webchat` from a downloaded release bundle.

## Agent Execution Contract

Follow these rules strictly:

1. Complete one step and run its check before moving to the next step.
2. Do not assume a command succeeded unless the check says it did.
3. If a check fails, stop, report the failure, and repair it before continuing.
4. Prefer short, single-purpose commands over long chained commands.
5. If your model is weaker at long procedural tasks, pause after each check and restate the current state before moving on.
6. Never delete unrelated user files or reset unrelated git state.

## Best-Fit Environment

This bundle flow is best when:
- the user already downloaded the release bundle from GitHub Releases
- OpenClaw is already installed
- Node.js `20+` is already installed
- the target machine is macOS and can use a user LaunchAgent

If OpenClaw or Node.js is missing, stop and switch to [AGENT_INSTALL_NETWORK.md](./AGENT_INSTALL_NETWORK.md) first. Return to this bundle guide only after `openclaw --version`, `node -v`, and `npm -v` all succeed.

## Inputs You Need Before Starting

Do not continue until all four inputs are known:

- the absolute path of the downloaded release bundle
- the target install directory
- whether the user wants local-only or LAN / Tailscale access
- whether the user wants lightweight auth enabled

If any input is missing, ask only for that missing input.

## Step 1: Verify Prerequisites

Run:

```bash
node -v
openclaw --version
tar --version
```

Check:
- `node -v` must report `v20` or newer
- `openclaw --version` must succeed
- `tar --version` must succeed

If any check fails:
- stop here
- report exactly which prerequisite is missing
- do not continue to extraction

## Step 2: Verify The Bundle File

Run:

```bash
ls -lh /ABSOLUTE/PATH/TO/claw-webchat-RELEASE-BUNDLE.tar.gz
tar -tzf /ABSOLUTE/PATH/TO/claw-webchat-RELEASE-BUNDLE.tar.gz | head -20
```

Check:
- the bundle file exists
- the archive can be listed without error
- the archive contains `package.json`, `src/`, `public/`, and `docs/`

If the archive cannot be listed, stop and ask for a valid bundle file.

If a checksum file exists next to the bundle, also run:

```bash
shasum -a 256 /ABSOLUTE/PATH/TO/claw-webchat-RELEASE-BUNDLE.tar.gz
cat /ABSOLUTE/PATH/TO/claw-webchat-RELEASE-BUNDLE.sha256
```

Only continue if the two SHA256 values match.

## Step 3: Extract Into The Install Directory

Create the install directory if needed, then extract:

```bash
mkdir -p /ABSOLUTE/PATH/TO/INSTALL_PARENT
tar -xzf /ABSOLUTE/PATH/TO/claw-webchat-RELEASE-BUNDLE.tar.gz -C /ABSOLUTE/PATH/TO/INSTALL_PARENT
```

Check:

```bash
ls -la /ABSOLUTE/PATH/TO/INSTALL_PARENT
ls -la /ABSOLUTE/PATH/TO/INSTALL_PARENT/claw-webchat
```

Confirm:
- the extracted project directory exists
- `package.json` exists inside it

If not, stop and inspect the archive layout before continuing.

## Step 4: Install Node Dependencies

Run inside the extracted project directory:

```bash
npm install
```

Check:

```bash
test -d node_modules && echo OK
npm run check
```

Do not continue unless:
- `node_modules` exists
- `npm run check` succeeds

## Step 5: Verify OpenClaw CLI Reachability

Run:

```bash
openclaw gateway call health --json
```

Check:
- the command returns valid JSON
- the gateway is reachable from the same user session that will run WebChat

If the gateway is not reachable, stop and fix OpenClaw first.

## Step 6: Configure Runtime Choices

If the user wants local-only access, you can usually keep defaults.

If the user wants LAN / Tailscale access, prepare:

```bash
export OPENCLAW_WEBCHAT_HOST=0.0.0.0
```

If the user wants a custom port or data directory, prepare those too:

```bash
export OPENCLAW_WEBCHAT_PORT=3770
export OPENCLAW_WEBCHAT_DATA_DIR=/ABSOLUTE/PATH/TO/claw-webchat-data
```

Check:
- every configured path is absolute
- the chosen port is not already occupied

To check the port:

```bash
lsof -nP -iTCP:3770 -sTCP:LISTEN
```

If the chosen port is occupied, stop and choose another port.

## Step 7: First Manual Start

Run from the project directory:

```bash
npm start
```

Keep this process running long enough to test it.

Check from another terminal:

```bash
curl -sf http://127.0.0.1:3770/healthz
```

Confirm:
- `/healthz` returns JSON with `"ok": true`
- the page loads in a browser

If the user requested LAN access, also check from the same machine:

```bash
curl -sf http://YOUR_HOST_OR_IP:3770/healthz
```

Do not continue to service enablement until the manual start works.

## Step 8: Optional First Functional Smoke Test

Run:

```bash
npm run selftest
```

Check:
- it ends with `SELFTEST_OK`

If the environment cannot satisfy `selftest`, note that clearly before proceeding.

## Step 9: Enable As A Background Service On macOS

If the target machine is macOS and the user wants a LaunchAgent:

1. Confirm the launch helper exists:

```bash
test -f /ABSOLUTE/PATH/TO/claw-webchat/scripts/run-webchat-launchd.sh && echo OK
```

2. Create the LaunchAgent directories and log directory:

```bash
mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/.openclaw/logs"
```

3. Write the LaunchAgent plist to the exact path below. Replace every placeholder before saving:

```bash
cat > "$HOME/Library/LaunchAgents/ai.openclaw.webchat.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.openclaw.webchat</string>
  <key>ProgramArguments</key>
  <array>
    <string>/ABSOLUTE/PATH/TO/claw-webchat/scripts/run-webchat-launchd.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/ABSOLUTE/PATH/TO/claw-webchat</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/Users/USERNAME/.openclaw/logs/claw-webchat.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/USERNAME/.openclaw/logs/claw-webchat.stderr.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>/Users/USERNAME</string>
    <key>OPENCLAW_BIN</key>
    <string>/ABSOLUTE/PATH/TO/openclaw</string>
    <key>OPENCLAW_WEBCHAT_PORT</key>
    <string>3770</string>
    <key>OPENCLAW_WEBCHAT_HOST</key>
    <string>127.0.0.1</string>
    <key>OPENCLAW_WEBCHAT_DATA_DIR</key>
    <string>/ABSOLUTE/PATH/TO/claw-webchat-data</string>
  </dict>
</dict>
</plist>
PLIST
```

4. Validate the plist before loading:

```bash
test -f "$HOME/Library/LaunchAgents/ai.openclaw.webchat.plist" && echo OK
grep -nE "/ABSOLUTE/PATH/TO|USERNAME" "$HOME/Library/LaunchAgents/ai.openclaw.webchat.plist"
```

Only continue if:
- the plist file exists
- `grep` returns no unresolved placeholders

5. Load or reload the LaunchAgent:

```bash
launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/ai.openclaw.webchat.plist" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/ai.openclaw.webchat.plist"
launchctl kickstart -k "gui/$(id -u)/ai.openclaw.webchat"
```

Minimum checks:

```bash
launchctl print gui/$(id -u)/ai.openclaw.webchat | head -40
curl -sf http://127.0.0.1:3770/healthz
tail -n 20 "$HOME/.openclaw/logs/claw-webchat.stderr.log"
```

Confirm:
- the LaunchAgent exists
- the service is running
- `/healthz` still succeeds after the agent is loaded
- the stderr log does not show an immediate startup failure

If the machine is not macOS:
- stop at a manual `npm start` installation
- report that background-service automation was not applied because the current guide is `launchd`-oriented

## Step 10: Configure In-App Settings

Open the WebChat UI and set:
- access mode
- optional light auth
- display language
- theme

Check:
- settings save successfully
- if access mode changed, the service restarts cleanly or the restart instructions are clear

## Final Completion Check

The install is complete only if all of the following are true:

- the project directory exists and includes installed dependencies
- `npm run check` succeeded
- OpenClaw gateway is reachable
- `/healthz` succeeds
- the UI loads
- background service is enabled if requested
- the chosen access mode is active

## If You Are A Lower-Capability Agent

Use this fallback behavior:

- run one command at a time
- after each command, summarize only the key success signal
- never compress multiple checks into one statement
- if you see unclear output, do not guess; ask the user for confirmation or inspect more narrowly
