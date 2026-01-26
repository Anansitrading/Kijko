# Task 4_3: Add CLI vs API Mode Indicator

**Phase:** 4
**Sequence:** 3
**Type:** ASYNC
**Agent Assignment:** general-purpose
**Blocking:** No
**Parallel With:** [task_4_1_tool_ui_ASYNC, task_4_2_fallback_ASYNC]

---

## Dependencies

**Depends On:**
- [ ] task_3_1_chatpanel_cli (CLI integration complete)
- [ ] task_4_2_fallback_ASYNC (fallback logic available)

**Blocks:**
- (none)

**Critical Path:** No

---

## Objective

Add a visual indicator in the chat panel header showing whether CLI or API mode is active. This helps users understand how Claude is being invoked.

---

## Implementation Steps

1. [ ] Add mode indicator HTML to chat panel header:
   ```html
   <div class="mode-indicator cli" title="Using Claude Code CLI">
     <span class="mode-icon">⚡</span>
     <span class="mode-text">CLI</span>
   </div>
   <!-- or -->
   <div class="mode-indicator api" title="Using Anthropic API">
     <span class="mode-icon">🔌</span>
     <span class="mode-text">API</span>
   </div>
   ```
2. [ ] Add CSS styling for indicators:
   - CLI mode: Green/blue accent
   - API mode: Orange/yellow accent
3. [ ] Update indicator when mode changes
4. [ ] Add tooltip explaining the mode
5. [ ] Send mode info from extension to webview

---

## Verification Requirements

**Type:** PLAYWRIGHT_SCREENSHOT

**Requirements:**
- [ ] Indicator visible in chat header
- [ ] Shows correct mode (CLI vs API)
- [ ] Tooltip explains mode
- [ ] Styled consistently with UI

**Acceptance Criteria:**
- ✅ Indicator always visible
- ✅ Accurate mode display
- ✅ Helpful tooltip

**Automation Script:**
```bash
npm run compile
# Manual: check indicator in both CLI and API modes
```

---

## Files Modified/Created

- [ ] `src/chatPanel.ts` (MODIFY - webview HTML/CSS)

---

## Commit Message

```
feat(ui): add CLI vs API mode indicator to chat panel

Display visual indicator showing whether CLI or API
mode is active for Claude communication.
```

---

## Git Note

```
Task: task_4_3_ui_indicator_ASYNC
Summary: Added mode indicator to chat header
Verification: Screenshot shows indicator
Context: Parallel with tool UI and fallback tasks
```

---

## Risk Assessment

**Risk Level:** LOW

**Potential Risks:**
- Risk 1: Header space constraints → Mitigation: Compact design

**Critical Blocker:** No

---

## Context Cost Estimate

**Estimated Tokens:** ~2,500 tokens
**Tool Calls:** 3-5 expected
**Agent Session:** Short (15-20 min)

---

## Status Tracking

**Status:** [x] Complete
**Assigned Agent:** opus-4.5
**Started:** 2026-01-24
**Completed:** 2026-01-24
**Checkpoint SHA:** a48b9dc
