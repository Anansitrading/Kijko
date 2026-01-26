/**
 * Ralph - Runtime Assessment Layer for Process Health
 *
 * Ralph monitors agent health and system stability by:
 * - Performing periodic health assessments of all running agents
 * - Detecting stuck, looping, or failing agents
 * - Suggesting interventions (restart, stop, redirect)
 * - Providing system-level monitoring
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { ClaudeProcess, createClaudeProcess } from './claudeProcess';
import { AgentManager } from '../agentManager';
import {
    AgentConfig,
    AgentState,
    RalphAssessment,
    AgentStatusReport,
    HealthStatus,
    InterventionRequest,
    InterventionAction,
    RalphEvents
} from './types';

/**
 * Default assessment interval: 30 seconds
 */
const DEFAULT_INTERVAL_MS = 30000;

/**
 * System prompt for Ralph assessments
 */
const RALPH_SYSTEM_PROMPT = `You are Ralph, the Runtime Assessment Layer for Process Health. Your role is to monitor agent health and system stability.

For each assessment, analyze:
1. Agent activity - Is each agent making progress or stuck?
2. Error patterns - Are there repeated errors or failures?
3. Resource usage - Are agents responding promptly?
4. Task completion - Are tasks completing in reasonable time?

Provide assessments in this format:
- Overall health: good | warning | critical
- Per-agent status with concerns
- Recommendations for interventions

If an agent appears stuck (no activity for extended period), recommend restart.
If an agent is in an error loop, recommend stop.
If an agent is making slow progress, note but don't intervene.

Be conservative with intervention recommendations - only suggest action when clearly needed.`;

/**
 * Ralph class for agent health monitoring
 */
export class Ralph extends EventEmitter {
    private ralphAgent: ClaudeProcess | null = null;
    private assessmentInterval: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private lastAssessment: RalphAssessment | null = null;
    private assessmentHistory: RalphAssessment[] = [];
    private outputChannel: vscode.OutputChannel;
    private stuckThresholdMs: number = 60000; // 1 minute
    private errorThreshold: number = 3; // 3 consecutive errors

    constructor(
        private agentManager: AgentManager,
        private workingDir: string,
        outputChannel?: vscode.OutputChannel,
        private intervalMs: number = DEFAULT_INTERVAL_MS
    ) {
        super();
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Ralph');
    }

    /**
     * Check if Ralph is currently running
     */
    public get running(): boolean {
        return this.isRunning;
    }

    /**
     * Get the last assessment
     */
    public getLastAssessment(): RalphAssessment | null {
        return this.lastAssessment;
    }

    /**
     * Get assessment history
     */
    public getAssessmentHistory(): RalphAssessment[] {
        return [...this.assessmentHistory];
    }

    /**
     * Start Ralph monitoring
     */
    public async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error('Ralph is already running');
        }

        this.log('Starting Ralph health monitoring');
        this.isRunning = true;

        // Start periodic assessments
        this.assessmentInterval = setInterval(() => {
            this.performAssessment();
        }, this.intervalMs);

        // Perform initial assessment
        await this.performAssessment();

        this.emit('started');
    }

    /**
     * Stop Ralph monitoring
     */
    public stop(): void {
        this.log('Stopping Ralph');

        if (this.assessmentInterval) {
            clearInterval(this.assessmentInterval);
            this.assessmentInterval = null;
        }

        if (this.ralphAgent) {
            this.ralphAgent.stop();
            this.ralphAgent = null;
        }

        this.isRunning = false;
        this.emit('stopped');
    }

    /**
     * Perform a health assessment
     */
    private async performAssessment(): Promise<void> {
        const states = this.agentManager.getAllAgentStates();

        if (states.size === 0) {
            // No agents to assess
            return;
        }

        this.log(`Performing health assessment for ${states.size} agents`);

        const assessment = this.analyzeAgentStates(states);
        this.lastAssessment = assessment;
        this.assessmentHistory.push(assessment);

        // Keep only last 100 assessments
        if (this.assessmentHistory.length > 100) {
            this.assessmentHistory = this.assessmentHistory.slice(-100);
        }

        this.emit('assessment', assessment);

        // Log assessment summary
        this.log(`Assessment: ${assessment.overallHealth} - ${assessment.systemRecommendations.length} recommendations`);

        // Check if intervention is required
        if (assessment.interventionRequired) {
            for (const [agentId, status] of assessment.agentStatuses) {
                if (status.recommendations.length > 0) {
                    const action = this.determineAction(status);
                    if (action) {
                        const request: InterventionRequest = {
                            agentId,
                            action,
                            reason: status.concerns.join('; '),
                            timestamp: Date.now()
                        };
                        this.emit('interventionRequired', request);
                    }
                }
            }
        }
    }

    /**
     * Analyze agent states and produce an assessment
     */
    private analyzeAgentStates(states: Map<string, AgentState>): RalphAssessment {
        const agentStatuses = new Map<string, AgentStatusReport>();
        const systemRecommendations: string[] = [];
        let overallHealth: HealthStatus = 'good';
        let interventionRequired = false;

        const now = Date.now();

        for (const [agentId, state] of states) {
            const report = this.analyzeAgent(agentId, state, now);
            agentStatuses.set(agentId, report);

            // Update overall health based on agent status
            if (report.concerns.length > 0) {
                if (overallHealth === 'good') {
                    overallHealth = 'warning';
                }
            }

            if (report.recommendations.some(r => r.includes('stop') || r.includes('restart'))) {
                overallHealth = 'critical';
                interventionRequired = true;
            }
        }

        // Add system-level recommendations
        const runningCount = Array.from(states.values()).filter(s => s.status === 'running').length;
        const errorCount = Array.from(states.values()).filter(s => s.status === 'error').length;

        if (errorCount > runningCount / 2) {
            systemRecommendations.push('High error rate across agents - consider pausing orchestration');
            overallHealth = 'critical';
        }

        if (runningCount === 0 && states.size > 0) {
            systemRecommendations.push('No agents currently running');
        }

        return {
            timestamp: now,
            overallHealth,
            agentStatuses,
            systemRecommendations,
            interventionRequired
        };
    }

    /**
     * Analyze a single agent's state
     */
    private analyzeAgent(agentId: string, state: AgentState, now: number): AgentStatusReport {
        const concerns: string[] = [];
        const recommendations: string[] = [];

        // Check for stuck agent
        const timeSinceActivity = now - state.lastActivity;
        if (state.status === 'running' && timeSinceActivity > this.stuckThresholdMs) {
            concerns.push(`No activity for ${Math.round(timeSinceActivity / 1000)}s`);
            recommendations.push(`Consider restarting agent ${agentId}`);
        }

        // Check for error patterns
        const recentMessages = state.messages.slice(-10);
        const errorMessages = recentMessages.filter(m => m.is_error || m.type === 'error');
        if (errorMessages.length >= this.errorThreshold) {
            concerns.push(`${errorMessages.length} errors in last ${recentMessages.length} messages`);
            recommendations.push(`Consider stopping agent ${agentId} due to repeated errors`);
        }

        // Check for waiting state
        if (state.status === 'waiting' && timeSinceActivity > this.stuckThresholdMs * 2) {
            concerns.push(`Agent waiting for extended period`);
            recommendations.push(`Check if agent ${agentId} is blocked on user input`);
        }

        // Check for idle state with assigned task
        if (state.status === 'idle' && state.currentTask) {
            concerns.push(`Agent idle but has assigned task: ${state.currentTask}`);
            recommendations.push(`Restart agent ${agentId} to continue task`);
        }

        return {
            agentId,
            status: state.status,
            concerns,
            recommendations
        };
    }

    /**
     * Determine intervention action based on status report
     */
    private determineAction(status: AgentStatusReport): InterventionAction | null {
        const recText = status.recommendations.join(' ').toLowerCase();

        if (recText.includes('stop')) {
            return 'stop';
        }

        if (recText.includes('restart')) {
            return 'restart';
        }

        if (recText.includes('redirect') || recText.includes('blocked')) {
            return 'redirect';
        }

        return null;
    }

    /**
     * Request intervention on an agent
     *
     * @param agentId - ID of the agent
     * @param action - Intervention action
     * @param reason - Reason for intervention
     */
    public async requestIntervention(
        agentId: string,
        action: InterventionAction,
        reason: string
    ): Promise<void> {
        this.log(`Intervention requested: ${action} on ${agentId} - ${reason}`);

        switch (action) {
            case 'stop':
                await this.agentManager.killAgent(agentId);
                break;

            case 'restart':
                const state = this.agentManager.getAgentState(agentId);
                if (state) {
                    await this.agentManager.killAgent(agentId);
                    // Restart with same config
                    await this.agentManager.spawnAgent({
                        name: state.config.name,
                        prompt: state.config.systemPrompt || state.currentTask || 'Resume previous task'
                    });
                }
                break;

            case 'redirect':
                // For redirect, we notify but don't take action
                this.log(`Redirect recommended for ${agentId} - manual intervention needed`);
                break;
        }
    }

    /**
     * Set stuck threshold
     *
     * @param ms - Threshold in milliseconds
     */
    public setStuckThreshold(ms: number): void {
        this.stuckThresholdMs = ms;
    }

    /**
     * Set error threshold
     *
     * @param count - Number of errors before flagging
     */
    public setErrorThreshold(count: number): void {
        this.errorThreshold = count;
    }

    /**
     * Set assessment interval
     *
     * @param ms - Interval in milliseconds
     */
    public setInterval(ms: number): void {
        this.intervalMs = ms;

        // Restart interval if running
        if (this.isRunning && this.assessmentInterval) {
            clearInterval(this.assessmentInterval);
            this.assessmentInterval = setInterval(() => {
                this.performAssessment();
            }, this.intervalMs);
        }
    }

    /**
     * Force an immediate assessment
     */
    public async forceAssessment(): Promise<RalphAssessment> {
        await this.performAssessment();
        return this.lastAssessment!;
    }

    /**
     * Get health summary for display
     */
    public getHealthSummary(): {
        status: HealthStatus;
        agentCount: number;
        concernCount: number;
        lastAssessmentAge: number;
    } {
        const states = this.agentManager.getAllAgentStates();

        return {
            status: this.lastAssessment?.overallHealth || 'good',
            agentCount: states.size,
            concernCount: this.lastAssessment
                ? Array.from(this.lastAssessment.agentStatuses.values())
                    .reduce((sum, s) => sum + s.concerns.length, 0)
                : 0,
            lastAssessmentAge: this.lastAssessment
                ? Date.now() - this.lastAssessment.timestamp
                : 0
        };
    }

    /**
     * Log a message
     */
    private log(message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] [Ralph] ${message}`);
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
 * Create a Ralph instance
 *
 * @param agentManager - The agent manager instance
 * @param workingDir - Working directory
 * @param outputChannel - Optional output channel
 * @param intervalMs - Assessment interval in milliseconds
 * @returns Configured Ralph instance
 */
export function createRalph(
    agentManager: AgentManager,
    workingDir: string,
    outputChannel?: vscode.OutputChannel,
    intervalMs: number = DEFAULT_INTERVAL_MS
): Ralph {
    return new Ralph(agentManager, workingDir, outputChannel, intervalMs);
}
