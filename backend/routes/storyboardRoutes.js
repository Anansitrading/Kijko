import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler.js';
import { 
  generateStructuredContent, 
  generateImage,
  generateStoryboardFrames
} from '../services/geminiService.js';
import { 
  STORYBOARD_PROMPT, 
  IMAGE_PROMPT_TEMPLATE 
} from '../config/prompts.js';

const router = express.Router();

// In-memory storage for MVP (use database in production)
const storyboardStorage = new Map();

/**
 * Create storyboard from VRD scenes
 * POST /api/storyboard/create
 */
router.post('/create', asyncHandler(async (req, res) => {
  const { vrdId, scenes, projectId, visualStyle = 'professional cinematic' } = req.body;

  if (!scenes || !Array.isArray(scenes)) {
    return res.status(400).json({
      success: false,
      error: 'Scenes array is required for storyboard creation'
    });
  }

  try {
    console.log('🎨 Creating storyboard with image generation...');
    
    // Generate storyboard frames using enhanced Gemini service
    const generatedFrames = await generateStoryboardFrames(scenes);

    // Create storyboard with metadata
    const storyboard = {
      id: uuidv4(),
      projectId: projectId || uuidv4(),
      vrdId,
      frames: generatedFrames,
      visualStyle,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'generated',
        total_frames: generatedFrames.length,
        successful_frames: generatedFrames.filter(f => f.status === 'generated').length,
        failed_frames: generatedFrames.filter(f => f.status === 'error').length
      }
    };

    // Store storyboard
    storyboardStorage.set(storyboard.id, storyboard);

    res.json({
      success: true,
      data: storyboard
    });

  } catch (error) {
    console.error('Storyboard creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create storyboard',
      details: error.message
    });
  }
}));

/**
 * Get storyboard by ID
 * GET /api/storyboard/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const storyboard = storyboardStorage.get(id);
  if (!storyboard) {
    return res.status(404).json({
      success: false,
      error: 'Storyboard not found'
    });
  }

  res.json({
    success: true,
    data: storyboard
  });
}));

/**
 * Generate images for specific storyboard frames
 * POST /api/storyboard/:id/generate-images
 */
router.post('/:id/generate-images', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { frameIds = [], visualStyle, aspectRatio = '16:9' } = req.body;

  const storyboard = storyboardStorage.get(id);
  if (!storyboard) {
    return res.status(404).json({
      success: false,
      error: 'Storyboard not found'
    });
  }

  try {
    const framesToUpdate = frameIds.length > 0 
      ? storyboard.frames.filter(f => frameIds.includes(f.scene_id))
      : storyboard.frames;

    console.log(`🎨 Regenerating ${framesToUpdate.length} storyboard frames...`);

    const updatedFrames = [];

    for (const frame of framesToUpdate) {
      const imagePrompt = `${frame.description}. Visual style: ${visualStyle || storyboard.visualStyle || 'professional cinematic'}. Cinematic composition, high quality.`;

      try {
        const generatedImage = await generateImage(imagePrompt, {
          aspect_ratio: aspectRatio,
          output_mime_type: 'image/jpeg',
          number_of_images: 1
        });

        updatedFrames.push({
          ...frame,
          image: generatedImage.image,
          prompt: imagePrompt,
          status: generatedImage.status,
          updatedAt: new Date().toISOString()
        });

      } catch (imageError) {
        console.error(`Image regeneration failed for frame ${frame.scene_id}:`, imageError);
        
        updatedFrames.push({
          ...frame,
          status: 'error',
          error: imageError.message,
          updatedAt: new Date().toISOString()
        });
      }
    }

    // Update storyboard frames
    storyboard.frames = storyboard.frames.map(existingFrame => {
      const updatedFrame = updatedFrames.find(f => f.scene_id === existingFrame.scene_id);
      return updatedFrame || existingFrame;
    });

    storyboard.metadata.updatedAt = new Date().toISOString();
    storyboard.metadata.successful_frames = storyboard.frames.filter(f => f.status === 'generated').length;
    storyboard.metadata.failed_frames = storyboard.frames.filter(f => f.status === 'error').length;

    storyboardStorage.set(id, storyboard);

    res.json({
      success: true,
      data: {
        storyboard_id: id,
        updated_frames: updatedFrames,
        total_frames: storyboard.frames.length,
        successful_frames: storyboard.metadata.successful_frames,
        failed_frames: storyboard.metadata.failed_frames
      }
    });

  } catch (error) {
    console.error('Storyboard image generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate storyboard images',
      details: error.message
    });
  }
}));

/**
 * Update storyboard frame
 * PUT /api/storyboard/:id/frame/:frameId
 */
router.put('/:id/frame/:frameId', asyncHandler(async (req, res) => {
  const { id, frameId } = req.params;
  const { description, prompt, regenerateImage = false } = req.body;

  const storyboard = storyboardStorage.get(id);
  if (!storyboard) {
    return res.status(404).json({
      success: false,
      error: 'Storyboard not found'
    });
  }

  const frameIndex = storyboard.frames.findIndex(f => f.scene_id === parseInt(frameId));
  if (frameIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Frame not found'
    });
  }

  try {
    let updatedFrame = {
      ...storyboard.frames[frameIndex],
      description: description || storyboard.frames[frameIndex].description,
      prompt: prompt || storyboard.frames[frameIndex].prompt,
      updatedAt: new Date().toISOString()
    };

    // Regenerate image if requested
    if (regenerateImage) {
      console.log(`🔄 Regenerating image for frame ${frameId}...`);
      
      const imagePrompt = `${updatedFrame.description}. Visual style: ${storyboard.visualStyle || 'professional cinematic'}. Cinematic composition, high quality.`;
      
      const generatedImage = await generateImage(imagePrompt, {
        aspect_ratio: '16:9',
        output_mime_type: 'image/jpeg'
      });

      updatedFrame = {
        ...updatedFrame,
        image: generatedImage.image,
        prompt: imagePrompt,
        status: generatedImage.status
      };
    }

    storyboard.frames[frameIndex] = updatedFrame;
    storyboard.metadata.updatedAt = new Date().toISOString();
    
    storyboardStorage.set(id, storyboard);

    res.json({
      success: true,
      data: updatedFrame
    });

  } catch (error) {
    console.error('Frame update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update frame',
      details: error.message
    });
  }
}));

/**
 * Replace storyboard frame image with new prompt
 * POST /api/storyboard/:id/frame/:frameId/replace
 */
router.post('/:id/frame/:frameId/replace', asyncHandler(async (req, res) => {
  const { id, frameId } = req.params;
  const { newPrompt, visualStyle, aspectRatio = '16:9' } = req.body;

  if (!newPrompt) {
    return res.status(400).json({
      success: false,
      error: 'New prompt is required for image replacement'
    });
  }

  const storyboard = storyboardStorage.get(id);
  if (!storyboard) {
    return res.status(404).json({
      success: false,
      error: 'Storyboard not found'
    });
  }

  const frameIndex = storyboard.frames.findIndex(f => f.scene_id === parseInt(frameId));
  if (frameIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Frame not found'
    });
  }

  try {
    console.log(`🔄 Replacing image for frame ${frameId}...`);
    
    const imagePrompt = `${newPrompt}. Visual style: ${visualStyle || storyboard.visualStyle || 'professional cinematic'}. Cinematic composition, high quality.`;

    const generatedImage = await generateImage(imagePrompt, {
      aspect_ratio: aspectRatio,
      output_mime_type: 'image/jpeg'
    });

    const updatedFrame = {
      ...storyboard.frames[frameIndex],
      image: generatedImage.image,
      prompt: imagePrompt,
      description: newPrompt,
      status: generatedImage.status,
      replacedAt: new Date().toISOString()
    };

    storyboard.frames[frameIndex] = updatedFrame;
    storyboard.metadata.updatedAt = new Date().toISOString();
    
    storyboardStorage.set(id, storyboard);

    res.json({
      success: true,
      data: updatedFrame
    });

  } catch (error) {
    console.error('Image replacement error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to replace image',
      details: error.message
    });
  }
}));

/**
 * Delete storyboard frame
 * DELETE /api/storyboard/:id/frame/:frameId
 */
router.delete('/:id/frame/:frameId', asyncHandler(async (req, res) => {
  const { id, frameId } = req.params;

  const storyboard = storyboardStorage.get(id);
  if (!storyboard) {
    return res.status(404).json({
      success: false,
      error: 'Storyboard not found'
    });
  }

  const frameIndex = storyboard.frames.findIndex(f => f.scene_id === parseInt(frameId));
  if (frameIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Frame not found'
    });
  }

  // Remove frame
  storyboard.frames.splice(frameIndex, 1);
  storyboard.metadata.updatedAt = new Date().toISOString();
  storyboard.metadata.total_frames = storyboard.frames.length;
  
  storyboardStorage.set(id, storyboard);

  res.json({
    success: true,
    data: {
      message: `Frame ${frameId} removed from storyboard ${id}`,
      removedAt: new Date().toISOString(),
      remaining_frames: storyboard.frames.length
    }
  });
}));

/**
 * Export storyboard
 * GET /api/storyboard/:id/export
 */
router.get('/:id/export', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { format = 'json' } = req.query; // json, pdf, images

  const storyboard = storyboardStorage.get(id);
  if (!storyboard) {
    return res.status(404).json({
      success: false,
      error: 'Storyboard not found'
    });
  }

  try {
    switch (format) {
      case 'json':
        res.setHeader('Content-Disposition', `attachment; filename="storyboard-${id}.json"`);
        res.setHeader('Content-Type', 'application/json');
        res.json(storyboard);
        break;
        
      case 'images':
        // Return array of image URLs/data
        const images = storyboard.frames.map(frame => ({
          scene_id: frame.scene_id,
          title: frame.scene_title,
          image: frame.image,
          description: frame.description
        }));
        
        res.json({
          success: true,
          data: {
            storyboard_id: id,
            total_frames: images.length,
            images
          }
        });
        break;
        
      default:
        res.status(400).json({
          success: false,
          error: 'Unsupported export format. Supported: json, images'
        });
    }
  } catch (error) {
    console.error('Storyboard export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export storyboard'
    });
  }
}));

/**
 * Get all storyboards (for debugging/admin)
 * GET /api/storyboard
 */
router.get('/', asyncHandler(async (req, res) => {
  const storyboards = Array.from(storyboardStorage.values()).map(sb => ({
    id: sb.id,
    projectId: sb.projectId,
    vrdId: sb.vrdId,
    visualStyle: sb.visualStyle,
    metadata: sb.metadata,
    frame_count: sb.frames?.length || 0
  }));

  res.json({
    success: true,
    data: {
      total_storyboards: storyboards.length,
      storyboards
    }
  });
}));

export default router;