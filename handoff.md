# Claude Agent Spawner - Headless CLI Integration Handoff

## Overview

This document outlines the implementation plan for integrating headless Claude Code CLI with the VS Code extension. The goal is to stream user inputs and Claude responses between the webview chat interface and background Claude Code CLI processes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      VS Code Extension                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────────┐     ┌─────────────┐ │
│  │   Webview    │     │   CLIManager     │     │  Claude CLI │ │
│  │  Chat Panel  │◄───►│  (New Module)    │◄───►│  Subprocess │ │
│  └──────────────┘     └──────────────────┘     └─────────────┘ │
│         │                      │                      │         │
│         │    postMessage()     │    spawn/stdin       │         │
│         │◄────────────────────►│◄────────────────────►│         │
│         │                      │    stdout/stderr     │         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Claude Code CLI Detection & Validation

**File: `src/cliDetector.ts` (NEW)**

```typescript
import { execSync } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export interface ClaudeCodeInfo {
    installed: boolean;
    version: string | null;
    path: string | null;
    authenticated: boolean;
    authMethod: 'oauth' | 'apikey' | 'none';
}

export async function detectClaudeCode(): Promise<ClaudeCodeInfo> {
    const result: ClaudeCodeInfo = {
        installed: false,
        version: null,
        path: null,
        authenticated: false,
        authMethod: 'none'
    };

    try {
        // 1. Check if claude is in PATH
        const whichCmd = os.platform() === 'win32' ? 'where claude' : 'which claude';
        result.path = execSync(whichCmd, { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0];

        // 2. Get version
        result.version = execSync('claude --version', { encoding: 'utf8', timeout: 5000 }).trim();
        result.installed = true;

        // 3. Check authentication status
        const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            if (settings.oauthToken || settings.primaryApiKey) {
                result.authenticated = true;
                result.authMethod = settings.oauthToken ? 'oauth' : 'apikey';
            }
        }
    } catch (error) {
        // Claude Code not installed or not in PATH
    }

    return result;
}
```

**Tasks:**
- [ ] Create `cliDetector.ts` module
- [ ] Implement `detectClaudeCode()` function
- [ ] Add authentication status check via `~/.claude/settings.json`
- [ ] Show warning in UI if Claude Code not installed
- [ ] Provide install instructions link

---

### Phase 2: CLI Process Manager

**File: `src/cliManager.ts` (NEW)**

This module manages spawning and communicating with headless Claude Code CLI processes.

```typescript
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';

export interface CLIStreamEvent {
    type: 'output' | 'error' | 'complete' | 'tool_use';
    content: string;
    timestamp: Date;
}

export interface CLIManagerOptions {
    workingDirectory: string;
    allowedTools?: string[];
    systemPrompt?: string;
    continueSession?: boolean;
}

export class CLIManager extends EventEmitter {
    private process: ChildProcess | null = null;
    private outputBuffer: string = '';
    private isProcessing: boolean = false;

    constructor(private options: CLIManagerOptions) {
        super();
    }

    /**
     * Send a prompt to Claude Code CLI and stream the response
     */
    async sendPrompt(prompt: string): Promise<void> {
        if (this.isProcessing) {
            throw new Error('Already processing a prompt');
        }

        this.isProcessing = true;
        this.outputBuffer = '';

        // Build command arguments
        const args = this.buildArgs(prompt);

        // Spawn claude process
        this.process = spawn('claude', args, {
            cwd: this.options.workingDirectory,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                // Ensure non-interactive mode
                CI: 'true',
                TERM: 'dumb'
            }
        });

        // Handle stdout streaming
        this.process.stdout?.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            this.outputBuffer += text;

            this.emit('stream', {
                type: 'output',
                content: text,
                timestamp: new Date()
            } as CLIStreamEvent);
        });

        // Handle stderr
        this.process.stderr?.on('data', (chunk: Buffer) => {
            const text = chunk.toString();

            this.emit('stream', {
                type: 'error',
                content: text,
                timestamp: new Date()
            } as CLIStreamEvent);
        });

        // Handle process completion
        this.process.on('close', (code) => {
            this.isProcessing = false;

            this.emit('complete', {
                type: 'complete',
                content: this.outputBuffer,
                exitCode: code,
                timestamp: new Date()
            });
        });

        this.process.on('error', (err) => {
            this.isProcessing = false;
            this.emit('error', err);
        });
    }

    /**
     * Build CLI arguments for headless mode
     */
    private buildArgs(prompt: string): string[] {
        const args: string[] = [
            '-p', prompt,                    // Print mode (headless)
            '--output-format', 'stream-json' // Structured streaming output
        ];

        // Add allowed tools if specified
        if (this.options.allowedTools?.length) {
            args.push('--allowedTools', this.options.allowedTools.join(','));
        }

        // Add system prompt if specified
        if (this.options.systemPrompt) {
            args.push('--append-system-prompt', this.options.systemPrompt);
        }

        // Continue previous session if requested
        if (this.options.continueSession) {
            args.push('--continue');
        }

        return args;
    }

    /**
     * Cancel the current operation
     */
    cancel(): void {
        if (this.process && !this.process.killed) {
            this.process.kill('SIGTERM');
            this.isProcessing = false;
        }
    }

    /**
     * Check if currently processing
     */
    get processing(): boolean {
        return this.isProcessing;
    }
}
```

**Tasks:**
- [ ] Create `cliManager.ts` module
- [ ] Implement `CLIManager` class with EventEmitter pattern
- [ ] Handle `--output-format stream-json` parsing
- [ ] Implement process cancellation
- [ ] Add timeout handling
- [ ] Add retry logic for transient failures

---

### Phase 3: Update ChatPanel to Use CLI

**File: `src/chatPanel.ts` (MODIFY)**

Replace direct API calls with CLIManager:

```typescript
// In ChatPanel class, replace _processWithClaude method:

private cliManager: CLIManager | null = null;

private async _processWithClaude(userMessage: ChatMessage): Promise<void> {
    this._isProcessing = true;
    this._panel.webview.postMessage({ command: 'setProcessing', isProcessing: true });

    try {
        // Create CLI manager for this agent's working directory
        this.cliManager = new CLIManager({
            workingDirectory: this._config.workspacePath || process.cwd(),
            allowedTools: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
            continueSession: this._messages.length > 2 // Continue if not first message
        });

        const assistantMessageId = this._generateId();
        this._panel.webview.postMessage({
            command: 'startStreaming',
            messageId: assistantMessageId
        });

        let fullContent = '';

        // Listen for streaming output
        this.cliManager.on('stream', (event: CLIStreamEvent) => {
            if (event.type === 'output') {
                fullContent += event.content;

                this._panel.webview.postMessage({
                    command: 'streamChunk',
                    messageId: assistantMessageId,
                    chunk: event.content
                });
            }
        });

        // Build prompt with context
        const prompt = this._buildPromptWithAttachments(userMessage);

        // Send to CLI
        await this.cliManager.sendPrompt(prompt);

        // Wait for completion
        await new Promise<void>((resolve, reject) => {
            this.cliManager!.on('complete', () => resolve());
            this.cliManager!.on('error', reject);
        });

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
        // Error handling...
    } finally {
        this._isProcessing = false;
        this._panel.webview.postMessage({ command: 'setProcessing', isProcessing: false });
    }
}

private _buildPromptWithAttachments(message: ChatMessage): string {
    let prompt = message.content;

    // Add file attachments as context
    if (message.attachments?.length) {
        prompt += '\n\n--- Attached Files ---\n';
        for (const attachment of message.attachments) {
            if (attachment.type === 'file') {
                prompt += `\n### ${attachment.name}\n\`\`\`\n${attachment.content}\n\`\`\`\n`;
            }
        }
    }

    return prompt;
}
```

**Tasks:**
- [ ] Modify `ChatPanel` to use `CLIManager` instead of direct API
- [ ] Update `_processWithClaude` method
- [ ] Handle file attachments in prompt building
- [ ] Implement conversation continuation with `--continue`
- [ ] Add cancel button functionality

---

### Phase 4: Parse Stream-JSON Output

**File: `src/streamParser.ts` (NEW)**

Parse the `--output-format stream-json` output from Claude Code CLI:

```typescript
export interface StreamJsonEvent {
    type: 'init' | 'text' | 'tool_use' | 'tool_result' | 'complete' | 'error';
    content?: string;
    tool?: {
        name: string;
        input: any;
    };
    result?: any;
}

export function parseStreamJson(line: string): StreamJsonEvent | null {
    if (!line.trim()) return null;

    try {
        const parsed = JSON.parse(line);

        // Handle different event types from Claude Code CLI
        if (parsed.type === 'assistant') {
            return {
                type: 'text',
                content: parsed.message?.content?.[0]?.text || ''
            };
        }

        if (parsed.type === 'tool_use') {
            return {
                type: 'tool_use',
                tool: {
                    name: parsed.name,
                    input: parsed.input
                }
            };
        }

        if (parsed.type === 'tool_result') {
            return {
                type: 'tool_result',
                result: parsed.content
            };
        }

        if (parsed.type === 'result') {
            return {
                type: 'complete',
                content: parsed.result
            };
        }

        return null;
    } catch {
        // Plain text output (not JSON)
        return {
            type: 'text',
            content: line
        };
    }
}
```

**Tasks:**
- [ ] Create `streamParser.ts` module
- [ ] Implement JSON event parsing
- [ ] Handle tool use events for UI display
- [ ] Handle plain text fallback

---

### Phase 5: Update Agent Manager

**File: `src/agentManager.ts` (MODIFY)**

Update to pass working directory properly:

```typescript
// In spawnAgent method, update ChatPanelConfig:

const chatConfig: ChatPanelConfig = {
    agentId,
    agentName,
    initialPrompt: options.prompt,
    workspacePath: worktreePath || cwd,  // Use worktree if created
    useClaudeCLI: true  // Flag to use CLI instead of API
};
```

**Tasks:**
- [ ] Add `useClaudeCLI` config option
- [ ] Pass correct working directory (worktree support)
- [ ] Update agent status based on CLI process state

---

### Phase 6: Settings & Configuration

**File: `package.json` (MODIFY)**

Add new settings:

```json
{
  "claudeAgentSpawner.useClaudeCLI": {
    "type": "boolean",
    "default": true,
    "description": "Use installed Claude Code CLI instead of direct API (recommended)"
  },
  "claudeAgentSpawner.cliAllowedTools": {
    "type": "array",
    "default": ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
    "description": "Tools to auto-approve when using Claude Code CLI"
  },
  "claudeAgentSpawner.cliTimeout": {
    "type": "number",
    "default": 300000,
    "description": "Timeout for CLI operations in milliseconds (default: 5 minutes)"
  }
}
```

**Tasks:**
- [ ] Add CLI-related settings to `package.json`
- [ ] Implement fallback to API if CLI not available
- [ ] Add UI indicator showing CLI vs API mode

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/cliDetector.ts` | CREATE | Detect Claude Code CLI installation |
| `src/cliManager.ts` | CREATE | Manage CLI subprocess communication |
| `src/streamParser.ts` | CREATE | Parse stream-json output |
| `src/chatPanel.ts` | MODIFY | Use CLIManager instead of API calls |
| `src/agentManager.ts` | MODIFY | Pass working directory, add CLI flag |
| `src/extension.ts` | MODIFY | Initialize CLI detection on activation |
| `package.json` | MODIFY | Add CLI-related settings |

---

## CLI Command Reference

### Headless Mode Flags

| Flag | Purpose |
|------|---------|
| `-p, --print` | Run in non-interactive print mode |
| `--output-format stream-json` | Output structured JSON for parsing |
| `--continue, -c` | Continue previous conversation |
| `--allowedTools` | Pre-approve tools (e.g., `Read,Edit,Bash`) |
| `--append-system-prompt` | Add custom system instructions |
| `--verbose` | Debug output to stderr |

### Example Commands

```bash
# Basic headless query
claude -p "Explain this code"

# With streaming JSON output
claude -p "Review this PR" --output-format stream-json

# Continue conversation
claude -p "Now fix the issues" --continue

# With pre-approved tools
claude -p "Refactor auth.ts" --allowedTools "Read,Edit,Write"

# Pipe file content
cat file.ts | claude -p "Review this code"
```

---

## Testing Checklist

- [ ] Verify CLI detection works on Windows/macOS/Linux
- [ ] Test streaming output displays correctly in webview
- [ ] Test file attachments are included in prompts
- [ ] Test conversation continuation with `--continue`
- [ ] Test cancellation stops CLI process
- [ ] Test fallback to API when CLI unavailable
- [ ] Test worktree directory is used correctly
- [ ] Test tool approval works with `--allowedTools`
- [ ] Test error handling for CLI failures
- [ ] Test timeout handling

---

## Known Limitations

1. **Large Input**: Inputs >7000 chars may yield empty output (chunk if needed)
2. **Session Persistence**: No automatic session persistence across VS Code restarts
3. **Slash Commands**: `/commit`, `/review-pr` etc. unavailable in headless mode
4. **Interactive Tools**: Some tools may require interactive approval even with `--allowedTools`

---

## Migration Path

1. **Phase 1-2**: Core CLI infrastructure (detection + manager)
2. **Phase 3-4**: Integration with existing chat panel
3. **Phase 5-6**: Polish, settings, and fallback handling
4. **Testing**: Full integration testing
5. **Release**: Update VSIX package

---

## Dependencies

No new npm dependencies required - uses Node.js built-in `child_process` module.

---

## References

- [Claude Code Headless Mode Docs](https://code.claude.com/docs/en/headless)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Node.js child_process API](https://nodejs.org/api/child_process.html)
