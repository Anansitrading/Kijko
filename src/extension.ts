/**
 * Claude Agent Spawner - VS Code Extension
 *
 * Spawns multiple Claude Code instances for parallel task execution.
 * Integrates with Conductor workflow for automated agent assignment.
 * 
 * Features:
 * - Spawn Claude Code instances as if clicking the "+" button manually
 * - Auto-detect ASYNC tasks from Conductor tracks
 * - Manage multiple agents with git worktree isolation
 * - Claude Code-style UI matching the existing extension look
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AgentManager } from './agentManager';
import { AgentSpawnerViewProvider } from './webviewProvider';
import { ConductorIntegration, TaskStatus } from './conductorIntegration';
import { TaskDetector, createTaskDetector } from './taskDetector';
import { detectClaudeCode, ClaudeCodeInfo } from './cliDetector';
import { Conductor, createConductor } from './claude/conductor';
import { Ralph, createRalph } from './claude/ralph';
import { ChatPanel } from './chatPanel';

// Global instances
let agentManager: AgentManager;
let viewProvider: AgentSpawnerViewProvider;
let conductorIntegration: ConductorIntegration;
let taskDetector: TaskDetector;
let cliInfo: ClaudeCodeInfo | null = null;
let conductor: Conductor | null = null;
let ralph: Ralph | null = null;
let mainChatPanel: ChatPanel | null = null;

// Output channel for logging
let outputChannel: vscode.OutputChannel;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('Claude Agent Spawner is now active');

    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Claude Agent Spawner');
    context.subscriptions.push(outputChannel);

    // Get workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showWarningMessage(
            'Claude Agent Spawner: No workspace folder open. Some features may be limited.'
        );
    }

    // Detect Claude Code CLI (async, non-blocking)
    checkCliStatus();

    // Initialize core components
    agentManager = new AgentManager(workspaceRoot || '', context.extensionUri);
    
    if (workspaceRoot) {
        conductorIntegration = new ConductorIntegration(workspaceRoot);
        await conductorIntegration.initialize();
    }

    // Initialize webview provider
    viewProvider = new AgentSpawnerViewProvider(
        context.extensionUri,
        agentManager,
        conductorIntegration
    );

    // Register webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'claudeAgentSpawner.mainView',
            viewProvider
        )
    );

    // Initialize task detector after other components
    if (workspaceRoot && conductorIntegration) {
        taskDetector = await createTaskDetector(conductorIntegration, agentManager);
        
        // Connect task detector events to view refresh
        taskDetector.onTaskDetected(() => viewProvider.refresh());
        taskDetector.onAutoSpawn(() => viewProvider.refresh());
    }

    // Register all commands
    registerCommands(context);

    // Listen for agent state changes to refresh view
    agentManager.onAgentStateChanged(() => viewProvider.refresh());

    // Initialize Conductor and Ralph
    if (workspaceRoot) {
        conductor = createConductor(agentManager, workspaceRoot, outputChannel);
        ralph = createRalph(agentManager, workspaceRoot, outputChannel);

        // Wire up Conductor events
        conductor.on('started', (goal) => {
            outputChannel.appendLine(`[Conductor] Started with goal: ${goal}`);
            viewProvider.updateConductorStatus(true, goal);
        });

        conductor.on('completed', (result) => {
            outputChannel.appendLine(`[Conductor] Completed: ${result}`);
            viewProvider.updateConductorStatus(false);
        });

        conductor.on('error', (err) => {
            outputChannel.appendLine(`[Conductor] Error: ${err.message}`);
            vscode.window.showErrorMessage(`Conductor error: ${err.message}`);
        });

        conductor.on('agentSpawned', (agentId, task) => {
            outputChannel.appendLine(`[Conductor] Spawned agent ${agentId} for task: ${task.description}`);
            viewProvider.refresh();
        });

        // Wire up Ralph events
        ralph.on('assessment', (assessment) => {
            if (ralph) {
                const summary = ralph.getHealthSummary();
                viewProvider.updateRalphStatus(
                    true,
                    summary.status,
                    summary.agentCount,
                    summary.concernCount
                );
            }
        });

        ralph.on('interventionRequired', (request) => {
            outputChannel.appendLine(`[Ralph] Intervention required for ${request.agentId}: ${request.reason}`);
            vscode.window.showWarningMessage(
                `Ralph suggests ${request.action} on agent ${request.agentId}: ${request.reason}`,
                'Apply',
                'Dismiss'
            ).then(async (selection) => {
                if (selection === 'Apply' && ralph) {
                    await ralph.requestIntervention(request.agentId, request.action, request.reason);
                    viewProvider.refresh();
                }
            });
        });

        // Register Conductor and Ralph commands
        registerConductorCommands(context, workspaceRoot);
    }

    // Auto-open main chat panel on activation (no button click needed)
    outputChannel.appendLine('[Extension] Scheduling auto-open chat panel...');
    outputChannel.show(); // Show output immediately
    vscode.window.showInformationMessage('Claude Agent Spawner: Opening chat panel...');

    setTimeout(() => {
        outputChannel.appendLine('[Extension] Auto-opening chat panel now');
        openMainChatPanel(context.extensionUri, workspaceRoot);
    }, 1500); // Delay to let UI settle

    // Return API for other extensions
    return {
        spawnAgent: (prompt: string, name?: string) => agentManager.spawnAgent({ name: name || 'Agent', prompt }),
        getAgents: () => agentManager.getAllAgents(),
        killAgent: (id: string) => agentManager.killAgent(id)
    };
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
    console.log('[AgentSpawner] Registering commands...');

    // Spawn single agent with prompt
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeAgentSpawner.spawnAgent', async () => {
            console.log('[AgentSpawner] spawnAgent command invoked');
            outputChannel.appendLine('[CMD] spawnAgent command invoked');

            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter the initial prompt for the new Claude agent',
                placeHolder: 'e.g., Implement the user authentication feature',
                ignoreFocusOut: true
            });

            console.log('[AgentSpawner] User prompt:', prompt ? 'provided' : 'cancelled');

            if (prompt) {
                const name = await vscode.window.showInputBox({
                    prompt: 'Enter a name for this agent (optional)',
                    placeHolder: 'e.g., Auth-Agent'
                });

                try {
                    await agentManager.spawnAgent({
                        name: name || `Agent-${Date.now()}`,
                        prompt
                    });
                    viewProvider.refresh();
                    vscode.window.showInformationMessage('Claude agent spawned successfully');
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to spawn agent: ${error}`);
                }
            }
        })
    );

    // Spawn multiple agents from task files
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeAgentSpawner.spawnMultiple', async () => {
            const taskFiles = await selectTaskFiles();
            if (taskFiles && taskFiles.length > 0) {
                const config = vscode.workspace.getConfiguration('claudeAgentSpawner');
                const maxAgents = config.get<number>('maxConcurrentAgents', 5);
                const runningCount = agentManager.getRunningAgents().length;
                const availableSlots = maxAgents - runningCount;

                if (taskFiles.length > availableSlots) {
                    const proceed = await vscode.window.showWarningMessage(
                        `Only ${availableSlots} slots available. Spawn first ${availableSlots} tasks?`,
                        'Yes', 'Cancel'
                    );
                    if (proceed !== 'Yes') {
                        return;
                    }
                }

                const filesToSpawn = taskFiles.slice(0, availableSlots);
                let spawned = 0;

                for (const file of filesToSpawn) {
                    try {
                        const content = fs.readFileSync(file, 'utf-8');
                        const taskName = path.basename(file, '.md').replace(/_/g, ' ');
                        
                        await agentManager.spawnAgent({
                            name: taskName,
                            prompt: `Read and implement the following task:\n\n${content}`,
                            useWorktree: file.includes('_ASYNC'),
                            worktreeBranch: `task/${path.basename(file, '.md')}`
                        });
                        spawned++;
                        
                        // Small delay between spawns
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (error) {
                        console.error(`Failed to spawn agent for ${file}:`, error);
                    }
                }

                viewProvider.refresh();
                vscode.window.showInformationMessage(`Spawned ${spawned} Claude agents`);
            }
        })
    );

    // Spawn from Conductor track
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeAgentSpawner.spawnFromConductor', async () => {
            if (!conductorIntegration) {
                vscode.window.showErrorMessage('Conductor integration not available');
                return;
            }

            const tracks = conductorIntegration.getTracks();
            if (tracks.length === 0) {
                vscode.window.showWarningMessage('No Conductor tracks found in .conductor/tracks/');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                tracks.map(t => ({
                    label: t.name,
                    description: `${t.metadata.completedTasks}/${t.metadata.totalTasks} completed`,
                    detail: `Mode: ${t.metadata.planMode} | Waves: ${t.metadata.waves.length}`,
                    track: t
                })),
                { placeHolder: 'Select a Conductor track' }
            );

            if (selected) {
                const spawnableTasks = conductorIntegration.getSpawnableTasks(selected.track.name);
                
                if (spawnableTasks.length === 0) {
                    vscode.window.showInformationMessage('No spawnable ASYNC tasks in this track');
                    return;
                }

                const action = await vscode.window.showQuickPick(
                    [
                        { label: 'Spawn All Ready Tasks', value: 'all', detail: `${spawnableTasks.length} tasks ready` },
                        { label: 'Select Specific Tasks', value: 'select' },
                        { label: 'Cancel', value: 'cancel' }
                    ],
                    { placeHolder: `${spawnableTasks.length} ASYNC tasks ready to spawn` }
                );

                if (action?.value === 'all') {
                    for (const task of spawnableTasks) {
                        await taskDetector.spawnTaskAgent(task);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    viewProvider.refresh();
                    vscode.window.showInformationMessage(`Spawned ${spawnableTasks.length} agents`);
                } else if (action?.value === 'select') {
                    const selectedTasks = await vscode.window.showQuickPick(
                        spawnableTasks.map(t => ({
                            label: t.name,
                            description: `Phase ${t.phase} | ${t.estimatedComplexity}`,
                            detail: t.description.substring(0, 100),
                            picked: true,
                            task: t
                        })),
                        { canPickMany: true, placeHolder: 'Select tasks to spawn' }
                    );

                    if (selectedTasks && selectedTasks.length > 0) {
                        for (const item of selectedTasks) {
                            await taskDetector.spawnTaskAgent(item.task);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        viewProvider.refresh();
                        vscode.window.showInformationMessage(`Spawned ${selectedTasks.length} agents`);
                    }
                }
            }
        })
    );

    // Spawn current wave
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeAgentSpawner.spawnCurrentWave', async () => {
            if (!conductorIntegration || !taskDetector) {
                vscode.window.showErrorMessage('Conductor integration not available');
                return;
            }

            const tracks = conductorIntegration.getTracks();
            if (tracks.length === 0) {
                vscode.window.showWarningMessage('No Conductor tracks found');
                return;
            }

            // If multiple tracks, let user select
            let trackName = tracks[0].name;
            if (tracks.length > 1) {
                const selected = await vscode.window.showQuickPick(
                    tracks.map(t => ({ label: t.name, track: t })),
                    { placeHolder: 'Select track' }
                );
                if (!selected) { return; }
                trackName = selected.label;
            }

            const wave = conductorIntegration.getNextWave(trackName);
            if (!wave) {
                vscode.window.showInformationMessage('No pending waves in this track');
                return;
            }

            const asyncCount = wave.tasks.filter(t => t.type === 'ASYNC' && t.status === TaskStatus.PENDING).length;
            const confirm = await vscode.window.showInformationMessage(
                `Spawn ${asyncCount} agents for Wave ${wave.waveNumber}?`,
                'Yes', 'Cancel'
            );

            if (confirm === 'Yes') {
                await taskDetector.spawnCurrentWave(trackName);
                viewProvider.refresh();
            }
        })
    );

    // Show panel (opens main chat)
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeAgentSpawner.showPanel', () => {
            // Open the main chat panel
            openMainChatPanel(context.extensionUri, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
            // Also reveal sidebar
            vscode.commands.executeCommand('workbench.view.extension.claude-agent-spawner');
        })
    );

    // Kill all agents
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeAgentSpawner.killAllAgents', async () => {
            const runningCount = agentManager.getRunningAgents().length;
            if (runningCount === 0) {
                vscode.window.showInformationMessage('No running agents to kill');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Kill all ${runningCount} running agents?`,
                { modal: true },
                'Yes, Kill All'
            );

            if (confirm === 'Yes, Kill All') {
                await agentManager.killAllAgents();
                viewProvider.refresh();
                vscode.window.showInformationMessage('All agents terminated');
            }
        })
    );

    // Kill specific agent
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeAgentSpawner.killAgent', async (agentId?: string) => {
            if (!agentId) {
                // Show picker if no ID provided
                const agents = agentManager.getRunningAgents();
                if (agents.length === 0) {
                    vscode.window.showInformationMessage('No running agents');
                    return;
                }

                const selected = await vscode.window.showQuickPick(
                    agents.map(a => ({
                        label: a.name,
                        description: a.status,
                        detail: a.taskId || 'Manual spawn',
                        agentId: a.id
                    })),
                    { placeHolder: 'Select agent to kill' }
                );

                if (selected) {
                    agentId = selected.agentId;
                }
            }

            if (agentId) {
                await agentManager.killAgent(agentId);
                viewProvider.refresh();
            }
        })
    );

    // Refresh agents
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeAgentSpawner.refreshAgents', () => {
            agentManager.refreshStatus();
            if (conductorIntegration) {
                conductorIntegration.scanForTracks();
            }
            viewProvider.refresh();
        })
    );

    // Toggle auto-detect
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeAgentSpawner.toggleAutoDetect', () => {
            if (taskDetector) {
                taskDetector.toggleMonitoring();
            } else {
                vscode.window.showWarningMessage('Task detector not available');
            }
        })
    );

    // Focus agent terminal
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeAgentSpawner.focusAgent', (agentId?: string) => {
            if (agentId) {
                agentManager.focusAgent(agentId);
            }
        })
    );
}

/**
 * Select task files from workspace
 */
async function selectTaskFiles(): Promise<string[] | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return undefined;
    }

    // Look for conductor tracks first
    const conductorPath = path.join(workspaceFolder.uri.fsPath, '.conductor', 'tracks');
    
    if (!fs.existsSync(conductorPath)) {
        // Fall back to file picker
        const files = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: { 'Markdown Task Files': ['md'] },
            title: 'Select task files to spawn agents for'
        });
        return files?.map(f => f.fsPath);
    }

    // Scan for ASYNC task files
    const asyncFiles: string[] = [];
    
    function scanDir(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanDir(fullPath);
            } else if (entry.name.includes('_ASYNC') && entry.name.endsWith('.md')) {
                asyncFiles.push(fullPath);
            }
        }
    }

    scanDir(conductorPath);

    if (asyncFiles.length === 0) {
        vscode.window.showInformationMessage('No ASYNC task files found in .conductor/tracks/');
        return undefined;
    }

    // Let user select from found files
    const selected = await vscode.window.showQuickPick(
        asyncFiles.map(f => ({
            label: path.basename(f),
            description: path.relative(conductorPath, path.dirname(f)),
            picked: true,
            file: f
        })),
        { 
            canPickMany: true, 
            placeHolder: `Select ASYNC tasks to spawn (${asyncFiles.length} found)` 
        }
    );

    return selected?.map(s => s.file);
}

/**
 * Open the main chat panel automatically
 */
function openMainChatPanel(extensionUri: vscode.Uri, workspaceRoot?: string) {
    outputChannel.appendLine('[Extension] openMainChatPanel called');
    outputChannel.appendLine('[Extension] extensionUri: ' + extensionUri?.toString());
    outputChannel.appendLine('[Extension] workspaceRoot: ' + workspaceRoot);

    try {
        // Create or show the main chat panel
        outputChannel.appendLine('[Extension] Creating ChatPanel...');
        mainChatPanel = ChatPanel.createOrShow(extensionUri, {
            agentId: 'conductor-main',
            agentName: 'Claude Chat',
            workspacePath: workspaceRoot,
            useClaudeCLI: true
        });
        outputChannel.appendLine('[Extension] ChatPanel created: ' + (mainChatPanel ? 'yes' : 'no'));

        // Track panel disposal
        mainChatPanel.onDidDispose(() => {
            mainChatPanel = null;
        });

        outputChannel.appendLine('[Extension] Main chat panel opened successfully');
        outputChannel.show(); // Show the output channel so user can see logs
    } catch (error: any) {
        outputChannel.appendLine(`[Extension] FAILED to open chat panel: ${error.message}`);
        outputChannel.appendLine(`[Extension] Stack: ${error.stack}`);
        outputChannel.show();
    }
}

/**
 * Check CLI status and show appropriate messages
 */
async function checkCliStatus(): Promise<void> {
    try {
        cliInfo = await detectClaudeCode();

        if (cliInfo.installed) {
            outputChannel.appendLine(`Claude Code CLI detected: v${cliInfo.version}`);
            outputChannel.appendLine(`  Path: ${cliInfo.path}`);
            outputChannel.appendLine(`  Auth: ${cliInfo.authenticated ? cliInfo.authMethod : 'not authenticated'}`);
        } else {
            outputChannel.appendLine('Claude Code CLI not detected');

            // Check if user wants to use CLI mode
            const config = vscode.workspace.getConfiguration('claudeAgentSpawner');
            const useCLI = config.get<boolean>('useClaudeCLI', true);

            if (useCLI) {
                const action = await vscode.window.showWarningMessage(
                    'Claude Code CLI not found. Install it for enhanced tool support, or use direct API mode.',
                    'Install CLI',
                    'Use API Mode',
                    'Dismiss'
                );

                if (action === 'Install CLI') {
                    vscode.env.openExternal(vscode.Uri.parse('https://docs.anthropic.com/en/docs/claude-code'));
                } else if (action === 'Use API Mode') {
                    await config.update('useClaudeCLI', false, vscode.ConfigurationTarget.Global);
                    outputChannel.appendLine('Switched to API mode');
                }
            }
        }
    } catch (error) {
        outputChannel.appendLine(`CLI detection error: ${error}`);
    }
}

/**
 * Get current CLI info (for use by other modules)
 */
export function getCliInfo(): ClaudeCodeInfo | null {
    return cliInfo;
}

/**
 * Register Conductor and Ralph commands
 */
function registerConductorCommands(context: vscode.ExtensionContext, workspaceRoot: string) {
    // Start Conductor
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeConductor.start', async () => {
            if (!conductor) {
                vscode.window.showErrorMessage('Conductor not available');
                return;
            }

            if (conductor.running) {
                vscode.window.showWarningMessage('Conductor is already running');
                return;
            }

            const goal = await vscode.window.showInputBox({
                prompt: 'Enter the goal for the Conductor to orchestrate',
                placeHolder: 'e.g., Implement user authentication with OAuth',
                ignoreFocusOut: true
            });

            if (goal) {
                try {
                    await conductor.start(goal);

                    // Also start Ralph for monitoring
                    if (ralph && !ralph.running) {
                        await ralph.start();
                        viewProvider.updateRalphStatus(true, 'good', 0, 0);
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to start Conductor: ${error}`);
                }
            }
        })
    );

    // Stop all Conductor agents
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeConductor.stopAll', async () => {
            if (!conductor) {
                vscode.window.showErrorMessage('Conductor not available');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                'Stop Conductor and all spawned agents?',
                { modal: true },
                'Yes, Stop All'
            );

            if (confirm === 'Yes, Stop All') {
                conductor.stop();
                viewProvider.updateConductorStatus(false);
                viewProvider.refresh();
                vscode.window.showInformationMessage('Conductor stopped');
            }
        })
    );

    // Toggle Ralph monitoring
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeConductor.toggleRalph', async () => {
            if (!ralph) {
                vscode.window.showErrorMessage('Ralph not available');
                return;
            }

            if (ralph.running) {
                ralph.stop();
                viewProvider.updateRalphStatus(false);
                vscode.window.showInformationMessage('Ralph monitoring stopped');
            } else {
                await ralph.start();
                viewProvider.updateRalphStatus(true, 'good', 0, 0);
                vscode.window.showInformationMessage('Ralph monitoring started');
            }
        })
    );

    // Force Ralph assessment
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeConductor.forceAssessment', async () => {
            if (!ralph) {
                vscode.window.showErrorMessage('Ralph not available');
                return;
            }

            const assessment = await ralph.forceAssessment();
            const summary = ralph.getHealthSummary();

            vscode.window.showInformationMessage(
                `Ralph Assessment: ${summary.status} | ${summary.agentCount} agents | ${summary.concernCount} concerns`
            );
        })
    );

    // Open Conductor panel
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeConductor.openPanel', () => {
            vscode.commands.executeCommand('claudeAgentSpawner.showPanel');
        })
    );

    // Get Conductor status
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeConductor.status', () => {
            if (!conductor) {
                vscode.window.showInformationMessage('Conductor: Not available');
                return;
            }

            const conductorStatus = conductor.running ? 'Running' : 'Stopped';
            const ralphStatus = ralph?.running ? 'Active' : 'Inactive';
            const tasks = conductor.getTasks();
            const completed = tasks.filter(t => t.status === 'completed').length;
            const failed = tasks.filter(t => t.status === 'failed').length;

            vscode.window.showInformationMessage(
                `Conductor: ${conductorStatus} | Tasks: ${completed}/${tasks.length} (${failed} failed) | Ralph: ${ralphStatus}`
            );
        })
    );
}

/**
 * Extension deactivation
 */
export function deactivate() {
    if (ralph) {
        ralph.dispose();
    }
    if (conductor) {
        conductor.dispose();
    }
    if (taskDetector) {
        taskDetector.dispose();
    }
    if (agentManager) {
        agentManager.dispose();
    }
    if (conductorIntegration) {
        conductorIntegration.dispose();
    }
    console.log('Claude Agent Spawner deactivated');
}
