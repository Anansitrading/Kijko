# Task 2_1: Create CLI Manager Module

**Phase:** 2
**Sequence:** 1
**Type:** SEQUENTIAL
**Agent Assignment:** general-purpose
**Blocking:** Yes
**Parallel With:** []

---

## Dependencies

**Depends On:**
- [ ] task_1_1_stream_parser_ASYNC (needs parser for output)

**Blocks:**
- [ ] task_3_1_chatpanel_cli (needs CLIManager class)

**Critical Path:** Yes

---

## Objective

Create `src/cliManager.ts` module to manage spawning and communicating with headless Claude Code CLI processes. This is the core integration layer.

---

## Implementation Steps

1. [ ] Create `src/cliManager.ts` file
2. [ ] Define interfaces:
   - `CLIStreamEvent`: type, content, timestamp
   - `CLIManagerOptions`: workingDirectory, allowedTools, systemPrompt, continueSession, timeout
3. [ ] Implement `CLIManager` class extending `EventEmitter`:
   - Constructor accepts `CLIManagerOptions`
   - `sendPrompt(prompt: string): Promise<void>` - spawn CLI process
   - `cancel(): void` - kill process with SIGTERM
   - `get processing(): boolean` - check if busy
4. [ ] Implement `buildArgs(prompt: string): string[]`:
   - Add `-p` for print mode
   - Add `--output-format stream-json`
   - Add `--allowedTools` if specified
   - Add `--append-system-prompt` if specified
   - Add `--continue` if session continuation
5. [ ] Wire up process events:
   - `stdout.on('data')` → emit 'stream' events (use streamParser)
   - `stderr.on('data')` → emit 'stream' error events
   - `on('close')` → emit 'complete'
   - `on('error')` → emit 'error'
6. [ ] Add timeout handling with configurable duration
7. [ ] Add JSDoc documentation

---

## Verification Requirements

**Type:** INTEGRATION_TEST

**Requirements:**
- [ ] CLI process spawns correctly
- [ ] stdout streams to events
- [ ] stderr captured for errors
- [ ] Process cancellation works
- [ ] Timeout handling works
- [ ] Multiple sequential prompts work

**Acceptance Criteria:**
- ✅ `sendPrompt()` spawns claude process
- ✅ Events emitted correctly during streaming
- ✅ `cancel()` terminates process
- ✅ Timeout triggers after configured duration

**Automation Script:**
```bash
npm run compile && node -e "
const { CLIManager } = require('./out/cliManager');
const mgr = new CLIManager({ workingDirectory: process.cwd() });
mgr.on('stream', e => console.log('STREAM:', e.type));
mgr.on('complete', () => { console.log('COMPLETE'); process.exit(0); });
mgr.on('error', e => { console.error('ERROR:', e); process.exit(1); });
mgr.sendPrompt('Say hello in one word');
"
```

---

## Enhancement Queries

**Query 1 (Priority: high):**
```
Node.js child_process spawn best practices for CLI subprocess management with EventEmitter streaming
```

**Query 2 (Priority: medium):**
```
Claude Code CLI headless mode --output-format stream-json integration patterns
```

---

## Files Modified/Created

- [ ] `src/cliManager.ts` (CREATE)

---

## Commit Message

```
feat(cli): add CLI process manager with EventEmitter streaming

Implement CLIManager class to spawn and communicate with
Claude Code CLI in headless mode using stream-json output.
```

---

## Git Note

```
Task: task_2_1_cli_manager
Summary: Created CLIManager with process lifecycle handling
Verification: Integration test with live CLI
Context: Sequential task, blocks chatPanel integration
```

---

## Risk Assessment

**Risk Level:** HIGH

**Potential Risks:**
- Risk 1: Process hangs indefinitely → Mitigation: Configurable timeout
- Risk 2: Buffer overflow on large output → Mitigation: Stream processing, no buffering
- Risk 3: Zombie processes on crash → Mitigation: Process cleanup in dispose()

**Critical Blocker:** Yes - core component

---

## Context Cost Estimate

**Estimated Tokens:** ~8,000 tokens
**Tool Calls:** 10-15 expected
**Agent Session:** Long (45-60 min)

---

## Status Tracking

**Status:** [x] Complete
**Assigned Agent:** conductor
**Started:** 2026-01-24
**Completed:** 2026-01-24
**Checkpoint SHA:** 25bcd38
