# Task 3_2: Update AgentManager with CLI Config

**Phase:** 3
**Sequence:** 2
**Type:** SEQUENTIAL
**Agent Assignment:** general-purpose
**Blocking:** No
**Parallel With:** []

---

## Dependencies

**Depends On:**
- [ ] task_3_1_chatpanel_cli (chatPanel accepts useClaudeCLI flag)

**Blocks:**
- [ ] task_4_2_fallback_ASYNC (needs config plumbing done)

**Critical Path:** No

---

## Objective

Update `AgentManager` to pass CLI configuration to `ChatPanel`, including the working directory (worktree path) and `useClaudeCLI` flag.

---

## Implementation Steps

1. [ ] Read existing `src/agentManager.ts`
2. [ ] Add `useClaudeCLI?: boolean` to `ChatPanelConfig` interface
3. [ ] In `spawnAgent()` method:
   - Read `claudeAgentSpawner.useClaudeCLI` from VS Code config
   - Pass worktree path as `workspacePath` (not workspace root)
   - Pass `useClaudeCLI: true` to ChatPanelConfig
4. [ ] Ensure worktree directory is created before passing to ChatPanel
5. [ ] Update agent status tracking for CLI-based agents

---

## Verification Requirements

**Type:** INTEGRATION_TEST

**Requirements:**
- [ ] Config option added to ChatPanelConfig interface
- [ ] AgentManager passes config correctly
- [ ] Worktree path used as working directory
- [ ] ChatPanel respects config

**Acceptance Criteria:**
- ✅ `useClaudeCLI` in config
- ✅ Worktree agents run CLI in worktree directory
- ✅ Non-worktree agents run CLI in workspace root

**Automation Script:**
```bash
npm run compile && npm run lint
```

---

## Files Modified/Created

- [ ] `src/agentManager.ts` (MODIFY)
- [ ] `src/chatPanel.ts` (MODIFY - interface only)

---

## Commit Message

```
feat(agent): pass CLI config and worktree path to ChatPanel

Update AgentManager to pass useClaudeCLI flag and correct
working directory to ChatPanel for CLI integration.
```

---

## Git Note

```
Task: task_3_2_agent_config
Summary: Added CLI config plumbing to AgentManager
Verification: Config flows to ChatPanel
Context: Enables worktree-aware CLI execution
```

---

## Risk Assessment

**Risk Level:** LOW

**Potential Risks:**
- Risk 1: Worktree path doesn't exist → Mitigation: Create if needed

**Critical Blocker:** No

---

## Context Cost Estimate

**Estimated Tokens:** ~3,000 tokens
**Tool Calls:** 3-5 expected
**Agent Session:** Short (15-20 min)

---

## Status Tracking

**Status:** [x] Complete
**Assigned Agent:** conductor
**Started:** 2026-01-24
**Completed:** 2026-01-24
**Checkpoint SHA:** fa32e06
