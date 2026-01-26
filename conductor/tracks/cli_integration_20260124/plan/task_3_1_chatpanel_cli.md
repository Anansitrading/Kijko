# Task 3_1: Modify ChatPanel to Use CLIManager

**Phase:** 3
**Sequence:** 1
**Type:** SEQUENTIAL
**Agent Assignment:** general-purpose
**Blocking:** Yes
**Parallel With:** []

---

## Dependencies

**Depends On:**
- [ ] task_2_1_cli_manager (needs CLIManager class)
- [ ] task_1_2_settings_ASYNC (needs settings for config)

**Blocks:**
- [ ] task_4_1_tool_ui_ASYNC (chatPanel must emit tool events)
- [ ] task_4_2_fallback_ASYNC (needs CLI integration done first)

**Critical Path:** Yes

---

## Objective

Replace direct Anthropic API calls in `ChatPanel` with `CLIManager`-based subprocess communication. This is the main integration point where chat messages are sent to Claude Code CLI.

---

## Implementation Steps

1. [ ] Read existing `src/chatPanel.ts` to understand current API flow
2. [ ] Add `CLIManager` import
3. [ ] Add `cliManager: CLIManager | null` property
4. [ ] Create `_processWithCLI(userMessage: ChatMessage): Promise<void>`:
   - Initialize CLIManager with workspace path
   - Set allowed tools from config
   - Set continueSession based on message count
   - Wire up 'stream' events to webview postMessage
   - Wire up 'complete' event to finalize message
   - Wire up 'error' event to show error
5. [ ] Modify `_processWithClaude()` to use `_processWithCLI()`
6. [ ] Implement `_buildPromptWithAttachments(message: ChatMessage): string`:
   - Start with message content
   - Append file attachments in markdown format
7. [ ] Update cancel functionality to call `cliManager.cancel()`
8. [ ] Update webview message handlers for new streaming format
9. [ ] Test streaming display in webview

---

## Verification Requirements

**Type:** INTEGRATION_TEST + PLAYWRIGHT_E2E

**Requirements:**
- [ ] CLI used instead of direct API calls
- [ ] Streaming works to webview
- [ ] Conversation continues across messages (--continue)
- [ ] File attachments included in prompt
- [ ] Cancel button stops CLI process
- [ ] Error handling displays errors in chat

**Acceptance Criteria:**
- ✅ User message triggers CLIManager
- ✅ Response streams to chat panel
- ✅ Multiple messages maintain context
- ✅ Attachments visible in prompt

**Automation Script:**
```bash
npm run compile && npm run lint
# Manual verification required for webview testing
```

---

## Enhancement Queries

**Query 1 (Priority: high):**
```
VS Code webview postMessage streaming patterns for real-time chat updates
```

**Query 2 (Priority: medium):**
```
Claude Code CLI --continue flag session management best practices
```

---

## Files Modified/Created

- [ ] `src/chatPanel.ts` (MODIFY - major changes)

---

## Commit Message

```
feat(chat): integrate CLIManager for Claude Code CLI communication

Replace direct API calls with CLIManager subprocess communication.
Add streaming support, conversation continuation, and file attachments.
```

---

## Git Note

```
Task: task_3_1_chatpanel_cli
Summary: Major refactor of chatPanel to use CLI
Verification: Manual webview testing, streaming works
Context: Critical path, largest code change in this track
```

---

## Risk Assessment

**Risk Level:** HIGH

**Potential Risks:**
- Risk 1: Breaking existing chat functionality → Mitigation: Keep API code as fallback
- Risk 2: Webview message format incompatibility → Mitigation: Update webview JS
- Risk 3: Memory leaks from event listeners → Mitigation: Proper cleanup in dispose

**Critical Blocker:** Yes - core integration

---

## Context Cost Estimate

**Estimated Tokens:** ~15,000 tokens
**Tool Calls:** 15-25 expected
**Agent Session:** Long (60-90 min)

---

## Status Tracking

**Status:** [x] Complete
**Assigned Agent:** conductor
**Started:** 2026-01-24
**Completed:** 2026-01-24
**Checkpoint SHA:** fa32e06
