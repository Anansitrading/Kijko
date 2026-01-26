# Master Implementation Plan: PTY Byte-Pump Architecture

**Generated:** 2026-01-26
**Track ID:** pty_migration_20260126
**Total Tasks:** 9
**Total Phases:** 5
**Total Waves:** 5

---

## Architecture Overview

Replace spawn() + stdio with node-pty + VS Code Pseudoterminal API for native-speed
Claude Code integration. Two execution paths:

- **Hot path** (<1ms): `pty.onData(chunk) → writeEmitter.fire(chunk)` — zero processing
- **Cold path** (async): `setImmediate(() => processor.ingest(chunk))` — parsing, UI updates

Source: https://poe.com/s/8HnHwPwfTTe9S6gPjZMo

---

## Execution Sequence

### Wave 0: Prerequisites (SEQUENTIAL)

| Task | File | Type | Description |
|------|------|------|-------------|
| 0_1 | [task_0_1_install_node_pty.md](./plan/task_0_1_install_node_pty.md) | SEQUENTIAL | Install node-pty and configure build |

**Checkpoint:** `conductor(checkpoint): Complete Wave 0 - node-pty installed`

---

### Wave 1: Foundation (ASYNC)

**Max Agents:** 2

| Task | File | Type | Description |
|------|------|------|-------------|
| 1_1 | [task_1_1_pty_manager_ASYNC.md](./plan/task_1_1_pty_manager_ASYNC.md) | ASYNC | Create PTY process manager |
| 1_2 | [task_1_2_cold_path_ASYNC.md](./plan/task_1_2_cold_path_ASYNC.md) | ASYNC | Create cold path processor |

**Checkpoint:** `conductor(checkpoint): Complete Wave 1 - Foundation modules`

---

### Wave 2: Core Terminal (SEQUENTIAL)

| Task | File | Type | Description |
|------|------|------|-------------|
| 2_1 | [task_2_1_claude_terminal.md](./plan/task_2_1_claude_terminal.md) | SEQUENTIAL | Create Pseudoterminal with byte pump |
| 2_2 | [task_2_2_oauth_refresh.md](./plan/task_2_2_oauth_refresh.md) | SEQUENTIAL | OAuth token auto-refresh before spawn |

**Checkpoint:** `conductor(checkpoint): Complete Wave 2 - Terminal + Auth`

---

### Wave 3: Integration (ASYNC)

**Max Agents:** 2

| Task | File | Type | Description |
|------|------|------|-------------|
| 3_1 | [task_3_1_extension_terminal_ASYNC.md](./plan/task_3_1_extension_terminal_ASYNC.md) | ASYNC | Register terminal commands in extension.ts |
| 3_2 | [task_3_2_dual_mode_ASYNC.md](./plan/task_3_2_dual_mode_ASYNC.md) | ASYNC | ChatPanel dual-mode: PTY interactive + headless print |

**Checkpoint:** `conductor(checkpoint): Complete Wave 3 - Integration`

---

### Wave 4: Polish (ASYNC)

**Max Agents:** 2

| Task | File | Type | Description |
|------|------|------|-------------|
| 4_1 | [task_4_1_bundle_config_ASYNC.md](./plan/task_4_1_bundle_config_ASYNC.md) | ASYNC | Configure bundling for node-pty native bindings |
| 4_2 | [task_4_2_cleanup_ASYNC.md](./plan/task_4_2_cleanup_ASYNC.md) | ASYNC | Remove old spawn code, clean up dead paths |

**Checkpoint:** `conductor(checkpoint): Complete PTY Migration Track`

---

## Critical Path

```
task_0_1_install_node_pty
        │
        ├──────────────────────┐
        ▼                      ▼
task_1_1_pty_manager    task_1_2_cold_path
        │                      │
        └──────────┬───────────┘
                   ▼
        task_2_1_claude_terminal
                   │
                   ▼
        task_2_2_oauth_refresh
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
task_3_1_extension    task_3_2_dual_mode
        │                     │
        └──────────┬──────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
task_4_1_bundle       task_4_2_cleanup
```

---

## Files Summary

| Action | File | Task |
|--------|------|------|
| MODIFY | `package.json` | task_0_1 |
| CREATE | `src/ptyManager.ts` | task_1_1 |
| CREATE | `src/coldPathProcessor.ts` | task_1_2 |
| CREATE | `src/claudeTerminal.ts` | task_2_1 |
| MODIFY | `src/chatPanel.ts` | task_2_2, task_3_2 |
| MODIFY | `src/extension.ts` | task_3_1 |
| CREATE | `webpack.config.js` or update build | task_4_1 |
| MODIFY | `src/chatPanel.ts` | task_4_2 |

---

**Track ID:** pty_migration_20260126
**Status:** Ready for Implementation
