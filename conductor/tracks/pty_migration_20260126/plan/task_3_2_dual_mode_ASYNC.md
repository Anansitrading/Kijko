# Task 3_2: ChatPanel Dual Mode - PTY Interactive + Headless Print

**Phase:** 3
**Sequence:** 2
**Type:** ASYNC
**Parallel With:** [task_3_1]

---

## Dependencies

**Depends On:** task_2_1 (claude terminal), task_2_2 (oauth refresh)
**Blocks:** task_4_2

---

## Objective

Update ChatPanel to support two modes:
1. **Interactive mode**: Opens Claude in a VS Code terminal via PTY (default)
2. **Headless mode**: Uses `claude -p` with `spawn()` for programmatic request/response

---

## Implementation Steps

1. [ ] Add mode toggle in ChatPanel config:
   ```typescript
   interface ChatPanelConfig {
     // ... existing fields
     mode?: 'interactive' | 'headless';
   }
   ```
2. [ ] In `_processWithCLI()`, branch on mode:
   - **headless**: Keep existing spawn() + `--output-format json` code
   - **interactive**: Open PTY terminal, send prompt via `pty.write(prompt + '\n')`
3. [ ] For headless mode, keep `ensureValidToken()` call before spawn
4. [ ] For interactive mode, the PTY terminal handles auth internally
5. [ ] Add UI toggle in webview header for mode switch
6. [ ] Default to headless mode for chat panel (better for request/response pattern)
7. [ ] Default to interactive mode for terminal command

---

## Verification

- [ ] Chat panel works in headless mode (current behavior preserved)
- [ ] Chat panel can switch to interactive mode
- [ ] Interactive mode opens a real terminal
- [ ] TypeScript compilation succeeds
