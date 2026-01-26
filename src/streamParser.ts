/**
 * Stream Parser - Parse Claude Code CLI stream-json output
 *
 * Parses the streaming JSON output from Claude Code CLI
 * (--output-format stream-json) into structured events.
 */

/**
 * Types of events in the stream-json output
 */
export type StreamEventType =
    | 'init'
    | 'text'
    | 'tool_use'
    | 'tool_result'
    | 'complete'
    | 'error';

/**
 * Tool information for tool_use events
 */
export interface ToolInfo {
    /** Name of the tool being used */
    name: string;
    /** Input parameters for the tool */
    input: Record<string, unknown>;
    /** Unique ID for this tool use */
    id?: string;
}

/**
 * Parsed stream event from Claude Code CLI
 */
export interface StreamJsonEvent {
    /** Type of the event */
    type: StreamEventType;
    /** Text content (for text events) */
    content?: string;
    /** Tool information (for tool_use events) */
    tool?: ToolInfo;
    /** Result data (for tool_result or complete events) */
    result?: unknown;
    /** Error message (for error events) */
    error?: string;
    /** Original raw data from the event */
    raw?: unknown;
}

/**
 * Parse a single line of stream-json output
 *
 * @param line - A single line from CLI stdout
 * @returns Parsed event or null for empty/invalid lines
 *
 * @example
 * ```typescript
 * const event = parseStreamJson('{"type":"assistant","message":{"content":[{"type":"text","text":"Hello"}]}}');
 * // Returns: { type: 'text', content: 'Hello' }
 * ```
 */
export function parseStreamJson(line: string): StreamJsonEvent | null {
    // Handle empty lines
    if (!line || line.trim() === '') {
        return null;
    }

    const trimmed = line.trim();

    // Try to parse as JSON
    try {
        const data = JSON.parse(trimmed);
        return parseJsonEvent(data);
    } catch {
        // Not valid JSON - treat as plain text output
        return {
            type: 'text',
            content: trimmed
        };
    }
}

/**
 * Parse a JSON object into a StreamJsonEvent
 *
 * @param data - Parsed JSON object
 * @returns Structured event
 */
function parseJsonEvent(data: unknown): StreamJsonEvent {
    if (!data || typeof data !== 'object') {
        return { type: 'text', content: String(data), raw: data };
    }

    const obj = data as Record<string, unknown>;

    // Handle different event types from Claude Code CLI

    // Type 1: Direct type field (newer format)
    if (obj.type === 'init' || obj.type === 'system') {
        return {
            type: 'init',
            content: extractContent(obj),
            raw: data
        };
    }

    // Type 2: Assistant message with content blocks
    if (obj.type === 'assistant' || obj.type === 'message') {
        return parseAssistantMessage(obj);
    }

    // Type 3: Content block delta (streaming text)
    if (obj.type === 'content_block_delta') {
        const delta = obj.delta as Record<string, unknown> | undefined;
        if (delta?.type === 'text_delta' || delta?.text) {
            return {
                type: 'text',
                content: (delta.text as string) || '',
                raw: data
            };
        }
        if (delta?.type === 'input_json_delta') {
            return {
                type: 'text',
                content: (delta.partial_json as string) || '',
                raw: data
            };
        }
    }

    // Type 4: Content block start (tool use begins)
    if (obj.type === 'content_block_start') {
        const block = obj.content_block as Record<string, unknown> | undefined;
        if (block?.type === 'tool_use') {
            return {
                type: 'tool_use',
                tool: {
                    name: (block.name as string) || 'unknown',
                    input: {},
                    id: block.id as string
                },
                raw: data
            };
        }
    }

    // Type 5: Tool use event
    if (obj.type === 'tool_use') {
        return {
            type: 'tool_use',
            tool: {
                name: (obj.name as string) || 'unknown',
                input: (obj.input as Record<string, unknown>) || {},
                id: obj.id as string
            },
            raw: data
        };
    }

    // Type 6: Tool result event
    if (obj.type === 'tool_result') {
        return {
            type: 'tool_result',
            result: obj.content || obj.output || obj.result,
            tool: obj.tool_use_id ? { name: '', input: {}, id: obj.tool_use_id as string } : undefined,
            raw: data
        };
    }

    // Type 7: Result/completion event
    if (obj.type === 'result' || obj.type === 'message_stop' || obj.type === 'message_delta') {
        if (obj.type === 'message_delta') {
            const delta = obj.delta as Record<string, unknown> | undefined;
            if (delta?.stop_reason) {
                return {
                    type: 'complete',
                    result: { stop_reason: delta.stop_reason },
                    raw: data
                };
            }
        }
        return {
            type: 'complete',
            result: obj.result || obj.message || obj,
            raw: data
        };
    }

    // Type 8: Error event
    if (obj.type === 'error' || obj.error) {
        const errorMsg = obj.error
            ? (typeof obj.error === 'string' ? obj.error : (obj.error as Record<string, unknown>).message)
            : obj.message;
        return {
            type: 'error',
            error: String(errorMsg || 'Unknown error'),
            raw: data
        };
    }

    // Type 9: Message start (initialization)
    if (obj.type === 'message_start') {
        return {
            type: 'init',
            content: 'Message started',
            raw: data
        };
    }

    // Type 10: Ping/keepalive (ignore)
    if (obj.type === 'ping') {
        return null as unknown as StreamJsonEvent;
    }

    // Unknown type - return as text with the raw content
    return {
        type: 'text',
        content: extractContent(obj) || JSON.stringify(obj),
        raw: data
    };
}

/**
 * Parse an assistant message into events
 */
function parseAssistantMessage(obj: Record<string, unknown>): StreamJsonEvent {
    // Check for message.content structure
    const message = obj.message as Record<string, unknown> | undefined;
    const contentBlocks = (message?.content || obj.content) as unknown[];

    if (Array.isArray(contentBlocks)) {
        // Extract text from content blocks
        const textParts: string[] = [];
        let toolEvent: StreamJsonEvent | null = null;

        for (const block of contentBlocks) {
            if (typeof block === 'object' && block !== null) {
                const b = block as Record<string, unknown>;
                if (b.type === 'text' && typeof b.text === 'string') {
                    textParts.push(b.text);
                } else if (b.type === 'tool_use') {
                    toolEvent = {
                        type: 'tool_use',
                        tool: {
                            name: (b.name as string) || 'unknown',
                            input: (b.input as Record<string, unknown>) || {},
                            id: b.id as string
                        },
                        raw: obj
                    };
                }
            }
        }

        // Prefer returning tool event if found, otherwise text
        if (toolEvent) {
            return toolEvent;
        }

        if (textParts.length > 0) {
            return {
                type: 'text',
                content: textParts.join(''),
                raw: obj
            };
        }
    }

    // Fallback: extract any text content
    return {
        type: 'text',
        content: extractContent(obj) || '',
        raw: obj
    };
}

/**
 * Extract text content from various object structures
 */
function extractContent(obj: Record<string, unknown>): string {
    // Direct text field
    if (typeof obj.text === 'string') {
        return obj.text;
    }

    // Content field
    if (typeof obj.content === 'string') {
        return obj.content;
    }

    // Message field
    if (typeof obj.message === 'string') {
        return obj.message;
    }

    // Nested message.content
    if (obj.message && typeof obj.message === 'object') {
        const msg = obj.message as Record<string, unknown>;
        if (typeof msg.content === 'string') {
            return msg.content;
        }
    }

    return '';
}

/**
 * Parse multiple lines of stream-json output
 *
 * @param output - Multi-line string from CLI
 * @returns Array of parsed events (nulls filtered out)
 */
export function parseStreamOutput(output: string): StreamJsonEvent[] {
    const lines = output.split('\n');
    const events: StreamJsonEvent[] = [];

    for (const line of lines) {
        const event = parseStreamJson(line);
        if (event) {
            events.push(event);
        }
    }

    return events;
}

/**
 * Create a line parser for streaming input
 *
 * @returns Object with parse method and buffer handling
 */
export function createStreamParser(): {
    parse: (chunk: string) => StreamJsonEvent[];
    flush: () => StreamJsonEvent[];
} {
    let buffer = '';

    return {
        /**
         * Parse a chunk of data, handling partial lines
         */
        parse(chunk: string): StreamJsonEvent[] {
            buffer += chunk;
            const events: StreamJsonEvent[] = [];

            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                const event = parseStreamJson(line);
                if (event) {
                    events.push(event);
                }
            }

            return events;
        },

        /**
         * Flush remaining buffer content
         */
        flush(): StreamJsonEvent[] {
            if (buffer.trim()) {
                const event = parseStreamJson(buffer);
                buffer = '';
                return event ? [event] : [];
            }
            buffer = '';
            return [];
        }
    };
}
