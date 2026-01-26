# Kijko Dependency Analysis: PTY Migration

**Generated:** 2026-01-26
**Source:** https://poe.com/s/8HnHwPwfTTe9S6gPjZMo
**Nodes:** 18 (14 existing + 4 new)
**Waves:** 5

---

## Architecture: PTY Byte-Pump

Replace `spawn()` + stdio with `node-pty` + VS Code `Pseudoterminal` API.

```
HOT PATH (<1ms):  pty.onData(chunk) → writeEmitter.fire(chunk)
COLD PATH (async): setImmediate(() => processor.ingest(chunk))
```

## New Module Map

| Module | Layer | Purpose |
|--------|-------|---------|
| `ptyManager.ts` | Infrastructure | Spawn Claude under real PTY via node-pty |
| `coldPathProcessor.ts` | Application | Async processing: tool calls, status, parsing |
| `claudeTerminal.ts` | Presentation | VS Code Pseudoterminal with byte pump |
| `oauthRefresh.ts` | Infrastructure | Auto-refresh expired OAuth tokens |

## Wave Execution Plan

| Wave | Type | Tasks | Parallel |
|------|------|-------|----------|
| 0 | SEQ | Install node-pty | 1 agent |
| 1 | ASYNC | ptyManager + coldPathProcessor | 2 agents |
| 2 | SEQ | claudeTerminal + oauthRefresh | 1 agent |
| 3 | ASYNC | extension terminal + dual mode | 2 agents |
| 4 | ASYNC | bundle config + cleanup | 2 agents |

## Critical Path

```
extension.ts → claudeTerminal.ts → ptyManager.ts → node-pty (native C++)
```

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| node-pty native build fails | HIGH | Fallback to spawn() headless |
| OAuth token expires | MEDIUM | Auto-refresh before spawn |
| xterm.js rendering slow | LOW | VS Code limitation, can't fix |
| node-pty not thread-safe | LOW | Keep in main thread |
