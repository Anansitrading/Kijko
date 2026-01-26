# Task 4_1: Display Tool Use in Chat Webview

**Phase:** 4
**Sequence:** 1
**Type:** ASYNC
**Agent Assignment:** general-purpose
**Blocking:** No
**Parallel With:** [task_4_2_fallback_ASYNC, task_4_3_ui_indicator_ASYNC]

---

## Dependencies

**Depends On:**
- [ ] task_3_1_chatpanel_cli (chatPanel must emit tool events)

**Blocks:**
- (none)

**Critical Path:** No

---

## Objective

Update the chat webview to display tool use indicators and results when Claude Code CLI uses tools like Read, Edit, Bash, etc.

---

## Implementation Steps

1. [ ] Update webview script in `chatPanel.ts` to handle tool events:
   - Add `case 'toolUse':` message handler
   - Add `case 'toolResult':` message handler
2. [ ] Create tool indicator HTML/CSS:
   ```html
   <div class="tool-indicator">
     <span class="tool-icon">🔧</span>
     <span class="tool-name">Using Read...</span>
   </div>
   ```
3. [ ] Style tool indicators to match VS Code theme:
   - Subtle background color
   - Monospace font for tool names
   - Collapsible for tool results
4. [ ] Update CLIManager to parse and emit tool_use events
5. [ ] Add collapsible section for tool results (optional)

---

## Verification Requirements

**Type:** PLAYWRIGHT_SCREENSHOT

**Requirements:**
- [ ] Tool use indicator appears during execution
- [ ] Tool name displayed correctly
- [ ] Results shown (optionally collapsible)
- [ ] Styling matches VS Code theme

**Acceptance Criteria:**
- ✅ Tool use visible in chat
- ✅ Multiple tools shown sequentially
- ✅ No visual glitches

**Automation Script:**
```bash
npm run compile
# Manual verification: trigger tool use, check display
```

---

## Files Modified/Created

- [ ] `src/chatPanel.ts` (MODIFY - webview HTML/JS)

---

## Commit Message

```
feat(ui): display tool use indicators in chat panel

Add visual indicators for Claude Code CLI tool usage
with collapsible results section.
```

---

## Git Note

```
Task: task_4_1_tool_ui_ASYNC
Summary: Added tool use display to chat webview
Verification: Screenshot shows tool indicators
Context: Parallel with fallback and UI indicator tasks
```

---

## Risk Assessment

**Risk Level:** LOW

**Potential Risks:**
- Risk 1: CSS conflicts with VS Code theme → Mitigation: Use CSS variables

**Critical Blocker:** No

---

## Context Cost Estimate

**Estimated Tokens:** ~5,000 tokens
**Tool Calls:** 5-8 expected
**Agent Session:** Medium (25-35 min)

---

## Status Tracking

**Status:** [x] Complete
**Assigned Agent:** opus-4.5
**Started:** 2026-01-24
**Completed:** 2026-01-24
**Checkpoint SHA:** a48b9dc
