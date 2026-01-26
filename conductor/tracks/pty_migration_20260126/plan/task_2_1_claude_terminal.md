# Task 2_1: Create Pseudoterminal with Byte Pump

**Phase:** 2
**Sequence:** 1
**Type:** SEQUENTIAL
**Critical Path:** Yes

---

## Dependencies

**Depends On:** task_1_1 (PTY manager), task_1_2 (cold path processor)
**Blocks:** task_3_1 (extension registration), task_3_2 (dual mode)

---

## Objective

Create `src/claudeTerminal.ts` - implements VS Code's `Pseudoterminal` interface with the hot path byte pump pattern. This is the core of the new architecture.

---

## Implementation Steps

1. [ ] Create `src/claudeTerminal.ts`
2. [ ] Implement `createClaudePty()` function returning `vscode.Pseudoterminal`:
   ```typescript
   export function createClaudePty(options?: ClaudeTerminalOptions): vscode.Pseudoterminal {
     const writeEmitter = new vscode.EventEmitter<string>();
     const closeEmitter = new vscode.EventEmitter<number | void>();
     const coldPath = new ColdPathProcessor();
     let ptyProcess: pty.IPty | undefined;

     return {
       onDidWrite: writeEmitter.event,
       onDidClose: closeEmitter.event,

       open(initialDimensions) {
         // Spawn Claude under real PTY
         ptyProcess = pty.spawn('claude', [], {
           name: 'xterm-256color',
           cols: initialDimensions?.columns ?? 80,
           rows: initialDimensions?.rows ?? 24,
           cwd: options?.cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
           env: process.env,
         });

         // HOT PATH: Raw bytes straight through
         ptyProcess.onData((data: string) => {
           writeEmitter.fire(data);  // Zero processing
           setImmediate(() => coldPath.ingest(data));  // Cold path tee
         });

         ptyProcess.onExit(({ exitCode }) => {
           coldPath.dispose();
           closeEmitter.fire(exitCode);
         });
       },

       close() { ptyProcess?.kill(); coldPath.dispose(); },
       handleInput(data: string) { ptyProcess?.write(data); },
       setDimensions(dims) { ptyProcess?.resize(dims.columns, dims.rows); },
     };
   }
   ```
3. [ ] `ClaudeTerminalOptions` interface:
   ```typescript
   interface ClaudeTerminalOptions {
     cwd?: string;
     args?: string[];
     onToolCall?: (event: ToolCallEvent) => void;
     onStatus?: (event: StatusEvent) => void;
   }
   ```
4. [ ] Wire cold path events to options callbacks
5. [ ] Add OAuth token refresh call before spawning (call ensureValidToken())

---

## Key Constraints

- Hot path is TWO lines only: `writeEmitter.fire(data)` and `ptyProcess.write(data)`
- NO parsing, transforms, or buffering in the hot path
- Cold path runs via `setImmediate()` - never blocks render
- node-pty is NOT thread safe - keep in main thread

---

## Verification

- [ ] `vscode.window.createTerminal({ pty: createClaudePty() })` opens Claude interactive REPL
- [ ] Typing works bidirectionally
- [ ] Terminal resize works
- [ ] Cold path receives data without blocking terminal rendering
- [ ] TypeScript compilation succeeds
