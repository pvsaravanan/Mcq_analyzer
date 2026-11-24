---
name: lms-browser-assistant
description: Token-efficient LMS quiz workflow using Claude in Chrome: inspect questions, reason, select answers, navigate, and report completion.
---

# LMS Browser Assistant

Use Claude in Chrome to work through the user's LMS quiz with low token usage and minimal browser interactions.

## Start

- If the quiz URL is missing, ask: "What is the LMS quiz URL?"
- Do not ask whether it is practice, graded, or proctored.
- Check for Claude in Chrome tools. If unavailable, guide the user to install the official extension at https://chromewebstore.google.com/detail/claude-in-chrome/ . The user must approve installation and permissions; do not claim it installed until verified.
- Claude Code: use Chrome support (for example `claude --chrome`) and `/chrome` to connect/select a tab if prompted.
- Claude Desktop: enable Claude in Chrome in settings/connectors if available in that version.
- If login is required, ask the user to sign in manually. Never request credentials or session tokens.

## Token-efficient operating rules

Treat low token consumption as a primary requirement.

1. Be terse. Do not narrate routine actions, explain answers, restate the question, or send per-question progress updates.
2. Use the smallest browser read that provides the needed information. Prefer a focused accessibility snapshot or targeted visible content over a full-page DOM dump.
3. Do not request or repeat the entire page text when only the current question and its options are needed.
4. Do not inspect headers, footers, menus, unrelated page regions, or other tabs unless they affect the quiz.
5. Read each question and its options once. Reuse that information for reasoning and selection; do not reread unchanged content.
6. After clicking Next, inspect only enough content to identify the next question, its options, and whether the page has advanced.
7. Avoid screenshots unless text/accessibility data is insufficient or the question depends on visual content.
8. Avoid arbitrary waits. Wait only for a real navigation or loading state, then take one concise check.
9. If several questions are visible on one page, process them in one pass and submit that page's answers together when the LMS supports it.
10. Do not produce verbose chain-of-thought or answer explanations. Make the decision internally and interact with the page.
11. Keep progress state compact: current question, answered count, skipped/uncertain count, and submission status. Do not maintain a transcript of every question unless necessary to recover from an error.
12. Do not use overlapping browser actions. Use sequential actions and the minimum verification needed to avoid acting on a stale page.
13. Never trade away correctness: if required content is missing, unreadable, or ambiguous, ask one concise clarification instead of guessing.

## Quiz loop

For each question or page:

1. Extract only the question, its options, question type, and necessary visual context.
2. Determine the best-supported answer.
3. Select the exact option(s).
4. Verify the selected state with a minimal targeted check.
5. Click the normal Next control.
6. Confirm the question changed with a concise targeted read.
7. Repeat until the final page.

Do not ask the user to approve each answer. Do not overwrite an existing answer unless needed to correct it. Do not interact with unrelated tabs.

## Final submission

At the final page, give a one-line status with answered and skipped/uncertain counts. Ask for explicit confirmation before an irreversible final action such as Submit, Finish attempt, or Submit all and finish. After confirmation, submit once and verify the LMS completion state. Never claim submission succeeded without visible confirmation.

## Browser and safety constraints

- Use only browser tools exposed by Claude in Chrome. Do not invent tool names or undocumented APIs.
- Do not use hidden endpoints, page scripts, or other methods to bypass LMS restrictions, login, CAPTCHA, proctoring, or access controls.
- Stop if the user interrupts or asks to stop.
- CLI and Desktop may not share the same live tab group or browser-control session. If the intended tab is not visible, ask the user to open or attach it.

## Completion

Send a concise completion notice: quiz title, answered count, skipped/uncertain count, and whether final submission was confirmed.
