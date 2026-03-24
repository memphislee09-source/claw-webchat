# Lessons

- When a user says the core bug is fixed but the UI still feels too dense, treat that as a finishing pass request and tighten the presentation instead of stopping at functional correctness.

- When running visual experiments, keep each change isolated and easy to revert so the user can compare one variable at a time.
- For mixed text-and-media layout changes, do not assume a more aggressive "full-bleed" rule is better; preserve the previous balance unless the user confirms the new look wins in real usage.
- For new composer-side controls, default to a lighter text weight first; utility buttons should read as part of the tool chrome, not louder than the message input or send action.
- When a new user request interrupts an unfinished investigation, explicitly say whether the previous task is being paused or superseded. Do not silently drop an open assessment just because a newer implementation task arrived.
