import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler.js';
import { 
  generateVideo, 
  generateVideoPreview,
  checkOperationStatus
} from '../services/geminiService.js';
import { VIDEO_PROMPT_TEMPLATE } from '../config/prompts.js';

const router = express.Router();

// In-memory storage for MVP (use database in production)
const videoStorage = new Map();
const operationStorage = new Map();

/**
 * Generate video preview clips from storyboard frames
 * POST /api/video/generate-preview
 */
router.post('/generate-preview', asyncHandler(async (req, res) => {
  const { frames, projectId, duration = 3 } = req.body;

  if (!frames || !Array.isArray(frames)) {
    return res.status(400).json({
      success: false,
      error: 'Frames array is required for video preview generation'
    });
  }

  try {
    console.log(`🎬 Generating ${frames.length} video previews...`);
    
    const generatedPreviews = [];

    // Generate preview videos for each frame
    for (const frame of frames) {
      try {
        const previewResult = await generateVideoPreview(frame, {
          duration_seconds: duration,
          aspect_ratio: '16:9'
        });

        generatedPreviews.push({
          scene_id: frame.scene_id,
          frame_id: frame.id || frame.scene_id,
          video: previewResult.video,
          prompt: previewResult.prompt,
          duration: duration,
          status: previewResult.video.status,
          operation_id: previewResult.operation_id,
          generatedAt: new Date().toISOString()
        });

      } catch (videoError) {
        console.error(`Video preview generation failed for frame ${frame.scene_id}:`, videoError);
        
        generatedPreviews.push({
          scene_id: frame.scene_id,
          frame_id: frame.id || frame.scene_id,
          video: null,
          prompt: frame.description,
          duration: duration,
          status: 'error',
          error: videoError.message,
          generatedAt: new Date().toISOString()
        });
      }
    }

    const videoProject = {
      id: uuidv4(),
      projectId: projectId || uuidv4(),
      type: 'preview',
      previews: generatedPreviews,
      metadata: {
        createdAt: new Date().toISOString(),
        totalPreviews: generatedPreviews.length,
        successfulPreviews: generatedPreviews.filter(p => p.status === 'generated' || p.status === 'processing').length,
        failedPreviews: generatedPreviews.filter(p => p.status === 'error').length,
        totalDuration: generatedPreviews.length * duration
      }
    };

    videoStorage.set(videoProject.id, videoProject);

    res.json({
      success: true,
      data: videoProject
    });

  } catch (error) {
    console.error('Video preview generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate video previews',
      details: error.message
    });
  }
}));

/**
 * Generate final high-quality video clips
 * POST /api/video/generate-final
 */
router.post('/generate-final', asyncHandler(async (req, res) => {
  const { frames, projectId, duration = 5, quality = 'high' } = req.body;

  if (!frames || !Array.isArray(frames)) {
    return res.status(400).json({
      success: false,
      error: 'Frames array is required for final video generation'
    });
  }

  try {
    console.log(`🎬 Generating ${frames.length} final video clips...`);
    
    const generatedClips = [];

    // Generate final quality videos for each frame
    for (const frame of frames) {
      const videoPrompt = `${frame.description}. Create a professional, cinematic ${duration}-second video clip. High quality, smooth motion, ${frame.visual_style || 'professional cinematography'}.`;

      try {
        const config = {
          duration_seconds: duration,
          aspect_ratio: '16:9',
          number_of_videos: 1,
          safety_filter_level: 'block_some'
        };

        const generatedVideo = await generateVideo(videoPrompt, config);

        generatedClips.push({
          scene_id: frame.scene_id,
          frame_id: frame.id || frame.scene_id,
          video: generatedVideo.video,
          prompt: videoPrompt,
          duration: duration,
          quality: quality,
          status: generatedVideo.video.status,
          operation_id: generatedVideo.operation_id,
          generatedAt: new Date().toISOString()
        });

      } catch (videoError) {
        console.error(`Final video generation failed for frame ${frame.scene_id}:`, videoError);
        
        generatedClips.push({
          scene_id: frame.scene_id,
          frame_id: frame.id || frame.scene_id,
          video: null,
          prompt: videoPrompt,
          duration: duration,
          quality: quality,
          status: 'error',
          error: videoError.message,
          generatedAt: new Date().toISOString()
        });
      }
    }

    const videoProject = {
      id: uuidv4(),
      projectId: projectId || uuidv4(),
      type: 'final',
      clips: generatedClips,
      metadata: {
        createdAt: new Date().toISOString(),
        quality: quality,
        totalClips: generatedClips.length,
        successfulClips: generatedClips.filter(c => c.status === 'generated' || c.status === 'processing').length,
        failedClips: generatedClips.filter(c => c.status === 'error').length,
        totalDuration: generatedClips.length * duration
      }
    };

    videoStorage.set(videoProject.id, videoProject);

    res.json({
      success: true,
      data: videoProject
    });

  } catch (error) {
    console.error('Final video generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate final video clips',
      details: error.message
    });
  }
}));

/**
 * Check video generation operation status
 * GET /api/video/status/:operationId
 */
router.get('/status/:operationId', asyncHandler(async (req, res) => {
  const { operationId } = req.params;

  try {
    console.log(`📊 Checking status for operation: ${operationId}`);
    
    const status = await checkOperationStatus(operationId);
    
    // Store operation status for caching
    operationStorage.set(operationId, {
      ...status,
      lastChecked: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        operation_id: operationId,
        done: status.done,
        result: status.result,
        error: status.error,
        metadata: status.metadata,
        last_checked: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Operation status check error:', error);
    
    // Return cached status if available
    const cachedStatus = operationStorage.get(operationId);
    if (cachedStatus) {
      res.json({
        success: true,
        data: {
          operation_id: operationId,
          ...cachedStatus,
          cached: true
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to check operation status',
        details: error.message
      });
    }
  }
}));

/**
 * Get video project by ID
 * GET /api/video/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const videoProject = videoStorage.get(id);
  if (!videoProject) {
    return res.status(404).json({
      success: false,
      error: 'Video project not found'
    });
  }

  res.json({
    success: true,
    data: videoProject
  });
}));

/**
 * Assemble final video from clips
 * POST /api/video/assemble
 */
router.post('/assemble', asyncHandler(async (req, res) => {
  const { 
    clips, 
    projectId, 
    audioTrack, 
    transitions = [], 
    title,
    outputFormat = 'mp4' 
  } = req.body;

  if (!clips || !Array.isArray(clips)) {
    return res.status(400).json({
      success: false,
      error: 'Video clips array is required for assembly'
    });
  }

  try {
    // In a real implementation, this would use video editing APIs/tools
    // to concatenate clips, add audio, transitions, etc.
    console.log(`🎞️ Assembling final video from ${clips.length} clips...`);

    const assembledVideo = {
      id: uuidv4(),
      projectId: projectId || uuidv4(),
      title: title || 'Kijko Generated Video',
      clips: clips.map((clip, index) => ({
        ...clip,
        order: index,
        startTime: clips.slice(0, index).reduce((sum, c) => sum + (c.duration || 0), 0),
        endTime: clips.slice(0, index + 1).reduce((sum, c) => sum + (c.duration || 0), 0)
      })),
      audioTrack: audioTrack || null,
      transitions,
      outputFormat,
      totalDuration: clips.reduce((sum, clip) => sum + (clip.duration || 0), 0),
      status: 'assembled',
      assembledAt: new Date().toISOString(),
      // Simulated final video data (in production, this would be the actual video file)
      finalVideo: {
        url: `/api/video/download/${projectId || uuidv4()}`,
        format: outputFormat,
        size: `${(clips.length * 2.5).toFixed(1)}MB`, // Estimated size
        duration: clips.reduce((sum, clip) => sum + (clip.duration || 0), 0),
        resolution: '1920x1080',
        fps: 30
      }
    };

    videoStorage.set(assembledVideo.id, assembledVideo);

    res.json({
      success: true,
      data: assembledVideo
    });

  } catch (error) {
    console.error('Video assembly error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assemble final video',
      details: error.message
    });
  }
}));

/**
 * Regenerate specific video clip
 * POST /api/video/regenerate
 */
router.post('/regenerate', asyncHandler(async (req, res) => {
  const { 
    sceneId, 
    frameId, 
    prompt, 
    duration = 5, 
    projectId,
    aspectRatio = '16:9',
    quality = 'high' 
  } = req.body;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'Prompt is required for video regeneration'
    });
  }

  try {
    console.log(`🔄 Regenerating video for scene ${sceneId}...`);
    
    const videoPrompt = `${prompt}. Create a professional, cinematic ${duration}-second video clip. High quality, smooth motion, professional cinematography.`;

    const generatedVideo = await generateVideo(videoPrompt, {
      duration_seconds: duration,
      aspect_ratio: aspectRatio,
      number_of_videos: 1,
      safety_filter_level: 'block_some'
    });

    const regeneratedClip = {
      scene_id: sceneId,
      frame_id: frameId,
      video: generatedVideo.video,
      prompt: videoPrompt,
      duration: duration,
      quality: quality,
      status: generatedVideo.video.status,
      operation_id: generatedVideo.operation_id,
      regeneratedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: regeneratedClip
    });

  } catch (error) {
    console.error('Video regeneration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate video clip',
      details: error.message
    });
  }
}));

/**
 * Download generated video (placeholder)
 * GET /api/video/download/:videoId
 */
router.get('/download/:videoId', asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  // In a real implementation, this would serve the actual video file
  // For MVP, we'll return information about the video
  const videoProject = Array.from(videoStorage.values())
    .find(vp => vp.projectId === videoId || vp.id === videoId);

  if (!videoProject) {
    return res.status(404).json({
      success: false,
      error: 'Video not found',
      videoId
    });
  }

  res.json({
    success: true,
    message: 'Video download would be implemented here',
    data: {
      videoId,
      project: videoProject,
      download_info: 'In production, this would serve the actual video file with proper Content-Type and streaming support'
    }
  });
}));

/**
 * Get all video projects (for debugging/admin)
 * GET /api/video
 */
router.get('/', asyncHandler(async (req, res) => {
  const projects = Array.from(videoStorage.values()).map(vp => ({
    id: vp.id,
    projectId: vp.projectId,
    type: vp.type,
    metadata: vp.metadata,
    clip_count: vp.clips?.length || vp.previews?.length || 0
  }));

  res.json({
    success: true,
    data: {
      total_projects: projects.length,
      projects
    }
  });
}));

/**
 * Batch check operation statuses
 * POST /api/video/batch-status
 */
router.post('/batch-status', asyncHandler(async (req, res) => {
  const { operationIds } = req.body;

  if (!operationIds || !Array.isArray(operationIds)) {
    return res.status(400).json({
      success: false,
      error: 'Operation IDs array is required'
    });
  }

  try {
    const statuses = [];

    for (const operationId of operationIds) {
      try {
        const status = await checkOperationStatus(operationId);
        statuses.push({
          operation_id: operationId,
          ...status,
          last_checked: new Date().toISOString()
        });
      } catch (error) {
        statuses.push({
          operation_id: operationId,
          error: error.message,
          last_checked: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      data: {
        total_operations: operationIds.length,
        statuses
      }
    });

  } catch (error) {
    console.error('Batch status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check batch operation statuses',
      details: error.message
    });
  }
}));

export default router;