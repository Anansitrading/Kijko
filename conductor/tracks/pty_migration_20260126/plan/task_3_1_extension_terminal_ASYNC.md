# Task 3_1: Register Terminal Commands in Extension

**Phase:** 3
**Sequence:** 1
**Type:** ASYNC
**Parallel With:** [task_3_2]

---

## Dependencies

**Depends On:** task_2_1 (claude terminal), task_2_2 (oauth refresh)
**Blocks:** task_4_1, task_4_2

---

## Objective

Update `src/extension.ts` to register a command that opens Claude Code as a VS Code terminal using the PTY Pseudoterminal.

---

## Implementation Steps

1. [ ] Import `createClaudePty` from `./claudeTerminal`
2. [ ] Register command `claudeAgentSpawner.openTerminal`:
   ```typescript
   context.subscriptions.push(
     vscode.commands.registerCommand('claudeAgentSpawner.openTerminal', () => {
       const terminal = vscode.window.createTerminal({
         name: 'Claude Code',
         pty: createClaudePty({ cwd: workspaceRoot }),
       });
       terminal.show();
     })
   );
   ```
3. [ ] Add command to `package.json` contributes.commands:
   ```json
   {
     "command": "claudeAgentSpawner.openTerminal",
     "title": "Open Claude Code Terminal",
     "icon": "$(terminal)"
   }
   ```
4. [ ] Add keybinding (optional): `Ctrl+Shift+C` for open terminal
5. [ ] Keep existing chat panel command working alongside terminal

---

## Verification

- [ ] Command palette shows "Open Claude Code Terminal"
- [ ] Running command opens interactive Claude REPL in terminal panel
- [ ] Terminal supports full interactive usage (typing, scrolling, resize)
- [ ] Multiple terminals can be opened
- [ ] TypeScript compilation succeeds
