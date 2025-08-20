import { GoogleGenerativeAI } from '@google/generative-ai';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { createChatSession } from './geminiService.js';
import { KIJKO_SYSTEM_PROMPT } from '../config/prompts.js';

dotenv.config();

/**
 * Live API Service for real-time multi-modal interactions
 * Based on Google Gemini Live API capabilities
 */

class LiveApiService {
  constructor() {
    this.client = null;
    this.activeSessions = new Map();
    this.initialize();
  }

  initialize() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  GEMINI_API_KEY not found - Live API disabled');
      return;
    }

    try {
      this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      console.log('✅ Live API service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Live API service:', error);
    }
  }

  /**
   * Create a new live session for multi-modal interaction
   */
  async createLiveSession(sessionId, config = {}) {
    if (!this.client) {
      throw new Error('Live API service not initialized');
    }

    try {
      // Default configuration for Kijko video production
      const defaultConfig = {
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          responseModalities: ['TEXT', 'AUDIO'], // Support both text and audio responses
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck' // Use a friendly, professional voice
              }
            }
          }
        },
        systemInstruction: `You are Kijko, an AI Video Production Assistant. You help users create professional videos through conversational interfaces.
        
        Your capabilities:
        - Creative discovery and brief generation
        - Real-time storyboard creation
        - Video production guidance
        - Multi-modal content analysis
        - Professional feedback and refinement
        
        Always be helpful, creative, and focused on video production excellence.`,
        tools: [
          {
            name: 'generate_creative_brief',
            description: 'Generate a structured creative brief from user input',
            parameters: {
              type: 'object',
              properties: {
                userInput: { type: 'string', description: 'User\'s video concept or idea' },
                context: { type: 'object', description: 'Additional context information' }
              },
              required: ['userInput']
            }
          },
          {
            name: 'generate_storyboard',
            description: 'Create storyboard frames from video requirements',
            parameters: {
              type: 'object',
              properties: {
                scenes: { type: 'array', description: 'Array of scene descriptions' },
                visualStyle: { type: 'string', description: 'Visual style preference' }
              },
              required: ['scenes']
            }
          },
          {
            name: 'analyze_media',
            description: 'Analyze uploaded images, videos, or audio for video production',
            parameters: {
              type: 'object',
              properties: {
                mediaType: { type: 'string', enum: ['image', 'video', 'audio'] },
                analysisType: { type: 'string', description: 'Type of analysis requested' }
              },
              required: ['mediaType']
            }
          }
        ],
        ...config
      };

      // Create Gemini chat session to back this live session
      const chatSession = await createChatSession(KIJKO_SYSTEM_PROMPT);

      const liveSession = {
        sessionId,
        config: defaultConfig,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        messageHistory: [],
        // Placeholder for actual Live API connection
        connection: null,
        chatSession
      };

      this.activeSessions.set(sessionId, liveSession);
      console.log(`🎙️ Live session created: ${sessionId}`);

      return liveSession;

    } catch (error) {
      console.error('Live session creation error:', error);
      throw new Error(`Failed to create live session: ${error.message}`);
    }
  }

  /**
   * Send real-time input to a live session
   */
  async sendRealtimeInput(sessionId, input) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Live session not found: ${sessionId}`);
    }

    try {
      // Update session activity
      session.lastActivity = new Date().toISOString();

      // Process different types of input (text only for now)
      const processedInput = this.processInput(input);

      // Ensure we have a chat session (create if missing)
      if (!session.chatSession) {
        session.chatSession = await createChatSession(KIJKO_SYSTEM_PROMPT);
      }

      // Add user message to history
      session.messageHistory.push({
        timestamp: new Date().toISOString(),
        type: 'user',
        content: processedInput
      });

      // Send to Gemini chat session (non-streaming for WS MVP)
      const result = await session.chatSession.send_message(
        processedInput.type === 'text' ? processedInput.content : '[non-text input received]'
      );

      const respObj = {
        type: 'text',
        content: result.text,
        usage: result.usage
      };

      // Add assistant response to history
      session.messageHistory.push({
        timestamp: new Date().toISOString(),
        type: 'assistant',
        content: respObj
      });

      return respObj;

    } catch (error) {
      console.error('Realtime input error:', error);
      throw new Error(`Failed to process realtime input: ${error.message}`);
    }
  }

  /**
   * Process different types of input (text, audio, image)
   */
  processInput(input) {
    if (typeof input === 'string') {
      return { type: 'text', content: input };
    }

    if (input.audio) {
      return { 
        type: 'audio', 
        content: input.audio,
        mimeType: input.mimeType || 'audio/wav'
      };
    }

    if (input.image) {
      return { 
        type: 'image', 
        content: input.image,
        mimeType: input.mimeType || 'image/jpeg'
      };
    }

    if (input.video) {
      return { 
        type: 'video', 
        content: input.video,
        mimeType: input.mimeType || 'video/mp4'
      };
    }

    return { type: 'text', content: 'Unknown input type' };
  }



  /**
   * Get live session information
   */
  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Close a live session
   */
  closeSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      // Clean up resources
      if (session.connection) {
        session.connection.close();
      }
      
      this.activeSessions.delete(sessionId);
      console.log(`🔌 Live session closed: ${sessionId}`);
      
      return true;
    }
    return false;
  }

  /**
   * Get all active sessions (for admin/debugging)
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.values()).map(session => ({
      sessionId: session.sessionId,
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      messageCount: session.messageHistory.length
    }));
  }

  /**
   * Handle WebSocket connection for live interaction
   */
  handleWebSocketConnection(ws, sessionId) {
    console.log(`🔗 WebSocket connected for session: ${sessionId}`);

    // Create or get live session
    let session = this.activeSessions.get(sessionId);
    if (!session) {
      this.createLiveSession(sessionId).then(newSession => {
        session = newSession;
        ws.send(JSON.stringify({
          type: 'session_created',
          sessionId,
          timestamp: new Date().toISOString()
        }));
      }).catch(error => {
        ws.send(JSON.stringify({
          type: 'error',
          message: `Failed to create session: ${error.message}`,
          timestamp: new Date().toISOString()
        }));
      });
    }

    // Handle incoming WebSocket messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        console.log(`📨 Received message for session ${sessionId}:`, data.type);

        switch (data.type) {
          case 'realtime_input':
            const response = await this.sendRealtimeInput(sessionId, data.input);
            ws.send(JSON.stringify({
              type: 'response',
              content: response,
              timestamp: new Date().toISOString()
            }));
            break;

          case 'get_session':
            const sessionInfo = this.getSession(sessionId);
            ws.send(JSON.stringify({
              type: 'session_info',
              session: sessionInfo,
              timestamp: new Date().toISOString()
            }));
            break;

          case 'ping':
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString()
            }));
            break;

          default:
            ws.send(JSON.stringify({
              type: 'error',
              message: `Unknown message type: ${data.type}`,
              timestamp: new Date().toISOString()
            }));
        }

      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        }));
      }
    });

    // Handle WebSocket close
    ws.on('close', () => {
      console.log(`🔌 WebSocket disconnected for session: ${sessionId}`);
      // Keep session active for potential reconnection
      if (session) {
        session.status = 'disconnected';
        session.lastActivity = new Date().toISOString();
      }
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for session ${sessionId}:`, error);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to Kijko Live API',
      sessionId,
      timestamp: new Date().toISOString()
    }));
  }
}

// Create singleton instance
const liveApiService = new LiveApiService();

export default liveApiService;