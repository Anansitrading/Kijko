# Task 2_1: Initialize CLI Detection on Extension Activation

**Phase:** 2
**Sequence:** 1
**Type:** SEQUENTIAL
**Agent Assignment:** general-purpose
**Blocking:** No
**Parallel With:** []

---

## Dependencies

**Depends On:**
- [ ] task_0_1_cli_detector (needs detectClaudeCode function)

**Blocks:**
- (none)

**Critical Path:** No

---

## Objective

Integrate CLI detection into the extension activation flow. Show appropriate UI feedback when CLI is not installed.

---

## Implementation Steps

1. [ ] Read existing `src/extension.ts` activate function
2. [ ] Import `detectClaudeCode` from `./cliDetector`
3. [ ] Call `detectClaudeCode()` early in activate function
4. [ ] Store result for use by ChatPanel (context or global state)
5. [ ] If CLI not installed:
   - Show warning message with install link
   - Log to output channel
6. [ ] If CLI installed:
   - Log version to output channel
7. [ ] Add CLI status to status bar (optional)

---

## Verification Requirements

**Type:** SMOKE_TEST

**Requirements:**
- [ ] CLI status checked on activation
- [ ] Warning shown when CLI not installed
- [ ] Install link opens browser
- [ ] Version logged to output channel

**Acceptance Criteria:**
- ✅ Extension activates without error
- ✅ CLI detection runs silently on startup
- ✅ User informed if CLI missing

**Automation Script:**
```bash
npm run compile && npm run lint
# Manual verification: activate extension, check output channel
```

---

## Files Modified/Created

- [ ] `src/extension.ts` (MODIFY)

---

## Commit Message

```
feat(ext): add CLI detection on extension activation

Detect Claude Code CLI on startup and show warning
if not installed with link to installation docs.
```

---

## Git Note

```
Task: task_2_1_extension_init
Summary: Added CLI detection to extension activation
Verification: Warning appears when CLI missing
Context: Improves user experience with clear feedback
```

---

## Risk Assessment

**Risk Level:** LOW

**Potential Risks:**
- Risk 1: Slow detection blocks activation → Mitigation: Run async, don't await

**Critical Blocker:** No

---

## Context Cost Estimate

**Estimated Tokens:** ~2,500 tokens
**Tool Calls:** 3-5 expected
**Agent Session:** Short (15 min)

---

## Status Tracking

**Status:** [x] Complete
**Assigned Agent:** conductor
**Started:** 2026-01-24
**Completed:** 2026-01-24
**Checkpoint SHA:** 25bcd38
