import { fal } from '@fal-ai/client';
import dotenv from 'dotenv';

dotenv.config();

// Configure fal.ai client
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY
  });
  console.log('✅ fal.ai client initialized successfully');
} else {
  console.warn('⚠️  FAL_KEY not found in environment variables');
}

/**
 * Available fal.ai models with their characteristics
 */
export const FAL_MODELS = {
  // Fast and cheap options
  'flux-schnell': {
    id: 'fal-ai/flux/schnell',
    name: 'Flux Schnell',
    description: 'Fast and cost-effective, priced per megapixel',
    speed: 'fast',
    quality: 'good',
    cost: 'low',
    avgTime: '2-4s'
  },
  'lightning': {
    id: 'fal-ai/lightning-models',
    name: 'Lightning Models',
    description: 'Ultra-fast generation for rapid prototyping',
    speed: 'ultra-fast',
    quality: 'basic',
    cost: 'very-low',
    avgTime: '2-3s'
  },
  
  // Balanced options
  'flux-dev': {
    id: 'fal-ai/flux/dev',
    name: 'Flux Dev',
    description: 'General-purpose, photorealistic & illustrative',
    speed: 'medium',
    quality: 'high',
    cost: 'medium',
    avgTime: '6-8s'
  },
  'recraft-v3': {
    id: 'fal-ai/recraft/v3',
    name: 'Recraft V3',
    description: 'Vector-style, great for brand graphics and UI',
    speed: 'medium',
    quality: 'high',
    cost: 'medium',
    avgTime: '8-10s'
  },
  
  // High quality options
  'stable-diffusion-v35': {
    id: 'fal-ai/stable-diffusion-v35-large',
    name: 'Stable Diffusion 3.5 Large',
    description: 'Better typography & long prompts',
    speed: 'slow',
    quality: 'very-high',
    cost: 'high',
    avgTime: '10-12s'
  },
  'imagen3': {
    id: 'fal-ai/imagen3',
    name: 'Imagen 3',
    description: 'Google Imagen 3 via fal.ai - highest photorealism',
    speed: 'slow',
    quality: 'premium',
    cost: 'high',
    avgTime: '12-14s'
  },
  'imagen3-fast': {
    id: 'fal-ai/imagen3/fast',
    name: 'Imagen 3 Fast',
    description: 'Faster Imagen 3 with slight quality trade-off',
    speed: 'medium',
    quality: 'high',
    cost: 'medium',
    avgTime: '6-8s'
  }
};

/**
 * Generate images using fal.ai
 * @param {string} prompt - Text prompt for image generation
 * @param {Object} config - Generation configuration
 * @returns {Promise<Object>} Generated image result
 */
export const generateImageWithFal = async (prompt, config = {}) => {
  console.log('🎨 fal.ai image generation requested:', prompt);
  console.log('🔧 Config:', config);

  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY not found in environment variables');
  }

  try {
    // Select model based on config or default to flux-dev
    const modelKey = config.model || 'flux-dev';
    const model = FAL_MODELS[modelKey];
    
    if (!model) {
      throw new Error(`Unknown model: ${modelKey}`);
    }

    console.log(`🚀 Using model: ${model.name} (${model.id})`);

    // Prepare generation parameters
    const input = {
      prompt: prompt,
      num_images: config.numberOfImages || config.num_images || 1,
      image_size: config.imageSize || config.image_size || 'square_hd', // square_hd, landscape_4_3, portrait_4_3, etc.
      enable_safety_checker: config.enableSafetyChecker !== false,
    };

    // Add model-specific parameters
    if (model.id.includes('flux')) {
      // Flux Schnell doesn't use guidance_scale and has fewer steps
      if (model.id.includes('schnell')) {
        input.num_inference_steps = config.numInferenceSteps || 4; // Schnell uses fewer steps
        // Don't add guidance_scale for schnell
      } else {
        input.guidance_scale = config.guidanceScale || 3.5;
        input.num_inference_steps = config.numInferenceSteps || 28;
      }
      if (config.seed) input.seed = parseInt(config.seed);
    }

    if (model.id.includes('recraft')) {
      input.style = config.style || 'realistic_image';
    }

    if (model.id.includes('stable-diffusion')) {
      input.guidance_scale = config.guidanceScale || 7.5;
      input.num_inference_steps = config.numInferenceSteps || 50;
      if (config.seed) input.seed = parseInt(config.seed);
    }

    console.log('📤 fal.ai request:', JSON.stringify({ model: model.id, input }, null, 2));

    // Generate image using fal.ai
    const result = await fal.subscribe(model.id, {
      input: input,
      logs: true // Enable progress logging
    });

    console.log('📥 fal.ai response structure:', Object.keys(result));
    console.log('📥 fal.ai full response:', JSON.stringify(result, null, 2));

    // Handle different response structures from fal.ai
    let images = result.images || result.data?.images || [];

    if (images && images.length > 0) {
      const imageUrl = images[0].url;
      
      // Download the image to convert to base64 for consistency with existing code
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');

      console.log('✅ Image generated successfully with fal.ai');
      return {
        image: base64Image, // Return base64 for consistency
        imageUrl: imageUrl, // Also provide the CDN URL
        prompt: prompt,
        status: 'generated',
        model: model.name,
        modelId: model.id,
        rai_reason: 'Image generated successfully with fal.ai',
        mime_type: 'image/png',
        generation_time: result.timings?.inference || 'unknown'
      };
    }
    
    throw new Error('No images generated by fal.ai');
    
  } catch (error) {
    console.error('❌ fal.ai generation error:', error.message);
    
    // Determine error type for better user feedback
    let errorType = 'api_error';
    let userMessage = 'Image generation failed';
    
    if (error.message.includes('quota') || error.message.includes('limit')) {
      errorType = 'quota_exceeded';
      userMessage = 'fal.ai quota exceeded. Please try again later.';
    } else if (error.message.includes('safety') || error.message.includes('content')) {
      errorType = 'safety_filter';
      userMessage = 'Image prompt was blocked by safety filters. Please try a different prompt.';
    } else if (error.message.includes('authentication') || error.message.includes('key')) {
      errorType = 'permission_denied';
      userMessage = 'Authentication failed. Please check your fal.ai API key.';
    } else if (error.message.includes('FAL_KEY')) {
      errorType = 'missing_key';
      userMessage = 'fal.ai API key not configured. Please add FAL_KEY to environment variables.';
    }
    
    return {
      image: null,
      prompt: prompt,
      status: 'error',
      error_type: errorType,
      rai_reason: userMessage,
      mime_type: 'image/png',
      technical_details: error.message
    };
  }
};

/**
 * Get available models for UI selection
 */
export const getAvailableModels = () => {
  return Object.entries(FAL_MODELS).map(([key, model]) => ({
    key,
    ...model
  }));
};

/**
 * Get recommended model based on use case
 */
export const getRecommendedModel = (useCase = 'balanced') => {
  const recommendations = {
    'fast': 'flux-schnell',
    'cheap': 'lightning',
    'balanced': 'flux-dev',
    'quality': 'stable-diffusion-v35',
    'premium': 'imagen3',
    'vector': 'recraft-v3'
  };
  
  return recommendations[useCase] || 'flux-dev';
};
