/**
 * CLI Manager - Manage Claude Code CLI subprocess
 *
 * Spawns and communicates with headless Claude Code CLI processes
 * using --output-format stream-json for real-time streaming.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as vscode from 'vscode';
import { StreamJsonEvent, createStreamParser } from './streamParser';

/**
 * Options for CLIManager
 */
export interface CLIManagerOptions {
    /** Working directory for the CLI process */
    workingDirectory: string;
    /** Tools to auto-approve (passed to --allowedTools) */
    allowedTools?: string[];
    /** System prompt to append */
    systemPrompt?: string;
    /** Whether to continue previous session */
    continueSession?: boolean;
    /** Timeout in milliseconds (default: 5 minutes) */
    timeout?: number;
    /** Claude CLI command (default: 'claude') */
    command?: string;
}

/**
 * Event emitted during CLI streaming
 */
export interface CLIStreamEvent {
    /** Event type */
    type: 'text' | 'tool_use' | 'tool_result' | 'init' | 'complete' | 'error';
    /** Text content */
    content?: string;
    /** Tool information */
    tool?: {
        name: string;
        input: Record<string, unknown>;
        id?: string;
    };
    /** Result data */
    result?: unknown;
    /** Error message */
    error?: string;
    /** Timestamp */
    timestamp: Date;
}

/**
 * Events emitted by CLIManager
 */
export interface CLIManagerEvents {
    /** Streaming event from CLI */
    stream: (event: CLIStreamEvent) => void;
    /** Processing complete */
    complete: () => void;
    /** Error occurred */
    error: (error: Error) => void;
}

/**
 * Default timeout: 5 minutes
 */
const DEFAULT_TIMEOUT_MS = 300000;

/**
 * CLI Manager class
 *
 * Manages spawning and communication with Claude Code CLI.
 * Emits events for streaming output, completion, and errors.
 *
 * @example
 * ```typescript
 * const mgr = new CLIManager({ workingDirectory: '/path/to/project' });
 *
 * mgr.on('stream', (event) => {
 *     if (event.type === 'text') {
 *         console.log(event.content);
 *     }
 * });
 *
 * mgr.on('complete', () => console.log('Done!'));
 * mgr.on('error', (err) => console.error(err));
 *
 * await mgr.sendPrompt('Hello, Claude!');
 * ```
 */
export class CLIManager extends EventEmitter {
    private readonly options: CLIManagerOptions;
    private process: ChildProcess | null = null;
    private timeoutId: NodeJS.Timeout | null = null;
    private _isProcessing: boolean = false;
    private streamParser = createStreamParser();

    constructor(options: CLIManagerOptions) {
        super();
        this.options = {
            timeout: DEFAULT_TIMEOUT_MS,
            command: 'claude',
            ...options
        };
    }

    /**
     * Check if currently processing a prompt
     */
    public get processing(): boolean {
        return this._isProcessing;
    }

    /**
     * Send a prompt to Claude Code CLI
     *
     * @param prompt - The prompt to send
     * @throws Error if already processing
     */
    public async sendPrompt(prompt: string): Promise<void> {
        if (this._isProcessing) {
            throw new Error('Already processing a prompt. Call cancel() first.');
        }

        this._isProcessing = true;

        return new Promise((resolve, reject) => {
            const args = this.buildArgs(prompt);
            const command = this.options.command || 'claude';

            console.log('[CLIManager] Spawning:', command, args.join(' '));
            console.log('[CLIManager] CWD:', this.options.workingDirectory);

            // Spawn the CLI process
            try {
                this.process = spawn(command, args, {
                    cwd: this.options.workingDirectory,
                    env: { ...process.env },
                    shell: process.platform === 'win32'
                });
                console.log('[CLIManager] Process spawned, PID:', this.process.pid);
            } catch (spawnError: any) {
                console.error('[CLIManager] Spawn failed:', spawnError.message);
                this._isProcessing = false;
                reject(spawnError);
                return;
            }

            // Set up timeout
            if (this.options.timeout && this.options.timeout > 0) {
                this.timeoutId = setTimeout(() => {
                    this.handleTimeout();
                }, this.options.timeout);
            }

            // Handle stdout
            this.process.stdout?.on('data', (data: Buffer) => {
                const str = data.toString();
                console.log('[CLIManager] STDOUT chunk:', str.length, 'bytes');
                this.handleStdout(str);
            });

            // Handle stderr
            this.process.stderr?.on('data', (data: Buffer) => {
                const str = data.toString();
                console.log('[CLIManager] STDERR:', str.substring(0, 200));
                this.handleStderr(str);
            });

            // Handle process close
            this.process.on('close', (code: number | null) => {
                this.cleanup();

                // Flush remaining buffer
                const remaining = this.streamParser.flush();
                for (const event of remaining) {
                    this.emitStreamEvent(event);
                }

                if (code === 0 || code === null) {
                    this.emit('complete');
                    resolve();
                } else {
                    const error = new Error(`CLI exited with code ${code}`);
                    this.emit('error', error);
                    reject(error);
                }
            });

            // Handle process error
            this.process.on('error', (error: Error) => {
                this.cleanup();
                this.emit('error', error);
                reject(error);
            });
        });
    }

    /**
     * Cancel the current operation
     */
    public cancel(): void {
        if (this.process) {
            // Send SIGTERM for graceful shutdown
            this.process.kill('SIGTERM');

            // Force kill after 5 seconds if still running
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGKILL');
                }
            }, 5000);
        }
        this.cleanup();
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.cancel();
        this.removeAllListeners();
    }

    /**
     * Build CLI arguments from options and prompt
     */
    private buildArgs(prompt: string): string[] {
        const args: string[] = [];

        // Print mode (non-interactive)
        args.push('-p', prompt);

        // Stream JSON output (requires --verbose with -p mode)
        args.push('--output-format', 'stream-json');
        args.push('--verbose');

        // Allowed tools
        if (this.options.allowedTools && this.options.allowedTools.length > 0) {
            args.push('--allowedTools', this.options.allowedTools.join(','));
        }

        // System prompt
        if (this.options.systemPrompt) {
            args.push('--append-system-prompt', this.options.systemPrompt);
        }

        // Continue session
        if (this.options.continueSession) {
            args.push('--continue');
        }

        return args;
    }

    /**
     * Handle stdout data
     */
    private handleStdout(data: string): void {
        const events = this.streamParser.parse(data);
        console.log('[CLIManager] Parsed', events.length, 'events from stdout');

        for (const event of events) {
            console.log('[CLIManager] Emitting event:', event.type, (event.content || '').substring(0, 50));
            this.emitStreamEvent(event);
        }
    }

    /**
     * Handle stderr data
     */
    private handleStderr(data: string): void {
        // Emit stderr as error events
        const lines = data.split('\n').filter(line => line.trim());

        for (const line of lines) {
            this.emit('stream', {
                type: 'error',
                content: line,
                error: line,
                timestamp: new Date()
            } as CLIStreamEvent);
        }
    }

    /**
     * Emit a stream event
     */
    private emitStreamEvent(event: StreamJsonEvent): void {
        const cliEvent: CLIStreamEvent = {
            type: event.type,
            content: event.content,
            tool: event.tool,
            result: event.result,
            error: event.error,
            timestamp: new Date()
        };

        this.emit('stream', cliEvent);
    }

    /**
     * Handle timeout
     */
    private handleTimeout(): void {
        const error = new Error(`CLI operation timed out after ${this.options.timeout}ms`);
        this.cancel();
        this.emit('error', error);
    }

    /**
     * Cleanup after process ends
     */
    private cleanup(): void {
        this._isProcessing = false;

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        this.process = null;
        this.streamParser = createStreamParser(); // Reset parser
    }
}

// Cache the claude path
let cachedClaudePath: string | null = null;

/**
 * Create a CLIManager with settings from VS Code configuration
 *
 * @param workingDirectory - Working directory for the CLI
 * @returns Configured CLIManager instance
 */
export function createCLIManagerFromConfig(workingDirectory: string): CLIManager {
    const config = vscode.workspace.getConfiguration('claudeAgentSpawner');

    const allowedTools = config.get<string[]>('cliAllowedTools', [
        'Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'
    ]);

    const timeout = config.get<number>('cliTimeout', DEFAULT_TIMEOUT_MS);

    // Use cached path or find it synchronously
    if (!cachedClaudePath) {
        const { execSync } = require('child_process');
        const fs = require('fs');
        try {
            cachedClaudePath = execSync('which claude', { encoding: 'utf-8', timeout: 5000 }).trim();
        } catch {
            // Try common locations
            const commonPaths = [
                '/root/.local/bin/claude',
                '/usr/local/bin/claude',
                '/usr/bin/claude',
                `${process.env.HOME}/.local/bin/claude`
            ];
            for (const p of commonPaths) {
                if (fs.existsSync(p)) {
                    cachedClaudePath = p;
                    break;
                }
            }
        }
        cachedClaudePath = cachedClaudePath || config.get<string>('claudeCommand', 'claude');
        console.log('[CLIManager] Using claude path:', cachedClaudePath);
    }

    return new CLIManager({
        workingDirectory,
        allowedTools,
        timeout,
        command: cachedClaudePath
    });
}
