# Multi-Agent Orchestration System Specification

## Overview

Implement a comprehensive multi-agent orchestration system for the Claude Agent Spawner VS Code extension that enables:
1. **Conductor** - Task orchestration and agent spawning
2. **Ralph** - Runtime Assessment Layer for Process Health
3. **ClaudeProcess** - Enhanced CLI process management
4. **Centralized Types** - Consolidated type definitions

## Functional Requirements

### FR-1: ClaudeProcess Module
- Spawn Claude CLI with `--print --output-format stream-json`
- Session ID management for multi-agent isolation
- Event-based message handling via EventEmitter
- Send/receive with promise-based API
- Graceful shutdown with SIGTERM/SIGKILL

### FR-2: Conductor Module
- Create orchestrator agent with system prompt
- Handle spawn_agent tool use from conductor
- Track task assignments and dependencies
- Coordinate agent completion notifications
- Synthesize results from child agents

### FR-3: Ralph Module
- Periodic health assessments of all running agents
- Detect stuck, looping, or failing agents
- Suggest interventions (restart, stop, redirect)
- System-level resource monitoring
- Integration with AgentManager state

### FR-4: UI Integration
- Conductor goal input UI
- Agent hierarchy tree display
- Ralph health indicators
- Real-time agent status updates
- Tool use visualization improvements

## Non-Functional Requirements

### NFR-1: Performance
- UI remains responsive with many agents
- Minimal overhead for Ralph assessments

### NFR-2: Compatibility
- Preserve backward compatibility with single-agent mode
- Ralph is optional (can be toggled)

### NFR-3: Memory Safety
- Proper cleanup on process termination
- No memory leaks from lingering processes

## Acceptance Criteria

- [ ] All types defined and exported from `src/claude/types.ts`
- [ ] ClaudeProcess spawns and manages CLI sessions correctly
- [ ] Conductor can break down goals and spawn child agents
- [ ] Ralph performs periodic health assessments
- [ ] UI shows agent hierarchy and status
- [ ] All existing functionality preserved
- [ ] TypeScript compiles without errors
- [ ] Extension activates successfully

## Out of Scope

- Authentication/authorization for agents
- Cloud-based agent coordination
- Persistent storage of agent history
