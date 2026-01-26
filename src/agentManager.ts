/**
 * Agent Manager - Core agent lifecycle management
 *
 * Manages Claude agents with native webview chat panels.
 * Provides event emitter for state changes to enable UI updates.
 * Supports multi-agent orchestration with parent/child hierarchies.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ChatPanel, ChatPanelConfig } from './chatPanel';
import { AgentConfig, AgentState, AgentStatus, ClaudeStreamMessage } from './claude/types';

const execAsync = promisify(exec);

/**
 * Agent spawn options
 */
export interface SpawnOptions {
    name?: string;
    prompt: string;
    taskId?: string;
    useWorktree?: boolean;
    worktreeBranch?: string;
}

/**
 * Agent information
 */
export interface AgentInfo {
    id: string;
    name: string;
    task: string;
    taskId?: string;
    status: 'running' | 'completed' | 'failed' | 'idle';
    chatPanel?: ChatPanel;
    worktreePath?: string;
    branch?: string;
    startTime: Date;
    endTime?: Date;
}

/**
 * Agent hierarchy node for tree representation
 */
export interface AgentHierarchyNode {
    id: string;
    children: AgentHierarchyNode[];
}

/**
 * Agent Manager class
 *
 * Manages agent lifecycle with support for:
 * - Native webview chat panels
 * - Git worktree isolation
 * - Parent/child agent hierarchies for orchestration
 * - AgentState tracking for multi-agent coordination
 */
export class AgentManager {
    private agents: Map<string, AgentInfo> = new Map();
    private agentStates: Map<string, AgentState> = new Map();
    private parentChildMap: Map<string, string[]> = new Map(); // parentId -> childIds
    private childParentMap: Map<string, string> = new Map(); // childId -> parentId
    private workspaceRoot: string;
    private extensionUri: vscode.Uri | undefined;
    private statusBarItem: vscode.StatusBarItem;

    // Event emitters
    private _onAgentStateChanged: vscode.EventEmitter<AgentInfo> = new vscode.EventEmitter<AgentInfo>();
    public readonly onAgentStateChanged: vscode.Event<AgentInfo> = this._onAgentStateChanged.event;

    private _onAgentSpawned: vscode.EventEmitter<AgentInfo> = new vscode.EventEmitter<AgentInfo>();
    public readonly onAgentSpawned: vscode.Event<AgentInfo> = this._onAgentSpawned.event;

    private _onSpawnRequest: vscode.EventEmitter<AgentConfig> = new vscode.EventEmitter<AgentConfig>();
    public readonly onSpawnRequest: vscode.Event<AgentConfig> = this._onSpawnRequest.event;

    private _onAgentMessage: vscode.EventEmitter<{agentId: string; message: ClaudeStreamMessage}> = new vscode.EventEmitter();
    public readonly onAgentMessage: vscode.Event<{agentId: string; message: ClaudeStreamMessage}> = this._onAgentMessage.event;

    constructor(workspaceRoot: string, extensionUri?: vscode.Uri) {
        this.workspaceRoot = workspaceRoot;
        this.extensionUri = extensionUri;

        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'claudeAgentSpawner.showPanel';
        this.updateStatusBar();
        this.statusBarItem.show();
    }

    /**
     * Set extension URI (needed for webview resources)
     */
    public setExtensionUri(uri: vscode.Uri): void {
        this.extensionUri = uri;
    }

    /**
     * Spawn a new Claude agent with native chat panel
     */
    async spawnAgent(options: SpawnOptions): Promise<AgentInfo> {
        const config = vscode.workspace.getConfiguration('claudeAgentSpawner');
        const maxAgents = config.get<number>('maxConcurrentAgents', 5);
        const useWorktreesConfig = config.get<boolean>('useGitWorktrees', false);

        const runningCount = this.getRunningCount();
        if (runningCount >= maxAgents) {
            vscode.window.showWarningMessage(
                `Maximum concurrent agents (${maxAgents}) reached. Wait for agents to complete.`
            );
            throw new Error('Max agents reached');
        }

        if (!this.extensionUri) {
            throw new Error('Extension URI not set. Cannot create chat panel.');
        }

        const agentId = this.generateId();
        const agentName = options.name || `Agent-${agentId.slice(0, 8)}`;
        const useWorktree = options.useWorktree ?? useWorktreesConfig;

        let worktreePath: string | undefined;
        let branch: string | undefined;
        let cwd = this.workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        // Create git worktree for isolation (optional)
        if (useWorktree && cwd) {
            try {
                const worktreeBase = config.get<string>('worktreeBasePath', '../worktrees');
                const basePath = path.isAbsolute(worktreeBase)
                    ? worktreeBase
                    : path.join(cwd, worktreeBase);

                const safeName = agentName.replace(/[^a-zA-Z0-9-_]/g, '-');
                worktreePath = path.join(basePath, safeName);
                branch = options.worktreeBranch || `agent-${safeName}-${Date.now()}`;

                // Ensure base directory exists
                if (!fs.existsSync(basePath)) {
                    fs.mkdirSync(basePath, { recursive: true });
                }

                // Create worktree
                await execAsync(`git worktree add "${worktreePath}" -b "${branch}"`, { cwd });
                cwd = worktreePath;

                console.log(`Created worktree: ${worktreePath}`);
            } catch (error) {
                console.error('Failed to create worktree:', error);
                worktreePath = undefined;
                branch = undefined;
            }
        }

        // Create chat panel configuration
        const useClaudeCLI = config.get<boolean>('useClaudeCLI', true);
        const chatConfig: ChatPanelConfig = {
            agentId,
            agentName,
            initialPrompt: options.prompt,
            workspacePath: cwd,
            useClaudeCLI
        };

        // Create the chat panel
        const chatPanel = ChatPanel.createOrShow(this.extensionUri, chatConfig);

        const agentInfo: AgentInfo = {
            id: agentId,
            name: agentName,
            task: options.prompt,
            taskId: options.taskId,
            status: 'running',
            chatPanel: chatPanel,
            worktreePath: worktreePath,
            branch: branch,
            startTime: new Date()
        };

        this.agents.set(agentId, agentInfo);
        this.updateStatusBar();

        // Listen for panel disposal
        chatPanel.onDidDispose(() => {
            const agent = this.agents.get(agentId);
            if (agent) {
                agent.status = 'completed';
                agent.endTime = new Date();
                agent.chatPanel = undefined;
                this.updateStatusBar();
                this._onAgentStateChanged.fire(agent);
            }
        });

        this._onAgentSpawned.fire(agentInfo);
        this._onAgentStateChanged.fire(agentInfo);

        return agentInfo;
    }

    /**
     * Kill a specific agent
     */
    async killAgent(agentId: string): Promise<void> {
        const agent = this.agents.get(agentId);
        if (agent) {
            // Dispose chat panel
            if (agent.chatPanel) {
                agent.chatPanel.panel.dispose();
            }

            agent.status = 'completed';
            agent.endTime = new Date();

            // Cleanup worktree
            if (agent.worktreePath && agent.branch) {
                try {
                    const cwd = this.workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    if (cwd) {
                        await execAsync(`git worktree remove "${agent.worktreePath}" --force`, { cwd });
                        await execAsync(`git branch -D "${agent.branch}"`, { cwd });
                    }
                } catch (error) {
                    console.error('Failed to cleanup worktree:', error);
                }
            }

            this.updateStatusBar();
            this._onAgentStateChanged.fire(agent);
        }
    }

    /**
     * Kill all agents
     */
    async killAllAgents(): Promise<void> {
        const promises = Array.from(this.agents.keys()).map(id => this.killAgent(id));
        await Promise.all(promises);
    }

    /**
     * Focus an agent's chat panel
     */
    focusAgent(agentId: string): void {
        const agent = this.agents.get(agentId);
        if (agent && agent.chatPanel) {
            agent.chatPanel.reveal();
        } else if (agent && this.extensionUri) {
            // Recreate chat panel if it was closed
            const chatConfig: ChatPanelConfig = {
                agentId: agent.id,
                agentName: agent.name,
                initialPrompt: agent.task,
                workspacePath: agent.worktreePath || this.workspaceRoot
            };

            const chatPanel = ChatPanel.createOrShow(this.extensionUri, chatConfig);
            agent.chatPanel = chatPanel;
            agent.status = 'running';

            chatPanel.onDidDispose(() => {
                agent.status = 'completed';
                agent.endTime = new Date();
                agent.chatPanel = undefined;
                this.updateStatusBar();
                this._onAgentStateChanged.fire(agent);
            });

            this._onAgentStateChanged.fire(agent);
        }
    }

    /**
     * Refresh agent status
     */
    refreshStatus(): void {
        for (const [id, agent] of this.agents) {
            // Check if chat panel still exists
            const existingPanel = ChatPanel.getPanel(id);
            if (!existingPanel && agent.status === 'running') {
                agent.status = 'completed';
                agent.endTime = new Date();
                agent.chatPanel = undefined;
                this._onAgentStateChanged.fire(agent);
            }
        }
        this.updateStatusBar();
    }

    /**
     * Get all agents
     */
    getAllAgents(): AgentInfo[] {
        return Array.from(this.agents.values());
    }

    /**
     * Get agents (alias for getAllAgents)
     */
    getAgents(): AgentInfo[] {
        return this.getAllAgents();
    }

    /**
     * Get running agents
     */
    getRunningAgents(): AgentInfo[] {
        return this.getAllAgents().filter(a => a.status === 'running');
    }

    /**
     * Get running count
     */
    getRunningCount(): number {
        return this.getRunningAgents().length;
    }

    /**
     * Get agent by ID
     */
    getAgent(agentId: string): AgentInfo | undefined {
        return this.agents.get(agentId);
    }

    /**
     * Get agent history for display
     */
    getAgentHistory(): Array<{id: string; name: string; task: string; startTime: string; status: string}> {
        return this.getAllAgents().map(a => ({
            id: a.id,
            name: a.name,
            task: a.task,
            startTime: a.startTime.toISOString(),
            status: a.status
        }));
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Update status bar
     */
    private updateStatusBar(): void {
        const running = this.getRunningCount();
        const total = this.agents.size;

        if (running > 0) {
            this.statusBarItem.text = `$(hubot) ${running} agents`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                'statusBarItem.warningBackground'
            );
        } else {
            this.statusBarItem.text = `$(hubot) Agents`;
            this.statusBarItem.backgroundColor = undefined;
        }

        this.statusBarItem.tooltip = `Claude Agent Spawner\n${running} running / ${total} total`;
    }

    // ========================================
    // Agent Hierarchy Methods (Orchestration)
    // ========================================

    /**
     * Spawn a child agent from a parent agent
     *
     * @param parentId - ID of the parent agent
     * @param config - Configuration for the child agent
     * @returns Promise resolving to the child AgentInfo
     */
    async spawnChildAgent(parentId: string, config: AgentConfig): Promise<AgentInfo> {
        const parent = this.agents.get(parentId);
        if (!parent) {
            throw new Error(`Parent agent ${parentId} not found`);
        }

        const child = await this.spawnAgent({
            name: config.name,
            prompt: config.systemPrompt || `Working as child of ${parent.name}`,
            useWorktree: true
        });

        // Set up parent/child relationship
        this.setParent(child.id, parentId);

        // Create AgentState for the child
        const agentState: AgentState = {
            config: {
                ...config,
                id: child.id,
                workingDir: child.worktreePath || this.workspaceRoot,
                parentId
            },
            status: 'running',
            messages: [],
            childAgents: [],
            createdAt: Date.now(),
            lastActivity: Date.now()
        };
        this.agentStates.set(child.id, agentState);

        return child;
    }

    /**
     * Set parent-child relationship between agents
     *
     * @param childId - ID of the child agent
     * @param parentId - ID of the parent agent
     */
    setParent(childId: string, parentId: string): void {
        // Update child -> parent mapping
        this.childParentMap.set(childId, parentId);

        // Update parent -> children mapping
        const children = this.parentChildMap.get(parentId) || [];
        if (!children.includes(childId)) {
            children.push(childId);
            this.parentChildMap.set(parentId, children);
        }

        // Update parent's AgentState
        const parentState = this.agentStates.get(parentId);
        if (parentState && !parentState.childAgents.includes(childId)) {
            parentState.childAgents.push(childId);
            parentState.lastActivity = Date.now();
        }
    }

    /**
     * Get parent ID of an agent
     *
     * @param agentId - ID of the agent
     * @returns Parent ID or undefined if no parent
     */
    getParent(agentId: string): string | undefined {
        return this.childParentMap.get(agentId);
    }

    /**
     * Get child IDs of an agent
     *
     * @param agentId - ID of the agent
     * @returns Array of child agent IDs
     */
    getChildren(agentId: string): string[] {
        return this.parentChildMap.get(agentId) || [];
    }

    /**
     * Get full agent hierarchy tree starting from a root agent
     *
     * @param rootId - ID of the root agent
     * @returns Hierarchical structure of agent IDs
     */
    getHierarchy(rootId: string): AgentHierarchyNode {
        return {
            id: rootId,
            children: this.getChildren(rootId).map(childId => this.getHierarchy(childId))
        };
    }

    /**
     * Check if an agent is a root agent (no parent)
     *
     * @param agentId - ID of the agent
     * @returns True if the agent has no parent
     */
    isRootAgent(agentId: string): boolean {
        return !this.childParentMap.has(agentId);
    }

    /**
     * Get all root agents (agents without parents)
     *
     * @returns Array of root agent IDs
     */
    getRootAgents(): string[] {
        return Array.from(this.agents.keys()).filter(id => this.isRootAgent(id));
    }

    // ========================================
    // Agent State Methods (Orchestration)
    // ========================================

    /**
     * Get AgentState for an agent
     *
     * @param agentId - ID of the agent
     * @returns AgentState or undefined
     */
    getAgentState(agentId: string): AgentState | undefined {
        return this.agentStates.get(agentId);
    }

    /**
     * Get all agent states
     *
     * @returns Map of agent ID to AgentState
     */
    getAllAgentStates(): Map<string, AgentState> {
        return new Map(this.agentStates);
    }

    /**
     * Update agent status
     *
     * @param agentId - ID of the agent
     * @param status - New status
     */
    updateAgentStatus(agentId: string, status: AgentStatus): void {
        const state = this.agentStates.get(agentId);
        if (state) {
            state.status = status;
            state.lastActivity = Date.now();
        }

        const agent = this.agents.get(agentId);
        if (agent) {
            // Map AgentStatus to AgentInfo.status
            switch (status) {
                case 'running':
                case 'waiting':
                    agent.status = 'running';
                    break;
                case 'completed':
                    agent.status = 'completed';
                    agent.endTime = new Date();
                    break;
                case 'error':
                    agent.status = 'failed';
                    agent.endTime = new Date();
                    break;
                default:
                    agent.status = 'idle';
            }
            this._onAgentStateChanged.fire(agent);
        }

        this.updateStatusBar();
    }

    /**
     * Add a message to an agent's history
     *
     * @param agentId - ID of the agent
     * @param message - Message to add
     */
    addAgentMessage(agentId: string, message: ClaudeStreamMessage): void {
        const state = this.agentStates.get(agentId);
        if (state) {
            state.messages.push(message);
            state.lastActivity = Date.now();
        }
        this._onAgentMessage.fire({ agentId, message });
    }

    /**
     * Request spawn of a new agent (emits event for Conductor to handle)
     *
     * @param config - Configuration for the agent to spawn
     */
    requestSpawn(config: AgentConfig): void {
        this._onSpawnRequest.fire(config);
    }

    /**
     * Notify parent agent that a child has completed
     *
     * @param childId - ID of the completed child agent
     * @param success - Whether the child completed successfully
     * @param result - Result message from the child
     */
    notifyParentOfCompletion(childId: string, success: boolean, result?: string): void {
        const parentId = this.getParent(childId);
        if (!parentId) {
            return;
        }

        const parentState = this.agentStates.get(parentId);
        if (parentState) {
            // Add completion message to parent's messages
            const message: ClaudeStreamMessage = {
                type: 'system',
                subtype: 'child_completion',
                content: `Child agent ${childId} ${success ? 'completed' : 'failed'}: ${result || 'No result'}`,
                timestamp: new Date().toISOString()
            };
            parentState.messages.push(message);
            parentState.lastActivity = Date.now();

            this._onAgentMessage.fire({ agentId: parentId, message });
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this._onAgentStateChanged.dispose();
        this._onAgentSpawned.dispose();
        this._onSpawnRequest.dispose();
        this._onAgentMessage.dispose();
        this.statusBarItem.dispose();
    }
}
