# Master Implementation Plan: Headless CLI Integration

**Generated:** 2026-01-24
**Track ID:** cli_integration_20260124
**Total Tasks:** 10
**Total Phases:** 4
**Total Waves:** 5
**Estimated Duration:** 8-12 hours

---

## Quick Navigation

- [Dependency Graph](../../dependency_graph.dot)
- [Dependency Analysis](../../dependency_analysis.md)
- [Dependency Graph JSON](../../dependency_graph.json)

---

## Execution Sequence

### Wave 0: Prerequisites (SEQUENTIAL)

**Duration:** 1-2 hours

| Task | File | Type | Description |
|------|------|------|-------------|
| 0_1 | [task_0_1_cli_detector.md](./plan/task_0_1_cli_detector.md) | SEQUENTIAL | Create CLI detection module |

**Checkpoint:** `conductor(checkpoint): Complete Wave 0 - CLI Detector`

---

### Wave 1: Foundation (ASYNC)

**Duration:** 1-2 hours | **Max Agents:** 2

| Task | File | Type | Description |
|------|------|------|-------------|
| 1_1 | [task_1_1_stream_parser_ASYNC.md](./plan/task_1_1_stream_parser_ASYNC.md) | ASYNC | Create stream JSON parser |
| 1_2 | [task_1_2_settings_ASYNC.md](./plan/task_1_2_settings_ASYNC.md) | ASYNC | Add CLI settings to package.json |

**Checkpoint:** `conductor(checkpoint): Complete Wave 1 - Foundation`

---

### Wave 2: Core Integration (SEQUENTIAL)

**Duration:** 2-3 hours

| Task | File | Type | Description |
|------|------|------|-------------|
| 2_1 | [task_2_1_cli_manager.md](./plan/task_2_1_cli_manager.md) | SEQUENTIAL | Create CLI process manager |
| 2_2 | [task_2_1_extension_init.md](./plan/task_2_1_extension_init.md) | SEQUENTIAL | Initialize CLI detection on activation |

**Checkpoint:** `conductor(checkpoint): Complete Wave 2 - CLI Manager`

---

### Wave 3: ChatPanel Integration (SEQUENTIAL)

**Duration:** 2-3 hours

| Task | File | Type | Description |
|------|------|------|-------------|
| 3_1 | [task_3_1_chatpanel_cli.md](./plan/task_3_1_chatpanel_cli.md) | SEQUENTIAL | Modify ChatPanel to use CLIManager |
| 3_2 | [task_3_2_agent_config.md](./plan/task_3_2_agent_config.md) | SEQUENTIAL | Update AgentManager with CLI config |

**Checkpoint:** `conductor(checkpoint): Complete Wave 3 - ChatPanel Integration`

---

### Wave 4: Polish & Fallback (ASYNC)

**Duration:** 1-2 hours | **Max Agents:** 3

| Task | File | Type | Description |
|------|------|------|-------------|
| 4_1 | [task_4_1_tool_ui_ASYNC.md](./plan/task_4_1_tool_ui_ASYNC.md) | ASYNC | Display tool use in chat webview |
| 4_2 | [task_4_2_fallback_ASYNC.md](./plan/task_4_2_fallback_ASYNC.md) | ASYNC | Implement API fallback logic |
| 4_3 | [task_4_3_ui_indicator_ASYNC.md](./plan/task_4_3_ui_indicator_ASYNC.md) | ASYNC | Add CLI vs API mode indicator |

**Final Checkpoint:** `conductor(checkpoint): Complete CLI Integration Track`

---

## Critical Path

```
task_0_1_cli_detector
        │
        ▼
task_1_1_stream_parser ─────┐
        │                   │
        ▼                   │
task_2_1_cli_manager ◄──────┘
        │
        ▼
task_3_1_chatpanel_cli
        │
        ▼
    (complete)
```

**Critical Path Length:** 4 tasks
**Estimated Critical Path Duration:** 5-7 hours

---

## Parallelization Summary

| Wave | Type | Tasks | Max Agents | Duration |
|------|------|-------|------------|----------|
| 0 | SEQUENTIAL | 1 | 1 | 1-2 hrs |
| 1 | ASYNC | 2 | 2 | 1-2 hrs |
| 2 | SEQUENTIAL | 2 | 1 | 2-3 hrs |
| 3 | SEQUENTIAL | 2 | 1 | 2-3 hrs |
| 4 | ASYNC | 3 | 3 | 1-2 hrs |

**Total Sequential Time:** ~6-10 hours (if running one task at a time)
**Total Parallel Time:** ~8-12 hours (with parallelization)
**Parallelization Efficiency:** ~40%

---

## Dependency Graph (Visual)

```
                    ┌─────────────────────┐
                    │   Wave 0 (SEQ)      │
                    │  task_0_1_cli_det   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
    ┌─────────────────────┐          ┌─────────────────────┐
    │   Wave 1 (ASYNC)    │          │   Wave 1 (ASYNC)    │
    │ task_1_1_parser     │          │ task_1_2_settings   │
    └──────────┬──────────┘          └──────────┬──────────┘
               │                                 │
               └────────────────┬────────────────┘
                                ▼
                    ┌─────────────────────┐
                    │   Wave 2 (SEQ)      │
                    │ task_2_1_cli_mgr    │
                    │ task_2_2_ext_init   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Wave 3 (SEQ)      │
                    │ task_3_1_chatpanel  │
                    │ task_3_2_agent_cfg  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │ Wave 4 (ASYNC)│ │ Wave 4 (ASYNC)│ │ Wave 4 (ASYNC)│
    │ task_4_1_tool │ │ task_4_2_fall │ │ task_4_3_ui   │
    └───────────────┘ └───────────────┘ └───────────────┘
```

---

## Conductor Assignment Commands

### Wave 0 (Sequential)
```bash
/conductor:implement task_0_1_cli_detector
# Wait for completion
```

### Wave 1 (Async - 2 agents)
```bash
# Terminal 1:
cd worktree-1 && claude -p "Implement task_1_1_stream_parser_ASYNC.md"

# Terminal 2:
cd worktree-2 && claude -p "Implement task_1_2_settings_ASYNC.md"

# Wait for both to complete
```

### Wave 2 (Sequential)
```bash
/conductor:implement task_2_1_cli_manager
/conductor:implement task_2_1_extension_init
```

### Wave 3 (Sequential)
```bash
/conductor:implement task_3_1_chatpanel_cli
/conductor:implement task_3_2_agent_config
```

### Wave 4 (Async - 3 agents)
```bash
# Terminal 1:
cd worktree-1 && claude -p "Implement task_4_1_tool_ui_ASYNC.md"

# Terminal 2:
cd worktree-2 && claude -p "Implement task_4_2_fallback_ASYNC.md"

# Terminal 3:
cd worktree-3 && claude -p "Implement task_4_3_ui_indicator_ASYNC.md"
```

---

## Testing Checklist (from handoff.md)

- [ ] Verify CLI detection works on Windows/macOS/Linux
- [ ] Test streaming output displays correctly in webview
- [ ] Test file attachments are included in prompts
- [ ] Test conversation continuation with `--continue`
- [ ] Test cancellation stops CLI process
- [ ] Test fallback to API when CLI unavailable
- [ ] Test worktree directory is used correctly
- [ ] Test tool approval works with `--allowedTools`
- [ ] Test error handling for CLI failures
- [ ] Test timeout handling

---

## Files Summary

| Action | File | Task |
|--------|------|------|
| CREATE | `src/cliDetector.ts` | task_0_1 |
| CREATE | `src/streamParser.ts` | task_1_1 |
| MODIFY | `package.json` | task_1_2 |
| CREATE | `src/cliManager.ts` | task_2_1 |
| MODIFY | `src/extension.ts` | task_2_2 |
| MODIFY | `src/chatPanel.ts` | task_3_1, task_4_1, task_4_2, task_4_3 |
| MODIFY | `src/agentManager.ts` | task_3_2 |

---

## Risk Register

| Risk ID | Description | Severity | Mitigation | Status |
|---------|-------------|----------|------------|--------|
| R1 | CLI output format changes | MEDIUM | Flexible parsing, fallback | Open |
| R2 | Process hangs/zombies | HIGH | Timeout, cleanup in dispose | Open |
| R3 | Breaking existing chat | HIGH | Keep API code as fallback | Mitigated |
| R4 | Memory leaks from listeners | MEDIUM | Proper cleanup | Open |

---

**Track ID:** cli_integration_20260124
**Plan Version:** 2.0
**Last Updated:** 2026-01-24
**Status:** Ready for Implementation
