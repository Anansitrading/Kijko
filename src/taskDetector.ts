/**
 * Task Detector Module
 * 
 * Automatically detects ASYNC tasks that are ready for parallel execution
 * and triggers agent spawning based on configurable rules.
 */

import * as vscode from 'vscode';
import { ConductorIntegration, ConductorTask, TaskType, TaskStatus, TaskWave } from './conductorIntegration';
import { AgentManager, AgentInfo } from './agentManager';

/**
 * Auto-spawn configuration
 */
export interface AutoSpawnConfig {
    enabled: boolean;
    maxConcurrentAgents: number;
    spawnDelayMs: number;
    autoSpawnOnWaveComplete: boolean;
    prioritizeByComplexity: boolean;
    complexityOrder: ('low' | 'medium' | 'high')[];
}

/**
 * Spawn event data
 */
export interface SpawnEvent {
    task: ConductorTask;
    agentId: string;
    timestamp: Date;
    automatic: boolean;
}

/**
 * Detection result
 */
export interface DetectionResult {
    readyTasks: ConductorTask[];
    blockedTasks: ConductorTask[];
    currentWave: TaskWave | null;
    canSpawnMore: boolean;
    reason?: string;
}

/**
 * TaskDetector class
 * 
 * Monitors Conductor tracks and automatically spawns agents for ASYNC tasks
 */
export class TaskDetector {
    private conductor: ConductorIntegration;
    private agentManager: AgentManager;
    private config: AutoSpawnConfig;
    private isMonitoring: boolean = false;
    private monitorInterval: NodeJS.Timeout | null = null;
    private spawnHistory: SpawnEvent[] = [];
    private statusBarItem: vscode.StatusBarItem;

    private _onTaskDetected: vscode.EventEmitter<ConductorTask[]> = new vscode.EventEmitter<ConductorTask[]>();
    public readonly onTaskDetected: vscode.Event<ConductorTask[]> = this._onTaskDetected.event;

    private _onAutoSpawn: vscode.EventEmitter<SpawnEvent> = new vscode.EventEmitter<SpawnEvent>();
    public readonly onAutoSpawn: vscode.Event<SpawnEvent> = this._onAutoSpawn.event;

    constructor(
        conductor: ConductorIntegration,
        agentManager: AgentManager
    ) {
        this.conductor = conductor;
        this.agentManager = agentManager;
        this.config = this.loadConfig();

        // Create status bar item for monitoring status
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        this.statusBarItem.command = 'claudeAgentSpawner.toggleAutoDetect';
        this.updateStatusBar();

        // Listen to configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('claudeAgentSpawner')) {
                this.config = this.loadConfig();
                this.updateStatusBar();
            }
        });

        // Listen to track changes
        this.conductor.onTracksChanged(() => {
            if (this.isMonitoring) {
                this.checkForSpawnableTasks();
            }
        });

        // Listen to agent completions
        this.agentManager.onAgentStateChanged((agent: AgentInfo) => {
            if (agent.status === 'completed' && this.config.autoSpawnOnWaveComplete) {
                this.checkForSpawnableTasks();
            }
        });
    }

    /**
     * Load configuration from VS Code settings
     */
    private loadConfig(): AutoSpawnConfig {
        const config = vscode.workspace.getConfiguration('claudeAgentSpawner');
        return {
            enabled: config.get('autoDetect.enabled', true),
            maxConcurrentAgents: config.get('maxConcurrentAgents', 5),
            spawnDelayMs: config.get('autoDetect.spawnDelayMs', 1000),
            autoSpawnOnWaveComplete: config.get('autoDetect.autoSpawnOnWaveComplete', true),
            prioritizeByComplexity: config.get('autoDetect.prioritizeByComplexity', true),
            complexityOrder: config.get('autoDetect.complexityOrder', ['low', 'medium', 'high'])
        };
    }

    /**
     * Update status bar item
     */
    private updateStatusBar(): void {
        if (this.isMonitoring) {
            this.statusBarItem.text = '$(eye) Auto-Detect: ON';
            this.statusBarItem.tooltip = 'Click to disable automatic task detection';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.statusBarItem.text = '$(eye-closed) Auto-Detect: OFF';
            this.statusBarItem.tooltip = 'Click to enable automatic task detection';
            this.statusBarItem.backgroundColor = undefined;
        }
        this.statusBarItem.show();
    }

    /**
     * Start monitoring for spawnable tasks
     */
    public startMonitoring(): void {
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;
        this.updateStatusBar();

        // Initial check
        this.checkForSpawnableTasks();

        // Set up periodic monitoring
        this.monitorInterval = setInterval(
            () => this.checkForSpawnableTasks(),
            5000 // Check every 5 seconds
        );

        vscode.window.showInformationMessage('Task auto-detection enabled');
    }

    /**
     * Stop monitoring
     */
    public stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        this.updateStatusBar();

        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }

        vscode.window.showInformationMessage('Task auto-detection disabled');
    }

    /**
     * Toggle monitoring state
     */
    public toggleMonitoring(): void {
        if (this.isMonitoring) {
            this.stopMonitoring();
        } else {
            this.startMonitoring();
        }
    }

    /**
     * Check for tasks that can be spawned
     */
    public async checkForSpawnableTasks(): Promise<DetectionResult> {
        const result = this.detectSpawnableTasks();

        if (result.readyTasks.length > 0) {
            this._onTaskDetected.fire(result.readyTasks);

            // Auto-spawn if enabled and we can spawn more
            if (this.config.enabled && result.canSpawnMore) {
                await this.autoSpawnTasks(result.readyTasks);
            }
        }

        return result;
    }

    /**
     * Detect which tasks are ready to be spawned
     */
    public detectSpawnableTasks(trackName?: string): DetectionResult {
        const spawnableTasks = this.conductor.getSpawnableTasks(trackName);
        const runningAgents = this.agentManager.getRunningAgents();
        const runningCount = runningAgents.length;

        // Filter out tasks that already have agents assigned
        const assignedTaskIds = new Set(runningAgents.map(a => a.taskId).filter(Boolean));
        const readyTasks = spawnableTasks.filter(t => !assignedTaskIds.has(t.id));

        // Prioritize by complexity if configured
        if (this.config.prioritizeByComplexity) {
            readyTasks.sort((a, b) => {
                const aIndex = this.config.complexityOrder.indexOf(a.estimatedComplexity);
                const bIndex = this.config.complexityOrder.indexOf(b.estimatedComplexity);
                return aIndex - bIndex;
            });
        }

        // Determine if we can spawn more
        const canSpawnMore = runningCount < this.config.maxConcurrentAgents;
        const availableSlots = this.config.maxConcurrentAgents - runningCount;

        // Get current wave info
        const tracks = this.conductor.getTracks();
        let currentWave: TaskWave | null = null;
        if (tracks.length > 0) {
            currentWave = this.conductor.getNextWave(tracks[0].name);
        }

        // Blocked tasks are ASYNC tasks with unsatisfied dependencies
        const allTasks = tracks.flatMap(t => t.tasks);
        const blockedTasks = allTasks.filter(task => 
            task.type === TaskType.ASYNC &&
            task.status === TaskStatus.PENDING &&
            !readyTasks.includes(task)
        );

        return {
            readyTasks: readyTasks.slice(0, availableSlots),
            blockedTasks,
            currentWave,
            canSpawnMore,
            reason: canSpawnMore 
                ? undefined 
                : `Max concurrent agents (${this.config.maxConcurrentAgents}) reached`
        };
    }

    /**
     * Auto-spawn agents for detected tasks
     */
    private async autoSpawnTasks(tasks: ConductorTask[]): Promise<void> {
        const runningCount = this.agentManager.getRunningAgents().length;
        const availableSlots = this.config.maxConcurrentAgents - runningCount;
        const tasksToSpawn = tasks.slice(0, availableSlots);

        for (const task of tasksToSpawn) {
            // Add delay between spawns to prevent overwhelming the system
            if (tasksToSpawn.indexOf(task) > 0) {
                await this.delay(this.config.spawnDelayMs);
            }

            try {
                // Generate prompt for the task
                const prompt = this.conductor.generateTaskPrompt(task);

                // Spawn the agent
                const agentInfo = await this.agentManager.spawnAgent({
                    name: `Task: ${task.name}`,
                    prompt,
                    taskId: task.id,
                    useWorktree: task.type === TaskType.ASYNC,
                    worktreeBranch: `task/${task.id.replace(/_/g, '-')}`
                });

                // Update task status
                await this.conductor.updateTaskStatus(
                    task.id,
                    TaskStatus.IN_PROGRESS,
                    agentInfo.id
                );

                // Record spawn event
                const spawnEvent: SpawnEvent = {
                    task,
                    agentId: agentInfo.id,
                    timestamp: new Date(),
                    automatic: true
                };
                this.spawnHistory.push(spawnEvent);
                this._onAutoSpawn.fire(spawnEvent);

                vscode.window.showInformationMessage(
                    `Auto-spawned agent for task: ${task.name}`
                );
            } catch (error) {
                console.error(`Failed to auto-spawn agent for task ${task.id}:`, error);
                vscode.window.showErrorMessage(
                    `Failed to spawn agent for task: ${task.name}`
                );
            }
        }
    }

    /**
     * Manually spawn an agent for a specific task
     */
    public async spawnTaskAgent(task: ConductorTask): Promise<string> {
        const prompt = this.conductor.generateTaskPrompt(task);

        const agentInfo = await this.agentManager.spawnAgent({
            name: `Task: ${task.name}`,
            prompt,
            taskId: task.id,
            useWorktree: task.type === TaskType.ASYNC,
            worktreeBranch: `task/${task.id.replace(/_/g, '-')}`
        });

        await this.conductor.updateTaskStatus(
            task.id,
            TaskStatus.IN_PROGRESS,
            agentInfo.id
        );

        const spawnEvent: SpawnEvent = {
            task,
            agentId: agentInfo.id,
            timestamp: new Date(),
            automatic: false
        };
        this.spawnHistory.push(spawnEvent);

        return agentInfo.id;
    }

    /**
     * Spawn all tasks in the current wave
     */
    public async spawnCurrentWave(trackName: string): Promise<string[]> {
        const wave = this.conductor.getNextWave(trackName);
        if (!wave) {
            vscode.window.showWarningMessage('No pending wave found');
            return [];
        }

        const agentIds: string[] = [];
        const asyncTasks = wave.tasks.filter(
            t => t.type === TaskType.ASYNC && t.status === TaskStatus.PENDING
        );

        for (const task of asyncTasks) {
            if (asyncTasks.indexOf(task) > 0) {
                await this.delay(this.config.spawnDelayMs);
            }

            try {
                const agentId = await this.spawnTaskAgent(task);
                agentIds.push(agentId);
            } catch (error) {
                console.error(`Failed to spawn agent for task ${task.id}:`, error);
            }
        }

        vscode.window.showInformationMessage(
            `Spawned ${agentIds.length} agents for Wave ${wave.waveNumber}`
        );

        return agentIds;
    }

    /**
     * Get spawn history
     */
    public getSpawnHistory(): SpawnEvent[] {
        return [...this.spawnHistory];
    }

    /**
     * Clear spawn history
     */
    public clearSpawnHistory(): void {
        this.spawnHistory = [];
    }

    /**
     * Get current monitoring status
     */
    public isAutoDetectEnabled(): boolean {
        return this.isMonitoring;
    }

    /**
     * Get configuration
     */
    public getConfig(): AutoSpawnConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    public async updateConfig(updates: Partial<AutoSpawnConfig>): Promise<void> {
        const config = vscode.workspace.getConfiguration('claudeAgentSpawner');
        
        for (const [key, value] of Object.entries(updates)) {
            if (key === 'enabled') {
                await config.update('autoDetect.enabled', value, true);
            } else if (key === 'maxConcurrentAgents') {
                await config.update('maxConcurrentAgents', value, true);
            } else if (key === 'spawnDelayMs') {
                await config.update('autoDetect.spawnDelayMs', value, true);
            } else if (key === 'autoSpawnOnWaveComplete') {
                await config.update('autoDetect.autoSpawnOnWaveComplete', value, true);
            } else if (key === 'prioritizeByComplexity') {
                await config.update('autoDetect.prioritizeByComplexity', value, true);
            } else if (key === 'complexityOrder') {
                await config.update('autoDetect.complexityOrder', value, true);
            }
        }

        this.config = this.loadConfig();
    }

    /**
     * Helper: delay execution
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.stopMonitoring();
        this._onTaskDetected.dispose();
        this._onAutoSpawn.dispose();
        this.statusBarItem.dispose();
    }
}

/**
 * Factory function to create TaskDetector with proper initialization
 */
export async function createTaskDetector(
    conductor: ConductorIntegration,
    agentManager: AgentManager
): Promise<TaskDetector> {
    const detector = new TaskDetector(conductor, agentManager);
    
    // Start monitoring if configured to auto-start
    const config = vscode.workspace.getConfiguration('claudeAgentSpawner');
    if (config.get('autoDetect.startOnActivation', true)) {
        detector.startMonitoring();
    }

    return detector;
}
