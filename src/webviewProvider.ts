/**
 * Webview Provider - Claude Code-style UI for agent management
 */

import * as vscode from 'vscode';
import { AgentManager, AgentInfo } from './agentManager';
import { ConductorIntegration } from './conductorIntegration';

export class AgentSpawnerViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'claudeAgentSpawner.mainView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _agentManager: AgentManager,
        private readonly _conductorIntegration: ConductorIntegration
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlContent(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            console.log('[AgentSpawner] Received webview message:', data.type);

            try {
                switch (data.type) {
                    case 'spawnAgent':
                        console.log('[AgentSpawner] Executing spawnAgent command...');
                        await vscode.commands.executeCommand('claudeAgentSpawner.spawnAgent');
                        console.log('[AgentSpawner] spawnAgent command completed');
                        break;
                    case 'spawnFromConductor':
                        console.log('[AgentSpawner] Executing spawnFromConductor command...');
                        await vscode.commands.executeCommand('claudeAgentSpawner.spawnFromConductor');
                        break;
                    case 'killAgent':
                        await vscode.commands.executeCommand('claudeAgentSpawner.killAgent', data.agentId);
                        break;
                    case 'focusAgent':
                        vscode.commands.executeCommand('claudeAgentSpawner.focusAgent', data.agentId);
                        break;
                    case 'killAll':
                        await vscode.commands.executeCommand('claudeAgentSpawner.killAllAgents');
                        break;
                    case 'refresh':
                        this.refresh();
                        break;
                    case 'startConductor':
                        await vscode.commands.executeCommand('claudeConductor.start');
                        break;
                    case 'stopConductor':
                        await vscode.commands.executeCommand('claudeConductor.stopAll');
                        break;
                    case 'toggleRalph':
                        await vscode.commands.executeCommand('claudeConductor.toggleRalph');
                        break;
                    default:
                        console.log('[AgentSpawner] Unknown message type:', data.type);
                }
            } catch (error) {
                console.error('[AgentSpawner] Error handling message:', error);
                vscode.window.showErrorMessage(`Agent Spawner Error: ${error}`);
            }
        });

        // Initial refresh
        this.refresh();
    }

    public refresh() {
        if (this._view) {
            const agents = this._agentManager.getAgents();
            const history = this._agentManager.getAgentHistory();
            this._view.webview.postMessage({
                type: 'updateAgents',
                agents: agents.map(a => ({
                    id: a.id,
                    name: a.name,
                    task: a.task,
                    status: a.status,
                    startTime: a.startTime.toISOString(),
                    endTime: a.endTime?.toISOString(),
                    worktreePath: a.worktreePath
                })),
                history: history.slice(0, 20)
            });
        }
    }

    /**
     * Update conductor status in the webview
     */
    public updateConductorStatus(active: boolean, goal?: string) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateConductor',
                data: { active, goal }
            });
        }
    }

    /**
     * Update Ralph status in the webview
     */
    public updateRalphStatus(active: boolean, status?: string, agentCount?: number, concernCount?: number) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateRalph',
                data: { active, status, agentCount, concernCount }
            });
        }
    }

    /**
     * Update agent hierarchy in the webview
     */
    public updateHierarchy(hierarchy: any[]) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateHierarchy',
                data: hierarchy
            });
        }
    }

    private _getHtmlContent(webview: vscode.Webview): string {
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Claude Agent Spawner</title>
    <style>
        :root {
            --vscode-font-family: var(--vscode-editor-font-family, 'SF Mono', Consolas, monospace);
        }
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: var(--vscode-font-family);
            font-size: 13px;
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            padding: 0;
            height: 100vh;
            overflow: hidden;
        }
        
        .container {
            display: flex;
            flex-direction: column;
            height: 100%;
        }
        
        /* Header - matches Claude Code style */
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBarSectionHeader-background);
        }
        
        .header-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-sideBarSectionHeader-foreground);
        }
        
        .header-actions {
            display: flex;
            gap: 4px;
        }
        
        .icon-btn {
            background: transparent;
            border: none;
            color: var(--vscode-icon-foreground);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .icon-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }
        
        /* Session list - matches Claude Code history panel */
        .sessions-container {
            flex: 1;
            overflow-y: auto;
            padding: 8px 0;
        }
        
        .section-header {
            padding: 8px 16px 4px;
            font-size: 11px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .agent-item {
            display: flex;
            align-items: center;
            padding: 8px 16px;
            cursor: pointer;
            gap: 10px;
            border-left: 3px solid transparent;
            transition: all 0.1s ease;
        }
        
        .agent-item:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .agent-item.running {
            border-left-color: var(--vscode-terminal-ansiGreen);
        }
        
        .agent-item.completed {
            border-left-color: var(--vscode-terminal-ansiBlue);
            opacity: 0.7;
        }
        
        .agent-item.failed {
            border-left-color: var(--vscode-terminal-ansiRed);
        }
        
        .agent-icon {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--vscode-badge-background);
            border-radius: 6px;
            font-size: 14px;
        }
        
        .agent-icon.running {
            background: rgba(40, 167, 69, 0.2);
            color: var(--vscode-terminal-ansiGreen);
        }
        
        .agent-info {
            flex: 1;
            min-width: 0;
        }
        
        .agent-name {
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .agent-task {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .agent-time {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
        }
        
        .agent-actions {
            display: flex;
            gap: 2px;
            opacity: 0;
            transition: opacity 0.1s;
        }
        
        .agent-item:hover .agent-actions {
            opacity: 1;
        }
        
        /* Spawn button - prominent like Claude Code new chat */
        .spawn-section {
            padding: 12px 16px;
            border-top: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBar-background);
        }
        
        .spawn-btn {
            width: 100%;
            padding: 10px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: background 0.1s;
        }
        
        .spawn-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .spawn-btn.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            margin-top: 8px;
        }
        
        .spawn-btn.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        /* Status indicator */
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--vscode-terminal-ansiGreen);
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        /* Empty state */
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
        }
        
        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
        
        .empty-state-text {
            font-size: 13px;
            margin-bottom: 16px;
        }
        
        /* Running count badge */
        .running-badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 600;
        }

        /* Conductor Section */
        .conductor-section {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 12px 16px;
            background: var(--vscode-sideBarSectionHeader-background);
        }

        .conductor-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .conductor-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--vscode-sideBarSectionHeader-foreground);
        }

        .conductor-status {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
        }

        .conductor-status.active {
            color: var(--vscode-terminal-ansiGreen);
        }

        .conductor-status.inactive {
            color: var(--vscode-descriptionForeground);
        }

        .conductor-btn {
            width: 100%;
            padding: 8px 12px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        .conductor-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .conductor-btn.stop {
            background: rgba(239, 68, 68, 0.15);
            color: #f87171;
        }

        .conductor-btn.stop:hover {
            background: rgba(239, 68, 68, 0.25);
        }

        /* Ralph Health Panel */
        .ralph-section {
            padding: 8px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: none;
        }

        .ralph-section.active {
            display: block;
        }

        .ralph-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
        }

        .ralph-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 500;
        }

        .ralph-health-badge {
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
        }

        .ralph-health-badge.good {
            background: rgba(34, 197, 94, 0.15);
            color: #4ade80;
        }

        .ralph-health-badge.warning {
            background: rgba(251, 191, 36, 0.15);
            color: #fbbf24;
        }

        .ralph-health-badge.critical {
            background: rgba(239, 68, 68, 0.15);
            color: #f87171;
        }

        .ralph-stats {
            display: flex;
            gap: 16px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .ralph-stat {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        /* Agent Hierarchy */
        .hierarchy-section {
            padding: 8px 0;
            display: none;
        }

        .hierarchy-section.active {
            display: block;
        }

        .hierarchy-node {
            display: flex;
            align-items: center;
            padding: 4px 16px;
            gap: 8px;
            font-size: 12px;
        }

        .hierarchy-node.child {
            padding-left: 32px;
        }

        .hierarchy-connector {
            width: 12px;
            border-left: 1px solid var(--vscode-panel-border);
            border-bottom: 1px solid var(--vscode-panel-border);
            height: 12px;
            margin-right: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-title">
                <span>🤖</span>
                <span>Agents</span>
                <span class="running-badge" id="runningCount">0</span>
            </div>
            <div class="header-actions">
                <button class="icon-btn" id="refreshBtn" title="Refresh">
                    ↻
                </button>
            </div>
        </div>

        <!-- Conductor Section -->
        <div class="conductor-section" id="conductorSection">
            <div class="conductor-header">
                <div class="conductor-title">
                    <span>🎭</span>
                    <span>Conductor</span>
                </div>
                <div class="conductor-status inactive" id="conductorStatus">
                    <span class="status-dot" style="display:none"></span>
                    <span id="conductorStatusText">Inactive</span>
                </div>
            </div>
            <button class="conductor-btn" id="conductorBtn">
                <span>▶</span>
                <span>Start Conductor</span>
            </button>
        </div>

        <!-- Ralph Health Section -->
        <div class="ralph-section" id="ralphSection">
            <div class="ralph-header">
                <div class="ralph-title">
                    <span>🔍</span>
                    <span>Ralph Health Monitor</span>
                </div>
                <span class="ralph-health-badge good" id="ralphHealthBadge">Good</span>
            </div>
            <div class="ralph-stats">
                <div class="ralph-stat">
                    <span>Agents:</span>
                    <span id="ralphAgentCount">0</span>
                </div>
                <div class="ralph-stat">
                    <span>Concerns:</span>
                    <span id="ralphConcernCount">0</span>
                </div>
            </div>
        </div>

        <!-- Agent Hierarchy -->
        <div class="hierarchy-section" id="hierarchySection">
            <div class="section-header">Agent Hierarchy</div>
            <div id="hierarchyTree"></div>
        </div>

        <div class="sessions-container" id="agentList">
            <div class="empty-state">
                <div class="empty-state-icon">🚀</div>
                <div class="empty-state-text">No agents running.<br>Spawn an agent to get started.</div>
            </div>
        </div>

        <div class="spawn-section">
            <button class="spawn-btn" id="spawnAgentBtn">
                <span>+</span>
                <span>New Agent</span>
            </button>
            <button class="spawn-btn secondary" id="spawnFromConductorBtn">
                <span>📋</span>
                <span>Spawn from Conductor</span>
            </button>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        console.log('[AgentSpawner Webview] Script initialized');

        let agents = [];
        let history = [];

        // Button event listeners (CSP-compliant - no inline handlers)
        document.getElementById('spawnAgentBtn').addEventListener('click', function() {
            console.log('[AgentSpawner Webview] spawnAgent button clicked');
            try {
                vscode.postMessage({ type: 'spawnAgent' });
                console.log('[AgentSpawner Webview] Message posted successfully');
            } catch (err) {
                console.error('[AgentSpawner Webview] Error posting message:', err);
            }
        });

        document.getElementById('spawnFromConductorBtn').addEventListener('click', function() {
            console.log('[AgentSpawner Webview] spawnFromConductor button clicked');
            vscode.postMessage({ type: 'spawnFromConductor' });
        });

        document.getElementById('refreshBtn').addEventListener('click', function() {
            vscode.postMessage({ type: 'refresh' });
        });

        // Conductor button handler
        let conductorActive = false;
        document.getElementById('conductorBtn').addEventListener('click', function() {
            if (conductorActive) {
                vscode.postMessage({ type: 'stopConductor' });
            } else {
                vscode.postMessage({ type: 'startConductor' });
            }
        });

        // Update conductor UI
        function updateConductor(data) {
            conductorActive = data.active;
            const statusEl = document.getElementById('conductorStatus');
            const statusTextEl = document.getElementById('conductorStatusText');
            const btnEl = document.getElementById('conductorBtn');

            if (data.active) {
                statusEl.className = 'conductor-status active';
                statusEl.querySelector('.status-dot').style.display = 'inline-block';
                statusTextEl.textContent = 'Active';
                btnEl.className = 'conductor-btn stop';
                btnEl.innerHTML = '<span>■</span><span>Stop Conductor</span>';
            } else {
                statusEl.className = 'conductor-status inactive';
                statusEl.querySelector('.status-dot').style.display = 'none';
                statusTextEl.textContent = 'Inactive';
                btnEl.className = 'conductor-btn';
                btnEl.innerHTML = '<span>▶</span><span>Start Conductor</span>';
            }
        }

        // Update Ralph UI
        function updateRalph(data) {
            const sectionEl = document.getElementById('ralphSection');
            const badgeEl = document.getElementById('ralphHealthBadge');
            const agentCountEl = document.getElementById('ralphAgentCount');
            const concernCountEl = document.getElementById('ralphConcernCount');

            if (data.active) {
                sectionEl.classList.add('active');
                badgeEl.className = 'ralph-health-badge ' + (data.status || 'good');
                badgeEl.textContent = (data.status || 'good').charAt(0).toUpperCase() + (data.status || 'good').slice(1);
                agentCountEl.textContent = data.agentCount || '0';
                concernCountEl.textContent = data.concernCount || '0';
            } else {
                sectionEl.classList.remove('active');
            }
        }

        // Update hierarchy tree
        function updateHierarchy(data) {
            const sectionEl = document.getElementById('hierarchySection');
            const treeEl = document.getElementById('hierarchyTree');

            if (data && data.length > 0) {
                sectionEl.classList.add('active');
                treeEl.innerHTML = data.map(node => renderHierarchyNode(node, false)).join('');
            } else {
                sectionEl.classList.remove('active');
                treeEl.innerHTML = '';
            }
        }

        function renderHierarchyNode(node, isChild) {
            const statusClass = node.status || 'idle';
            let html = \`
                <div class="hierarchy-node \${isChild ? 'child' : ''}">
                    \${isChild ? '<div class="hierarchy-connector"></div>' : ''}
                    <div class="status-dot" style="width:6px;height:6px;background:\${statusClass === 'running' ? 'var(--vscode-terminal-ansiGreen)' : 'var(--vscode-descriptionForeground)'}"></div>
                    <span>\${node.name || node.id}</span>
                </div>
            \`;

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    html += renderHierarchyNode(child, true);
                });
            }

            return html;
        }

        // Event delegation for dynamically created agent items
        document.getElementById('agentList').addEventListener('click', function(e) {
            const target = e.target;
            const agentItem = target.closest('.agent-item');
            const killBtn = target.closest('.kill-btn');

            if (killBtn) {
                e.stopPropagation();
                const agentId = killBtn.dataset.agentId;
                if (agentId) {
                    vscode.postMessage({ type: 'killAgent', agentId: agentId });
                }
                return;
            }

            if (agentItem) {
                const agentId = agentItem.dataset.agentId;
                if (agentId) {
                    vscode.postMessage({ type: 'focusAgent', agentId: agentId });
                }
            }
        });

        function killAll() {
            vscode.postMessage({ type: 'killAll' });
        }
        
        function formatTime(isoString) {
            const date = new Date(isoString);
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) return 'Just now';
            if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
            if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
            return date.toLocaleDateString();
        }
        
        function renderAgents() {
            const container = document.getElementById('agentList');
            const runningCount = document.getElementById('runningCount');
            
            const running = agents.filter(a => a.status === 'running');
            const completed = agents.filter(a => a.status !== 'running');
            
            runningCount.textContent = running.length;
            
            if (agents.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-state-icon">🚀</div>
                        <div class="empty-state-text">No agents running.<br>Spawn an agent to get started.</div>
                    </div>
                \`;
                return;
            }
            
            let html = '';
            
            if (running.length > 0) {
                html += '<div class="section-header">Running</div>';
                running.forEach(agent => {
                    html += renderAgentItem(agent);
                });
            }
            
            if (completed.length > 0) {
                html += '<div class="section-header">Completed</div>';
                completed.slice(0, 10).forEach(agent => {
                    html += renderAgentItem(agent);
                });
            }
            
            if (history.length > 0 && agents.length < 5) {
                html += '<div class="section-header">History</div>';
                history.slice(0, 5).forEach(h => {
                    html += \`
                        <div class="agent-item completed">
                            <div class="agent-icon">📜</div>
                            <div class="agent-info">
                                <div class="agent-name">\${h.name}</div>
                                <div class="agent-task">\${h.task.substring(0, 50)}...</div>
                            </div>
                            <div class="agent-time">\${formatTime(h.startTime)}</div>
                        </div>
                    \`;
                });
            }
            
            container.innerHTML = html;
        }
        
        function renderAgentItem(agent) {
            const isRunning = agent.status === 'running';
            return \`
                <div class="agent-item \${agent.status}" data-agent-id="\${agent.id}">
                    <div class="agent-icon \${agent.status}">
                        \${isRunning ? '<div class="status-dot"></div>' : '✓'}
                    </div>
                    <div class="agent-info">
                        <div class="agent-name">\${agent.name}</div>
                        <div class="agent-task">\${agent.task.substring(0, 40)}...</div>
                    </div>
                    <div class="agent-time">\${formatTime(agent.startTime)}</div>
                    <div class="agent-actions">
                        \${isRunning ? \`<button class="icon-btn kill-btn" data-agent-id="\${agent.id}" title="Stop">⏹</button>\` : ''}
                    </div>
                </div>
            \`;
        }
        
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updateAgents':
                    agents = message.agents;
                    history = message.history;
                    renderAgents();
                    break;
                case 'updateConductor':
                    updateConductor(message.data);
                    break;
                case 'updateRalph':
                    updateRalph(message.data);
                    break;
                case 'updateHierarchy':
                    updateHierarchy(message.data);
                    break;
            }
        });
        
        // Initial render
        renderAgents();
    </script>
</body>
</html>`;
    }

    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
