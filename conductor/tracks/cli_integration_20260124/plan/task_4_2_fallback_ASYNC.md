# Task 4_2: Implement API Fallback Logic

**Phase:** 4
**Sequence:** 2
**Type:** ASYNC
**Agent Assignment:** general-purpose
**Blocking:** No
**Parallel With:** [task_4_1_tool_ui_ASYNC, task_4_3_ui_indicator_ASYNC]

---

## Dependencies

**Depends On:**
- [ ] task_3_1_chatpanel_cli (CLI integration complete)
- [ ] task_3_2_agent_config (config plumbing done)

**Blocks:**
- (none)

**Critical Path:** No

---

## Objective

Add fallback to direct Anthropic API when Claude Code CLI is not available. This ensures the extension works even without CLI installed.

---

## Implementation Steps

1. [ ] Keep existing API code in chatPanel.ts as `_processWithAPI()`
2. [ ] Modify `_processWithClaude()` to check CLI availability:
   ```typescript
   const config = vscode.workspace.getConfiguration('claudeAgentSpawner');
   const useCLI = config.get<boolean>('useClaudeCLI', true);
   const cliInfo = await detectClaudeCode();

   if (useCLI && cliInfo.installed) {
       await this._processWithCLI(userMessage);
   } else {
       if (useCLI && !cliInfo.installed) {
           vscode.window.showWarningMessage('CLI not found, using API');
       }
       await this._processWithAPI(userMessage);
   }
   ```
3. [ ] Cache CLI detection result (don't check every message)
4. [ ] Allow manual toggle via settings
5. [ ] Show notification when falling back

---

## Verification Requirements

**Type:** INTEGRATION_TEST

**Requirements:**
- [ ] Detects CLI availability at runtime
- [ ] Falls back gracefully when CLI unavailable
- [ ] User notified of fallback
- [ ] Settings toggle works
- [ ] API mode still functional

**Acceptance Criteria:**
- ✅ Extension works without CLI installed
- ✅ Warning shown on fallback
- ✅ Can manually disable CLI via settings

**Automation Script:**
```bash
npm run compile && npm run lint
# Manual: temporarily rename 'claude' binary, test fallback
```

---

## Files Modified/Created

- [ ] `src/chatPanel.ts` (MODIFY)

---

## Commit Message

```
feat(chat): add API fallback when CLI unavailable

Implement graceful fallback to direct Anthropic API
when Claude Code CLI is not installed or disabled.
```

---

## Git Note

```
Task: task_4_2_fallback_ASYNC
Summary: Added API fallback logic
Verification: Extension works without CLI
Context: Parallel with tool UI and indicator tasks
```

---

## Risk Assessment

**Risk Level:** MEDIUM

**Potential Risks:**
- Risk 1: API key not configured → Mitigation: Check for API key in fallback path
- Risk 2: Different response formats → Mitigation: Normalize in message handling

**Critical Blocker:** No

---

## Context Cost Estimate

**Estimated Tokens:** ~4,000 tokens
**Tool Calls:** 5-8 expected
**Agent Session:** Medium (25-35 min)

---

## Status Tracking

**Status:** [x] Complete
**Assigned Agent:** opus-4.5
**Started:** 2026-01-24
**Completed:** 2026-01-24
**Checkpoint SHA:** a48b9dc
