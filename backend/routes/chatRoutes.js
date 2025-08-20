import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { 
  generateContent, 
  generateContentStream, 
  createChatSession,
  analyzeContent,
  generateCreativeBrief
} from '../services/geminiService.js';
import { KIJKO_SYSTEM_PROMPT } from '../config/prompts.js';

const router = express.Router();

// Store active chat sessions (in production, use Redis or database)
const chatSessions = new Map();

/**
 * Send message to live agent
 * POST /api/chat/message
 */
router.post('/message', asyncHandler(async (req, res) => {
  const { message, sessionId, streaming = false, context = {} } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({
      success: false,
      error: 'Message and sessionId are required'
    });
  }

  try {
    // Get or create chat session
    let chatSession = chatSessions.get(sessionId);
    if (!chatSession) {
      chatSession = await createChatSession(KIJKO_SYSTEM_PROMPT);
      chatSessions.set(sessionId, chatSession);
    }

    if (streaming) {
      // For streaming responses, we'll use Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      try {
        const stream = chatSession.send_message_stream(message);
        
        for await (const chunk of stream) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          if (chunk.done) break;
        }
        
        res.end();
      } catch (streamError) {
        console.error('Streaming error:', streamError);
        res.write(`data: ${JSON.stringify({ error: 'Streaming failed', done: true })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      const response = await chatSession.send_message(message);
      
      res.json({
        success: true,
        data: {
          text: response.text,
          sessionId,
          timestamp: new Date().toISOString(),
          usage: response.usage
        }
      });
    }
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
}));

/**
 * Generate creative brief from user input
 * POST /api/chat/brief
 */
router.post('/brief', asyncHandler(async (req, res) => {
  const { userInput, context = {} } = req.body;

  if (!userInput) {
    return res.status(400).json({
      success: false,
      error: 'User input is required'
    });
  }

  try {
    const brief = await generateCreativeBrief(userInput, context);
    
    res.json({
      success: true,
      data: {
        brief,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Creative brief generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate creative brief'
    });
  }
}));

/**
 * Analyze uploaded content
 * POST /api/chat/analyze
 */
router.post('/analyze', asyncHandler(async (req, res) => {
  const { content, analysisPrompt, contentType = 'text' } = req.body;

  if (!content || !analysisPrompt) {
    return res.status(400).json({
      success: false,
      error: 'Content and analysis prompt are required'
    });
  }

  try {
    const analysis = await analyzeContent(content, analysisPrompt, contentType);
    
    res.json({
      success: true,
      data: {
        analysis: analysis.analysis,
        content_type: analysis.content_type,
        usage: analysis.usage,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Content analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze content'
    });
  }
}));

/**
 * Start new chat session
 * POST /api/chat/session
 */
router.post('/session', asyncHandler(async (req, res) => {
  const { sessionId, systemInstruction } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  try {
    const chatSession = await createChatSession(systemInstruction || KIJKO_SYSTEM_PROMPT);
    chatSessions.set(sessionId, chatSession);

    res.json({
      success: true,
      data: {
        sessionId,
        message: 'Chat session created successfully',
        system_instruction: chatSession.get_system_instruction()
      }
    });
  } catch (error) {
    console.error('Chat session creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create chat session'
    });
  }
}));

/**
 * Get chat session history
 * GET /api/chat/session/:sessionId
 */
router.get('/session/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const chatSession = chatSessions.get(sessionId);
  if (!chatSession) {
    return res.status(404).json({
      success: false,
      error: 'Chat session not found'
    });
  }

  try {
    // Get chat history
    const history = chatSession.get_history ? await chatSession.get_history() : [];

    res.json({
      success: true,
      data: {
        sessionId,
        history,
        system_instruction: chatSession.get_system_instruction()
      }
    });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat history'
    });
  }
}));

/**
 * Clear chat session
 * DELETE /api/chat/session/:sessionId
 */
router.delete('/session/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (chatSessions.has(sessionId)) {
    chatSessions.delete(sessionId);
  }

  res.json({
    success: true,
    data: {
      message: 'Chat session cleared'
    }
  });
}));

/**
 * Get all active sessions (for debugging)
 * GET /api/chat/sessions
 */
router.get('/sessions', asyncHandler(async (req, res) => {
  const sessionIds = Array.from(chatSessions.keys());
  
  res.json({
    success: true,
    data: {
      active_sessions: sessionIds.length,
      session_ids: sessionIds
    }
  });
}));

export default router;