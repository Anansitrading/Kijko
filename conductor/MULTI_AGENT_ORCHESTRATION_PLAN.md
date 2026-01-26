# Multi-Agent Orchestration System Refactoring Plan

## Overview

This plan implements a comprehensive multi-agent orchestration system with:
1. **Types** - Centralized interfaces and types
2. **ClaudeProcess** - CLI integration with JSON streaming
3. **AgentManager** - Enhanced agent lifecycle management
4. **Conductor** - Task orchestration and agent spawning
5. **Ralph** - Meta-oversight loop for monitoring agent health
6. **ChatPanel** - Enhanced webview UI
7. **Extension** - Updated entry point

## Current State Analysis

### Existing Components (to enhance/refactor):
- `src/extension.ts` - Main entry point (548 lines)
- `src/agentManager.ts` - Agent lifecycle (356 lines)
- `src/chatPanel.ts` - Webview chat UI (1909 lines)
- `src/cliManager.ts` - CLI subprocess manager (333 lines)
- `src/streamParser.ts` - JSON stream parsing (372 lines)
- `src/conductorIntegration.ts` - Conductor track parsing (593 lines)
- `src/webviewProvider.ts` - Sidebar UI (552 lines)
- `src/taskDetector.ts` - ASYNC task detection
- `src/cliDetector.ts` - CLI detection

### New Components (to create):
- `src/claude/types.ts` - Centralized type definitions
- `src/claude/claudeProcess.ts` - Enhanced CLI process management
- `src/claude/conductor.ts` - Orchestrator for multi-agent coordination
- `src/claude/ralph.ts` - Runtime Assessment Layer for Process Health

## Tech Stack
- TypeScript 5.3+
- VS Code Extension API 1.85+
- Node.js child_process for CLI spawning
- EventEmitter pattern for reactive updates
- Webview API for UI

---

## Phase 0: Foundation (SEQUENTIAL)

### Task 0.1: Create Directory Structure
**Type:** SEQUENTIAL
**Complexity:** low

Create the `src/claude/` directory structure for the new modular components.

**Files:**
- Create `src/claude/` directory
- Create `src/claude/index.ts` for exports

**Dependencies:** None

---

### Task 0.2: Create Types Module
**Type:** SEQUENTIAL
**Complexity:** medium

Extract and consolidate all type definitions into a central types module.

**Files to create:**
- `src/claude/types.ts`

**Types to define:**
```typescript
// Stream message types
export interface ClaudeStreamMessage {
    type: 'assistant' | 'user' | 'system' | 'result' | 'tool_use' | 'tool_result' | 'error' | 'status';
    subtype?: string;
    content?: string;
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    tool_result?: string;
    is_error?: boolean;
    status?: string;
    session_id?: string;
    timestamp?: string;
}

// Agent configuration
export interface AgentConfig {
    id: string;
    name: string;
    role: 'orchestrator' | 'worker' | 'overseer';
    workingDir: string;
    systemPrompt?: string;
    autoApprove?: boolean;
    parentId?: string;
}

// Agent state
export interface AgentState {
    config: AgentConfig;
    status: 'idle' | 'running' | 'waiting' | 'error' | 'completed';
    messages: ClaudeStreamMessage[];
    currentTask?: string;
    childAgents: string[];
    createdAt: number;
    lastActivity: number;
}

// Conductor types
export interface ConductorPlan {
    goal: string;
    tasks: ConductorTask[];
    dependencies: Map<string, string[]>;
}

export interface ConductorTask {
    id: string;
    description: string;
    assignedAgent?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    result?: string;
    dependsOn: string[];
}

// Ralph assessment
export interface RalphAssessment {
    timestamp: number;
    overallHealth: 'good' | 'warning' | 'critical';
    agentStatuses: Map<string, AgentStatusReport>;
    systemRecommendations: string[];
    interventionRequired: boolean;
}

export interface AgentStatusReport {
    status: string;
    concerns: string[];
    recommendations: string[];
}
```

**Dependencies:** Task 0.1

---

## Phase 1: Core Process Management (SEQUENTIAL)

### Task 1.1: Create ClaudeProcess Module
**Type:** SEQUENTIAL
**Complexity:** high

Create enhanced CLI process manager that wraps Claude CLI with JSON streaming support.

**File:** `src/claude/claudeProcess.ts`

**Key Features:**
- Spawn Claude CLI with `--print --output-format stream-json`
- Session ID management for multi-agent isolation
- Event-based message handling
- Send/receive with promise-based API
- Graceful shutdown with SIGTERM/SIGKILL

**Implementation:**
```typescript
export class ClaudeProcess extends EventEmitter {
    private process: ChildProcess | null = null;
    private buffer: string = '';
    private _sessionId: string;
    private _isRunning: boolean = false;

    constructor(
        public readonly id: string,
        public readonly workingDir: string,
        private readonly autoApprove: boolean = false
    ) {
        super();
        this._sessionId = `agent-${id}-${Date.now()}`;
    }

    async start(prompt?: string): Promise<void>;
    send(input: string): void;
    async sendAndWait(input: string, timeoutMs?: number): Promise<ClaudeStreamMessage[]>;
    stop(): void;
    resume(sessionId: string): void;
}
```

**Dependencies:** Task 0.2

---

### Task 1.2: Update Agent Manager
**Type:** SEQUENTIAL
**Complexity:** medium

Refactor AgentManager to use new ClaudeProcess and support the orchestration pattern.

**File:** `src/agentManager.ts` (modify existing)

**Changes:**
- Import types from `src/claude/types.ts`
- Use ClaudeProcess instead of direct CLI spawning
- Add methods for agent hierarchy (parent/child)
- Emit events for spawn requests from agents
- Track agent states using AgentState interface

**Dependencies:** Task 1.1

---

## Phase 2: Orchestration (ASYNC-capable)

### Task 2.1: Create Conductor Module
**Type:** ASYNC
**Complexity:** high

Create the Conductor orchestrator that breaks down goals and spawns specialist agents.

**File:** `src/claude/conductor.ts`

**Key Features:**
- Create conductor agent with orchestration system prompt
- Handle spawn_agent tool use from conductor
- Track task assignments and dependencies
- Coordinate agent completion notifications
- Synthesize results from child agents

**Implementation:**
```typescript
export class Conductor {
    private conductorAgent: ClaudeProcess | null = null;
    private currentPlan: ConductorPlan | null = null;
    private isRunning: boolean = false;

    constructor(
        private agentManager: AgentManager,
        private workingDir: string,
        private outputChannel: vscode.OutputChannel
    ) {}

    async start(goal: string): Promise<void>;
    private getConductorSystemPrompt(): string;
    private handleSpawnRequest(parentId: string, config: any): Promise<void>;
    private handleAgentCompletion(agentId: string, code: number): void;
    private notifyParent(parentId: string, childId: string, result: string, success: boolean): Promise<void>;
    stop(): void;
}
```

**Dependencies:** Task 1.2

---

### Task 2.2: Create Ralph Module
**Type:** ASYNC
**Complexity:** high

Create the Ralph oversight loop for monitoring agent health and system stability.

**File:** `src/claude/ralph.ts`

**Key Features:**
- Periodic health assessments of all running agents
- Detect stuck, looping, or failing agents
- Suggest interventions (restart, stop, redirect)
- System-level resource monitoring
- Integration with AgentManager state

**Implementation:**
```typescript
export class Ralph {
    private ralphAgent: ClaudeProcess | null = null;
    private assessmentInterval: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private lastAssessment: RalphAssessment | null = null;

    constructor(
        private agentManager: AgentManager,
        private workingDir: string,
        private outputChannel: vscode.OutputChannel,
        private intervalMs: number = 30000
    ) {}

    async start(): Promise<void>;
    private getRalphSystemPrompt(): string;
    private performAssessment(): Promise<void>;
    private buildStatesSummary(states: Map<string, AgentState>): string;
    async requestIntervention(agentId: string, action: 'restart' | 'stop' | 'redirect', reason: string): Promise<void>;
    stop(): void;
    getLastAssessment(): RalphAssessment | null;
}
```

**Dependencies:** Task 1.2

---

## Phase 3: UI Integration (ASYNC-capable)

### Task 3.1: Update ChatPanel for Orchestration
**Type:** ASYNC
**Complexity:** medium

Enhance ChatPanel to support conductor mode and agent hierarchy display.

**File:** `src/chatPanel.ts` (modify existing)

**Changes:**
- Add conductor goal input UI
- Show agent hierarchy tree
- Display Ralph health indicators
- Real-time agent status updates
- Tool use visualization improvements

**Dependencies:** Task 2.1, Task 2.2

---

### Task 3.2: Update WebviewProvider
**Type:** ASYNC
**Complexity:** medium

Update sidebar to show orchestration status and Ralph assessments.

**File:** `src/webviewProvider.ts` (modify existing)

**Changes:**
- Add "Start Conductor" button
- Show conductor status
- Display Ralph health summary
- Agent hierarchy visualization
- Quick actions for interventions

**Dependencies:** Task 3.1

---

## Phase 4: Extension Integration (SEQUENTIAL)

### Task 4.1: Update Extension Entry Point
**Type:** SEQUENTIAL
**Complexity:** medium

Integrate all new components into the extension lifecycle.

**File:** `src/extension.ts` (modify existing)

**Changes:**
- Initialize Conductor and Ralph
- Register new commands:
  - `claudeConductor.openPanel`
  - `claudeConductor.start`
  - `claudeConductor.stopAll`
  - `claudeConductor.toggleRalph`
- Wire up event handlers
- Update deactivation cleanup

**Dependencies:** Task 3.1, Task 3.2

---

### Task 4.2: Update Package.json
**Type:** SEQUENTIAL
**Complexity:** low

Add new commands and configuration to package.json.

**File:** `package.json` (modify existing)

**Changes:**
- Add new commands for conductor/ralph
- Add keybindings
- Add configuration options for Ralph interval

**Dependencies:** Task 4.1

---

## Execution Waves

### Wave 0 (Sequential - Setup)
- Task 0.1: Create Directory Structure
- Task 0.2: Create Types Module

### Wave 1 (Sequential - Core)
- Task 1.1: Create ClaudeProcess Module
- Task 1.2: Update Agent Manager

### Wave 2 (Async - Orchestration)
- Task 2.1: Create Conductor Module (ASYNC)
- Task 2.2: Create Ralph Module (ASYNC)

### Wave 3 (Async - UI)
- Task 3.1: Update ChatPanel (ASYNC)
- Task 3.2: Update WebviewProvider (ASYNC)

### Wave 4 (Sequential - Integration)
- Task 4.1: Update Extension Entry Point
- Task 4.2: Update Package.json

---

## Critical Path

```
Task 0.1 → Task 0.2 → Task 1.1 → Task 1.2 → Task 2.1 → Task 3.1 → Task 4.1 → Task 4.2
                                         ↘ Task 2.2 → Task 3.2 ↗
```

**Total Estimated Duration:** 4-6 hours of implementation time

---

## Success Criteria

- [ ] All types defined and exported from `src/claude/types.ts`
- [ ] ClaudeProcess spawns and manages CLI sessions correctly
- [ ] Conductor can break down goals and spawn child agents
- [ ] Ralph performs periodic health assessments
- [ ] UI shows agent hierarchy and status
- [ ] All existing functionality preserved
- [ ] TypeScript compiles without errors
- [ ] Extension activates successfully

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| CLI JSON format changes | Medium | Abstract parser, use existing streamParser |
| Session isolation issues | Medium | Unique session IDs per agent |
| Memory leaks from processes | High | Proper cleanup on dispose |
| UI performance with many agents | Low | Virtual scrolling, limit displayed |

---

## Notes

- Preserve backward compatibility with existing single-agent mode
- Ralph is optional - can be toggled on/off
- Conductor mode is separate from manual agent spawning
- All new files use existing VS Code theming
