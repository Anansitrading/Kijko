/**
 * Conductor Integration Module
 * 
 * Reads and parses Conductor track structures, task files, and metadata.
 * Provides interface between the VS Code extension and Conductor's file-based
 * orchestration system.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Task execution type
 */
export enum TaskType {
    SEQUENTIAL = 'SEQUENTIAL',
    ASYNC = 'ASYNC'
}

/**
 * Task status
 */
export enum TaskStatus {
    PENDING = 'pending',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    BLOCKED = 'blocked',
    FAILED = 'failed'
}

/**
 * Represents a single task from Conductor/Scrum output
 */
export interface ConductorTask {
    id: string;
    name: string;
    phase: number;
    sequence: number;
    type: TaskType;
    status: TaskStatus;
    filePath: string;
    description: string;
    dependencies: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    assignedAgent?: string;
    worktreePath?: string;
}

/**
 * Represents a wave of tasks that can run in parallel
 */
export interface TaskWave {
    waveNumber: number;
    tasks: ConductorTask[];
    summaryFile?: string;
}

/**
 * Conductor track metadata
 */
export interface TrackMetadata {
    trackName: string;
    planMode: 'scrum' | 'classic';
    createdAt: string;
    techStack: string[];
    totalTasks: number;
    completedTasks: number;
    waves: TaskWave[];
    criticalPath: string[];
    scrumMetadata?: {
        dependencyGraphPath: string;
        criticalPathLength: number;
        parallelizationFactor: number;
    };
}

/**
 * Conductor track structure
 */
export interface ConductorTrack {
    name: string;
    path: string;
    metadata: TrackMetadata;
    tasks: ConductorTask[];
    planMasterPath: string;
}

/**
 * ConductorIntegration class
 * 
 * Handles all interactions with Conductor's file-based system
 */
export class ConductorIntegration {
    private workspaceRoot: string;
    private conductorPath: string;
    private tracks: Map<string, ConductorTrack> = new Map();
    private _onTracksChanged: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onTracksChanged: vscode.Event<void> = this._onTracksChanged.event;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.conductorPath = path.join(workspaceRoot, '.conductor');
    }

    /**
     * Initialize the integration and scan for existing tracks
     */
    public async initialize(): Promise<void> {
        await this.scanForTracks();
        this.watchForChanges();
    }

    /**
     * Scan the workspace for Conductor tracks
     */
    public async scanForTracks(): Promise<ConductorTrack[]> {
        this.tracks.clear();

        if (!fs.existsSync(this.conductorPath)) {
            return [];
        }

        const tracksPath = path.join(this.conductorPath, 'tracks');
        if (!fs.existsSync(tracksPath)) {
            return [];
        }

        const trackDirs = fs.readdirSync(tracksPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const trackName of trackDirs) {
            try {
                const track = await this.loadTrack(trackName);
                if (track) {
                    this.tracks.set(trackName, track);
                }
            } catch (error) {
                console.error(`Failed to load track ${trackName}:`, error);
            }
        }

        this._onTracksChanged.fire();
        return Array.from(this.tracks.values());
    }

    /**
     * Load a specific track by name
     */
    public async loadTrack(trackName: string): Promise<ConductorTrack | null> {
        const trackPath = path.join(this.conductorPath, 'tracks', trackName);
        
        if (!fs.existsSync(trackPath)) {
            return null;
        }

        // Load metadata
        const metadataPath = path.join(trackPath, 'metadata.json');
        let metadata: TrackMetadata;

        if (fs.existsSync(metadataPath)) {
            const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
            metadata = JSON.parse(metadataContent);
        } else {
            // Create default metadata
            metadata = this.createDefaultMetadata(trackName);
        }

        // Load tasks
        const tasks = await this.loadTasks(trackPath, metadata.planMode);

        // Organize tasks into waves
        metadata.waves = this.organizeTasksIntoWaves(tasks);

        const track: ConductorTrack = {
            name: trackName,
            path: trackPath,
            metadata,
            tasks,
            planMasterPath: path.join(trackPath, 'plan_master.md')
        };

        return track;
    }

    /**
     * Load all tasks from a track directory
     */
    private async loadTasks(trackPath: string, planMode: 'scrum' | 'classic'): Promise<ConductorTask[]> {
        const tasks: ConductorTask[] = [];
        const planPath = path.join(trackPath, 'plan');

        if (!fs.existsSync(planPath)) {
            return tasks;
        }

        // Find all task files
        const files = fs.readdirSync(planPath)
            .filter(f => f.startsWith('task_') && f.endsWith('.md'));

        for (const file of files) {
            const task = await this.parseTaskFile(path.join(planPath, file));
            if (task) {
                tasks.push(task);
            }
        }

        // Sort by phase and sequence
        tasks.sort((a, b) => {
            if (a.phase !== b.phase) {
                return a.phase - b.phase;
            }
            return a.sequence - b.sequence;
        });

        return tasks;
    }

    /**
     * Parse a single task file into a ConductorTask
     */
    private async parseTaskFile(filePath: string): Promise<ConductorTask | null> {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const fileName = path.basename(filePath);

        // Parse filename: task_<phase>_<seq>_<name>[_ASYNC].md
        const match = fileName.match(/^task_(\d+)_(\d+)_(.+?)(_ASYNC)?\.md$/);
        if (!match) {
            return null;
        }

        const [, phaseStr, seqStr, name, asyncSuffix] = match;
        const phase = parseInt(phaseStr, 10);
        const sequence = parseInt(seqStr, 10);
        const isAsync = !!asyncSuffix;

        // Parse YAML frontmatter if present
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        let frontmatter: Record<string, any> = {};
        
        if (frontmatterMatch) {
            try {
                frontmatter = this.parseYamlFrontmatter(frontmatterMatch[1]);
            } catch (e) {
                console.warn(`Failed to parse frontmatter in ${fileName}`);
            }
        }

        // Extract description from content
        const descriptionMatch = content.match(/## Description\n\n([\s\S]*?)(?=\n## |$)/);
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';

        // Extract dependencies
        const depsMatch = content.match(/## Dependencies\n\n([\s\S]*?)(?=\n## |$)/);
        let dependencies: string[] = [];
        if (depsMatch) {
            dependencies = depsMatch[1]
                .split('\n')
                .filter(line => line.startsWith('- '))
                .map(line => line.replace(/^- /, '').trim());
        }

        // Determine status from frontmatter or default
        const status = frontmatter.status || TaskStatus.PENDING;

        // Determine complexity
        const complexity = frontmatter.complexity || 'medium';

        const taskId = `task_${phase}_${sequence}_${name}${asyncSuffix || ''}`;

        return {
            id: taskId,
            name: name.replace(/_/g, ' '),
            phase,
            sequence,
            type: isAsync ? TaskType.ASYNC : TaskType.SEQUENTIAL,
            status,
            filePath,
            description,
            dependencies,
            estimatedComplexity: complexity,
            assignedAgent: frontmatter.assigned_agent,
            worktreePath: frontmatter.worktree_path
        };
    }

    /**
     * Simple YAML frontmatter parser
     */
    private parseYamlFrontmatter(yaml: string): Record<string, any> {
        const result: Record<string, any> = {};
        const lines = yaml.split('\n');

        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                let value: any = line.substring(colonIndex + 1).trim();
                
                // Handle arrays
                if (value.startsWith('[') && value.endsWith(']')) {
                    value = value.slice(1, -1).split(',').map((s: string) => s.trim().replace(/['"]/g, ''));
                }
                // Handle booleans
                else if (value === 'true') {
                    value = true;
                } else if (value === 'false') {
                    value = false;
                }
                // Handle numbers
                else if (!isNaN(Number(value))) {
                    value = Number(value);
                }
                // Remove quotes from strings
                else {
                    value = value.replace(/^['"]|['"]$/g, '');
                }

                result[key] = value;
            }
        }

        return result;
    }

    /**
     * Organize tasks into execution waves based on dependencies
     */
    private organizeTasksIntoWaves(tasks: ConductorTask[]): TaskWave[] {
        const waves: TaskWave[] = [];
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const completed = new Set<string>();
        const remaining = new Set(tasks.map(t => t.id));

        let waveNumber = 1;

        while (remaining.size > 0) {
            const waveTaskIds: string[] = [];

            // Find all tasks whose dependencies are satisfied
            for (const taskId of remaining) {
                const task = taskMap.get(taskId)!;
                const depsAreSatisfied = task.dependencies.every(
                    dep => completed.has(dep) || !taskMap.has(dep)
                );

                if (depsAreSatisfied) {
                    waveTaskIds.push(taskId);
                }
            }

            if (waveTaskIds.length === 0) {
                // Circular dependency or missing dependency - add remaining
                console.warn('Potential circular dependency detected');
                for (const taskId of remaining) {
                    waveTaskIds.push(taskId);
                }
            }

            // Create wave
            const waveTasks = waveTaskIds.map(id => taskMap.get(id)!);
            waves.push({
                waveNumber,
                tasks: waveTasks
            });

            // Mark as completed and remove from remaining
            for (const taskId of waveTaskIds) {
                completed.add(taskId);
                remaining.delete(taskId);
            }

            waveNumber++;
        }

        return waves;
    }

    /**
     * Create default metadata for a track
     */
    private createDefaultMetadata(trackName: string): TrackMetadata {
        return {
            trackName,
            planMode: 'scrum',
            createdAt: new Date().toISOString(),
            techStack: [],
            totalTasks: 0,
            completedTasks: 0,
            waves: [],
            criticalPath: []
        };
    }

    /**
     * Watch for file changes in the conductor directory
     */
    private watchForChanges(): void {
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.conductorPath, '**/*')
        );

        watcher.onDidChange(() => this.scanForTracks());
        watcher.onDidCreate(() => this.scanForTracks());
        watcher.onDidDelete(() => this.scanForTracks());
    }

    /**
     * Get all loaded tracks
     */
    public getTracks(): ConductorTrack[] {
        return Array.from(this.tracks.values());
    }

    /**
     * Get a specific track by name
     */
    public getTrack(trackName: string): ConductorTrack | undefined {
        return this.tracks.get(trackName);
    }

    /**
     * Get all ASYNC tasks that are ready to spawn
     */
    public getSpawnableTasks(trackName?: string): ConductorTask[] {
        const tracks = trackName 
            ? [this.tracks.get(trackName)].filter(Boolean) as ConductorTrack[]
            : Array.from(this.tracks.values());

        const spawnableTasks: ConductorTask[] = [];

        for (const track of tracks) {
            for (const task of track.tasks) {
                // Task is spawnable if:
                // 1. It's an ASYNC task
                // 2. Status is PENDING
                // 3. All dependencies are completed
                if (task.type === TaskType.ASYNC && task.status === TaskStatus.PENDING) {
                    const depsCompleted = task.dependencies.every(depId => {
                        const depTask = track.tasks.find(t => t.id === depId);
                        return !depTask || depTask.status === TaskStatus.COMPLETED;
                    });

                    if (depsCompleted) {
                        spawnableTasks.push(task);
                    }
                }
            }
        }

        return spawnableTasks;
    }

    /**
     * Get the next wave of tasks ready to execute
     */
    public getNextWave(trackName: string): TaskWave | null {
        const track = this.tracks.get(trackName);
        if (!track) {
            return null;
        }

        // Find the first wave with pending tasks
        for (const wave of track.metadata.waves) {
            const hasPending = wave.tasks.some(t => t.status === TaskStatus.PENDING);
            if (hasPending) {
                return wave;
            }
        }

        return null;
    }

    /**
     * Update a task's status
     */
    public async updateTaskStatus(
        taskId: string, 
        status: TaskStatus, 
        assignedAgent?: string
    ): Promise<void> {
        for (const track of this.tracks.values()) {
            const task = track.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = status;
                if (assignedAgent) {
                    task.assignedAgent = assignedAgent;
                }

                // Update the task file with new status
                await this.updateTaskFile(task);
                
                // Update track metadata
                track.metadata.completedTasks = track.tasks.filter(
                    t => t.status === TaskStatus.COMPLETED
                ).length;

                this._onTracksChanged.fire();
                return;
            }
        }
    }

    /**
     * Update a task file with new metadata
     */
    private async updateTaskFile(task: ConductorTask): Promise<void> {
        if (!fs.existsSync(task.filePath)) {
            return;
        }

        let content = fs.readFileSync(task.filePath, 'utf-8');

        // Update or add status in frontmatter
        if (content.startsWith('---\n')) {
            // Update existing frontmatter
            content = content.replace(
                /^---\n([\s\S]*?)\n---/,
                (match, frontmatter) => {
                    if (frontmatter.includes('status:')) {
                        frontmatter = frontmatter.replace(
                            /status:.*$/m, 
                            `status: ${task.status}`
                        );
                    } else {
                        frontmatter += `\nstatus: ${task.status}`;
                    }
                    if (task.assignedAgent) {
                        if (frontmatter.includes('assigned_agent:')) {
                            frontmatter = frontmatter.replace(
                                /assigned_agent:.*$/m,
                                `assigned_agent: ${task.assignedAgent}`
                            );
                        } else {
                            frontmatter += `\nassigned_agent: ${task.assignedAgent}`;
                        }
                    }
                    return `---\n${frontmatter}\n---`;
                }
            );
        } else {
            // Add frontmatter
            let frontmatter = `---\nstatus: ${task.status}`;
            if (task.assignedAgent) {
                frontmatter += `\nassigned_agent: ${task.assignedAgent}`;
            }
            frontmatter += '\n---\n\n';
            content = frontmatter + content;
        }

        fs.writeFileSync(task.filePath, content, 'utf-8');
    }

    /**
     * Generate a prompt for a task to send to Claude
     */
    public generateTaskPrompt(task: ConductorTask): string {
        const content = fs.existsSync(task.filePath) 
            ? fs.readFileSync(task.filePath, 'utf-8')
            : '';

        // Remove frontmatter for the prompt
        const cleanContent = content.replace(/^---\n[\s\S]*?\n---\n\n?/, '');

        return `You are working on the following task from a Conductor track:

## Task: ${task.name}
**ID:** ${task.id}
**Phase:** ${task.phase}
**Type:** ${task.type}
**Complexity:** ${task.estimatedComplexity}

${cleanContent}

---

Please complete this task. When finished, summarize what you accomplished.
If you encounter blockers, document them clearly.`;
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this._onTracksChanged.dispose();
    }
}
