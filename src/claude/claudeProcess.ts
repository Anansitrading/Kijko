/**
 * ClaudeProcess - Enhanced CLI process wrapper for multi-agent orchestration
 *
 * Spawns and manages Claude CLI sessions with:
 * - Session ID management for multi-agent isolation
 * - Event-based message handling
 * - Promise-based send/receive API
 * - Graceful shutdown and resume support
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { createStreamParser, StreamJsonEvent } from '../streamParser';
import {
    ClaudeStreamMessage,
    AgentConfig,
    ClaudeProcessEvents
} from './types';

/**
 * Default timeout for sendAndWait: 5 minutes
 */
const DEFAULT_TIMEOUT_MS = 300000;

/**
 * ClaudeProcess - Wrapper for Claude CLI subprocess
 *
 * Provides event-based and promise-based APIs for communicating
 * with Claude CLI in JSON streaming mode.
 *
 * @example
 * ```typescript
 * const proc = new ClaudeProcess('agent-1', '/path/to/project');
 *
 * proc.on('message', (msg) => console.log(msg));
 * proc.on('tool_use', (name, input) => console.log(`Tool: ${name}`));
 *
 * await proc.start('Analyze this codebase');
 * ```
 */
export class ClaudeProcess extends EventEmitter {
    private process: ChildProcess | null = null;
    private buffer: string = '';
    private streamParser = createStreamParser();
    private _sessionId: string;
    private _isRunning: boolean = false;
    private messageBuffer: ClaudeStreamMessage[] = [];
    private pendingResolve: ((messages: ClaudeStreamMessage[]) => void) | null = null;
    private pendingReject: ((error: Error) => void) | null = null;
    private timeoutId: NodeJS.Timeout | null = null;

    /**
     * Create a new ClaudeProcess instance
     *
     * @param id - Unique identifier for this agent
     * @param workingDir - Working directory for CLI operations
     * @param autoApprove - Whether to auto-approve tool use (default: false)
     * @param systemPrompt - Optional system prompt to append
     */
    constructor(
        public readonly id: string,
        public readonly workingDir: string,
        private readonly autoApprove: boolean = false,
        private readonly systemPrompt?: string
    ) {
        super();
        this._sessionId = `agent-${id}-${Date.now()}`;
    }

    /**
     * Get the session ID for this process
     */
    public get sessionId(): string {
        return this._sessionId;
    }

    /**
     * Check if the process is currently running
     */
    public get isRunning(): boolean {
        return this._isRunning;
    }

    /**
     * Start the Claude CLI with an optional initial prompt
     *
     * @param prompt - Initial prompt to send (optional)
     */
    public async start(prompt?: string): Promise<void> {
        if (this._isRunning) {
            throw new Error(`ClaudeProcess ${this.id} is already running`);
        }

        return new Promise((resolve, reject) => {
            const args = this.buildArgs(prompt);

            this.process = spawn('claude', args, {
                cwd: this.workingDir,
                env: { ...process.env },
                shell: process.platform === 'win32'
            });

            this._isRunning = true;

            this.process.stdout?.on('data', (data: Buffer) => {
                this.handleStdout(data.toString());
            });

            this.process.stderr?.on('data', (data: Buffer) => {
                this.handleStderr(data.toString());
            });

            this.process.on('close', (code: number | null) => {
                this.handleClose(code);
            });

            this.process.on('error', (error: Error) => {
                this._isRunning = false;
                this.emit('error', error);
                reject(error);
            });

            // Emit started event
            this.emit('started');
            resolve();
        });
    }

    /**
     * Send input to the running process
     *
     * @param input - Text input to send
     */
    public send(input: string): void {
        if (!this.process || !this._isRunning) {
            throw new Error(`ClaudeProcess ${this.id} is not running`);
        }

        this.process.stdin?.write(input + '\n');
    }

    /**
     * Send input and wait for response
     *
     * @param input - Text input to send
     * @param timeoutMs - Timeout in milliseconds (default: 5 minutes)
     * @returns Promise resolving to collected messages
     */
    public async sendAndWait(
        input: string,
        timeoutMs: number = DEFAULT_TIMEOUT_MS
    ): Promise<ClaudeStreamMessage[]> {
        if (!this.process || !this._isRunning) {
            throw new Error(`ClaudeProcess ${this.id} is not running`);
        }

        return new Promise((resolve, reject) => {
            this.messageBuffer = [];
            this.pendingResolve = resolve;
            this.pendingReject = reject;

            // Set up timeout
            this.timeoutId = setTimeout(() => {
                if (this.pendingReject) {
                    this.pendingReject(new Error(`sendAndWait timed out after ${timeoutMs}ms`));
                    this.pendingResolve = null;
                    this.pendingReject = null;
                }
            }, timeoutMs);

            this.send(input);
        });
    }

    /**
     * Stop the process gracefully
     */
    public stop(): void {
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
     * Resume a previous session
     *
     * @param sessionId - Session ID to resume
     * @param prompt - Optional prompt to continue with
     */
    public async resume(sessionId: string, prompt?: string): Promise<void> {
        this._sessionId = sessionId;

        const args = this.buildArgs(prompt, true);

        return new Promise((resolve, reject) => {
            this.process = spawn('claude', args, {
                cwd: this.workingDir,
                env: { ...process.env },
                shell: process.platform === 'win32'
            });

            this._isRunning = true;

            this.process.stdout?.on('data', (data: Buffer) => {
                this.handleStdout(data.toString());
            });

            this.process.stderr?.on('data', (data: Buffer) => {
                this.handleStderr(data.toString());
            });

            this.process.on('close', (code: number | null) => {
                this.handleClose(code);
            });

            this.process.on('error', (error: Error) => {
                this._isRunning = false;
                this.emit('error', error);
                reject(error);
            });

            this.emit('started');
            resolve();
        });
    }

    /**
     * Build CLI arguments
     */
    private buildArgs(prompt?: string, resume: boolean = false): string[] {
        const args: string[] = [];

        // Print mode with prompt or continue mode
        if (prompt) {
            args.push('-p', prompt);
        }

        // Stream JSON output
        args.push('--output-format', 'stream-json');

        // Resume previous session
        if (resume) {
            args.push('--continue');
            args.push('--resume', this._sessionId);
        }

        // Auto-approve tools
        if (this.autoApprove) {
            args.push('--dangerously-skip-permissions');
        }

        // System prompt
        if (this.systemPrompt) {
            args.push('--append-system-prompt', this.systemPrompt);
        }

        return args;
    }

    /**
     * Handle stdout data
     */
    private handleStdout(data: string): void {
        const events = this.streamParser.parse(data);

        for (const event of events) {
            const message = this.convertToStreamMessage(event);
            this.emit('message', message);

            // Check for tool use
            if (event.type === 'tool_use' && event.tool) {
                this.emit('tool_use', event.tool.name, event.tool.input);

                // Check for spawn_agent tool
                if (event.tool.name === 'spawn_agent') {
                    this.emit('spawn_request', event.tool.input as unknown as AgentConfig);
                }
            }

            // Collect messages for sendAndWait
            if (this.pendingResolve) {
                this.messageBuffer.push(message);

                // Check if response is complete
                if (event.type === 'complete') {
                    this.resolvePending();
                }
            }
        }
    }

    /**
     * Handle stderr data
     */
    private handleStderr(data: string): void {
        const lines = data.split('\n').filter(line => line.trim());

        for (const line of lines) {
            const message: ClaudeStreamMessage = {
                type: 'error',
                content: line,
                timestamp: new Date().toISOString()
            };
            this.emit('message', message);

            if (this.pendingResolve) {
                this.messageBuffer.push(message);
            }
        }
    }

    /**
     * Handle process close
     */
    private handleClose(code: number | null): void {
        this._isRunning = false;

        // Flush remaining buffer
        const remaining = this.streamParser.flush();
        for (const event of remaining) {
            const message = this.convertToStreamMessage(event);
            this.emit('message', message);

            if (this.pendingResolve) {
                this.messageBuffer.push(message);
            }
        }

        // Resolve pending promise if any
        this.resolvePending();

        this.emit('exit', code ?? 0);
        this.cleanup();
    }

    /**
     * Convert StreamJsonEvent to ClaudeStreamMessage
     */
    private convertToStreamMessage(event: StreamJsonEvent): ClaudeStreamMessage {
        const message: ClaudeStreamMessage = {
            type: this.mapEventType(event.type),
            content: event.content,
            session_id: this._sessionId,
            timestamp: new Date().toISOString()
        };

        if (event.tool) {
            message.tool_name = event.tool.name;
            message.tool_input = event.tool.input;
        }

        if (event.result !== undefined) {
            message.tool_result = JSON.stringify(event.result);
        }

        if (event.error) {
            message.is_error = true;
            message.content = event.error;
        }

        return message;
    }

    /**
     * Map StreamJsonEvent type to ClaudeStreamMessage type
     */
    private mapEventType(eventType: string): ClaudeStreamMessage['type'] {
        switch (eventType) {
            case 'text':
                return 'assistant';
            case 'init':
                return 'system';
            case 'complete':
                return 'result';
            case 'tool_use':
                return 'tool_use';
            case 'tool_result':
                return 'tool_result';
            case 'error':
                return 'error';
            default:
                return 'assistant';
        }
    }

    /**
     * Resolve pending sendAndWait promise
     */
    private resolvePending(): void {
        if (this.pendingResolve) {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }

            this.pendingResolve(this.messageBuffer);
            this.pendingResolve = null;
            this.pendingReject = null;
            this.messageBuffer = [];
        }
    }

    /**
     * Cleanup resources
     */
    private cleanup(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        this.process = null;
        this.streamParser = createStreamParser();
        this.pendingResolve = null;
        this.pendingReject = null;
        this.messageBuffer = [];
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.stop();
        this.removeAllListeners();
    }
}

/**
 * Create a ClaudeProcess from an AgentConfig
 *
 * @param config - Agent configuration
 * @returns Configured ClaudeProcess instance
 */
export function createClaudeProcess(config: AgentConfig): ClaudeProcess {
    return new ClaudeProcess(
        config.id,
        config.workingDir,
        config.autoApprove ?? false,
        config.systemPrompt
    );
}
