/**
 * Conductor - Multi-Agent Orchestration System
 *
 * The Conductor orchestrates complex tasks by:
 * - Breaking down goals into subtasks
 * - Spawning specialist agents for each subtask
 * - Tracking task assignments and dependencies
 * - Coordinating agent completion notifications
 * - Synthesizing results from child agents
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { ClaudeProcess, createClaudeProcess } from './claudeProcess';
import { AgentManager } from '../agentManager';
import {
    AgentConfig,
    ConductorPlan,
    ConductorTask,
    TaskStatus,
    ConductorEvents,
    ClaudeStreamMessage
} from './types';

/**
 * System prompt for the Conductor agent
 */
const CONDUCTOR_SYSTEM_PROMPT = `You are the Conductor, an orchestrator agent responsible for breaking down complex goals into subtasks and delegating them to specialist agents.

Your responsibilities:
1. Analyze the user's goal and break it into discrete, parallelizable subtasks
2. For each subtask, spawn a specialist agent using the spawn_agent tool
3. Track progress of all spawned agents
4. Synthesize results from completed agents
5. Report final results to the user

When spawning agents, consider:
- Task dependencies (what must complete before what)
- Parallelization opportunities (independent tasks can run simultaneously)
- Agent specialization (assign tasks based on required skills)

Available tool: spawn_agent
Parameters:
- name: Descriptive name for the agent (e.g., "CodeReviewer", "TestWriter")
- role: "worker" for task execution
- systemPrompt: Specific instructions for the agent's task
- autoApprove: Whether the agent can use tools without user approval

Report progress as you go and provide a summary when all tasks complete.`;

/**
 * Conductor class for multi-agent orchestration
 */
export class Conductor extends EventEmitter {
    private conductorAgent: ClaudeProcess | null = null;
    private currentPlan: ConductorPlan | null = null;
    private isRunning: boolean = false;
    private taskAgentMap: Map<string, string> = new Map(); // taskId -> agentId
    private agentTaskMap: Map<string, string> = new Map(); // agentId -> taskId
    private completedTasks: Set<string> = new Set();
    private outputChannel: vscode.OutputChannel;

    constructor(
        private agentManager: AgentManager,
        private workingDir: string,
        outputChannel?: vscode.OutputChannel
    ) {
        super();
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Conductor');

        // Listen for spawn requests from the conductor agent
        this.setupEventListeners();
    }

    /**
     * Check if the Conductor is currently running
     */
    public get running(): boolean {
        return this.isRunning;
    }

    /**
     * Get the current plan
     */
    public get plan(): ConductorPlan | null {
        return this.currentPlan;
    }

    /**
     * Start the Conductor with a goal
     *
     * @param goal - The goal to accomplish
     */
    public async start(goal: string): Promise<void> {
        if (this.isRunning) {
            throw new Error('Conductor is already running');
        }

        this.log(`Starting Conductor with goal: ${goal}`);
        this.isRunning = true;

        // Initialize the plan
        this.currentPlan = {
            goal,
            tasks: [],
            dependencies: new Map()
        };

        // Create the conductor agent
        const config: AgentConfig = {
            id: 'conductor-main',
            name: 'Conductor',
            role: 'orchestrator',
            workingDir: this.workingDir,
            systemPrompt: CONDUCTOR_SYSTEM_PROMPT,
            autoApprove: true
        };

        this.conductorAgent = createClaudeProcess(config);

        // Set up conductor agent event handlers
        this.conductorAgent.on('message', (msg: ClaudeStreamMessage) => {
            this.handleConductorMessage(msg);
        });

        this.conductorAgent.on('spawn_request', (spawnConfig: AgentConfig) => {
            this.handleSpawnRequest(spawnConfig);
        });

        this.conductorAgent.on('exit', (code: number) => {
            this.handleConductorExit(code);
        });

        this.conductorAgent.on('error', (err: Error) => {
            this.log(`Conductor error: ${err.message}`);
            this.emit('error', err);
        });

        // Start the conductor
        try {
            await this.conductorAgent.start(goal);
            this.emit('started', goal);
        } catch (error) {
            this.isRunning = false;
            throw error;
        }
    }

    /**
     * Stop the Conductor and all child agents
     */
    public stop(): void {
        this.log('Stopping Conductor');

        if (this.conductorAgent) {
            this.conductorAgent.stop();
            this.conductorAgent = null;
        }

        // Stop all child agents
        for (const agentId of this.agentTaskMap.keys()) {
            this.agentManager.killAgent(agentId).catch(err => {
                this.log(`Error stopping agent ${agentId}: ${err.message}`);
            });
        }

        this.isRunning = false;
        this.currentPlan = null;
        this.taskAgentMap.clear();
        this.agentTaskMap.clear();
        this.completedTasks.clear();
    }

    /**
     * Get task status
     *
     * @param taskId - ID of the task
     * @returns Task status or undefined
     */
    public getTaskStatus(taskId: string): TaskStatus | undefined {
        const task = this.currentPlan?.tasks.find(t => t.id === taskId);
        return task?.status;
    }

    /**
     * Get all tasks
     *
     * @returns Array of tasks
     */
    public getTasks(): ConductorTask[] {
        return this.currentPlan?.tasks || [];
    }

    /**
     * Handle messages from the conductor agent
     */
    private handleConductorMessage(msg: ClaudeStreamMessage): void {
        this.log(`Conductor: ${msg.content || msg.type}`);

        // Check for tool use
        if (msg.type === 'tool_use' && msg.tool_name === 'spawn_agent') {
            // Tool use is handled via spawn_request event
            return;
        }

        // Log assistant messages
        if (msg.type === 'assistant' && msg.content) {
            this.outputChannel.appendLine(`[Conductor] ${msg.content}`);
        }
    }

    /**
     * Handle spawn requests from the conductor
     */
    private async handleSpawnRequest(config: AgentConfig): Promise<void> {
        this.log(`Spawn request: ${config.name}`);

        // Create task for tracking
        const task: ConductorTask = {
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            description: config.systemPrompt || config.name,
            status: 'pending',
            dependsOn: []
        };

        this.currentPlan?.tasks.push(task);
        this.emit('taskStarted', task);

        try {
            // Spawn the child agent
            const agentInfo = await this.agentManager.spawnChildAgent(
                'conductor-main',
                {
                    ...config,
                    parentId: 'conductor-main'
                }
            );

            // Track the agent-task mapping
            task.assignedAgent = agentInfo.id;
            task.status = 'in_progress';
            this.taskAgentMap.set(task.id, agentInfo.id);
            this.agentTaskMap.set(agentInfo.id, task.id);

            this.emit('agentSpawned', agentInfo.id, task);
            this.log(`Spawned agent ${agentInfo.id} for task ${task.id}`);

            // Listen for agent completion
            const stateListener = this.agentManager.onAgentStateChanged((agent) => {
                if (agent.id === agentInfo.id && (agent.status === 'completed' || agent.status === 'failed')) {
                    this.handleAgentCompletion(
                        agent.id,
                        agent.status === 'completed' ? 0 : 1
                    );
                    stateListener.dispose();
                }
            });

        } catch (error) {
            task.status = 'failed';
            task.result = error instanceof Error ? error.message : 'Unknown error';
            this.log(`Failed to spawn agent: ${task.result}`);
        }
    }

    /**
     * Handle agent completion
     */
    private handleAgentCompletion(agentId: string, exitCode: number): void {
        const taskId = this.agentTaskMap.get(agentId);
        if (!taskId) {
            return;
        }

        const task = this.currentPlan?.tasks.find(t => t.id === taskId);
        if (!task) {
            return;
        }

        const success = exitCode === 0;
        task.status = success ? 'completed' : 'failed';

        this.completedTasks.add(taskId);
        this.emit('taskCompleted', task);

        this.log(`Agent ${agentId} completed task ${taskId} (${success ? 'success' : 'failed'})`);

        // Notify the conductor agent
        this.notifyParent(agentId, success);

        // Check if all tasks are complete
        this.checkAllTasksComplete();
    }

    /**
     * Notify the conductor that a child has completed
     */
    private async notifyParent(childId: string, success: boolean): Promise<void> {
        if (!this.conductorAgent || !this.conductorAgent.isRunning) {
            return;
        }

        const state = this.agentManager.getAgentState(childId);
        const lastMessages = state?.messages.slice(-3).map(m => m.content).join('\n') || '';

        const notification = success
            ? `Agent ${childId} completed successfully. Summary: ${lastMessages}`
            : `Agent ${childId} failed. Error: ${lastMessages}`;

        try {
            this.conductorAgent.send(notification);
        } catch (error) {
            this.log(`Failed to notify conductor: ${error}`);
        }
    }

    /**
     * Check if all tasks are complete
     */
    private checkAllTasksComplete(): void {
        const tasks = this.currentPlan?.tasks || [];
        const allComplete = tasks.every(t => t.status === 'completed' || t.status === 'failed');

        if (allComplete && tasks.length > 0) {
            this.log('All tasks completed');

            const successCount = tasks.filter(t => t.status === 'completed').length;
            const failCount = tasks.filter(t => t.status === 'failed').length;

            const result = `Completed ${successCount}/${tasks.length} tasks successfully. ${failCount} failed.`;
            this.emit('completed', result);
        }
    }

    /**
     * Handle conductor agent exit
     */
    private handleConductorExit(code: number): void {
        this.log(`Conductor process exited with code ${code}`);
        this.isRunning = false;

        if (code !== 0) {
            this.emit('error', new Error(`Conductor exited with code ${code}`));
        }
    }

    /**
     * Set up event listeners for agent manager events
     */
    private setupEventListeners(): void {
        // Listen for spawn requests from any agent
        this.agentManager.onSpawnRequest((config) => {
            if (this.isRunning) {
                this.handleSpawnRequest(config);
            }
        });
    }

    /**
     * Log a message
     */
    private log(message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.stop();
        this.removeAllListeners();
    }
}

/**
 * Create a Conductor instance
 *
 * @param agentManager - The agent manager instance
 * @param workingDir - Working directory
 * @param outputChannel - Optional output channel
 * @returns Configured Conductor instance
 */
export function createConductor(
    agentManager: AgentManager,
    workingDir: string,
    outputChannel?: vscode.OutputChannel
): Conductor {
    return new Conductor(agentManager, workingDir, outputChannel);
}
