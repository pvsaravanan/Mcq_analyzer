# LMS Browser Assistant v1.3

Token-efficiency update for Claude in Chrome.

## Install in Claude Code

```bash
rm -rf ~/.claude/skills/lms-browser-assistant
mkdir -p ~/.claude/skills
unzip ~/Downloads/lms-browser-assistant-v1.3.zip -d /tmp/
cp -R /tmp/lms-browser-assistant ~/.claude/skills/
```

Restart Claude Code and invoke `/lms-browser-assistant`.

## Token-saving behavior

The skill requests focused question-level browser reads, avoids full-page DOM dumps and repeated reads, prefers accessibility data to screenshots, avoids per-question narration, uses compact progress counters, and skips arbitrary waits.

**Limit:** Token usage cannot be guaranteed to a fixed number. It depends on question length, page complexity, browser-tool output, and how much reasoning a question requires. The skill minimizes avoidable input/output tokens without guessing or skipping necessary content.

## Browser setup

If browser tools are unavailable, the skill guides installation from the official Chrome Web Store. The user must approve extension installation and permissions. Sign into the LMS manually.

For Claude Code, use Chrome support (for example `claude --chrome`) and `/chrome` to connect/select a tab if needed. For Claude Desktop, enable the integration in settings if available. CLI and Desktop may not share the same live tab group.

## Final submission

The skill asks once for confirmation before an irreversible final Submit action, then verifies the LMS completion state.
