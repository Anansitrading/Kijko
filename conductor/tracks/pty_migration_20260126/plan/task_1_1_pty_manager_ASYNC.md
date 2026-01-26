# Task 1_1: Create PTY Process Manager

**Phase:** 1
**Sequence:** 1
**Type:** ASYNC
**Parallel With:** [task_1_2]

---

## Dependencies

**Depends On:** task_0_1 (node-pty installed)
**Blocks:** task_2_1 (claude terminal needs PTY manager)

---

## Objective

Create `src/ptyManager.ts` - a manager that spawns Claude Code under a real PTY using node-pty, handles lifecycle, resize, and cleanup.

---

## Implementation Steps

1. [ ] Create `src/ptyManager.ts`
2. [ ] Import `node-pty` with proper typing:
   ```typescript
   import * as pty from 'node-pty';
   ```
3. [ ] Create `PtyManager` class:
   ```typescript
   export class PtyManager implements vscode.Disposable {
     private ptyProcess: pty.IPty | undefined;

     spawn(command: string, args: string[], options: PtySpawnOptions): pty.IPty
     resize(cols: number, rows: number): void
     write(data: string): void
     kill(): void
     dispose(): void
   }
   ```
4. [ ] `PtySpawnOptions` interface:
   ```typescript
   interface PtySpawnOptions {
     cwd?: string;
     env?: Record<string, string>;
     cols?: number;
     rows?: number;
   }
   ```
5. [ ] Implement spawn with defaults:
   - `name: 'xterm-256color'`
   - `cols: 80, rows: 24`
   - `cwd: workspace folder`
   - `env: process.env`
6. [ ] Add `onData` and `onExit` event forwarding
7. [ ] Implement proper cleanup in `dispose()` - kill process, remove listeners

---

## Verification

- [ ] Can spawn `echo hello` via PTY and receive output
- [ ] Resize works without error
- [ ] Dispose kills the process cleanly
- [ ] TypeScript compilation succeeds
