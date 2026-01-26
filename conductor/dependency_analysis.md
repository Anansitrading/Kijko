# Dependency Analysis Report

**Project:** Multi-Agent Orchestration System Refactoring
**Generated:** 2026-01-25
**Source Plan:** MULTI_AGENT_ORCHESTRATION_PLAN.md
**Total Tasks:** 10
**Critical Path Length:** 8 tasks

## Overview

This analysis covers the refactoring to implement a multi-agent orchestration system with:
- **Conductor** - Task orchestration and agent spawning
- **Ralph** - Runtime Assessment Layer for Process Health
- **ClaudeProcess** - Enhanced CLI process management
- **Centralized Types** - Consolidated type definitions

## Task Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          WAVE 0: Foundation                              │
│                            (SEQUENTIAL)                                  │
│   ┌────────────────┐        ┌─────────────────┐                         │
│   │ Task 0.1       │───────▶│ Task 0.2        │                         │
│   │ Directory      │        │ Types Module    │                         │
│   │ Structure      │        │ (types.ts)      │                         │
│   └────────────────┘        └────────┬────────┘                         │
└──────────────────────────────────────┼──────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       WAVE 1: Core Process                               │
│                          (SEQUENTIAL)                                    │
│   ┌─────────────────┐       ┌──────────────────┐                        │
│   │ Task 1.1        │──────▶│ Task 1.2         │                        │
│   │ ClaudeProcess   │       │ Update           │                        │
│   │ Module          │       │ AgentManager     │                        │
│   └─────────────────┘       └────────┬─────────┘                        │
└──────────────────────────────────────┼──────────────────────────────────┘
                                       │
                          ┌────────────┴────────────┐
                          ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       WAVE 2: Orchestration                              │
│                           (ASYNC)                                        │
│   ┌─────────────────┐                  ┌─────────────────┐              │
│   │ Task 2.1        │                  │ Task 2.2        │              │
│   │ Conductor       │                  │ Ralph           │              │
│   │ Module (ASYNC)  │                  │ Module (ASYNC)  │              │
│   └────────┬────────┘                  └────────┬────────┘              │
└────────────┼───────────────────────────────────┼────────────────────────┘
             │                                    │
             └──────────────┬─────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       WAVE 3: UI Integration                             │
│                           (ASYNC)                                        │
│   ┌─────────────────┐       ┌──────────────────┐                        │
│   │ Task 3.1        │──────▶│ Task 3.2         │                        │
│   │ Update          │       │ Update           │                        │
│   │ ChatPanel       │       │ WebviewProvider  │                        │
│   └────────┬────────┘       └────────┬─────────┘                        │
└────────────┼────────────────────────┼───────────────────────────────────┘
             │                        │
             └──────────┬─────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       WAVE 4: Integration                                │
│                         (SEQUENTIAL)                                     │
│   ┌─────────────────┐       ┌──────────────────┐                        │
│   │ Task 4.1        │──────▶│ Task 4.2         │                        │
│   │ Update          │       │ Update           │                        │
│   │ Extension       │       │ Package.json     │                        │
│   └─────────────────┘       └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## Critical Path

The longest dependency chain (critical path):

```
task_0_1 → task_0_2 → task_1_1 → task_1_2 → task_2_1 → task_3_1 → task_4_1 → task_4_2
   │          │          │          │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼          ▼          ▼          ▼
 Setup     Types    ClaudeProc  AgentMgr  Conductor ChatPanel  Extension Package
```

**Critical Path Length:** 8 tasks
**Estimated Total Duration:** 4-6 hours

## Task Summary

| Task ID | Name | Type | Wave | Complexity | Critical Path |
|---------|------|------|------|------------|---------------|
| task_0_1 | Create Directory Structure | SEQUENTIAL | 0 | Low | Yes |
| task_0_2 | Create Types Module | SEQUENTIAL | 0 | Medium | Yes |
| task_1_1 | Create ClaudeProcess Module | SEQUENTIAL | 1 | High | Yes |
| task_1_2 | Update Agent Manager | SEQUENTIAL | 1 | Medium | Yes |
| task_2_1 | Create Conductor Module | **ASYNC** | 2 | High | Yes |
| task_2_2 | Create Ralph Module | **ASYNC** | 2 | High | No |
| task_3_1 | Update ChatPanel | ASYNC | 3 | Medium | Yes |
| task_3_2 | Update WebviewProvider | ASYNC | 3 | Medium | No |
| task_4_1 | Update Extension Entry Point | SEQUENTIAL | 4 | Medium | Yes |
| task_4_2 | Update Package.json | SEQUENTIAL | 4 | Low | Yes |

## Parallelization Opportunities

### Wave 2: Conductor + Ralph (ASYNC)

```
                    task_1_2 (AgentManager)
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
    ┌────────────────┐      ┌────────────────┐
    │ task_2_1       │      │ task_2_2       │
    │ Conductor      │      │ Ralph          │
    │ (can parallel) │      │ (can parallel) │
    └────────────────┘      └────────────────┘
```

**Parallelization Score:** 50%
**Max Concurrent Agents:** 2
**Reason:** Both modules depend only on AgentManager and don't share state

### Wave 3: UI Updates

```
    task_3_1 (ChatPanel)
         │
         ▼
    task_3_2 (WebviewProvider)
```

**Note:** WebviewProvider depends on ChatPanel, so these must be sequential

## File Impact Analysis

### New Files to Create

| File | Module | LOC Est. | Description |
|------|--------|----------|-------------|
| src/claude/index.ts | - | ~20 | Barrel exports |
| src/claude/types.ts | Types | ~100 | Centralized interfaces |
| src/claude/claudeProcess.ts | ClaudeProcess | ~200 | CLI process wrapper |
| src/claude/conductor.ts | Conductor | ~250 | Task orchestrator |
| src/claude/ralph.ts | Ralph | ~200 | Health oversight |

**Total New Code:** ~770 LOC

### Files to Modify

| File | Current LOC | Changes | Risk |
|------|-------------|---------|------|
| src/agentManager.ts | 356 | Import types, use ClaudeProcess | Medium |
| src/chatPanel.ts | 1909 | Add conductor UI, Ralph indicators | Medium |
| src/webviewProvider.ts | 552 | Add orchestration status | Low |
| src/extension.ts | 548 | Initialize Conductor, Ralph, new commands | High |
| package.json | - | Add commands, config | Low |

## Dependency Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| Total Nodes (Tasks) | 10 | Manageable |
| Total Edges | 12 | Moderate coupling |
| Critical Path Length | 8 | Long - watch for delays |
| Parallelization Factor | 20% | Limited parallel opportunities |
| Max Concurrent Agents | 2 | Wave 2 only |

## Risk Assessment

| Risk ID | Description | Severity | Likelihood | Mitigation |
|---------|-------------|----------|------------|------------|
| R1 | CLI JSON format changes | Medium | Low | Abstract parser |
| R2 | Session isolation issues | Medium | Medium | Unique session IDs |
| R3 | Memory leaks from processes | High | Medium | Proper cleanup |
| R4 | UI performance with many agents | Low | Low | Virtual scrolling |
| R5 | Backward compatibility | Medium | Low | Preserve single-agent mode |

## Architectural Patterns

### Detected Patterns

1. **EventEmitter** - Used throughout for reactive updates
2. **Factory** - AgentManager creates agents
3. **Singleton** - ChatPanel static instance management
4. **Observer** - Task detection and state changes
5. **Orchestrator** (new) - Conductor pattern for multi-agent coordination

### Layer Architecture

```
┌─────────────────────────────────────────────────┐
│              PRESENTATION                        │
│  extension.ts, webviewProvider.ts, chatPanel.ts │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│               APPLICATION                        │
│  agentManager.ts, conductor.ts, ralph.ts        │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│              INFRASTRUCTURE                      │
│  claudeProcess.ts, cliManager.ts, streamParser  │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│                 DOMAIN                           │
│  types.ts, conductorIntegration.ts              │
└─────────────────────────────────────────────────┘
```

## Recommendations

1. **Execute Wave 2 in Parallel** - Conductor and Ralph can be developed simultaneously by different agents

2. **Focus on Critical Path** - Prioritize tasks on the critical path to avoid delays

3. **Test ClaudeProcess Thoroughly** - It's the foundation for all agent spawning

4. **Implement Ralph as Optional** - Allow toggling for performance-sensitive scenarios

5. **Preserve Backward Compatibility** - Existing single-agent mode must continue to work

## Execution Commands

### Wave 0 (Sequential)
```bash
# Task 0.1: Directory structure
mkdir -p src/claude

# Task 0.2: Types module
# Create src/claude/types.ts
```

### Wave 1 (Sequential)
```bash
# Task 1.1: ClaudeProcess
# Create src/claude/claudeProcess.ts

# Task 1.2: Update AgentManager
# Modify src/agentManager.ts
```

### Wave 2 (Parallel - 2 Agents)
```bash
# Agent 1: Task 2.1 (Conductor)
cd worktree-1 && claude -p "Implement conductor.ts"

# Agent 2: Task 2.2 (Ralph)
cd worktree-2 && claude -p "Implement ralph.ts"
```

### Wave 3-4 (Sequential)
```bash
# Task 3.1, 3.2, 4.1, 4.2
# Sequential execution required
```

---

**Generated by:** Dependency Graph Skill
**Plan Version:** 1.0
**Status:** Ready for Implementation
