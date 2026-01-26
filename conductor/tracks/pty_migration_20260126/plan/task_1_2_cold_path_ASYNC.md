# Task 1_2: Create Cold Path Processor

**Phase:** 1
**Sequence:** 2
**Type:** ASYNC
**Parallel With:** [task_1_1]

---

## Dependencies

**Depends On:** task_0_1
**Blocks:** task_2_1 (claude terminal uses cold path)

---

## Objective

Create `src/coldPathProcessor.ts` - processes terminal output asynchronously without blocking the hot path rendering. Extracts tool calls, status updates, and structured data.

---

## Implementation Steps

1. [ ] Create `src/coldPathProcessor.ts`
2. [ ] Create `ColdPathProcessor` class:
   ```typescript
   export class ColdPathProcessor implements vscode.Disposable {
     private buffer: string = '';

     ingest(chunk: string): void     // Fire-and-forget from hot path
     onToolCall: vscode.Event<ToolCallEvent>
     onStatusChange: vscode.Event<StatusEvent>
     dispose(): void
   }
   ```
3. [ ] `ingest()` must be non-blocking - use `setImmediate()`:
   ```typescript
   ingest(chunk: string) {
     setImmediate(() => this._process(chunk));
   }
   ```
4. [ ] `_process()` accumulates buffer and extracts:
   - Tool call JSON objects (for status bar/tree view updates)
   - Error messages
   - Completion signals
5. [ ] Define event types:
   ```typescript
   interface ToolCallEvent { tool: string; input: any; }
   interface StatusEvent { status: 'thinking' | 'tool_use' | 'done' | 'error'; message?: string; }
   ```
6. [ ] Add ANSI strip utility for clean text extraction

---

## Verification

- [ ] Ingesting chunks does NOT block caller
- [ ] Can extract tool call JSON from mixed ANSI+text stream
- [ ] Events fire correctly
- [ ] TypeScript compilation succeeds
