import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Backend URL - update this to match your deployed backend
const BACKEND_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

// Import types from shared
interface Project {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  vrd?: any;
  storyboard?: any;
  videos?: any[];
  feedback?: any[];
  iterations: number;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  attachments?: any[];
  streaming?: boolean;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface KijkoState {
  currentProject: Project | null;
  messages: ChatMessage[];
  isProcessing: boolean;
  storyboardFrames: any[];
  showSettings: boolean;
  showExploreWall: boolean;
  sessionId: string;
  wsConnection: WebSocket | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  apiKey: string | null;
  streamingMessage: string;
}

type KijkoAction = 
  | { type: 'SET_CURRENT_PROJECT'; payload: Project }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_STREAMING_MESSAGE'; payload: string }
  | { type: 'COMPLETE_STREAMING_MESSAGE'; payload: { usage?: any } }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_STORYBOARD_FRAMES'; payload: any[] }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'TOGGLE_EXPLORE_WALL' }
  | { type: 'SET_WS_CONNECTION'; payload: WebSocket | null }
  | { type: 'SET_CONNECTION_STATUS'; payload: 'connecting' | 'connected' | 'disconnected' | 'error' }
  | { type: 'SET_API_KEY'; payload: string }
  | { type: 'CLEAR_MESSAGES' };

const initialState: KijkoState = {
  currentProject: null,
  messages: [],
  isProcessing: false,
  storyboardFrames: [],
  showSettings: false,
  showExploreWall: false,
  sessionId: uuidv4(),
  wsConnection: null,
  connectionStatus: 'disconnected',
  apiKey: null,
  streamingMessage: '',
};

function kijkoReducer(state: KijkoState, action: KijkoAction): KijkoState {
  switch (action.type) {
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProject: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_STREAMING_MESSAGE':
      return { ...state, streamingMessage: action.payload };
    case 'COMPLETE_STREAMING_MESSAGE':
      if (state.streamingMessage) {
        const newMessage: ChatMessage = {
          id: uuidv4(),
          type: 'agent',
          content: state.streamingMessage,
          timestamp: new Date(),
          usage: action.payload.usage
        };
        return { 
          ...state, 
          messages: [...state.messages, newMessage],
          streamingMessage: '',
          isProcessing: false
        };
      }
      return { ...state, isProcessing: false };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };
    case 'SET_STORYBOARD_FRAMES':
      return { ...state, storyboardFrames: action.payload };
    case 'TOGGLE_SETTINGS':
      return { ...state, showSettings: !state.showSettings };
    case 'TOGGLE_EXPLORE_WALL':
      return { ...state, showExploreWall: !state.showExploreWall };
    case 'SET_WS_CONNECTION':
      return { ...state, wsConnection: action.payload };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    case 'SET_API_KEY':
      return { ...state, apiKey: action.payload };
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [initialState.messages[0]] };
    default:
      return state;
  }
}

interface KijkoContextType {
  state: KijkoState;
  dispatch: React.Dispatch<KijkoAction>;
  sendMessage: (content: string, streaming?: boolean) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<void>;
  generateVRD: (userInput: string) => Promise<any>;
  generateStoryboard: (scenes: any[]) => Promise<any>;
  generateVideo: (frames: any[]) => Promise<any>;
  updateStoryboardFrame: (frameId: number, updates: any) => Promise<void>;
  regenerateFrameImage: (frameId: number) => Promise<void>;
  setApiKey: (apiKey: string) => void;
  connectWebSocket: () => void;
}

const KijkoContext = createContext<KijkoContextType | undefined>(undefined);

export function KijkoProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(kijkoReducer, initialState);

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('kijko_gemini_api_key');
    if (savedApiKey) {
      dispatch({ type: 'SET_API_KEY', payload: savedApiKey });
    }
  }, []);

  const connectWebSocket = async () => {
    if (state.wsConnection?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connecting' });
    
    try {
      // First check if backend is available
      const healthCheck = await fetch(`${BACKEND_URL}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!healthCheck.ok) {
        throw new Error('Backend not available');
      }
      
      const ws = new WebSocket(`${WS_URL}?sessionId=${state.sessionId}`);
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        dispatch({ type: 'SET_WS_CONNECTION', payload: ws });
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' });
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 WebSocket message:', message);
          
          if (message.type === 'welcome') {
            console.log('🎉 Welcome message:', message.message);
          } else if (message.type === 'response') {
            const agentMessage: ChatMessage = {
              id: uuidv4(),
              type: 'agent',
              content: message.content.content,
              timestamp: new Date()
            };
            dispatch({ type: 'ADD_MESSAGE', payload: agentMessage });
            dispatch({ type: 'SET_PROCESSING', payload: false });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        dispatch({ type: 'SET_WS_CONNECTION', payload: null });
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'error' });
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'error' });
    }
  };

  const setApiKey = (apiKey: string) => {
    dispatch({ type: 'SET_API_KEY', payload: apiKey });
    localStorage.setItem('kijko_gemini_api_key', apiKey);
    
    // Try to reconnect WebSocket with API key
    connectWebSocket();
  };

  const sendMessage = async (content: string, streaming: boolean = true) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      type: 'user',
      content,
      timestamp: new Date()
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
    dispatch({ type: 'SET_PROCESSING', payload: true });

    // API key is optional - backend has its own key configured
    // Frontend API key is only used as an override if provided

    try {
      if (streaming && state.wsConnection?.readyState === WebSocket.OPEN) {
        // Use WebSocket for real-time interaction
        state.wsConnection.send(JSON.stringify({
          type: 'realtime_input',
          input: content
        }));
      } else {
        // Use HTTP API
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        // Only add Authorization header if user provided an API key override
        if (state.apiKey) {
          headers['Authorization'] = `Bearer ${state.apiKey}`;
        }

        const response = await fetch(`${BACKEND_URL}/api/chat/message`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: content,
            sessionId: state.sessionId,
            streaming: false
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          const agentMessage: ChatMessage = {
            id: uuidv4(),
            type: 'agent',
            content: data.data.text,
            timestamp: new Date(),
            usage: data.data.usage
          };
          dispatch({ type: 'ADD_MESSAGE', payload: agentMessage });

          // Auto-generation removed - user should explicitly request storyboard generation
        } else {
          throw new Error(data.error || 'Failed to send message');
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        type: 'agent',
        content: `❌ Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your API key and try again.`,
        timestamp: new Date()
      };
      dispatch({ type: 'ADD_MESSAGE', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  };

  const createProject = async (name: string, description?: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({ name, description }),
      });

      const data = await response.json();
      if (data.success) {
        dispatch({ type: 'SET_CURRENT_PROJECT', payload: data.data });
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  };

  const generateCreativeBrief = async (userInput: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/brief`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({ userInput }),
      });

      const data = await response.json();
      if (data.success) {
        return data.data.brief;
      } else {
        throw new Error(data.error || 'Failed to generate creative brief');
      }
    } catch (error) {
      console.error('Error generating creative brief:', error);
      throw error;
    }
  };

  const generateVRD = async (briefData: any) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/vrd/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({ 
          userInput: JSON.stringify(briefData),
          briefData,
          projectId: state.currentProject?.id
        }),
      });

      const data = await response.json();
      if (data.success) {
        if (state.currentProject) {
          const updatedProject = {
            ...state.currentProject,
            vrd: data.data,
            status: 'vrd_generated'
          };
          dispatch({ type: 'SET_CURRENT_PROJECT', payload: updatedProject });
        }
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to generate VRD');
      }
    } catch (error) {
      console.error('Error generating VRD:', error);
      throw error;
    }
  };

  const generateStoryboard = async (scenes: any[]) => {
    try {
      dispatch({ type: 'SET_PROCESSING', payload: true });
      
      const response = await fetch(`${BACKEND_URL}/api/storyboard/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({ 
          scenes,
          projectId: state.currentProject?.id,
          vrdId: state.currentProject?.vrd?.id
        }),
      });

      const data = await response.json();
      if (data.success) {
        dispatch({ type: 'SET_STORYBOARD_FRAMES', payload: data.data.frames });
        
        if (state.currentProject) {
          const updatedProject = {
            ...state.currentProject,
            storyboard: data.data,
            status: 'storyboard_created'
          };
          dispatch({ type: 'SET_CURRENT_PROJECT', payload: updatedProject });
        }
        
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to generate storyboard');
      }
    } catch (error) {
      console.error('Error generating storyboard:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  };

  const generateVideo = async (frames: any[]) => {
    try {
      dispatch({ type: 'SET_PROCESSING', payload: true });
      
      const response = await fetch(`${BACKEND_URL}/api/video/generate-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({ 
          frames,
          projectId: state.currentProject?.id
        }),
      });

      const data = await response.json();
      if (data.success) {
        if (state.currentProject) {
          const updatedProject = {
            ...state.currentProject,
            videos: data.data.previews || data.data.clips,
            status: 'in_production'
          };
          dispatch({ type: 'SET_CURRENT_PROJECT', payload: updatedProject });
        }
        
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to generate video');
      }
    } catch (error) {
      console.error('Error generating video:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  };

  const updateStoryboardFrame = async (frameId: number, updates: any) => {
    try {
      if (!state.currentProject?.storyboard?.id) {
        throw new Error('No storyboard found');
      }

      const response = await fetch(`${BACKEND_URL}/api/storyboard/${state.currentProject.storyboard.id}/frame/${frameId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (data.success) {
        // Update the frame in the current storyboard frames
        const updatedFrames = state.storyboardFrames.map(frame =>
          frame.scene_id === frameId ? { ...frame, ...data.data } : frame
        );
        dispatch({ type: 'SET_STORYBOARD_FRAMES', payload: updatedFrames });

        // Update the project storyboard
        if (state.currentProject) {
          const updatedProject = {
            ...state.currentProject,
            storyboard: {
              ...state.currentProject.storyboard,
              frames: updatedFrames
            }
          };
          dispatch({ type: 'SET_CURRENT_PROJECT', payload: updatedProject });
        }
      } else {
        throw new Error(data.error || 'Failed to update frame');
      }
    } catch (error) {
      console.error('Error updating frame:', error);
      throw error;
    }
  };

  const regenerateFrameImage = async (frameId: number) => {
    try {
      if (!state.currentProject?.storyboard?.id) {
        throw new Error('No storyboard found');
      }

      const response = await fetch(`${BACKEND_URL}/api/storyboard/${state.currentProject.storyboard.id}/generate-images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({
          frameIds: [frameId],
          aspectRatio: '16:9'
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Update the frames with the regenerated image
        const updatedFrames = state.storyboardFrames.map(frame => {
          const updatedFrame = data.data.updated_frames?.find((f: any) => f.scene_id === frame.scene_id);
          return updatedFrame ? { ...frame, ...updatedFrame } : frame;
        });
        dispatch({ type: 'SET_STORYBOARD_FRAMES', payload: updatedFrames });
      } else {
        throw new Error(data.error || 'Failed to regenerate image');
      }
    } catch (error) {
      console.error('Error regenerating image:', error);
      throw error;
    }
  };

  const contextValue: KijkoContextType = {
    state,
    dispatch,
    sendMessage,
    createProject,
    generateVRD,
    generateStoryboard,
    generateVideo,
    updateStoryboardFrame,
    regenerateFrameImage,
    setApiKey,
    connectWebSocket,
  };

  return (
    <KijkoContext.Provider value={contextValue}>
      {children}
    </KijkoContext.Provider>
  );
}

export function useKijko() {
  const context = useContext(KijkoContext);
  if (context === undefined) {
    throw new Error('useKijko must be used within a KijkoProvider');
  }
  return context;
}