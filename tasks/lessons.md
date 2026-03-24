# Lessons

- When a user says the core bug is fixed but the UI still feels too dense, treat that as a finishing pass request and tighten the presentation instead of stopping at functional correctness.

- When running visual experiments, keep each change isolated and easy to revert so the user can compare one variable at a time.
- For mixed text-and-media layout changes, do not assume a more aggressive "full-bleed" rule is better; preserve the previous balance unless the user confirms the new look wins in real usage.
- For new composer-side controls, default to a lighter text weight first; utility buttons should read as part of the tool chrome, not louder than the message input or send action.
- When a new user request interrupts an unfinished investigation, explicitly say whether the previous task is being paused or superseded. Do not silently drop an open assessment just because a newer implementation task arrived.
- For promo-video revisions, do not assume the existing scene timings still fit after narration changes; re-check each scene boundary against the updated voiceover and verify that every screenshot still matches the spoken feature.
- For promo-video narration edits, confirm that the final CTA line still has dedicated audio time and a dedicated closing visual; do not let it disappear by folding it into a preceding feature scene.
- For GitHub repo-homepage media updates, distinguish between a downloadable repository video file and a homepage-visible embedded video; use a `github.com/user-attachments/assets/...` URL when the user wants the video visible directly in the README page.
