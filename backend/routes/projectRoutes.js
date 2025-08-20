import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// In-memory storage for MVP (in production, use a database)
const projects = new Map();

/**
 * Create new project
 * POST /api/projects
 */
router.post('/', asyncHandler(async (req, res) => {
  const { name, description, userInput } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Project name is required'
    });
  }

  const project = {
    id: uuidv4(),
    name,
    description: description || '',
    userInput: userInput || '',
    status: 'created',
    vrd: null,
    storyboard: null,
    videos: [],
    feedback: [],
    iterations: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  projects.set(project.id, project);

  res.status(201).json({
    success: true,
    data: project
  });
}));

/**
 * Get project by ID
 * GET /api/projects/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const project = projects.get(id);
  if (!project) {
    return res.status(404).json({
      success: false,
      error: 'Project not found'
    });
  }

  res.json({
    success: true,
    data: project
  });
}));

/**
 * Update project
 * PUT /api/projects/:id
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const project = projects.get(id);
  if (!project) {
    return res.status(404).json({
      success: false,
      error: 'Project not found'
    });
  }

  const updatedProject = {
    ...project,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  projects.set(id, updatedProject);

  res.json({
    success: true,
    data: updatedProject
  });
}));

/**
 * List all projects
 * GET /api/projects
 */
router.get('/', asyncHandler(async (req, res) => {
  const { limit = 10, offset = 0 } = req.query;

  const allProjects = Array.from(projects.values())
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json({
    success: true,
    data: {
      projects: allProjects,
      total: projects.size,
      limit: parseInt(limit),
      offset: parseInt(offset)
    }
  });
}));

/**
 * Delete project
 * DELETE /api/projects/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!projects.has(id)) {
    return res.status(404).json({
      success: false,
      error: 'Project not found'
    });
  }

  projects.delete(id);

  res.json({
    success: true,
    data: {
      message: 'Project deleted successfully'
    }
  });
}));

/**
 * Update project status
 * PATCH /api/projects/:id/status
 */
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['created', 'vrd_generated', 'storyboard_created', 'in_production', 'review', 'completed'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Valid statuses: ${validStatuses.join(', ')}`
    });
  }

  const project = projects.get(id);
  if (!project) {
    return res.status(404).json({
      success: false,
      error: 'Project not found'
    });
  }

  project.status = status;
  project.updatedAt = new Date().toISOString();

  projects.set(id, project);

  res.json({
    success: true,
    data: project
  });
}));

/**
 * Add VRD to project
 * POST /api/projects/:id/vrd
 */
router.post('/:id/vrd', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vrdData = req.body;

  const project = projects.get(id);
  if (!project) {
    return res.status(404).json({
      success: false,
      error: 'Project not found'
    });
  }

  project.vrd = vrdData;
  project.status = 'vrd_generated';
  project.updatedAt = new Date().toISOString();

  projects.set(id, project);

  res.json({
    success: true,
    data: project
  });
}));

/**
 * Add storyboard to project
 * POST /api/projects/:id/storyboard
 */
router.post('/:id/storyboard', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const storyboardData = req.body;

  const project = projects.get(id);
  if (!project) {
    return res.status(404).json({
      success: false,
      error: 'Project not found'
    });
  }

  project.storyboard = storyboardData;
  project.status = 'storyboard_created';
  project.updatedAt = new Date().toISOString();

  projects.set(id, project);

  res.json({
    success: true,
    data: project
  });
}));

/**
 * Add video to project
 * POST /api/projects/:id/videos
 */
router.post('/:id/videos', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const videoData = req.body;

  const project = projects.get(id);
  if (!project) {
    return res.status(404).json({
      success: false,
      error: 'Project not found'
    });
  }

  if (!project.videos) {
    project.videos = [];
  }

  project.videos.push({
    ...videoData,
    addedAt: new Date().toISOString()
  });

  project.status = 'in_production';
  project.updatedAt = new Date().toISOString();

  projects.set(id, project);

  res.json({
    success: true,
    data: project
  });
}));

/**
 * Increment project iteration
 * POST /api/projects/:id/iterate
 */
router.post('/:id/iterate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { feedback } = req.body;

  const project = projects.get(id);
  if (!project) {
    return res.status(404).json({
      success: false,
      error: 'Project not found'
    });
  }

  if (project.iterations >= 5) {
    return res.status(400).json({
      success: false,
      error: 'Maximum iterations (5) reached'
    });
  }

  project.iterations += 1;
  project.status = 'review';
  project.updatedAt = new Date().toISOString();

  if (feedback) {
    if (!project.feedback) {
      project.feedback = [];
    }
    project.feedback.push({
      iteration: project.iterations,
      feedback,
      timestamp: new Date().toISOString()
    });
  }

  projects.set(id, project);

  res.json({
    success: true,
    data: {
      project,
      remainingIterations: 5 - project.iterations
    }
  });
}));

export default router;