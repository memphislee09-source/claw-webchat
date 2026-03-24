# Promo Video Workflow

This document captures the full workflow used to generate the Claw WebChat narrated promo video, so future sessions can follow the same path quickly without re-discovering the setup.

## Goal

Produce a short product-intro video for Claw WebChat that includes:
- a concise script
- cloned-voice Chinese narration
- optional background music
- Remotion-based motion graphics using project screenshots
- a final `.mp4` that can be embedded on the GitHub repository homepage

## Final Outputs

Typical final artifacts:
- local working media under `media/`
- repository-tracked promo deliverable under `docs/media/`
- GitHub attachment video URL for README homepage embedding

Current example artifacts:
- local final render: `media/video/remotion-promo/out/claw-webchat-promo-v4.mp4`
- local final voiceover: `media/audio/claw-webchat-promo-zh-v4.mp3`
- tracked repo copy: `docs/media/claw-webchat-promo-v4.mp4`
- current homepage embed URL:
  `https://github.com/user-attachments/assets/53a40759-4889-41bf-9399-a3f3daf5bdaf`

## Required Inputs

Prepare these before starting:

### 1. Script

Keep the script short and scene-friendly. For a product intro video, write it as 5 to 7 spoken chunks, not one long paragraph.

Good chunking pattern:
1. hook / title
2. what the product is
3. easy install / easy config
4. history retention / search
5. rich media support
6. model / Think switching
7. CTA ending

Important rule:
- If the script changes, re-check every scene boundary. Do not assume the old timing still fits.

### 2. Screenshots

Put source screenshots under:
- `media/video/source-shots/`

Working screenshot set used for Claw WebChat:
- `01-main-chat.png`
- `02-model-picker.png`
- `03-thinking-picker.png`
- `04-history-search.png`
- `05-media-image-audio.png`
- `06-settings.png`
- `07-video-message.png`
- `08-markdown.png`

Guidelines:
- PNG preferred
- mixed wide and narrow screenshots are fine
- keep screenshots clean and intentional
- avoid over-cropping
- stable theme and language help the final edit look coherent

### 3. Reference Voice Material

Used by SiliconFlow CosyVoice cloning:
- reference audio: `/Users/memphis/.openclaw/skills/siliconflow-cosyvoice/zhuang.WAV`
- reference transcript: `/Users/memphis/.openclaw/skills/siliconflow-cosyvoice/zhuang.txt`

### 4. SiliconFlow API Key

Preferred:
- set `SILICONFLOW_API_KEY` in environment correctly

Known local fallback used in this project:
- extract the key from `~/.zshrc` inside the shell command, without printing it

Important:
- never echo the key in terminal output
- never include the key in docs, commits, or responses

### 5. Browser For Remotion Render

Remotion rendering used a local Chrome headless shell:
- `/Users/memphis/Downloads/chrome-headless-shell-mac-arm64/chrome-headless-shell`

If macOS blocks it, clear quarantine:

```bash
xattr -dr com.apple.quarantine /Users/memphis/Downloads/chrome-headless-shell-mac-arm64
```

Basic check:

```bash
/Users/memphis/Downloads/chrome-headless-shell-mac-arm64/chrome-headless-shell --version
```

## Skills And Tools Used

### Remotion

Skill:
- `/Users/memphis/.codex/skills/remotion/SKILL.md`

Used for:
- scene layout
- typography and motion
- image timing
- music and narration layering
- final `.mp4` render

### SiliconFlow CosyVoice

Skill:
- `/Users/memphis/.openclaw/skills/siliconflow-cosyvoice/SKILL.md`

Used for:
- cloned Chinese narration
- per-scene audio generation

### FFmpeg / ffprobe

Used for:
- audio concatenation
- metadata checks
- frame extraction for visual verification

## Directory Layout

Recommended local structure:

```text
media/
  audio/
    scenes-v4/
    scenes-v5/
    claw-webchat-promo-zh-v4.mp3
  video/
    source-shots/
    remotion-promo/
      public/
      src/
      out/
      verify/
docs/
  media/
    claw-webchat-promo-v4.mp4
tools/
  VIDEO_PROMO_WORKFLOW.md
```

Meaning:
- `media/` is the local working area
- `docs/media/` stores repo-tracked deliverables intended for public reference

## Step-By-Step Workflow

### Step 1. Confirm The Goal And Script

Decide:
- target duration
- language
- tone
- whether music is needed
- whether the final video is for README, release notes, or elsewhere

Recommended target:
- `25s` to `40s`

For this project, the final structure became:
1. opening title
2. what Claw WebChat is
3. easy install / easy config
4. history retention and search
5. rich media support
6. model / Think switching
7. CTA ending

Check before moving on:
- the script reads naturally out loud
- each scene has one clear message
- the CTA is its own scene, not squeezed into the prior scene

### Step 2. Gather Screenshots

Put screenshots into:
- `media/video/source-shots/`

Then copy the chosen ones into the Remotion `public/` directory when needed:
- `media/video/remotion-promo/public/`

Check before moving on:
- all required screenshots exist
- file names are stable and descriptive
- the final media scene includes the correct rich-media screenshot

Known correction from this project:
- the rich-media scene originally used `02-model-picker.png` by mistake
- it was corrected to `08-markdown.png`

### Step 3. Create The Remotion Project

Project path used here:
- `media/video/remotion-promo/`

Key files:
- `src/index.ts`
- `src/Root.tsx`
- `src/PromoVideo.tsx`

Key packages used:
- `remotion`
- `@remotion/cli`
- `@remotion/media`
- `@remotion/transitions`
- `react`
- `react-dom`

Check before moving on:
- Remotion project exists
- screenshots are available under `public/`
- `Root.tsx` duration matches the intended total frame count

### Step 4. Generate Narration As Per-Scene Audio

Do not generate only one long voice file first.

Preferred approach:
- split the script into one audio file per scene
- store them under a versioned folder such as `media/audio/scenes-v5/`

Why:
- makes scene timing easier to control
- easier to revise one line without regenerating everything
- prevents narration drift against screenshots

Example scene folder:
- `scene-01.mp3`
- `scene-02.mp3`
- `scene-03.mp3`
- `scene-04.mp3`
- `scene-05.mp3`
- `scene-06.mp3`
- `scene-07.mp3`

Example generation pattern:

```bash
python3 /Users/memphis/.openclaw/skills/siliconflow-cosyvoice/cosyvoice_gen.py \
  --text "如果你想要一个更好用的 OpenClaw 聊天界面，Claw WebChat 就是你的选择。" \
  --ref_audio /Users/memphis/.openclaw/skills/siliconflow-cosyvoice/zhuang.WAV \
  --ref_text /Users/memphis/.openclaw/skills/siliconflow-cosyvoice/zhuang.txt \
  --api_key "$API_KEY" \
  --emotion gentle \
  --style "产品介绍短片旁白，清晰自然，收尾更有号召感" \
  --speed 1.0 \
  --gain 0 \
  --response_format mp3 \
  --output /ABS/PATH/scene-07.mp3
```

Then copy scene audio into Remotion public assets:

```bash
mkdir -p media/video/remotion-promo/public/scenes-v5
cp media/audio/scenes-v5/scene-*.mp3 media/video/remotion-promo/public/scenes-v5/
```

Check before moving on:
- every scene has a corresponding audio file
- `ffprobe` can read every file
- the final CTA has its own dedicated clip

Example duration check:

```bash
for f in media/audio/scenes-v5/scene-*.mp3; do
  printf "%s\t" "$(basename "$f")"
  ffprobe -v error -show_entries format=duration \
    -of default=nokey=1:noprint_wrappers=1 "$f"
done
```

### Step 5. Match Scene Durations To Audio

Use per-scene audio durations to set Remotion frame counts.

Rule of thumb:
- `frames = ceil(seconds * 30) + small visual padding`

For this project:
- each sequence was given slightly more time than raw audio
- transitions used `15` frames
- background music was looped

Critical lesson:
- if the script changes, update scene durations
- do not keep old sequence lengths and hope they still match

### Step 6. Build The Scene Timeline In `PromoVideo.tsx`

Core responsibilities in `src/PromoVideo.tsx`:
- define scene order
- assign scene durations
- attach scene-specific audio with `<Audio src={staticFile(...)} />`
- attach background music at the top level
- place screenshots and text content per scene

Key pattern used:
- one `TransitionSeries.Sequence` per scene
- one scene audio file per sequence
- one dedicated final `OutroScene`

Important correction from this project:
- the CTA ending initially disappeared because it was folded into the previous feature scene
- final fix: split control narration and CTA narration into two different scenes

Check before moving on:
- the history/search narration still shows the history/search visuals
- the rich-media scene uses the correct screenshot set
- the CTA ending exists as its own sequence

### Step 7. Render With Headless Chrome

Render command used:

```bash
npx remotion render src/index.ts ClawWebChatPromo out/claw-webchat-promo-v4.mp4 \
  --browser-executable=/Users/memphis/Downloads/chrome-headless-shell-mac-arm64/chrome-headless-shell \
  --chrome-mode=headless-shell
```

Working directory:
- `media/video/remotion-promo/`

Check before moving on:
- render exits with code `0`
- output file exists
- output size is reasonable

### Step 8. Concatenate The Full Voice Track

Keep a combined narration file for reuse:

```bash
tmpfile=$(mktemp)
for f in media/audio/scenes-v5/scene-*.mp3; do
  printf "file '%s'\n" "$PWD/$f" >> "$tmpfile"
done
ffmpeg -y -f concat -safe 0 -i "$tmpfile" -c copy media/audio/claw-webchat-promo-zh-v4.mp3
rm -f "$tmpfile"
```

Check before moving on:
- the full narration file exists
- the scene ordering is correct

### Step 9. Verify The Final Video

Do not stop at “render succeeded”.

Verify metadata:

```bash
ffprobe -v error -show_entries stream=width,height:format=duration,size \
  -of default=noprint_wrappers=1 media/video/remotion-promo/out/claw-webchat-promo-v4.mp4
```

Extract key frames:

```bash
ffmpeg -y -ss 20 -i media/video/remotion-promo/out/claw-webchat-promo-v4.mp4 \
  -frames:v 1 media/video/remotion-promo/verify/frame-20s.png
```

Recommended spot checks:
- one frame during history/search narration
- one frame during rich-media narration
- one frame during model/Think narration
- one frame during the CTA ending

Checks that mattered in this project:
- `20s` should still be history/search, not rich media
- `23s` should enter rich media
- `29s` should show model / Think controls
- `34s+` in the final cut should be on the CTA outro

### Step 10. Track The Public Deliverable In The Repo

Copy the final deliverable to:
- `docs/media/`

Example:

```bash
mkdir -p docs/media
cp media/video/remotion-promo/out/claw-webchat-promo-v4.mp4 docs/media/claw-webchat-promo-v4.mp4
```

This gives the repo a stable tracked copy even if the working `media/` directory stays local-only.

### Step 11. Embed The Video On The GitHub Repo Homepage

Important distinction:
- a repo file link is only a link or a click-through player
- a homepage-visible embedded video should use a GitHub attachment URL like:
  `https://github.com/user-attachments/assets/...`

Workflow:
1. upload the final video to GitHub so it produces a `user-attachments` URL
2. place that URL directly in `README.md`
3. keep the tracked `docs/media/...mp4` as a download fallback

Current README pattern:

```md
# Claw WebChat

https://github.com/user-attachments/assets/53a40759-4889-41bf-9399-a3f3daf5bdaf

Language / 语言: [简体中文](#zh-cn) | [English](#en)

- Download the repository copy: [claw-webchat-promo-v4.mp4](docs/media/claw-webchat-promo-v4.mp4)
```

Check before moving on:
- the homepage video is actually visible on the repo page
- README still has a backup download link

### Step 12. Update README And Public Docs

When the video becomes the primary public-facing demo:
- replace screenshot-heavy README sections if needed
- update docs or task records so the workflow is reproducible

For this project:
- README screenshots were replaced by the promo video
- README was later reworked into a bilingual landing page with one-click language switches

## Common Pitfalls

### Pitfall 1. One Long Audio Track

Problem:
- visuals drift against narration

Fix:
- use per-scene audio files

### Pitfall 2. Wrong Screenshot In A Scene

Problem:
- feature description and screenshot disagree

Fix:
- verify each scene against the spoken line, not just overall pacing

### Pitfall 3. CTA Ending Gets Lost

Problem:
- the last line is merged into the prior feature scene and never gets proper visual landing time

Fix:
- make CTA its own clip and its own Remotion scene

### Pitfall 4. Repo File Link Is Not A Homepage Embed

Problem:
- README only shows a link instead of an inline video on the GitHub repo homepage

Fix:
- use a `github.com/user-attachments/assets/...` URL

### Pitfall 5. Remotion Render Fails Because Browser Is Blocked

Problem:
- local Chrome headless shell is quarantined on macOS

Fix:
- remove quarantine with `xattr -dr`

## Reuse Checklist

For the next promo video task, do this:
1. Confirm the script and split it by scene.
2. Collect screenshots into `media/video/source-shots/`.
3. Generate per-scene TTS clips into a versioned folder.
4. Copy those clips into Remotion `public/`.
5. Set scene frame lengths from audio lengths.
6. Render the video with the known headless Chrome path.
7. Verify metadata and key frames.
8. Copy the final `.mp4` into `docs/media/`.
9. Upload the final video to GitHub to obtain a `user-attachments` URL if homepage embed is needed.
10. Update `README.md` and relevant docs.

## Current Known Good References

Use these as working references:
- final render:
  `media/video/remotion-promo/out/claw-webchat-promo-v4.mp4`
- final narration:
  `media/audio/claw-webchat-promo-zh-v4.mp3`
- tracked public copy:
  `docs/media/claw-webchat-promo-v4.mp4`
- Remotion composition source:
  `media/video/remotion-promo/src/PromoVideo.tsx`
- Remotion composition root:
  `media/video/remotion-promo/src/Root.tsx`
- source screenshots:
  `media/video/source-shots/`
