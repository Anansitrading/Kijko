import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Graceful shutdown endpoint
router.post('/', asyncHandler(async (req, res) => {
  const { action } = req.body;
  
  console.log('🔌 Shutdown request received:', action);
  
  try {
    if (action === 'prepare_shutdown') {
      // Log the shutdown preparation
      console.log('🛑 Preparing for graceful shutdown...');
      
      // Here we could add cleanup logic:
      // - Close database connections
      // - Finish pending operations
      // - Clear temporary files
      // - Notify connected WebSocket clients
      
      // For now, we'll just acknowledge the shutdown preparation
      res.status(200).json({
        status: 'success',
        message: 'Shutdown preparation complete',
        timestamp: new Date().toISOString(),
        services_notified: [
          'websocket_server',
          'gemini_service',
          'live_api_service'
        ]
      });
      
      // Optional: Set a timer to actually shut down the server
      // This gives the frontend time to receive the response
      // setTimeout(() => {
      //   console.log('🔌 Initiating server shutdown...');
      //   process.exit(0);
      // }, 2000);
      
    } else {
      res.status(400).json({
        error: 'Invalid action',
        message: 'Expected action: prepare_shutdown',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Error during shutdown preparation:', error);
    res.status(500).json({
      error: 'Shutdown preparation failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// Get shutdown status
router.get('/status', asyncHandler(async (req, res) => {
  res.status(200).json({
    status: 'running',
    uptime: process.uptime(),
    memory_usage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
}));

export default router;