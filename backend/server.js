import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { geminiClient } from './services/geminiService.js';
import liveApiService from './services/liveApiService.js';
import { errorHandler, asyncHandler } from './middleware/errorHandler.js';
import chatRoutes from './routes/chatRoutes.js';
import vrdRoutes from './routes/vrdRoutes.js';
import storyboardRoutes from './routes/storyboardRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import shutdownRoutes from './routes/shutdownRoutes.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server for WebSocket support
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      gemini: geminiClient ? 'connected' : 'disconnected',
      live_api: liveApiService ? 'connected' : 'disconnected',
      active_sessions: liveApiService ? liveApiService.getActiveSessions().length : 0
    }
  });
});

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/vrd', vrdRoutes);
app.use('/api/storyboard', storyboardRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/shutdown', shutdownRoutes);

// WebSocket connection for live agent interaction
wss.on('connection', (ws, req) => {
  console.log('Client connected to WebSocket');
  
  // Extract session ID from URL query parameters or generate one
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId') || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🔗 WebSocket connection established for session: ${sessionId}`);
  
  // Use Live API service to handle the connection
  liveApiService.handleWebSocketConnection(ws, sessionId);
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🎬 Kijko Backend Server running on port ${PORT}`);
  console.log(`📡 WebSocket Server ready for live agent interaction`);
  console.log(`🤖 Gemini AI: ${geminiClient ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

export default app;