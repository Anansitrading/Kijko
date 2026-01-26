/**
 * CLI Detector - Detect Claude Code CLI installation
 *
 * Detects whether Claude Code CLI is installed, its version,
 * path, and authentication status. Cross-platform support for
 * Windows, macOS, and Linux.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Authentication method used by Claude Code CLI
 */
export type AuthMethod = 'oauth' | 'apikey' | 'none';

/**
 * Information about Claude Code CLI installation
 */
export interface ClaudeCodeInfo {
    /** Whether Claude Code CLI is installed and accessible */
    installed: boolean;
    /** Version string (e.g., "1.0.0"), null if not installed */
    version: string | null;
    /** Absolute path to the CLI executable, null if not installed */
    path: string | null;
    /** Whether the CLI is authenticated */
    authenticated: boolean;
    /** Authentication method in use */
    authMethod: AuthMethod;
}

/**
 * Default timeout for CLI commands in milliseconds
 */
const CLI_TIMEOUT_MS = 5000;

/**
 * Detect Claude Code CLI installation and status
 *
 * @returns Promise resolving to ClaudeCodeInfo object
 *
 * @example
 * ```typescript
 * const info = await detectClaudeCode();
 * if (info.installed) {
 *     console.log(`Claude CLI v${info.version} at ${info.path}`);
 * }
 * ```
 */
export async function detectClaudeCode(): Promise<ClaudeCodeInfo> {
    const defaultResult: ClaudeCodeInfo = {
        installed: false,
        version: null,
        path: null,
        authenticated: false,
        authMethod: 'none'
    };

    try {
        // Step 1: Find CLI path
        const cliPath = await findCliPath();
        if (!cliPath) {
            return defaultResult;
        }

        // Step 2: Get version
        const version = await getCliVersion(cliPath);
        if (!version) {
            return defaultResult;
        }

        // Step 3: Check authentication status
        const { authenticated, authMethod } = await checkAuthStatus();

        return {
            installed: true,
            version,
            path: cliPath,
            authenticated,
            authMethod
        };
    } catch (error) {
        // Silently handle errors and return default result
        console.error('CLI detection error:', error);
        return defaultResult;
    }
}

/**
 * Find the path to the Claude CLI executable
 *
 * @returns Absolute path to CLI or null if not found
 */
async function findCliPath(): Promise<string | null> {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'where claude' : 'which claude';

    try {
        const { stdout } = await execAsync(command, {
            timeout: CLI_TIMEOUT_MS
        });

        const cliPath = stdout.trim().split('\n')[0];
        if (cliPath && fs.existsSync(cliPath)) {
            return cliPath;
        }

        return null;
    } catch {
        // CLI not found in PATH
        return null;
    }
}

/**
 * Get the version of the Claude CLI
 *
 * @param cliPath - Path to the CLI executable
 * @returns Version string or null if unavailable
 */
async function getCliVersion(cliPath: string): Promise<string | null> {
    try {
        const { stdout } = await execAsync(`"${cliPath}" --version`, {
            timeout: CLI_TIMEOUT_MS
        });

        // Parse version from output like "claude 1.0.0" or "1.0.0"
        const versionMatch = stdout.match(/(\d+\.\d+\.\d+(?:-[\w.]+)?)/);
        return versionMatch ? versionMatch[1] : null;
    } catch {
        return null;
    }
}

/**
 * Check authentication status from environment and Claude settings
 *
 * Priority:
 * 1. CLAUDE_CODE_OAUTH_TOKEN env var (Max subscription, headless use)
 * 2. ANTHROPIC_API_KEY env var (separate billing)
 * 3. Config file auth tokens
 *
 * @returns Object with authenticated flag and auth method
 */
async function checkAuthStatus(): Promise<{
    authenticated: boolean;
    authMethod: AuthMethod;
}> {
    const defaultAuth = { authenticated: false, authMethod: 'none' as AuthMethod };

    try {
        // Check for Claude Code OAuth token (subscription-based, headless use)
        // This is set by running: claude setup-token
        if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
            return { authenticated: true, authMethod: 'oauth' };
        }

        // Check for API key (fallback, but uses separate billing)
        if (process.env.ANTHROPIC_API_KEY) {
            return { authenticated: true, authMethod: 'apikey' };
        }

        const homeDir = os.homedir();

        // Check ~/.claude/.credentials.json (current Claude Code location)
        const credentialsPath = path.join(homeDir, '.claude', '.credentials.json');
        if (fs.existsSync(credentialsPath)) {
            const credContent = fs.readFileSync(credentialsPath, 'utf-8');
            const creds = JSON.parse(credContent);

            if (creds.claudeAiOauth?.accessToken) {
                return { authenticated: true, authMethod: 'oauth' };
            }
        }

        // Check ~/.config/claude-code/auth.json (alternate location)
        const authPath = path.join(homeDir, '.config', 'claude-code', 'auth.json');
        if (fs.existsSync(authPath)) {
            const authContent = fs.readFileSync(authPath, 'utf-8');
            const auth = JSON.parse(authContent);

            if (auth.access_token || auth.accessToken) {
                return { authenticated: true, authMethod: 'oauth' };
            }
        }

        // Legacy: Check ~/.claude/settings.json
        const settingsPath = path.join(homeDir, '.claude', 'settings.json');

        if (fs.existsSync(settingsPath)) {
            const settingsContent = fs.readFileSync(settingsPath, 'utf-8');
            const settings = JSON.parse(settingsContent);

            if (settings.oauthToken || settings.oauth_token) {
                return { authenticated: true, authMethod: 'oauth' };
            }

            if (settings.apiKey || settings.api_key) {
                return { authenticated: true, authMethod: 'apikey' };
            }

            if (settings.authenticated === true) {
                return { authenticated: true, authMethod: 'oauth' };
            }
        }

        return defaultAuth;
    } catch {
        // Settings file doesn't exist or is invalid
        return defaultAuth;
    }
}

/**
 * Check if CLI is available (quick check without full detection)
 *
 * @returns Promise resolving to true if CLI is available
 */
export async function isCliAvailable(): Promise<boolean> {
    const info = await detectClaudeCode();
    return info.installed;
}

/**
 * Get cached CLI info (uses module-level cache for performance)
 */
let cachedInfo: ClaudeCodeInfo | null = null;
let cacheTime: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get CLI info with caching
 *
 * @param forceRefresh - If true, bypass cache and detect fresh
 * @returns Promise resolving to ClaudeCodeInfo
 */
export async function getCachedCliInfo(forceRefresh = false): Promise<ClaudeCodeInfo> {
    const now = Date.now();

    if (!forceRefresh && cachedInfo && (now - cacheTime) < CACHE_TTL_MS) {
        return cachedInfo;
    }

    cachedInfo = await detectClaudeCode();
    cacheTime = now;
    return cachedInfo;
}

/**
 * Clear the cached CLI info
 */
export function clearCliCache(): void {
    cachedInfo = null;
    cacheTime = 0;
}
