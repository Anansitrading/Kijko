import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

let geminiClient = null;
let vertexAIClient = null;

// Initialize Gemini clients for different services
const initializeGemini = () => {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY not found in environment variables');
    return null;
  }

  try {
    // Standard Gemini client for text generation
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // For now, we'll use REST API calls for Imagen and Veo since they might need Vertex AI
    console.log('✅ Gemini client initialized successfully');
    return geminiClient;
  } catch (error) {
    console.error('❌ Failed to initialize Gemini client:', error.message);
    return null;
  }
};

// Initialize on module load
geminiClient = initializeGemini();

/**
 * Generate content using Gemini 2.0 Flash (latest model)
 */
export const generateContent = async (prompt, config = {}) => {
  if (!geminiClient) {
    throw new Error('Gemini client not initialized');
  }

  try {
    // Use Gemini 2.0 Flash for enhanced performance
    const model = geminiClient.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192, // Increased for longer responses
        topP: 0.8,
        topK: 40,
        ...config
      },
      systemInstruction: config.systemInstruction || "You are Kijko, an AI video production assistant. You help users create professional videos through conversational interfaces, providing creative guidance and technical expertise."
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini generate_content error:', error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
};

/**
 * Generate content with streaming support using Gemini 2.0 Flash
 */
export const generateContentStream = async function* (prompt, config = {}) {
  if (!geminiClient) {
    throw new Error('Gemini client not initialized');
  }

  try {
    const model = geminiClient.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.8,
        topK: 40,
        ...config
      },
      systemInstruction: config.systemInstruction || "You are Kijko, an AI video production assistant. You help users create professional videos through conversational interfaces, providing creative guidance and technical expertise."
    });

    const result = await model.generateContentStream(prompt);
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        yield chunkText;
      }
    }
  } catch (error) {
    console.error('Gemini generate_content_stream error:', error);
    throw new Error(`Gemini streaming error: ${error.message}`);
  }
};

/**
 * Generate images using Gemini Imagen 3.0
 * Uses Google AI Studio API for image generation
 */
export const generateImage = async (prompt, config = {}) => {
  console.log('🎨 Image generation requested:', prompt);
  
  try {
    // Use Google AI Studio API for Imagen 3.0
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        number_of_images: config.number_of_images || 1,
        aspect_ratio: config.aspect_ratio || '16:9',
        safety_filter_level: config.safety_filter_level || 'block_some',
        include_rai_reason: true,
        output_mime_type: config.output_mime_type || 'image/jpeg'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.warn('⚠️ Imagen API returned error, using placeholder:', errorData.error?.message);
      
      // Return a high-quality placeholder if API fails
      return {
        image: 'data:image/svg+xml;base64,' + Buffer.from(`
          <svg width="1024" height="576" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#667eea" />
                <stop offset="100%" stop-color="#764ba2" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grad1)"/>
            <text x="50%" y="45%" fill="white" text-anchor="middle" dy="0.3em" font-family="Arial, sans-serif" font-size="24" font-weight="bold">
              Storyboard Frame
            </text>
            <text x="50%" y="55%" fill="rgba(255,255,255,0.8)" text-anchor="middle" dy="0.3em" font-family="Arial, sans-serif" font-size="16">
              ${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}
            </text>
            <circle cx="50" cy="50" r="20" fill="rgba(255,255,255,0.1)"/>
            <circle cx="974" cy="50" r="20" fill="rgba(255,255,255,0.1)"/>
            <circle cx="50" cy="526" r="20" fill="rgba(255,255,255,0.1)"/>
            <circle cx="974" cy="526" r="20" fill="rgba(255,255,255,0.1)"/>
          </svg>
        `).toString('base64'),
        prompt: prompt,
        status: 'placeholder',
        reason: errorData.error?.message || 'API unavailable'
      };
    }

    const data = await response.json();
    
    if (data.generated_images && data.generated_images.length > 0) {
      return {
        image: `data:${config.output_mime_type || 'image/jpeg'};base64,${data.generated_images[0].image}`,
        prompt: prompt,
        status: 'generated',
        rai_reason: data.generated_images[0].rai_reason
      };
    }
    
    throw new Error('No images generated');
    
  } catch (error) {
    console.error('❌ Imagen generation error:', error.message);
    
    // Return enhanced placeholder on error
    return {
      image: 'data:image/svg+xml;base64,' + Buffer.from(`
        <svg width="1024" height="576" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#667eea" />
              <stop offset="100%" stop-color="#764ba2" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad1)"/>
          <text x="50%" y="40%" fill="white" text-anchor="middle" dy="0.3em" font-family="Arial, sans-serif" font-size="28" font-weight="bold">
            🎬 Storyboard Frame
          </text>
          <text x="50%" y="55%" fill="rgba(255,255,255,0.9)" text-anchor="middle" dy="0.3em" font-family="Arial, sans-serif" font-size="16">
            ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}
          </text>
          <text x="50%" y="70%" fill="rgba(255,255,255,0.6)" text-anchor="middle" dy="0.3em" font-family="Arial, sans-serif" font-size="12">
            Preview Mode - Powered by Kijko AI
          </text>
        </svg>
      `).toString('base64'),
      prompt: prompt,
      status: 'placeholder',
      reason: error.message
    };
  }
};

/**
 * Generate videos using Gemini Veo 2.0
 * Uses Google AI Studio API for video generation
 */
export const generateVideo = async (prompt, config = {}) => {
  console.log('🎬 Video generation requested:', prompt);
  
  try {
    // Use Google AI Studio API for Veo 2.0
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:generateVideos?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        config: {
          number_of_videos: config.number_of_videos || 1,
          aspect_ratio: config.aspect_ratio || '16:9',
          duration_seconds: config.duration_seconds || 5,
          safety_filter_level: config.safety_filter_level || 'block_some',
          include_rai_reason: true
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.warn('⚠️ Veo API returned error, using placeholder:', errorData.error?.message);
      
      // Return placeholder video info
      return {
        video: {
          url: generatePlaceholderVideo(prompt, config),
          duration: config.duration_seconds || 5,
          status: 'placeholder',
          thumbnail: generateVideoThumbnail(prompt)
        },
        prompt: prompt,
        config: config,
        reason: errorData.error?.message || 'API unavailable'
      };
    }

    const data = await response.json();
    
    // Note: Video generation is typically async, so we might get an operation ID
    if (data.operation) {
      return {
        operation_id: data.operation.name,
        video: {
          url: null, // Will be available after processing
          duration: config.duration_seconds || 5,
          status: 'processing'
        },
        prompt: prompt,
        config: config
      };
    }
    
    if (data.generated_videos && data.generated_videos.length > 0) {
      return {
        video: {
          url: data.generated_videos[0].video.uri,
          duration: config.duration_seconds || 5,
          status: 'generated'
        },
        prompt: prompt,
        config: config,
        rai_reason: data.generated_videos[0].rai_reason
      };
    }
    
    throw new Error('No videos generated');
    
  } catch (error) {
    console.error('❌ Veo generation error:', error.message);
    
    // Return enhanced placeholder on error
    return {
      video: {
        url: generatePlaceholderVideo(prompt, config),
        duration: config.duration_seconds || 5,
        status: 'placeholder',
        thumbnail: generateVideoThumbnail(prompt)
      },
      prompt: prompt,
      config: config,
      reason: error.message
    };
  }
};

/**
 * Generate placeholder video data URL
 */
const generatePlaceholderVideo = (prompt, config) => {
  // For MVP, we create an animated SVG that serves as a video placeholder
  const svg = `
    <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#667eea" />
          <stop offset="100%" stop-color="#764ba2" />
        </linearGradient>
        <animate id="colorAnim" attributeName="stop-color" values="#667eea;#764ba2;#667eea" dur="3s" repeatCount="indefinite"/>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
      <circle cx="640" cy="360" r="100" fill="rgba(255,255,255,0.1)">
        <animate attributeName="r" values="80;120;80" dur="2s" repeatCount="indefinite"/>
      </circle>
      <text x="50%" y="40%" fill="white" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold">
        🎬 Video Preview
      </text>
      <text x="50%" y="65%" fill="rgba(255,255,255,0.9)" text-anchor="middle" font-family="Arial, sans-serif" font-size="18">
        ${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}
      </text>
      <text x="50%" y="75%" fill="rgba(255,255,255,0.7)" text-anchor="middle" font-family="Arial, sans-serif" font-size="14">
        Duration: ${config.duration_seconds || 5}s - Powered by Kijko AI
      </text>
    </svg>
  `;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
};

/**
 * Generate video thumbnail
 */
const generateVideoThumbnail = (prompt) => {
  const svg = `
    <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="thumbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#667eea" />
          <stop offset="100%" stop-color="#764ba2" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#thumbGrad)"/>
      <polygon points="120,65 120,115 160,90" fill="white" opacity="0.8"/>
      <text x="50%" y="70%" fill="white" text-anchor="middle" font-family="Arial, sans-serif" font-size="12">
        ${prompt.substring(0, 30)}...
      </text>
    </svg>
  `;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
};

/**
 * Generate structured JSON response using Gemini 2.0 Flash
 * Enhanced with better JSON extraction and validation
 */
export const generateStructuredContent = async (prompt, schema, config = {}) => {
  if (!geminiClient) {
    throw new Error('Gemini client not initialized');
  }

  try {
    const model = geminiClient.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1, // Lower temperature for more consistent JSON
        maxOutputTokens: 8192,
        topP: 0.8,
        ...config
      }
    });

    const enhancedPrompt = `${prompt}

IMPORTANT: You must respond with ONLY valid JSON that matches this schema structure. Do not include any markdown formatting, explanations, or additional text. Start your response with { and end with }.

Schema example: ${JSON.stringify(schema, null, 2)}

Response:`;
    
    const result = await model.generateContent(enhancedPrompt);
    const response = await result.response;
    let text = response.text().trim();
    
    // Clean up common formatting issues
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/^```|```$/g, '');
    
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      try {
        const parsed = JSON.parse(jsonStr);
        return parsed;
      } catch (parseError) {
        console.warn('JSON parse error, attempting cleanup:', parseError.message);
        // Try to fix common JSON issues
        const cleaned = jsonStr
          .replace(/,\s*}/g, '}') // Remove trailing commas
          .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
          .replace(/\n/g, ' ') // Remove newlines
          .replace(/\s+/g, ' '); // Normalize spaces
        return JSON.parse(cleaned);
      }
    }
    
    // If no JSON found, try parsing the entire response
    try {
      return JSON.parse(text);
    } catch (finalError) {
      console.error('Failed to parse JSON response:', text);
      throw new Error(`Invalid JSON response: ${finalError.message}`);
    }
  } catch (error) {
    console.error('Gemini structured content error:', error);
    throw new Error(`Gemini structured API error: ${error.message}`);
  }
};

/**
 * Create a chat session for multi-turn conversations using Gemini 2.0 Flash
 * Enhanced with better context management and streaming support
 */
export const createChatSession = async (systemInstruction = '', history = []) => {
  if (!geminiClient) {
    throw new Error('Gemini client not initialized');
  }

  try {
    const defaultSystemInstruction = systemInstruction || `You are Kijko, an AI Video Production Agent. You help users create professional videos through conversational interfaces.
    
    Your capabilities include:
    - Creative discovery and brief generation
    - Storyboard creation and visualization
    - Video Requirements Document (VRD) generation
    - Interactive feedback and refinement
    - Multi-modal content analysis
    - Professional video production guidance
    
    Always be helpful, creative, and focused on delivering high-quality video production results.`;

    const model = geminiClient.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.8,
        topK: 40,
      },
      systemInstruction: defaultSystemInstruction
    });

    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })),
    });

    return {
      send_message: async (message) => {
        try {
          const result = await chat.sendMessage(message);
          const response = await result.response;
          return {
            text: response.text(),
            usage: {
              prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
              completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
              total_tokens: response.usageMetadata?.totalTokenCount || 0
            }
          };
        } catch (error) {
          console.error('Chat message error:', error);
          throw new Error(`Failed to send message: ${error.message}`);
        }
      },
      send_message_stream: async function* (message) {
        try {
          const result = await chat.sendMessageStream(message);
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              yield {
                text: chunkText,
                done: false
              };
            }
          }
          
          // Final response with usage data
          const finalResponse = await result.response;
          yield {
            text: '',
            done: true,
            usage: {
              prompt_tokens: finalResponse.usageMetadata?.promptTokenCount || 0,
              completion_tokens: finalResponse.usageMetadata?.candidatesTokenCount || 0,
              total_tokens: finalResponse.usageMetadata?.totalTokenCount || 0
            }
          };
        } catch (error) {
          console.error('Chat stream error:', error);
          throw new Error(`Failed to stream message: ${error.message}`);
        }
      },
      get_history: () => chat.getHistory(),
      get_system_instruction: () => defaultSystemInstruction
    };
  } catch (error) {
    console.error('Gemini chat session error:', error);
    throw new Error(`Chat session error: ${error.message}`);
  }
};

/**
 * Analyze uploaded content (images, documents, video) using Gemini 2.0 Flash
 * Enhanced multi-modal analysis capabilities
 */
export const analyzeContent = async (content, analysisPrompt, contentType = 'text') => {
  if (!geminiClient) {
    throw new Error('Gemini client not initialized');
  }

  try {
    // Use Gemini 2.0 Flash which has enhanced multi-modal capabilities
    const model = geminiClient.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        topP: 0.8,
      }
    });

    let parts = [];
    
    // Handle different content types
    if (contentType === 'image') {
      // Content should be base64 encoded image data
      parts = [
        { text: analysisPrompt },
        {
          inlineData: {
            mimeType: content.mimeType || 'image/jpeg',
            data: content.data
          }
        }
      ];
    } else if (contentType === 'video') {
      // For video analysis
      parts = [
        { text: analysisPrompt },
        {
          inlineData: {
            mimeType: content.mimeType || 'video/mp4',
            data: content.data
          }
        }
      ];
    } else {
      // Text content analysis
      parts = [
        { text: `${analysisPrompt}\n\nContent to analyze:\n${content}` }
      ];
    }
    
    const result = await model.generateContent(parts);
    const response = await result.response;
    return {
      analysis: response.text(),
      content_type: contentType,
      usage: {
        prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
        completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: response.usageMetadata?.totalTokenCount || 0
      }
    };
  } catch (error) {
    console.error('Gemini content analysis error:', error);
    throw new Error(`Content analysis error: ${error.message}`);
  }
};

/**
 * Check operation status for async operations (like video generation)
 */
export const checkOperationStatus = async (operationId) => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/operations/${operationId}?key=${process.env.GEMINI_API_KEY}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to check operation status');
    }
    
    const data = await response.json();
    return {
      done: data.done || false,
      result: data.response || null,
      error: data.error || null,
      metadata: data.metadata || null
    };
  } catch (error) {
    console.error('Operation status check error:', error);
    throw new Error(`Operation status error: ${error.message}`);
  }
};

/**
 * Generate Video Requirements Document using structured content generation
 */
export const generateVRD = async (briefData) => {
  const vrdSchema = {
    logline: "string",
    objectives: ["string"],
    audience: {
      primary: "string",
      demographics: "string",
      psychographics: "string"
    },
    key_messages: ["string"],
    visual_style: {
      tone: "string",
      color_palette: ["string"],
      visual_references: ["string"]
    },
    scenes: [{
      id: "number",
      title: "string",
      description: "string",
      duration: "number",
      visual_elements: ["string"],
      audio_elements: ["string"],
      transitions: "string"
    }],
    asset_list: {
      logos: ["string"],
      images: ["string"],
      videos: ["string"],
      audio: ["string"],
      fonts: ["string"]
    },
    delivery_specs: {
      duration: "number",
      aspect_ratios: ["string"],
      resolutions: ["string"],
      formats: ["string"],
      platforms: ["string"]
    },
    timeline: [{
      timestamp: "number",
      type: "string",
      content: "string",
      layer: "string"
    }]
  };

  const prompt = `Create a comprehensive Video Requirements Document (VRD) based on the following creative brief:

${JSON.stringify(briefData, null, 2)}

Generate a detailed VRD that includes all necessary elements for professional video production. Make sure to break down the content into specific scenes with detailed descriptions, visual elements, and timing information.`;

  return await generateStructuredContent(prompt, vrdSchema);
};

/**
 * Generate creative brief from user input
 */
export const generateCreativeBrief = async (userInput, context = {}) => {
  const briefSchema = {
    goal: "string",
    audience: "string",
    tone: "string",
    key_messages: ["string"],
    deliverables: {
      format: "string",
      duration: "number",
      aspect_ratio: "string",
      platforms: ["string"]
    },
    style_preferences: {
      visual_style: "string",
      color_scheme: "string",
      music_style: "string"
    },
    constraints: {
      budget_tier: "string",
      timeline: "string",
      special_requirements: ["string"]
    }
  };

  const prompt = `Analyze the following user input and create a professional creative brief for video production:

User Input: "${userInput}"

Additional Context: ${JSON.stringify(context, null, 2)}

Create a comprehensive creative brief that captures the user's vision and provides clear direction for video production. Be specific about goals, audience, tone, and deliverables.`;

  return await generateStructuredContent(prompt, briefSchema);
};

/**
 * Generate storyboard frames based on VRD scenes
 */
export const generateStoryboardFrames = async (scenes) => {
  const frames = [];
  
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const imagePrompt = `Create a cinematic storyboard frame for: ${scene.description}. Visual style: ${scene.visual_elements?.join(', ') || 'professional, cinematic'}. This is scene ${i + 1} of ${scenes.length}.`;
    
    try {
      const imageResult = await generateImage(imagePrompt, {
        aspect_ratio: '16:9',
        output_mime_type: 'image/jpeg'
      });
      
      frames.push({
        scene_id: scene.id || i + 1,
        scene_title: scene.title,
        image: imageResult.image,
        prompt: imagePrompt,
        status: imageResult.status,
        duration: scene.duration,
        description: scene.description
      });
    } catch (error) {
      console.error(`Error generating frame for scene ${i + 1}:`, error);
      frames.push({
        scene_id: scene.id || i + 1,
        scene_title: scene.title,
        image: null,
        prompt: imagePrompt,
        status: 'error',
        error: error.message,
        duration: scene.duration,
        description: scene.description
      });
    }
  }
  
  return frames;
};

/**
 * Generate video previews for storyboard frames
 */
export const generateVideoPreview = async (frame, config = {}) => {
  const videoPrompt = `Create a ${config.duration_seconds || 3}-second video preview of: ${frame.description}. Style: cinematic, professional video production. Movement: subtle camera motion and scene dynamics.`;
  
  return await generateVideo(videoPrompt, {
    duration_seconds: config.duration_seconds || 3,
    aspect_ratio: config.aspect_ratio || '16:9',
    number_of_videos: 1
  });
};

export { geminiClient };