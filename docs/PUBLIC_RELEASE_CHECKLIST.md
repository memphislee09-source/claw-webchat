# Public Release Checklist

Use this checklist before recommending Claw WebChat in the OpenClaw community.

## 1. Product Readiness
- [ ] Confirm the release target commit is on `main`
- [ ] Confirm `status.md` and the latest handoff are up to date
- [ ] Verify the current version in `package.json` and release notes are aligned
- [ ] Review the current known-risk list, especially:
  - mobile history loading stability
  - multi-agent / late-reply regression
  - successful audio transcription path
  - send/stop button behavior during long replies and attachment preparation

## 2. Manual QA
- [ ] Open at least one existing agent and one newly created agent
- [ ] Verify `/new` resets upstream context while preserving local history
- [ ] Verify `/model` opens the picker and can switch models successfully
- [ ] Verify history search with:
  - a normal keyword query
  - a date-filtered query
  - a larger result limit
- [ ] Verify image, audio, and video rendering
- [ ] Verify the send button changes to the stop button while the agent is processing
- [ ] Verify clicking stop actually aborts the current run
- [ ] Verify a stopped run does not later reappear through delayed reconciliation
- [ ] Verify settings pages for Contacts, Appearance, Access & Security, About, and Manual Start
- [ ] Verify at least one mobile-width session

## 3. Automated Checks
- [ ] Run `npm run check`
- [ ] Run `npm run selftest` in a usable local OpenClaw environment
- [ ] If any plugin or gateway changes recently landed, re-check `/model`, `/think`, and session listing flows

## 4. Public-Facing Docs
- [ ] README homepage reflects the actual current release state
- [ ] Screenshots are current and match the shipped UI
- [ ] `CHANGELOG.md` includes all user-facing changes for the release
- [ ] Install docs are current:
  - [ ] `docs/AGENT_INSTALL_BUNDLE.md`
  - [ ] `docs/AGENT_INSTALL_NETWORK.md`
- [ ] Security wording is clear that this project is local-first / private-network-first

## 5. GitHub Repo Hygiene
- [ ] Issue templates are current and ask for the right diagnostics
- [ ] Pull request template matches the release workflow
- [ ] Release title and notes are drafted
- [ ] The repository About section and README summary use the same positioning

## 6. Release Assets
- [ ] Build the release bundle with `npm run bundle`
- [ ] Confirm the generated archive opens correctly on a clean machine
- [ ] Upload the bundle archive and checksum file to the GitHub Release
- [ ] Include at least these screenshots in the release page or README:
  - main UI
  - model picker
  - history search
  - settings

## 7. Community Launch
- [ ] Prepare a short announcement post covering:
  - who this is for
  - what it does better than the default WebUI for that audience
  - the two installation methods
  - the security/deployment boundary
- [ ] Include direct links to:
  - GitHub repository
  - latest Release
  - bundle install guide
  - network install guide
- [ ] Be ready to respond to first-wave issues around installation, models, media rendering, and mobile behavior
