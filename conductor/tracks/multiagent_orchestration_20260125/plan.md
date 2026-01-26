# Multi-Agent Orchestration Implementation Plan

## Phase 0: Foundation (SEQUENTIAL)

### [x] Task 0.1: Create Directory Structure
**Complexity:** Low | **Type:** SEQUENTIAL

- [x] Create `src/claude/` directory
- [x] Create `src/claude/index.ts` for barrel exports

**Dependencies:** None

---

### [x] Task 0.2: Create Types Module
**Complexity:** Medium | **Type:** SEQUENTIAL

- [x] Create `src/claude/types.ts` with:
  - ClaudeStreamMessage interface
  - AgentConfig interface
  - AgentState interface
  - ConductorPlan and ConductorTask interfaces
  - RalphAssessment and AgentStatusReport interfaces

**Dependencies:** Task 0.1

---

## Phase 1: Core Process Management (SEQUENTIAL)

### [x] Task 1.1: Create ClaudeProcess Module
**Complexity:** High | **Type:** SEQUENTIAL

- [x] Create `src/claude/claudeProcess.ts`
- [x] Implement ClaudeProcess class extending EventEmitter
- [x] Add spawn method with JSON streaming flags
- [x] Add send/sendAndWait methods
- [x] Add stop and resume methods
- [x] Export from index.ts

**Dependencies:** Task 0.2

---

### [x] Task 1.2: Update Agent Manager
**Complexity:** Medium | **Type:** SEQUENTIAL

- [x] Import types from `src/claude/types.ts`
- [x] Add ClaudeProcess integration points
- [x] Add methods for agent hierarchy (parent/child)
- [x] Add event emission for spawn requests
- [x] Track agent states using AgentState interface

**Dependencies:** Task 1.1

---

## Phase 2: Orchestration (ASYNC-capable)

### [x] Task 2.1: Create Conductor Module
**Complexity:** High | **Type:** ASYNC

- [x] Create `src/claude/conductor.ts`
- [x] Implement Conductor class
- [x] Add orchestrator system prompt
- [x] Handle spawn_agent tool use
- [x] Track task assignments
- [x] Notify parent on completion

**Dependencies:** Task 1.2

---

### [x] Task 2.2: Create Ralph Module
**Complexity:** High | **Type:** ASYNC

- [x] Create `src/claude/ralph.ts`
- [x] Implement Ralph class
- [x] Add assessment system prompt
- [x] Add periodic assessment loop
- [x] Detect stuck/failing agents
- [x] Provide intervention recommendations

**Dependencies:** Task 1.2

---

## Phase 3: UI Integration (ASYNC-capable)

### [x] Task 3.1: Update ChatPanel
**Complexity:** Medium | **Type:** ASYNC

- [x] Add conductor goal input UI
- [x] Show agent hierarchy tree
- [x] Display Ralph health indicators
- [x] Add real-time status updates
- [x] Improve tool use visualization

**Dependencies:** Task 2.1, Task 2.2

---

### [x] Task 3.2: Update WebviewProvider
**Complexity:** Medium | **Type:** ASYNC

- [x] Add "Start Conductor" button
- [x] Show conductor status
- [x] Display Ralph health summary
- [x] Add agent hierarchy visualization
- [x] Add quick intervention actions

**Dependencies:** Task 3.1

---

## Phase 4: Extension Integration (SEQUENTIAL)

### [x] Task 4.1: Update Extension Entry Point
**Complexity:** Medium | **Type:** SEQUENTIAL

- [x] Initialize Conductor and Ralph
- [x] Register command: `claudeConductor.openPanel`
- [x] Register command: `claudeConductor.start`
- [x] Register command: `claudeConductor.stopAll`
- [x] Register command: `claudeConductor.toggleRalph`
- [x] Wire up event handlers
- [x] Update deactivation cleanup

**Dependencies:** Task 3.1, Task 3.2

---

### [x] Task 4.2: Update Package.json
**Complexity:** Low | **Type:** SEQUENTIAL

- [x] Add new commands for conductor/ralph
- [x] Add keybindings
- [x] Add configuration for Ralph interval

**Dependencies:** Task 4.1

---

## Execution Waves

| Wave | Tasks | Type | Max Parallel |
|------|-------|------|--------------|
| 0 | 0.1, 0.2 | SEQUENTIAL | 1 |
| 1 | 1.1, 1.2 | SEQUENTIAL | 1 |
| 2 | 2.1, 2.2 | ASYNC | 2 |
| 3 | 3.1, 3.2 | ASYNC | 1 (sequential) |
| 4 | 4.1, 4.2 | SEQUENTIAL | 1 |

## Critical Path

```
0.1 → 0.2 → 1.1 → 1.2 → 2.1 → 3.1 → 4.1 → 4.2
```
