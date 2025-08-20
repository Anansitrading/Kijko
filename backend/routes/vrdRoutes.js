import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler.js';
import { 
  generateStructuredContent, 
  generateVRD,
  generateCreativeBrief
} from '../services/geminiService.js';
import { VRD_GENERATION_PROMPT } from '../config/prompts.js';

const router = express.Router();

// In-memory storage for MVP (use database in production)
const vrdStorage = new Map();

/**
 * Generate Video Requirements Document from user input
 * POST /api/vrd/generate
 */
router.post('/generate', asyncHandler(async (req, res) => {
  const { userInput, projectId, briefData = null } = req.body;

  if (!userInput) {
    return res.status(400).json({
      success: false,
      error: 'User input is required for VRD generation'
    });
  }

  try {
    let brief = briefData;
    
    // Generate creative brief first if not provided
    if (!brief) {
      console.log('🎯 Generating creative brief...');
      brief = await generateCreativeBrief(userInput);
    }

    console.log('📋 Generating VRD from brief...');
    const vrdData = await generateVRD(brief);
    
    // Add metadata and structure
    const vrd = {
      id: projectId || uuidv4(),
      brief,
      ...vrdData,
      feedback: [], // Array to store sticky notes
      iterations: 0, // Track feedback iterations (max 5)
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0',
        status: 'draft'
      }
    };

    // Store VRD
    vrdStorage.set(vrd.id, vrd);

    res.json({
      success: true,
      data: vrd
    });

  } catch (error) {
    console.error('VRD generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate VRD',
      details: error.message
    });
  }
}));

/**
 * Get VRD by ID  
 * GET /api/vrd/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vrd = vrdStorage.get(id);
  if (!vrd) {
    return res.status(404).json({
      success: false,
      error: 'VRD not found'
    });
  }

  res.json({
    success: true,
    data: vrd
  });
}));

/**
 * Update VRD based on feedback
 * PUT /api/vrd/:id
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const existingVrd = vrdStorage.get(id);
  if (!existingVrd) {
    return res.status(404).json({
      success: false,
      error: 'VRD not found'
    });
  }

  // Check iteration limit (max 5 feedback rounds)
  if (existingVrd.iterations >= 5) {
    return res.status(400).json({
      success: false,
      error: 'Maximum feedback iterations reached (5). Please select a winner or extend the contest.'
    });
  }

  try {
    // If this is a significant update, regenerate sections using AI
    let updatedData = { ...existingVrd, ...updates };
    
    if (updates.regenerateFromFeedback && existingVrd.feedback.length > 0) {
      console.log('🔄 Regenerating VRD sections based on feedback...');
      
      const feedbackSummary = existingVrd.feedback.map(f => 
        `Scene ${f.sceneNumber || 'General'}: ${f.content} (${f.severity})`
      ).join('\n');
      
      const improvementPrompt = `Update the following Video Requirements Document based on this feedback:\n\nFeedback:\n${feedbackSummary}\n\nOriginal VRD:\n${JSON.stringify(existingVrd, null, 2)}\n\nProvide an improved version addressing all feedback while maintaining the core vision.`;
      
      const improvedVrd = await generateVRD({
        ...existingVrd.brief,
        feedback: feedbackSummary
      });
      
      updatedData = {
        ...updatedData,
        ...improvedVrd,
        iterations: existingVrd.iterations + 1
      };
    }

    updatedData.metadata = {
      ...updatedData.metadata,
      updatedAt: new Date().toISOString(),
      version: `1.${existingVrd.iterations + 1}`
    };

    vrdStorage.set(id, updatedData);

    res.json({
      success: true,
      data: updatedData
    });
  } catch (error) {
    console.error('VRD update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update VRD',
      details: error.message
    });
  }
}));

/**
 * Add feedback/sticky note to VRD
 * POST /api/vrd/:id/feedback
 */
router.post('/:id/feedback', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    sceneNumber, 
    type, 
    content, 
    position, 
    severity, 
    timeCode,
    frameIndex,
    attachments = [] 
  } = req.body;

  if (!content) {
    return res.status(400).json({
      success: false,
      error: 'Feedback content is required'
    });
  }

  const vrd = vrdStorage.get(id);
  if (!vrd) {
    return res.status(404).json({
      success: false,
      error: 'VRD not found'
    });
  }

  const feedback = {
    id: uuidv4(),
    sceneNumber,
    type: type || 'text', // text, voice, file
    content,
    position, // { x, y } for UI positioning
    timeCode, // for timeline-based feedback
    frameIndex, // for storyboard frame feedback
    severity: severity || 'medium', // low, medium, high, critical
    attachments, // array of file attachments
    createdAt: new Date().toISOString(),
    status: 'open', // open, addressed, resolved
    iteration: vrd.iterations
  };

  // Add feedback to VRD
  vrd.feedback.push(feedback);
  vrd.metadata.updatedAt = new Date().toISOString();
  
  vrdStorage.set(id, vrd);

  res.json({
    success: true,
    data: {
      feedback,
      total_feedback_count: vrd.feedback.length,
      iterations_remaining: Math.max(0, 5 - vrd.iterations)
    }
  });
}));

/**
 * Get VRD feedback
 * GET /api/vrd/:id/feedback
 */
router.get('/:id/feedback', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { iteration, severity, status, sceneNumber } = req.query;

  const vrd = vrdStorage.get(id);
  if (!vrd) {
    return res.status(404).json({
      success: false,
      error: 'VRD not found'
    });
  }

  let feedback = vrd.feedback || [];

  // Apply filters
  if (iteration !== undefined) {
    feedback = feedback.filter(f => f.iteration === parseInt(iteration));
  }
  if (severity) {
    feedback = feedback.filter(f => f.severity === severity);
  }
  if (status) {
    feedback = feedback.filter(f => f.status === status);
  }
  if (sceneNumber !== undefined) {
    feedback = feedback.filter(f => f.sceneNumber === parseInt(sceneNumber));
  }

  res.json({
    success: true,
    data: {
      feedback,
      total_count: vrd.feedback.length,
      filtered_count: feedback.length,
      current_iteration: vrd.iterations,
      iterations_remaining: Math.max(0, 5 - vrd.iterations)
    }
  });
}));

/**
 * Update feedback status
 * PUT /api/vrd/:id/feedback/:feedbackId
 */
router.put('/:id/feedback/:feedbackId', asyncHandler(async (req, res) => {
  const { id, feedbackId } = req.params;
  const { status, response } = req.body;

  const vrd = vrdStorage.get(id);
  if (!vrd) {
    return res.status(404).json({
      success: false,
      error: 'VRD not found'
    });
  }

  const feedbackIndex = vrd.feedback.findIndex(f => f.id === feedbackId);
  if (feedbackIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Feedback not found'
    });
  }

  // Update feedback
  vrd.feedback[feedbackIndex] = {
    ...vrd.feedback[feedbackIndex],
    status: status || vrd.feedback[feedbackIndex].status,
    response,
    updatedAt: new Date().toISOString()
  };

  vrd.metadata.updatedAt = new Date().toISOString();
  vrdStorage.set(id, vrd);

  res.json({
    success: true,
    data: vrd.feedback[feedbackIndex]
  });
}));

/**
 * Export VRD in various formats
 * GET /api/vrd/:id/export
 */
router.get('/:id/export', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { format = 'json' } = req.query; // json, pdf, csv, edl

  const vrd = vrdStorage.get(id);
  if (!vrd) {
    return res.status(404).json({
      success: false,
      error: 'VRD not found'
    });
  }

  try {
    switch (format) {
      case 'json':
        res.setHeader('Content-Disposition', `attachment; filename="vrd-${id}.json"`);
        res.setHeader('Content-Type', 'application/json');
        res.json(vrd);
        break;
        
      case 'csv':
        // Generate CSV for timeline data
        const csvData = generateTimelineCSV(vrd);
        res.setHeader('Content-Disposition', `attachment; filename="vrd-timeline-${id}.csv"`);
        res.setHeader('Content-Type', 'text/csv');
        res.send(csvData);
        break;
        
      case 'edl':
        // Generate EDL (Edit Decision List) for video editors
        const edlData = generateEDL(vrd);
        res.setHeader('Content-Disposition', `attachment; filename="vrd-${id}.edl"`);
        res.setHeader('Content-Type', 'text/plain');
        res.send(edlData);
        break;
        
      default:
        res.status(400).json({
          success: false,
          error: 'Unsupported export format. Supported: json, csv, edl'
        });
    }
  } catch (error) {
    console.error('VRD export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export VRD'
    });
  }
}));

/**
 * Get all VRDs (for debugging/admin)
 * GET /api/vrd
 */
router.get('/', asyncHandler(async (req, res) => {
  const vrds = Array.from(vrdStorage.values()).map(vrd => ({
    id: vrd.id,
    brief: vrd.brief,
    metadata: vrd.metadata,
    feedback_count: vrd.feedback?.length || 0,
    iterations: vrd.iterations
  }));

  res.json({
    success: true,
    data: {
      total_vrds: vrds.length,
      vrds
    }
  });
}));

// Helper functions for export
function generateTimelineCSV(vrd) {
  const headers = ['Timestamp', 'Type', 'Content', 'Layer', 'Duration'];
  const rows = [headers];
  
  if (vrd.timeline) {
    vrd.timeline.forEach(item => {
      rows.push([
        item.timestamp || '',
        item.type || '',
        item.content || '',
        item.layer || '',
        item.duration || ''
      ]);
    });
  }
  
  return rows.map(row => row.join(',')).join('\n');
}

function generateEDL(vrd) {
  let edl = `TITLE: ${vrd.brief?.goal || 'Kijko Video Project'}\n`;
  edl += `FCM: NON-DROP FRAME\n\n`;
  
  if (vrd.scenes) {
    vrd.scenes.forEach((scene, index) => {
      const sceneNumber = String(index + 1).padStart(3, '0');
      edl += `${sceneNumber}  V     C        ${formatTimecode(scene.startTime || 0)} ${formatTimecode((scene.startTime || 0) + (scene.duration || 5))} ${formatTimecode(scene.startTime || 0)} ${formatTimecode((scene.startTime || 0) + (scene.duration || 5))}\n`;
      edl += `* FROM CLIP NAME: ${scene.title || `Scene ${index + 1}`}\n`;
      edl += `* COMMENT: ${scene.description || ''}\n\n`;
    });
  }
  
  return edl;
}

function formatTimecode(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30); // Assuming 30fps
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

export default router;