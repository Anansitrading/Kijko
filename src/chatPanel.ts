/**
 * ChatPanel - Native webview chat interface for Claude agents
 *
 * Creates a full-featured chat panel with:
 * - Message history display
 * - User input with send button
 * - File drag-drop attachment
 * - Ctrl+V paste for text and images
 * - Streaming response rendering
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CLIManager, CLIStreamEvent, createCLIManagerFromConfig } from './cliManager';
import { getCachedCliInfo, ClaudeCodeInfo } from './cliDetector';

// Output channel for visible logging in VS Code OUTPUT panel
const outputChannel = vscode.window.createOutputChannel('Claude Chat Debug');

function log(msg: string) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    outputChannel.appendLine(`[${timestamp}] ${msg}`);
    console.log(`[ChatPanel] ${msg}`);
}

/**
 * Refresh Claude OAuth token if expired.
 * Reads ~/.claude/.credentials.json, checks expiry, refreshes via Anthropic OAuth endpoint.
 * Updates the credentials file so the CLI can use the fresh token.
 */
async function ensureValidToken(): Promise<void> {
    const os = require('os');
    const credsPath = path.join(os.homedir(), '.claude', '.credentials.json');

    if (!fs.existsSync(credsPath)) {
        log('No credentials file found at ' + credsPath);
        return;
    }

    try {
        const raw = fs.readFileSync(credsPath, 'utf-8');
        const creds = JSON.parse(raw);
        const oauth = creds.claudeAiOauth;

        if (!oauth || !oauth.accessToken) {
            log('No OAuth credentials found in credentials file');
            return;
        }

        const now = Date.now();
        const expiresAt = oauth.expiresAt || 0;
        const bufferMs = 60000; // refresh 1 minute before expiry

        if (expiresAt - bufferMs > now) {
            log('Token still valid, expires in ' + Math.round((expiresAt - now) / 1000) + 's');
            return;
        }

        log('Token expired or expiring soon, refreshing...');

        if (!oauth.refreshToken) {
            log('No refresh token available - user needs to re-authenticate with: claude login');
            return;
        }

        const https = require('https');
        const tokenData = await new Promise<any>((resolve, reject) => {
            const body = JSON.stringify({
                grant_type: 'refresh_token',
                refresh_token: oauth.refreshToken,
                client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
            });

            const req = https.request('https://console.anthropic.com/api/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (res: any) => {
                let data = '';
                res.on('data', (chunk: string) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`Token refresh failed: ${res.statusCode} ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(body);
            req.end();
        });

        // Update credentials
        oauth.accessToken = tokenData.access_token;
        if (tokenData.refresh_token) {
            oauth.refreshToken = tokenData.refresh_token;
        }
        oauth.expiresAt = now + ((tokenData.expires_in || 3600) * 1000);

        fs.writeFileSync(credsPath, JSON.stringify(creds));
        log('Token refreshed successfully, new expiry in ' + (tokenData.expires_in || 3600) + 's');
    } catch (err: any) {
        log('Token refresh error: ' + (err.message || err));
    }
}

/**
 * Message types for chat
 */
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    attachments?: ChatAttachment[];
}

export interface ChatAttachment {
    id: string;
    name: string;
    type: 'file' | 'image';
    content: string; // Base64 for images, text content for files
    mimeType?: string;
}

/**
 * Chat panel configuration
 */
export interface ChatPanelConfig {
    agentId: string;
    agentName: string;
    initialPrompt?: string;
    workspacePath?: string;
    apiKey?: string;
    /** Whether to use Claude Code CLI instead of direct API */
    useClaudeCLI?: boolean;
}

/**
 * ChatPanel class - manages a single agent chat webview
 */
export class ChatPanel {
    public static readonly viewType = 'claudeAgentChat';
    private static panels: Map<string, ChatPanel> = new Map();

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _config: ChatPanelConfig;
    private _messages: ChatMessage[] = [];
    private _pendingAttachments: ChatAttachment[] = [];
    private _isProcessing: boolean = false;
    private _disposables: vscode.Disposable[] = [];

    // CLI integration
    private _cliManager: CLIManager | null = null;
    private _useCLI: boolean = true;
    private _messageCount: number = 0;
    private _cliInfo: ClaudeCodeInfo | null = null;
    private _currentMode: 'cli' | 'api' = 'cli';

    // Event emitters
    private _onDidDispose: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidDispose: vscode.Event<void> = this._onDidDispose.event;

    private _onMessageSent: vscode.EventEmitter<ChatMessage> = new vscode.EventEmitter<ChatMessage>();
    public readonly onMessageSent: vscode.Event<ChatMessage> = this._onMessageSent.event;

    /**
     * Create or show a chat panel
     */
    public static createOrShow(
        extensionUri: vscode.Uri,
        config: ChatPanelConfig
    ): ChatPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Check if panel already exists
        const existingPanel = ChatPanel.panels.get(config.agentId);
        if (existingPanel) {
            existingPanel._panel.reveal(column);
            return existingPanel;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            ChatPanel.viewType,
            `Chat: ${config.agentName}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        const chatPanel = new ChatPanel(panel, extensionUri, config);
        ChatPanel.panels.set(config.agentId, chatPanel);

        return chatPanel;
    }

    /**
     * Get existing panel by agent ID
     */
    public static getPanel(agentId: string): ChatPanel | undefined {
        return ChatPanel.panels.get(agentId);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        config: ChatPanelConfig
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._config = config;

        // Set webview content
        this._panel.webview.html = this._getHtmlContent();

        // Set icon
        this._panel.iconPath = {
            light: vscode.Uri.joinPath(extensionUri, 'media', 'icon.svg'),
            dark: vscode.Uri.joinPath(extensionUri, 'media', 'icon.svg')
        };

        // Handle messages from webview
        this._panel.webview.onDidReceiveMessage(
            this._handleWebviewMessage.bind(this),
            null,
            this._disposables
        );

        // Handle panel disposal
        this._panel.onDidDispose(
            () => this._dispose(),
            null,
            this._disposables
        );

        // Initialize CLI settings (use config value if provided, otherwise read from VS Code settings)
        const vsConfig = vscode.workspace.getConfiguration('claudeAgentSpawner');
        this._useCLI = config.useClaudeCLI !== undefined
            ? config.useClaudeCLI
            : vsConfig.get<boolean>('useClaudeCLI', true);

        // Initialize CLI detection and mode indicator
        this._initializeCLIMode();

        // Send initial prompt if provided
        if (config.initialPrompt) {
            setTimeout(() => {
                this._addSystemMessage(`Task: ${config.initialPrompt}`);
            }, 500);
        }
    }

    /**
     * Initialize CLI mode detection and update webview
     */
    private async _initializeCLIMode(): Promise<void> {
        try {
            log('_initializeCLIMode: _useCLI = ' + this._useCLI);
            this._cliInfo = await getCachedCliInfo();
            log('_initializeCLIMode: cliInfo = ' + JSON.stringify(this._cliInfo));

            if (this._useCLI && this._cliInfo.installed) {
                this._currentMode = 'cli';
                log('_initializeCLIMode: Set mode to CLI');
            } else {
                this._currentMode = 'api';
                log('_initializeCLIMode: Set mode to API');
                if (this._useCLI && !this._cliInfo.installed) {
                    // User wanted CLI but it's not available
                    vscode.window.showWarningMessage(
                        'Claude Code CLI not found. Falling back to API mode.'
                    );
                }
            }

            // Send mode to webview
            this._panel.webview.postMessage({
                command: 'setMode',
                mode: this._currentMode,
                cliVersion: this._cliInfo.version
            });
        } catch (error) {
            console.error('Failed to detect CLI:', error);
            this._currentMode = 'api';
            this._panel.webview.postMessage({
                command: 'setMode',
                mode: 'api',
                cliVersion: null
            });
        }
    }

    /**
     * Handle messages from webview
     */
    private async _handleWebviewMessage(message: any): Promise<void> {
        log('_handleWebviewMessage: ' + message.command);
        switch (message.command) {
            case 'sendMessage':
                log('sendMessage received, text: ' + message.text);
                await this._handleUserMessage(message.text, message.attachments);
                break;

            case 'addAttachment':
                this._handleAttachment(message.attachment);
                break;

            case 'removeAttachment':
                this._removeAttachment(message.attachmentId);
                break;

            case 'pasteImage':
                this._handlePastedImage(message.dataUrl, message.name);
                break;

            case 'dropFiles':
                await this._handleDroppedFiles(message.files);
                break;

            case 'cancelProcessing':
                this._cancelProcessing();
                break;

            case 'clearChat':
                this._clearChat();
                break;

            case 'exportChat':
                await this._exportChat();
                break;
        }
    }

    /**
     * Handle user message
     */
    private async _handleUserMessage(text: string, attachments?: ChatAttachment[]): Promise<void> {
        log('_handleUserMessage called with: ' + text.substring(0, 50));
        if (this._isProcessing) {
            log('Already processing, returning');
            return;
        }

        // Create user message
        const userMessage: ChatMessage = {
            id: this._generateId(),
            role: 'user',
            content: text,
            timestamp: new Date(),
            attachments: attachments || this._pendingAttachments
        };

        this._messages.push(userMessage);
        this._pendingAttachments = [];
        this._onMessageSent.fire(userMessage);

        // Update UI
        this._panel.webview.postMessage({
            command: 'addMessage',
            message: this._serializeMessage(userMessage)
        });

        this._panel.webview.postMessage({
            command: 'clearAttachments'
        });

        // Process with Claude (CLI or API based on mode)
        log('currentMode = ' + this._currentMode);
        if (this._currentMode === 'cli') {
            log('Taking CLI path');
            await this._processWithCLI(userMessage);
        } else {
            log('Taking API path');
            await this._processWithAPI(userMessage);
        }
    }

    /**
     * Process message with Claude Code CLI
     */
    private async _processWithCLI(userMessage: ChatMessage): Promise<void> {
        log('_processWithCLI called');
        outputChannel.show(); // Make the output panel visible
        this._isProcessing = true;
        this._messageCount++;
        this._panel.webview.postMessage({ command: 'setProcessing', isProcessing: true });

        try {
            const workspacePath = this._config.workspacePath ||
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
                process.cwd();

            log('Workspace: ' + workspacePath);

            // Build prompt
            const prompt = this._buildPromptWithAttachments(userMessage);
            log('Prompt: ' + prompt.substring(0, 50));

            // Create assistant message placeholder
            const assistantMessageId = this._generateId();
            this._panel.webview.postMessage({
                command: 'startStreaming',
                messageId: assistantMessageId
            });

            // Ensure OAuth token is fresh before spawning
            await ensureValidToken();

            // SIMPLE DIRECT APPROACH - bypass CLIManager
            const { spawn, execSync } = require('child_process');

            // Find claude path dynamically
            let claudePath = '/root/.local/bin/claude';
            try {
                claudePath = execSync('which claude', { encoding: 'utf-8', timeout: 5000 }).trim();
            } catch {
                // Fallback to common locations
                const commonPaths = ['/root/.local/bin/claude', '/usr/local/bin/claude',
                                     `${process.env.HOME}/.local/bin/claude`];
                for (const p of commonPaths) {
                    if (require('fs').existsSync(p)) {
                        claudePath = p;
                        break;
                    }
                }
            }

            const args = ['-p', prompt, '--output-format', 'json'];

            log('Spawning: ' + claudePath + ' ' + args.join(' '));
            log('OAuth token present: ' + !!process.env.CLAUDE_CODE_OAUTH_TOKEN);
            log('API key present: ' + !!process.env.ANTHROPIC_API_KEY);

            let fullContent = '';

            const proc = spawn(claudePath, args, {
                cwd: workspacePath,
                env: { ...process.env },
                stdio: ['ignore', 'pipe', 'pipe']  // IGNORE stdin - CLI hangs waiting for it!
                // No shell: true - let Node handle args to avoid quote/escape issues
            });

            log('Process spawned, PID: ' + proc.pid);
            log('stdout exists: ' + !!proc.stdout);
            log('stderr exists: ' + !!proc.stderr);

            // Add timeout to detect hangs
            const timeout = setTimeout(() => {
                log('TIMEOUT: Process hung for 30 seconds, killing...');
                proc.kill();
            }, 30000);

            proc.stdout.on('data', (data: Buffer) => {
                const str = data.toString();
                log('STDOUT: ' + str.substring(0, 100));

                // Try to parse JSON response
                try {
                    const json = JSON.parse(str);
                    if (json.result) {
                        fullContent = json.result;
                        this._panel.webview.postMessage({
                            command: 'streamChunk',
                            messageId: assistantMessageId,
                            chunk: json.result
                        });
                    }
                } catch {
                    // Not JSON, might be streaming text
                    fullContent += str;
                    this._panel.webview.postMessage({
                        command: 'streamChunk',
                        messageId: assistantMessageId,
                        chunk: str
                    });
                }
            });

            proc.stderr.on('data', (data: Buffer) => {
                log('STDERR: ' + data.toString().substring(0, 200));
            });

            await new Promise<void>((resolve, reject) => {
                proc.on('close', (code: number) => {
                    clearTimeout(timeout);
                    log('Process closed with code: ' + code);
                    if (code === 0 || code === null) {
                        resolve();
                    } else {
                        reject(new Error('CLI exited with code ' + code));
                    }
                });
                proc.on('error', (err: Error) => {
                    clearTimeout(timeout);
                    log('Process error: ' + err.message);
                    reject(err);
                });
            });

            log('Process completed, content length: ' + fullContent.length);

            // Store final message
            const assistantMessage: ChatMessage = {
                id: assistantMessageId,
                role: 'assistant',
                content: fullContent,
                timestamp: new Date()
            };
            this._messages.push(assistantMessage);

            this._panel.webview.postMessage({
                command: 'finishStreaming',
                messageId: assistantMessageId,
                content: fullContent
            });

        } catch (error: any) {
            console.error('CLI processing error:', error);

            // Fallback to API if CLI fails and API key is available
            const config = vscode.workspace.getConfiguration('claudeAgentSpawner');
            const apiKey = this._config.apiKey || config.get<string>('anthropicApiKey');

            if (apiKey) {
                console.log('Falling back to API mode');
                this._currentMode = 'api';

                // Notify user and update webview mode indicator
                vscode.window.showWarningMessage('CLI failed. Switching to API mode.');
                this._panel.webview.postMessage({
                    command: 'setMode',
                    mode: 'api',
                    cliVersion: null
                });

                await this._processWithAPI(userMessage);
                return;
            }

            const errorMessage: ChatMessage = {
                id: this._generateId(),
                role: 'assistant',
                content: `**Error:** ${error.message || 'Failed to communicate with Claude Code CLI'}`,
                timestamp: new Date()
            };

            this._messages.push(errorMessage);
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: this._serializeMessage(errorMessage)
            });
        } finally {
            this._isProcessing = false;
            this._panel.webview.postMessage({ command: 'setProcessing', isProcessing: false });

            // Clean up CLI manager
            if (this._cliManager) {
                this._cliManager.removeAllListeners();
            }
        }
    }

    /**
     * Build prompt string with attachments
     */
    private _buildPromptWithAttachments(message: ChatMessage): string {
        let prompt = message.content;

        if (message.attachments && message.attachments.length > 0) {
            for (const attachment of message.attachments) {
                if (attachment.type === 'file') {
                    prompt += `\n\n--- File: ${attachment.name} ---\n${attachment.content}\n--- End of ${attachment.name} ---`;
                } else if (attachment.type === 'image') {
                    // Note: CLI may not support images directly, mention it
                    prompt += `\n\n[Image attached: ${attachment.name}]`;
                }
            }
        }

        return prompt;
    }

    /**
     * Process message with Claude API (fallback)
     */
    private async _processWithAPI(userMessage: ChatMessage): Promise<void> {
        this._isProcessing = true;
        this._panel.webview.postMessage({ command: 'setProcessing', isProcessing: true });

        try {
            // Get API key from config or settings
            const config = vscode.workspace.getConfiguration('claudeAgentSpawner');
            const apiKey = this._config.apiKey || config.get<string>('anthropicApiKey');

            if (!apiKey) {
                // No API key - show setup message
                const assistantMessage: ChatMessage = {
                    id: this._generateId(),
                    role: 'assistant',
                    content: `**API Key Required**\n\nTo use the chat feature, please set your Anthropic API key:\n\n1. Open VS Code Settings\n2. Search for "Claude Agent Spawner"\n3. Enter your API key in the "Anthropic Api Key" field\n\nAlternatively, you can get an API key at [console.anthropic.com](https://console.anthropic.com)`,
                    timestamp: new Date()
                };

                this._messages.push(assistantMessage);
                this._panel.webview.postMessage({
                    command: 'addMessage',
                    message: this._serializeMessage(assistantMessage)
                });
                return;
            }

            // Build messages for API
            const apiMessages = this._buildApiMessages();

            // Create assistant message placeholder for streaming
            const assistantMessageId = this._generateId();
            this._panel.webview.postMessage({
                command: 'startStreaming',
                messageId: assistantMessageId
            });

            // Call Claude API with streaming
            const response = await this._callClaudeAPI(apiKey, apiMessages, assistantMessageId);

            // Store final message
            const assistantMessage: ChatMessage = {
                id: assistantMessageId,
                role: 'assistant',
                content: response,
                timestamp: new Date()
            };
            this._messages.push(assistantMessage);

            this._panel.webview.postMessage({
                command: 'finishStreaming',
                messageId: assistantMessageId,
                content: response
            });

        } catch (error: any) {
            const errorMessage: ChatMessage = {
                id: this._generateId(),
                role: 'assistant',
                content: `**Error:** ${error.message || 'Failed to get response from Claude'}`,
                timestamp: new Date()
            };

            this._messages.push(errorMessage);
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: this._serializeMessage(errorMessage)
            });
        } finally {
            this._isProcessing = false;
            this._panel.webview.postMessage({ command: 'setProcessing', isProcessing: false });
        }
    }

    /**
     * Build API messages from chat history
     */
    private _buildApiMessages(): Array<{ role: string; content: any }> {
        const messages: Array<{ role: string; content: any }> = [];

        for (const msg of this._messages) {
            if (msg.role === 'system') {
                continue; // Handle system messages separately
            }

            let content: any = msg.content;

            // Handle attachments
            if (msg.attachments && msg.attachments.length > 0) {
                content = [];

                // Add text first
                if (msg.content) {
                    content.push({ type: 'text', text: msg.content });
                }

                // Add attachments
                for (const attachment of msg.attachments) {
                    if (attachment.type === 'image') {
                        content.push({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: attachment.mimeType || 'image/png',
                                data: attachment.content.replace(/^data:image\/\w+;base64,/, '')
                            }
                        });
                    } else {
                        // Add file content as text
                        content.push({
                            type: 'text',
                            text: `\n\n--- File: ${attachment.name} ---\n${attachment.content}\n--- End of ${attachment.name} ---`
                        });
                    }
                }
            }

            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content
            });
        }

        return messages;
    }

    /**
     * Call Claude API with streaming
     */
    private async _callClaudeAPI(
        apiKey: string,
        messages: Array<{ role: string; content: any }>,
        messageId: string
    ): Promise<string> {
        const config = vscode.workspace.getConfiguration('claudeAgentSpawner');
        const model = config.get<string>('model', 'claude-sonnet-4-20250514');
        const maxTokens = config.get<number>('maxTokens', 4096);

        // Build system prompt
        let systemPrompt = 'You are Claude, an AI assistant created by Anthropic. You are helpful, harmless, and honest.';

        if (this._config.workspacePath) {
            systemPrompt += `\n\nYou are working in a VS Code workspace at: ${this._config.workspacePath}`;
        }

        if (this._config.initialPrompt) {
            systemPrompt += `\n\nYour current task: ${this._config.initialPrompt}`;
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                system: systemPrompt,
                messages,
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error: ${response.status} - ${error}`);
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);

                        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                            fullContent += parsed.delta.text;

                            // Stream to webview
                            this._panel.webview.postMessage({
                                command: 'streamChunk',
                                messageId,
                                chunk: parsed.delta.text
                            });
                        }
                    } catch {
                        // Ignore parse errors for incomplete chunks
                    }
                }
            }
        }

        return fullContent;
    }

    /**
     * Handle attachment
     */
    private _handleAttachment(attachment: ChatAttachment): void {
        this._pendingAttachments.push(attachment);
        this._panel.webview.postMessage({
            command: 'attachmentAdded',
            attachment: {
                id: attachment.id,
                name: attachment.name,
                type: attachment.type
            }
        });
    }

    /**
     * Remove attachment
     */
    private _removeAttachment(attachmentId: string): void {
        this._pendingAttachments = this._pendingAttachments.filter(a => a.id !== attachmentId);
    }

    /**
     * Handle pasted image
     */
    private _handlePastedImage(dataUrl: string, name: string): void {
        const attachment: ChatAttachment = {
            id: this._generateId(),
            name: name || `pasted-image-${Date.now()}.png`,
            type: 'image',
            content: dataUrl,
            mimeType: 'image/png'
        };

        this._handleAttachment(attachment);
    }

    /**
     * Handle dropped files
     */
    private async _handleDroppedFiles(files: Array<{ name: string; path?: string; content?: string; type: string }>): Promise<void> {
        for (const file of files) {
            let content = file.content || '';

            // Try to read file content if path is provided
            if (file.path && !content) {
                try {
                    content = fs.readFileSync(file.path, 'utf-8');
                } catch {
                    content = `[Could not read file: ${file.name}]`;
                }
            }

            const isImage = file.type.startsWith('image/');

            const attachment: ChatAttachment = {
                id: this._generateId(),
                name: file.name,
                type: isImage ? 'image' : 'file',
                content: content,
                mimeType: file.type
            };

            this._handleAttachment(attachment);
        }
    }

    /**
     * Add system message
     */
    private _addSystemMessage(content: string): void {
        const message: ChatMessage = {
            id: this._generateId(),
            role: 'system',
            content,
            timestamp: new Date()
        };

        this._messages.push(message);
        this._panel.webview.postMessage({
            command: 'addMessage',
            message: this._serializeMessage(message)
        });
    }

    /**
     * Cancel processing
     */
    private _cancelProcessing(): void {
        // Cancel CLI process if running
        if (this._cliManager) {
            this._cliManager.cancel();
        }

        this._isProcessing = false;
        this._panel.webview.postMessage({ command: 'setProcessing', isProcessing: false });
    }

    /**
     * Clear chat
     */
    private _clearChat(): void {
        this._messages = [];
        this._pendingAttachments = [];
        this._panel.webview.postMessage({ command: 'clearChat' });
    }

    /**
     * Export chat to file
     */
    private async _exportChat(): Promise<void> {
        const content = this._messages.map(m => {
            const role = m.role.toUpperCase();
            const time = m.timestamp.toISOString();
            return `[${time}] ${role}:\n${m.content}\n`;
        }).join('\n---\n\n');

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`chat-${this._config.agentName}-${Date.now()}.md`),
            filters: { 'Markdown': ['md'], 'Text': ['txt'] }
        });

        if (uri) {
            fs.writeFileSync(uri.fsPath, content, 'utf-8');
            vscode.window.showInformationMessage(`Chat exported to ${uri.fsPath}`);
        }
    }

    /**
     * Serialize message for webview
     */
    private _serializeMessage(message: ChatMessage): any {
        return {
            id: message.id,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp.toISOString(),
            attachments: message.attachments?.map(a => ({
                id: a.id,
                name: a.name,
                type: a.type
            }))
        };
    }

    /**
     * Generate unique ID
     */
    private _generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Focus the panel
     */
    public reveal(): void {
        this._panel.reveal();
    }

    /**
     * Get panel
     */
    public get panel(): vscode.WebviewPanel {
        return this._panel;
    }

    /**
     * Get agent ID
     */
    public get agentId(): string {
        return this._config.agentId;
    }

    /**
     * Get messages
     */
    public get messages(): ChatMessage[] {
        return [...this._messages];
    }

    /**
     * Dispose panel
     */
    private _dispose(): void {
        ChatPanel.panels.delete(this._config.agentId);
        this._onDidDispose.fire();

        // Clean up CLI manager
        if (this._cliManager) {
            this._cliManager.dispose();
            this._cliManager = null;
        }

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Get HTML content for webview
     */
    private _getHtmlContent(): string {
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data: https:;">
    <title>Chat: ${this._config.agentName}</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        :root {
            --bg-primary: var(--vscode-editor-background, #1e1e1e);
            --bg-secondary: var(--vscode-sideBar-background, #252526);
            --bg-tertiary: var(--vscode-input-background, #3c3c3c);
            --text-primary: var(--vscode-editor-foreground, #d4d4d4);
            --text-secondary: var(--vscode-descriptionForeground, #858585);
            --accent: var(--vscode-button-background, #0e639c);
            --accent-hover: var(--vscode-button-hoverBackground, #1177bb);
            --border: var(--vscode-panel-border, #454545);
            --user-bubble: var(--vscode-inputValidation-infoBackground, #063b49);
            --assistant-bubble: var(--vscode-editor-background, #1e1e1e);
            --error: var(--vscode-errorForeground, #f48771);
            --success: var(--vscode-terminal-ansiGreen, #4ec9b0);
        }

        body {
            font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
            font-size: 13px;
            color: var(--text-primary);
            background: var(--bg-primary);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* Header */
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
        }

        .header-title {
            font-weight: 600;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header-actions {
            display: flex;
            gap: 8px;
        }

        .header-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
        }

        .header-btn:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
        }

        /* Messages container */
        .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        /* Message bubble */
        .message {
            max-width: 85%;
            animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message.user {
            align-self: flex-end;
        }

        .message.assistant,
        .message.system {
            align-self: flex-start;
        }

        .message-header {
            font-size: 11px;
            color: var(--text-secondary);
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .message.user .message-header {
            justify-content: flex-end;
        }

        .message-content {
            padding: 12px 16px;
            border-radius: 12px;
            line-height: 1.5;
            word-wrap: break-word;
        }

        .message.user .message-content {
            background: var(--user-bubble);
            border-bottom-right-radius: 4px;
        }

        .message.assistant .message-content {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-bottom-left-radius: 4px;
        }

        .message.system .message-content {
            background: var(--bg-tertiary);
            border-left: 3px solid var(--accent);
            font-style: italic;
        }

        /* Attachments in message */
        .message-attachments {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
        }

        .attachment-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: var(--bg-tertiary);
            border-radius: 4px;
            font-size: 11px;
        }

        /* Markdown content */
        .message-content pre {
            background: var(--bg-tertiary);
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 8px 0;
        }

        .message-content code {
            background: var(--bg-tertiary);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
        }

        .message-content pre code {
            background: none;
            padding: 0;
        }

        .message-content p {
            margin: 8px 0;
        }

        .message-content p:first-child {
            margin-top: 0;
        }

        .message-content p:last-child {
            margin-bottom: 0;
        }

        .message-content a {
            color: var(--accent);
        }

        .message-content ul, .message-content ol {
            margin: 8px 0;
            padding-left: 20px;
        }

        /* Streaming indicator */
        .streaming-cursor {
            display: inline-block;
            width: 8px;
            height: 16px;
            background: var(--text-primary);
            animation: blink 1s infinite;
            vertical-align: middle;
            margin-left: 2px;
        }

        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }

        /* Input area */
        .input-area {
            padding: 16px;
            background: var(--bg-secondary);
            border-top: 1px solid var(--border);
        }

        /* Drop zone */
        .drop-zone {
            border: 2px dashed transparent;
            border-radius: 8px;
            transition: all 0.2s;
            padding: 4px;
        }

        .drop-zone.dragover {
            border-color: var(--accent);
            background: rgba(14, 99, 156, 0.1);
        }

        /* Attachments preview */
        .attachments-preview {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 12px;
        }

        .attachment-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            background: var(--bg-tertiary);
            border-radius: 6px;
            font-size: 12px;
        }

        .attachment-item img {
            width: 32px;
            height: 32px;
            object-fit: cover;
            border-radius: 4px;
        }

        .attachment-remove {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 2px;
            font-size: 14px;
            line-height: 1;
        }

        .attachment-remove:hover {
            color: var(--error);
        }

        /* Input container */
        .input-container {
            display: flex;
            gap: 12px;
            align-items: flex-end;
        }

        .input-wrapper {
            flex: 1;
            position: relative;
        }

        .message-input {
            width: 100%;
            min-height: 44px;
            max-height: 200px;
            padding: 12px 16px;
            padding-right: 40px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 13px;
            resize: none;
            outline: none;
            line-height: 1.5;
        }

        .message-input:focus {
            border-color: var(--accent);
        }

        .message-input::placeholder {
            color: var(--text-secondary);
        }

        .attach-btn {
            position: absolute;
            right: 8px;
            bottom: 8px;
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 4px;
            font-size: 16px;
        }

        .attach-btn:hover {
            color: var(--text-primary);
        }

        .send-btn {
            padding: 12px 20px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background 0.2s;
        }

        .send-btn:hover:not(:disabled) {
            background: var(--accent-hover);
        }

        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* Processing state */
        .processing-indicator {
            display: none;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: var(--bg-tertiary);
            border-radius: 6px;
            margin-bottom: 12px;
            font-size: 12px;
            color: var(--text-secondary);
        }

        .processing-indicator.active {
            display: flex;
        }

        .spinner {
            width: 14px;
            height: 14px;
            border: 2px solid var(--border);
            border-top-color: var(--accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Empty state */
        .empty-state {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            text-align: center;
            padding: 40px;
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }

        .empty-state-text {
            font-size: 14px;
            margin-bottom: 8px;
        }

        .empty-state-hint {
            font-size: 12px;
            opacity: 0.7;
        }

        /* File input (hidden) */
        .file-input {
            display: none;
        }

        /* Mode indicator */
        .mode-indicator {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
        }

        .mode-indicator.cli {
            background: rgba(78, 201, 176, 0.15);
            color: var(--success);
        }

        .mode-indicator.api {
            background: rgba(255, 204, 0, 0.15);
            color: #ffcc00;
        }

        .mode-icon {
            font-size: 12px;
        }

        /* Tool use indicators */
        .tool-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            margin: 8px 0;
            background: var(--bg-tertiary);
            border-left: 3px solid var(--accent);
            border-radius: 0 6px 6px 0;
            font-size: 12px;
            font-family: var(--vscode-editor-font-family, monospace);
        }

        .tool-indicator .tool-icon {
            font-size: 14px;
        }

        .tool-indicator .tool-name {
            color: var(--text-primary);
            font-weight: 500;
        }

        .tool-indicator .tool-input {
            color: var(--text-secondary);
            font-size: 11px;
            margin-left: auto;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .tool-result {
            padding: 8px 12px;
            margin: 4px 0 8px 0;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 11px;
            font-family: var(--vscode-editor-font-family, monospace);
            max-height: 100px;
            overflow-y: auto;
        }

        .tool-result-toggle {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 11px;
            padding: 2px 6px;
        }

        .tool-result-toggle:hover {
            color: var(--text-primary);
        }

        .tool-result.collapsed {
            display: none;
        }

        /* Orchestration Panel */
        .orchestration-panel {
            display: none;
            padding: 12px 16px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
        }

        .orchestration-panel.active {
            display: block;
        }

        .orchestration-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
        }

        .orchestration-title {
            font-weight: 600;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .orchestration-badge {
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 500;
        }

        .orchestration-badge.conductor {
            background: rgba(79, 70, 229, 0.2);
            color: #818cf8;
        }

        .orchestration-badge.ralph {
            background: rgba(34, 197, 94, 0.2);
            color: #4ade80;
        }

        /* Agent Hierarchy Tree */
        .agent-tree {
            margin-top: 8px;
            padding-left: 0;
        }

        .agent-node {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-bottom: 4px;
        }

        .agent-node:hover {
            background: var(--bg-tertiary);
        }

        .agent-node.root {
            font-weight: 600;
        }

        .agent-node .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .agent-node .status-dot.running {
            background: var(--success);
            animation: pulse 1.5s infinite;
        }

        .agent-node .status-dot.completed {
            background: #60a5fa;
        }

        .agent-node .status-dot.error {
            background: var(--error);
        }

        .agent-node .status-dot.idle {
            background: var(--text-secondary);
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .agent-children {
            padding-left: 16px;
            border-left: 1px solid var(--border);
            margin-left: 12px;
        }

        /* Ralph Health Panel */
        .ralph-panel {
            display: none;
            padding: 8px 12px;
            background: var(--bg-tertiary);
            border-radius: 6px;
            margin-top: 8px;
        }

        .ralph-panel.active {
            display: block;
        }

        .ralph-status {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
        }

        .ralph-health {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 500;
        }

        .ralph-health.good {
            background: rgba(34, 197, 94, 0.15);
            color: #4ade80;
        }

        .ralph-health.warning {
            background: rgba(251, 191, 36, 0.15);
            color: #fbbf24;
        }

        .ralph-health.critical {
            background: rgba(239, 68, 68, 0.15);
            color: #f87171;
        }

        .ralph-stats {
            display: flex;
            gap: 12px;
            margin-top: 8px;
            font-size: 11px;
            color: var(--text-secondary);
        }

        .ralph-stat {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--text-secondary);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-title">
            <span>🤖</span>
            <span>${this._config.agentName}</span>
            <div class="mode-indicator cli" id="modeIndicator" title="Using Claude Code CLI">
                <span class="mode-icon">⚡</span>
                <span class="mode-text">CLI</span>
            </div>
        </div>
        <div class="header-actions">
            <button class="header-btn" onclick="exportChat()" title="Export chat">📥 Export</button>
            <button class="header-btn" onclick="clearChat()" title="Clear chat">🗑️ Clear</button>
        </div>
    </div>

    <!-- Orchestration Panel -->
    <div class="orchestration-panel" id="orchestrationPanel">
        <div class="orchestration-header">
            <div class="orchestration-title">
                <span>🎭</span>
                <span>Orchestration</span>
                <span class="orchestration-badge conductor" id="conductorBadge" style="display:none">Conductor</span>
                <span class="orchestration-badge ralph" id="ralphBadge" style="display:none">Ralph Active</span>
            </div>
            <button class="header-btn" onclick="toggleOrchestrationPanel()">−</button>
        </div>
        <div class="agent-tree" id="agentTree">
            <!-- Agent hierarchy will be rendered here -->
        </div>
        <div class="ralph-panel" id="ralphPanel">
            <div class="ralph-status">
                <span>🔍 Health:</span>
                <span class="ralph-health good" id="ralphHealthBadge">Good</span>
            </div>
            <div class="ralph-stats" id="ralphStats">
                <div class="ralph-stat"><span>Agents:</span><span id="ralphAgentCount">0</span></div>
                <div class="ralph-stat"><span>Concerns:</span><span id="ralphConcernCount">0</span></div>
            </div>
        </div>
    </div>

    <div class="messages-container" id="messagesContainer">
        <div class="empty-state" id="emptyState">
            <div class="empty-state-icon">💬</div>
            <div class="empty-state-text">Start a conversation</div>
            <div class="empty-state-hint">Type a message, paste an image, or drop files</div>
        </div>
    </div>

    <div class="input-area">
        <div class="processing-indicator" id="processingIndicator">
            <div class="spinner"></div>
            <span>Claude is thinking...</span>
            <button class="header-btn" onclick="cancelProcessing()">Cancel</button>
        </div>

        <div class="drop-zone" id="dropZone">
            <div class="attachments-preview" id="attachmentsPreview"></div>

            <div class="input-container">
                <div class="input-wrapper">
                    <textarea
                        class="message-input"
                        id="messageInput"
                        placeholder="Type a message... (Shift+Enter for new line)"
                        rows="1"
                    ></textarea>
                    <button class="attach-btn" onclick="triggerFileInput()" title="Attach file">📎</button>
                </div>
                <button class="send-btn" id="sendBtn" onclick="sendMessage()">
                    <span>Send</span>
                    <span>↵</span>
                </button>
            </div>
        </div>

        <input type="file" class="file-input" id="fileInput" multiple accept="*/*">
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // State
        let attachments = [];
        let isProcessing = false;

        // DOM elements
        const messagesContainer = document.getElementById('messagesContainer');
        const emptyState = document.getElementById('emptyState');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const dropZone = document.getElementById('dropZone');
        const attachmentsPreview = document.getElementById('attachmentsPreview');
        const fileInput = document.getElementById('fileInput');
        const processingIndicator = document.getElementById('processingIndicator');

        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
        });

        // Send on Enter (Shift+Enter for new line)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Paste handling
        messageInput.addEventListener('paste', async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            vscode.postMessage({
                                command: 'pasteImage',
                                dataUrl: reader.result,
                                name: 'pasted-image.png'
                            });
                        };
                        reader.readAsDataURL(file);
                    }
                }
            }
        });

        // Drag and drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            dropZone.addEventListener(event, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(event => {
            dropZone.addEventListener(event, () => {
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(event => {
            dropZone.addEventListener(event, () => {
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', async (e) => {
            const files = Array.from(e.dataTransfer?.files || []);
            if (files.length === 0) return;

            const fileData = await Promise.all(files.map(async (file) => {
                const content = await readFileAsDataUrl(file);
                return {
                    name: file.name,
                    type: file.type,
                    content: content
                };
            }));

            vscode.postMessage({
                command: 'dropFiles',
                files: fileData
            });
        });

        // File input
        fileInput.addEventListener('change', async () => {
            const files = Array.from(fileInput.files || []);
            if (files.length === 0) return;

            const fileData = await Promise.all(files.map(async (file) => {
                const content = await readFileAsDataUrl(file);
                return {
                    name: file.name,
                    type: file.type,
                    content: content
                };
            }));

            vscode.postMessage({
                command: 'dropFiles',
                files: fileData
            });

            fileInput.value = '';
        });

        function readFileAsDataUrl(file) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                if (file.type.startsWith('image/')) {
                    reader.readAsDataURL(file);
                } else {
                    reader.readAsText(file);
                }
            });
        }

        function triggerFileInput() {
            fileInput.click();
        }

        // Send message
        function sendMessage() {
            const text = messageInput.value.trim();
            if (!text && attachments.length === 0) return;
            if (isProcessing) return;

            vscode.postMessage({
                command: 'sendMessage',
                text: text,
                attachments: attachments
            });

            messageInput.value = '';
            messageInput.style.height = 'auto';
        }

        // Clear chat
        function clearChat() {
            if (confirm('Clear all messages?')) {
                vscode.postMessage({ command: 'clearChat' });
            }
        }

        // Export chat
        function exportChat() {
            vscode.postMessage({ command: 'exportChat' });
        }

        // Cancel processing
        function cancelProcessing() {
            vscode.postMessage({ command: 'cancelProcessing' });
        }

        // Remove attachment
        function removeAttachment(id) {
            attachments = attachments.filter(a => a.id !== id);
            vscode.postMessage({ command: 'removeAttachment', attachmentId: id });
            renderAttachments();
        }

        // Render attachments preview
        function renderAttachments() {
            if (attachments.length === 0) {
                attachmentsPreview.innerHTML = '';
                return;
            }

            attachmentsPreview.innerHTML = attachments.map(a => \`
                <div class="attachment-item">
                    \${a.type === 'image' ? '<span>🖼️</span>' : '<span>📄</span>'}
                    <span>\${a.name}</span>
                    <button class="attachment-remove" onclick="removeAttachment('\${a.id}')">&times;</button>
                </div>
            \`).join('');
        }

        // Add message to UI
        function addMessage(message) {
            emptyState.style.display = 'none';

            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${message.role}\`;
            messageDiv.id = \`message-\${message.id}\`;

            const time = new Date(message.timestamp).toLocaleTimeString();
            const roleLabel = message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Claude' : 'System';

            let attachmentsHtml = '';
            if (message.attachments && message.attachments.length > 0) {
                attachmentsHtml = \`
                    <div class="message-attachments">
                        \${message.attachments.map(a => \`
                            <span class="attachment-badge">
                                \${a.type === 'image' ? '🖼️' : '📄'} \${a.name}
                            </span>
                        \`).join('')}
                    </div>
                \`;
            }

            messageDiv.innerHTML = \`
                <div class="message-header">
                    <span>\${roleLabel}</span>
                    <span>•</span>
                    <span>\${time}</span>
                </div>
                <div class="message-content">\${formatContent(message.content)}</div>
                \${attachmentsHtml}
            \`;

            messagesContainer.appendChild(messageDiv);
            scrollToBottom();
        }

        // Format content (basic markdown)
        function formatContent(content) {
            if (!content) return '';

            // Escape HTML
            let formatted = content
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // Code blocks
            formatted = formatted.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>');

            // Inline code
            formatted = formatted.replace(/\`([^\`]+)\`/g, '<code>$1</code>');

            // Bold
            formatted = formatted.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');

            // Italic
            formatted = formatted.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');

            // Links
            formatted = formatted.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank">$1</a>');

            // Line breaks
            formatted = formatted.replace(/\\n/g, '<br>');

            return formatted;
        }

        // Start streaming message
        function startStreaming(messageId) {
            emptyState.style.display = 'none';

            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant';
            messageDiv.id = \`message-\${messageId}\`;

            const time = new Date().toLocaleTimeString();

            messageDiv.innerHTML = \`
                <div class="message-header">
                    <span>Claude</span>
                    <span>•</span>
                    <span>\${time}</span>
                </div>
                <div class="message-content" id="content-\${messageId}"><span class="streaming-cursor"></span></div>
            \`;

            messagesContainer.appendChild(messageDiv);
            scrollToBottom();
        }

        // Stream chunk
        function streamChunk(messageId, chunk) {
            const contentEl = document.getElementById(\`content-\${messageId}\`);
            if (contentEl) {
                // Remove cursor temporarily
                const cursor = contentEl.querySelector('.streaming-cursor');
                if (cursor) cursor.remove();

                // Add chunk (preserve HTML for formatting)
                const span = document.createElement('span');
                span.textContent = chunk;
                contentEl.appendChild(span);

                // Re-add cursor
                const newCursor = document.createElement('span');
                newCursor.className = 'streaming-cursor';
                contentEl.appendChild(newCursor);

                scrollToBottom();
            }
        }

        // Finish streaming
        function finishStreaming(messageId, content) {
            const contentEl = document.getElementById(\`content-\${messageId}\`);
            if (contentEl) {
                contentEl.innerHTML = formatContent(content);
            }
        }

        // Scroll to bottom
        function scrollToBottom() {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Set processing state
        function setProcessing(processing) {
            isProcessing = processing;
            sendBtn.disabled = processing;
            processingIndicator.classList.toggle('active', processing);
        }

        // Set mode indicator
        function setMode(mode, cliVersion) {
            const indicator = document.getElementById('modeIndicator');
            if (!indicator) return;

            indicator.className = \`mode-indicator \${mode}\`;

            if (mode === 'cli') {
                indicator.innerHTML = \`
                    <span class="mode-icon">⚡</span>
                    <span class="mode-text">CLI\${cliVersion ? ' v' + cliVersion : ''}</span>
                \`;
                indicator.title = 'Using Claude Code CLI';
            } else {
                indicator.innerHTML = \`
                    <span class="mode-icon">🔌</span>
                    <span class="mode-text">API</span>
                \`;
                indicator.title = 'Using Anthropic API';
            }
        }

        // Display tool use indicator
        let currentToolContainer = null;

        function showToolUse(toolName, input) {
            // Get or create container in the current streaming message
            const streamingContent = messagesContainer.querySelector('.message.assistant:last-child .message-content');
            if (!streamingContent) return;

            // Create tool indicator
            const toolDiv = document.createElement('div');
            toolDiv.className = 'tool-indicator';
            toolDiv.id = \`tool-\${Date.now()}\`;

            const inputPreview = input ? (typeof input === 'string' ? input : JSON.stringify(input)).substring(0, 50) : '';

            toolDiv.innerHTML = \`
                <span class="tool-icon">🔧</span>
                <span class="tool-name">Using \${toolName}...</span>
                \${inputPreview ? \`<span class="tool-input" title="\${inputPreview}">\${inputPreview}\${inputPreview.length >= 50 ? '...' : ''}</span>\` : ''}
            \`;

            // Insert before the streaming cursor
            const cursor = streamingContent.querySelector('.streaming-cursor');
            if (cursor) {
                streamingContent.insertBefore(toolDiv, cursor);
            } else {
                streamingContent.appendChild(toolDiv);
            }

            currentToolContainer = toolDiv;
            scrollToBottom();
        }

        // Display tool result
        function showToolResult(result) {
            if (!currentToolContainer) return;

            // Update tool indicator to show complete
            const toolName = currentToolContainer.querySelector('.tool-name');
            if (toolName) {
                toolName.textContent = toolName.textContent.replace('...', ' ✓');
            }

            // Add result if it's not too large
            if (result && typeof result === 'string' && result.length < 500) {
                const resultDiv = document.createElement('div');
                resultDiv.className = 'tool-result';
                resultDiv.textContent = result.substring(0, 300) + (result.length > 300 ? '...' : '');
                currentToolContainer.parentNode.insertBefore(resultDiv, currentToolContainer.nextSibling);
            }

            currentToolContainer = null;
            scrollToBottom();
        }

        // Orchestration panel functions
        const orchestrationPanel = document.getElementById('orchestrationPanel');
        const conductorBadge = document.getElementById('conductorBadge');
        const ralphBadge = document.getElementById('ralphBadge');
        const agentTree = document.getElementById('agentTree');
        const ralphPanel = document.getElementById('ralphPanel');
        const ralphHealthBadge = document.getElementById('ralphHealthBadge');
        const ralphAgentCount = document.getElementById('ralphAgentCount');
        const ralphConcernCount = document.getElementById('ralphConcernCount');

        function toggleOrchestrationPanel() {
            orchestrationPanel.classList.toggle('active');
        }

        function updateOrchestration(data) {
            if (data.conductorActive) {
                orchestrationPanel.classList.add('active');
                conductorBadge.style.display = 'inline';
            } else {
                conductorBadge.style.display = 'none';
            }

            if (data.ralphActive) {
                ralphBadge.style.display = 'inline';
                ralphPanel.classList.add('active');
            } else {
                ralphBadge.style.display = 'none';
                ralphPanel.classList.remove('active');
            }

            if (data.hierarchy) {
                renderAgentTree(data.hierarchy);
            }

            if (data.ralph) {
                updateRalphStatus(data.ralph);
            }
        }

        function renderAgentTree(hierarchy) {
            agentTree.innerHTML = renderAgentNode(hierarchy, true);
        }

        function renderAgentNode(node, isRoot) {
            if (!node) return '';

            const statusClass = node.status || 'idle';
            const childrenHtml = node.children && node.children.length > 0
                ? \`<div class="agent-children">\${node.children.map(c => renderAgentNode(c, false)).join('')}</div>\`
                : '';

            return \`
                <div class="agent-node \${isRoot ? 'root' : ''}">
                    <span class="status-dot \${statusClass}"></span>
                    <span>\${node.name || node.id}</span>
                    \${node.task ? \`<span style="color: var(--text-secondary); font-size: 11px;">- \${node.task.substring(0, 30)}\${node.task.length > 30 ? '...' : ''}</span>\` : ''}
                </div>
                \${childrenHtml}
            \`;
        }

        function updateRalphStatus(ralph) {
            ralphHealthBadge.className = \`ralph-health \${ralph.status || 'good'}\`;
            ralphHealthBadge.textContent = (ralph.status || 'good').charAt(0).toUpperCase() + (ralph.status || 'good').slice(1);
            ralphAgentCount.textContent = ralph.agentCount || '0';
            ralphConcernCount.textContent = ralph.concernCount || '0';
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'addMessage':
                    addMessage(message.message);
                    break;

                case 'startStreaming':
                    startStreaming(message.messageId);
                    break;

                case 'streamChunk':
                    streamChunk(message.messageId, message.chunk);
                    break;

                case 'finishStreaming':
                    finishStreaming(message.messageId, message.content);
                    break;

                case 'setProcessing':
                    setProcessing(message.isProcessing);
                    break;

                case 'setMode':
                    setMode(message.mode, message.cliVersion);
                    break;

                case 'toolUse':
                    showToolUse(message.tool, message.input);
                    break;

                case 'toolResult':
                    showToolResult(message.result);
                    break;

                case 'attachmentAdded':
                    attachments.push(message.attachment);
                    renderAttachments();
                    break;

                case 'clearAttachments':
                    attachments = [];
                    renderAttachments();
                    break;

                case 'clearChat':
                    messagesContainer.innerHTML = \`
                        <div class="empty-state" id="emptyState">
                            <div class="empty-state-icon">💬</div>
                            <div class="empty-state-text">Start a conversation</div>
                            <div class="empty-state-hint">Type a message, paste an image, or drop files</div>
                        </div>
                    \`;
                    break;

                case 'orchestrationUpdate':
                    updateOrchestration(message.data);
                    break;

                case 'ralphAssessment':
                    updateRalphStatus(message.assessment);
                    break;

                case 'agentHierarchy':
                    renderAgentTree(message.hierarchy);
                    break;
            }
        });

        // Focus input on load
        messageInput.focus();
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
