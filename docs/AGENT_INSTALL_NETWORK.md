# Agent Install Guide: Network Install

This guide is written for OpenClaw agents that need to install `claw-webchat` by downloading the necessary software and repository contents over the network.

## Agent Execution Contract

Follow these rules strictly:

1. Finish one numbered step and pass its check before moving on.
2. If a check fails, stop and repair that step before continuing.
3. Prefer narrow commands and explicit checks.
4. Never assume tools already exist just because they usually do.
5. If your model is weaker at long shell workflows, narrate state after every step.

## Capability Notes

- Stronger models may pair one action command with its immediate verification command when the output is short and unambiguous.
- Lower-capability models should run exactly one command at a time, then report `pass` or `blocked` before moving on.
- If a step requires user secrets, provider choice, or a path you do not know, stop and ask only for that missing input.

## Best-Fit Environment

This flow is best when:
- the target machine has network access
- the user wants the agent to fetch software directly
- GitHub access is available
- the target machine is macOS, Linux, or WSL with `bash` and `curl`
- OpenClaw may already be installed, or may need to be bootstrapped first with the official installer

## Inputs You Need Before Starting

Do not continue until all inputs are known:

- the target install directory
- whether to install from the latest release tag or from `main`
- whether the user wants local-only or LAN / Tailscale access
- whether the user wants lightweight auth enabled
- whether OpenClaw is already configured with a usable model provider; if not, which provider/auth path the user wants to use during `openclaw onboard`

If the user does not care about branch choice, prefer the latest GitHub Release. Use `main` only when the user explicitly wants the newest unreleased state.

## Step 1: Verify Platform And Network Reachability

Run:

```bash
uname -s
bash --version | head -1
curl --version
curl -I https://github.com
curl -I https://openclaw.ai
```

Check:
- the OS is one of: `Darwin`, `Linux`
- `bash` exists
- `curl` exists
- both HTTPS checks succeed with response headers

If any check fails:
- stop
- report exactly what is missing or unreachable
- fix that prerequisite before continuing

If the OS is not supported by this guide:
- stop here
- report that this network guide currently targets macOS, Linux, or WSL-style shells

## Step 2: Verify Or Bootstrap OpenClaw CLI And Node Runtime

Run:

```bash
command -v openclaw || true
node -v || true
npm -v || true
```

Check:
- if `openclaw`, `node`, and `npm` already exist, record their versions and continue
- if any of them are missing, or Node.js is older than `v20`, bootstrap OpenClaw first with the official installer

The command below follows the current official OpenClaw install path:
- [OpenClaw CLI docs](https://openclawlab.com/en/docs/cli/)
- [OpenClaw setup docs](https://openclawlab.com/en/docs/getting-started/setup/)

Official bootstrap command:

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash
```

Then verify:

```bash
openclaw --version
node -v
npm -v
```

Only continue if all three checks succeed.

If the bootstrap fails:
- stop
- report the exact failing stage
- do not continue to repository download until `openclaw --version`, `node -v`, and `npm -v` all work

## Step 3: Verify Or Complete OpenClaw Onboarding

First probe whether OpenClaw is already usable:

```bash
openclaw gateway call health --json
```

Check:
- if valid JSON is returned, OpenClaw is already usable and you may continue
- if it fails because OpenClaw has not been configured yet, complete onboarding before continuing

To complete onboarding, run:

```bash
openclaw onboard
```

This follows the current official OpenClaw onboarding flow described in the setup docs above.

Check after onboarding:

```bash
openclaw gateway call health --json
```

Only continue if the health check now returns valid JSON.

If onboarding requires a provider choice or credential the agent does not have:
- stop
- ask only for the missing provider/auth input
- resume from this step after onboarding is complete

## Step 4: Fetch The Source

### Option A: Install From Latest Release Source

Use this when the user wants a stable public install:

```bash
mkdir -p /ABSOLUTE/PATH/TO/INSTALL_PARENT
cd /ABSOLUTE/PATH/TO/INSTALL_PARENT
RELEASE_TAG="$(curl -fsSL https://api.github.com/repos/memphislee09-source/claw-webchat/releases/latest | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
test -n "$RELEASE_TAG" && echo "Resolved release tag: $RELEASE_TAG"
ARCHIVE_PATH="claw-webchat-${RELEASE_TAG}.tar.gz"
curl -fL "https://github.com/memphislee09-source/claw-webchat/archive/refs/tags/${RELEASE_TAG}.tar.gz" -o "$ARCHIVE_PATH"
EXTRACTED_DIR="$(tar -tzf "$ARCHIVE_PATH" | head -1 | cut -d/ -f1)"
test -n "$EXTRACTED_DIR" && echo "Archive root: $EXTRACTED_DIR"
tar -xzf "$ARCHIVE_PATH"
rm -rf claw-webchat
mv "$EXTRACTED_DIR" claw-webchat
```

Check before moving on:
- `Resolved release tag: ...` was printed
- `Archive root: ...` was printed
- `claw-webchat/package.json` exists after the move

### Option B: Install From `main`

Use this only when the user explicitly wants the latest mainline state:

```bash
mkdir -p /ABSOLUTE/PATH/TO/INSTALL_PARENT
cd /ABSOLUTE/PATH/TO/INSTALL_PARENT
curl -fL https://github.com/memphislee09-source/claw-webchat/archive/refs/heads/main.tar.gz -o claw-webchat-main.tar.gz
EXTRACTED_DIR="$(tar -tzf claw-webchat-main.tar.gz | head -1 | cut -d/ -f1)"
test -n "$EXTRACTED_DIR" && echo "Archive root: $EXTRACTED_DIR"
tar -xzf claw-webchat-main.tar.gz
rm -rf claw-webchat
mv "$EXTRACTED_DIR" claw-webchat
```

Check:

```bash
cd /ABSOLUTE/PATH/TO/INSTALL_PARENT/claw-webchat
test -f package.json && echo OK
test -d src && echo OK
test -d public && echo OK
```

Do not continue unless all three checks pass.

## Step 5: Install Dependencies

Run inside the project directory:

```bash
npm install
```

Check:

```bash
test -d node_modules && echo OK
npm run check
```

Both must succeed before you continue.

## Step 6: Verify OpenClaw Gateway Reachability

Run:

```bash
openclaw gateway call health --json
```

Check:
- valid JSON is returned
- the gateway is reachable under the same user account that will run WebChat

If not, stop and fix the OpenClaw side first.

## Step 7: Choose Runtime Settings

For local-only access, defaults are usually enough.

For LAN / Tailscale access, prepare:

```bash
export OPENCLAW_WEBCHAT_HOST=0.0.0.0
```

Optional examples:

```bash
export OPENCLAW_WEBCHAT_PORT=3770
export OPENCLAW_WEBCHAT_DATA_DIR=/ABSOLUTE/PATH/TO/claw-webchat-data
```

Check:
- all configured paths are absolute
- the selected port is free

Port check:

```bash
lsof -nP -iTCP:3770 -sTCP:LISTEN
```

If the port is already in use, stop and choose another one.

## Step 8: First Manual Start

Run from the project directory:

```bash
npm start
```

Leave it running long enough to test.

Check from another terminal:

```bash
curl -sf http://127.0.0.1:3770/healthz
```

Confirm:
- `/healthz` returns `"ok": true`
- the UI opens in a browser

If the user selected LAN / Tailscale access, also check the chosen host or IP path.

## Step 9: Run Functional Smoke Test

Run:

```bash
npm run selftest
```

Check:
- it ends with `SELFTEST_OK`

If the environment cannot support `selftest`, record that clearly and explain why.

## Step 10: Enable Background Service

If the machine is macOS and the user wants a persistent background service:

1. Create the LaunchAgent directories and log directory:

```bash
mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/.openclaw/logs"
```

2. Write the LaunchAgent plist to the exact path below. Replace the placeholder values before saving:

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

3. Validate the two most important plist substitutions before loading it:

```bash
test -f "$HOME/Library/LaunchAgents/ai.openclaw.webchat.plist" && echo OK
grep -nE "/ABSOLUTE/PATH/TO|USERNAME" "$HOME/Library/LaunchAgents/ai.openclaw.webchat.plist"
```

Only continue if:
- the plist file exists
- `grep` returns no unresolved placeholders

4. Load or reload the LaunchAgent:

```bash
launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/ai.openclaw.webchat.plist" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/ai.openclaw.webchat.plist"
launchctl kickstart -k "gui/$(id -u)/ai.openclaw.webchat"
```

5. Verify the service is really running and serving:

Checks:

```bash
launchctl print gui/$(id -u)/ai.openclaw.webchat | head -40
curl -sf http://127.0.0.1:3770/healthz
tail -n 20 "$HOME/.openclaw/logs/claw-webchat.stderr.log"
```

Confirm:
- `launchctl print` shows the loaded `ai.openclaw.webchat` job
- `/healthz` succeeds
- the stderr log does not show an immediate startup failure

If the machine is not macOS:
- stop at a manual install unless the user gives a different service manager target
- report that persistent service setup was not applied

## Step 11: Apply UI Settings

Open the UI and configure:
- access mode
- optional light auth
- language
- theme

Check:
- settings save successfully
- restart guidance is clear if a bind-address change requires it

## Final Completion Check

The install is complete only if:

- the project files were downloaded successfully
- `npm install` succeeded
- `npm run check` succeeded
- OpenClaw gateway health works
- `/healthz` works
- the UI loads
- `npm run selftest` passed or a clear reason was documented
- background service is enabled if requested
- the chosen access mode and auth mode match the user request

## If You Are A Lower-Capability Agent

Use this fallback behavior:

- do not combine fetch, install, and verify steps into one command
- quote exact paths every time
- after each check, report either `pass` or `blocked`
- if GitHub download paths are uncertain, stop and confirm the exact release tag rather than guessing
