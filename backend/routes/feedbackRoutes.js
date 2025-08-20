import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Allow images, audio, and documents
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/mpeg', 'audio/wav', 'audio/m4a',
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// In-memory storage for feedback (in production, use a database)
const feedback = new Map();

/**
 * Add sticky note feedback
 * POST /api/feedback/add
 */
router.post('/add', upload.single('attachment'), asyncHandler(async (req, res) => {
  const { 
    projectId,
    sceneNumber,
    type = 'text', // text, voice, file
    content,
    position,
    severity = 'medium', // low, medium, high
    iteration = 1
  } = req.body;

  if (!projectId || !content) {
    return res.status(400).json({
      success: false,
      error: 'Project ID and content are required'
    });
  }

  const feedbackItem = {
    id: uuidv4(),
    projectId,
    sceneNumber: sceneNumber ? parseInt(sceneNumber) : null,
    type,
    content,
    position: position ? JSON.parse(position) : null,
    severity,
    iteration,
    status: 'open', // open, addressed, resolved
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Handle file attachment
  if (req.file) {
    feedbackItem.attachment = {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer.toString('base64') // In production, store in cloud storage
    };
  }

  feedback.set(feedbackItem.id, feedbackItem);

  res.status(201).json({
    success: true,
    data: feedbackItem
  });
}));

/**
 * Get feedback for project
 * GET /api/feedback/project/:projectId
 */
router.get('/project/:projectId', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { sceneNumber, status, iteration, severity } = req.query;

  let projectFeedback = Array.from(feedback.values())
    .filter(item => item.projectId === projectId);

  // Apply filters
  if (sceneNumber) {
    projectFeedback = projectFeedback.filter(item => 
      item.sceneNumber === parseInt(sceneNumber)
    );
  }

  if (status) {
    projectFeedback = projectFeedback.filter(item => item.status === status);
  }

  if (iteration) {
    projectFeedback = projectFeedback.filter(item => 
      item.iteration === parseInt(iteration)
    );
  }

  if (severity) {
    projectFeedback = projectFeedback.filter(item => item.severity === severity);
  }

  // Sort by creation date (newest first)
  projectFeedback.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    success: true,
    data: {
      feedback: projectFeedback,
      total: projectFeedback.length,
      filters: { sceneNumber, status, iteration, severity }
    }
  });
}));

/**
 * Update feedback item
 * PUT /api/feedback/:id
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const feedbackItem = feedback.get(id);
  if (!feedbackItem) {
    return res.status(404).json({
      success: false,
      error: 'Feedback item not found'
    });
  }

  const updatedFeedback = {
    ...feedbackItem,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  feedback.set(id, updatedFeedback);

  res.json({
    success: true,
    data: updatedFeedback
  });
}));

/**
 * Update feedback status
 * PATCH /api/feedback/:id/status
 */
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['open', 'addressed', 'resolved'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Valid statuses: ${validStatuses.join(', ')}`
    });
  }

  const feedbackItem = feedback.get(id);
  if (!feedbackItem) {
    return res.status(404).json({
      success: false,
      error: 'Feedback item not found'
    });
  }

  feedbackItem.status = status;
  feedbackItem.updatedAt = new Date().toISOString();

  feedback.set(id, feedbackItem);

  res.json({
    success: true,
    data: feedbackItem
  });
}));

/**
 * Delete feedback item
 * DELETE /api/feedback/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!feedback.has(id)) {
    return res.status(404).json({
      success: false,
      error: 'Feedback item not found'
    });
  }

  feedback.delete(id);

  res.json({
    success: true,
    data: {
      message: 'Feedback item deleted successfully'
    }
  });
}));

/**
 * Add voice note feedback
 * POST /api/feedback/voice
 */
router.post('/voice', upload.single('audio'), asyncHandler(async (req, res) => {
  const { projectId, sceneNumber, transcription, position, severity = 'medium' } = req.body;

  if (!projectId || !req.file) {
    return res.status(400).json({
      success: false,
      error: 'Project ID and audio file are required'
    });
  }

  const feedbackItem = {
    id: uuidv4(),
    projectId,
    sceneNumber: sceneNumber ? parseInt(sceneNumber) : null,
    type: 'voice',
    content: transcription || 'Voice note (transcription pending)',
    position: position ? JSON.parse(position) : null,
    severity,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    audio: {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      duration: null, // Could be extracted from audio file
      data: req.file.buffer.toString('base64')
    }
  };

  feedback.set(feedbackItem.id, feedbackItem);

  res.status(201).json({
    success: true,
    data: feedbackItem
  });
}));

/**
 * Get feedback statistics for project
 * GET /api/feedback/project/:projectId/stats
 */
router.get('/project/:projectId/stats', asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const projectFeedback = Array.from(feedback.values())
    .filter(item => item.projectId === projectId);

  const stats = {
    total: projectFeedback.length,
    byStatus: {
      open: projectFeedback.filter(item => item.status === 'open').length,
      addressed: projectFeedback.filter(item => item.status === 'addressed').length,
      resolved: projectFeedback.filter(item => item.status === 'resolved').length
    },
    bySeverity: {
      low: projectFeedback.filter(item => item.severity === 'low').length,
      medium: projectFeedback.filter(item => item.severity === 'medium').length,
      high: projectFeedback.filter(item => item.severity === 'high').length
    },
    byType: {
      text: projectFeedback.filter(item => item.type === 'text').length,
      voice: projectFeedback.filter(item => item.type === 'voice').length,
      file: projectFeedback.filter(item => item.type === 'file').length
    },
    byIteration: {}
  };

  // Calculate feedback by iteration
  const iterations = [...new Set(projectFeedback.map(item => item.iteration))];
  iterations.forEach(iteration => {
    stats.byIteration[iteration] = projectFeedback.filter(
      item => item.iteration === iteration
    ).length;
  });

  res.json({
    success: true,
    data: stats
  });
}));

export default router;