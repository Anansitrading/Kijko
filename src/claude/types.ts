/**
 * Multi-Agent Orchestration Type Definitions
 *
 * Central type definitions for the orchestration system including:
 * - Stream message types for Claude CLI JSON output
 * - Agent configuration and state interfaces
 * - Conductor task orchestration types
 * - Ralph health assessment types
 */

/**
 * Message received from Claude CLI JSON stream
 */
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

/**
 * Agent role in the orchestration hierarchy
 */
export type AgentRole = 'orchestrator' | 'worker' | 'overseer';

/**
 * Configuration for spawning a new agent
 */
export interface AgentConfig {
    id: string;
    name: string;
    role: AgentRole;
    workingDir: string;
    systemPrompt?: string;
    autoApprove?: boolean;
    parentId?: string;
}

/**
 * Agent execution status
 */
export type AgentStatus = 'idle' | 'running' | 'waiting' | 'error' | 'completed';

/**
 * Current state of an agent
 */
export interface AgentState {
    config: AgentConfig;
    status: AgentStatus;
    messages: ClaudeStreamMessage[];
    currentTask?: string;
    childAgents: string[];
    createdAt: number;
    lastActivity: number;
}

/**
 * Conductor task status
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * A task in the conductor's execution plan
 */
export interface ConductorTask {
    id: string;
    description: string;
    assignedAgent?: string;
    status: TaskStatus;
    result?: string;
    dependsOn: string[];
}

/**
 * Conductor's execution plan for a goal
 */
export interface ConductorPlan {
    goal: string;
    tasks: ConductorTask[];
    dependencies: Map<string, string[]>;
}

/**
 * Overall health status for Ralph assessments
 */
export type HealthStatus = 'good' | 'warning' | 'critical';

/**
 * Status report for a single agent
 */
export interface AgentStatusReport {
    agentId: string;
    status: AgentStatus;
    concerns: string[];
    recommendations: string[];
}

/**
 * Ralph's assessment of system health
 */
export interface RalphAssessment {
    timestamp: number;
    overallHealth: HealthStatus;
    agentStatuses: Map<string, AgentStatusReport>;
    systemRecommendations: string[];
    interventionRequired: boolean;
}

/**
 * Intervention action types
 */
export type InterventionAction = 'restart' | 'stop' | 'redirect';

/**
 * Request for intervention on an agent
 */
export interface InterventionRequest {
    agentId: string;
    action: InterventionAction;
    reason: string;
    timestamp: number;
}

/**
 * Event types emitted by ClaudeProcess
 */
export interface ClaudeProcessEvents {
    message: (msg: ClaudeStreamMessage) => void;
    error: (err: Error) => void;
    exit: (code: number) => void;
    started: () => void;
    tool_use: (toolName: string, toolInput: Record<string, unknown>) => void;
    spawn_request: (config: AgentConfig) => void;
}

/**
 * Event types emitted by Conductor
 */
export interface ConductorEvents {
    started: (goal: string) => void;
    taskStarted: (task: ConductorTask) => void;
    taskCompleted: (task: ConductorTask) => void;
    agentSpawned: (agentId: string, task: ConductorTask) => void;
    completed: (result: string) => void;
    error: (err: Error) => void;
}

/**
 * Event types emitted by Ralph
 */
export interface RalphEvents {
    started: () => void;
    assessment: (assessment: RalphAssessment) => void;
    interventionRequired: (request: InterventionRequest) => void;
    stopped: () => void;
}
