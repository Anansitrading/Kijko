/**
 * Shared TypeScript types for Kijko MVP
 */

// Base types
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Project related types
export interface Project extends BaseEntity {
  name: string;
  description?: string;
  userInput?: string;
  status: ProjectStatus;
  vrd?: VRD;
  storyboard?: Storyboard;
  videos: VideoClip[];
  feedback: FeedbackItem[];
  iterations: number;
}

export type ProjectStatus = 
  | 'created' 
  | 'vrd_generated' 
  | 'storyboard_created' 
  | 'in_production' 
  | 'review' 
  | 'completed';

// Video Requirements Document (VRD) types
export interface VRD extends BaseEntity {
  projectId: string;
  projectOverview: ProjectOverview;
  technicalSpecs: TechnicalSpecs;
  contentStructure: ContentStructure;
  assetRequirements: AssetRequirements;
  deliveryRequirements: DeliveryRequirements;
  metadata: VRDMetadata;
}

export interface ProjectOverview {
  goal: string;
  audience: string;
  keyMessages: string[];
  tone: string;
  style: string;
}

export interface TechnicalSpecs {
  duration: number; // in seconds
  aspectRatio: string; // e.g., "16:9", "9:16", "1:1"
  resolution: string; // e.g., "1920x1080", "1080x1920"
  platforms: string[]; // e.g., ["YouTube", "Instagram", "TikTok"]
}

export interface ContentStructure {
  scenes: Scene[];
}

export interface Scene {
  sceneNumber: number;
  title: string;
  description: string;
  visualDescription: string;
  duration: number; // in seconds
  audioNotes?: string;
  textOverlay?: string;
  cameraAngle?: string;
  mood?: string;
  keyElements?: string[];
  motionDescription?: string;
}

export interface AssetRequirements {
  images: string[];
  videos: string[];
  audio: string[];
  graphics: string[];
}

export interface DeliveryRequirements {
  formats: string[];
  compression: string;
  timeline: string;
}

export interface VRDMetadata {
  version: string;
  status: 'draft' | 'approved' | 'in_production';
}

// Storyboard types
export interface Storyboard extends BaseEntity {
  projectId: string;
  scenes: StoryboardScene[];
  metadata: StoryboardMetadata;
}

export interface StoryboardScene extends Scene {
  visualPrompt: string;
  imageData?: string; // Base64 or URL
  imageStatus: 'pending' | 'generated' | 'failed' | 'replaced';
  generatedAt?: string;
}

export interface StoryboardMetadata {
  status: 'draft' | 'generated' | 'approved';
}

// Video types
export interface VideoClip extends BaseEntity {
  projectId: string;
  sceneNumber: number;
  videoData?: string; // URL or blob reference
  prompt: string;
  duration: number;
  quality: 'preview' | 'final';
  status: 'pending' | 'generated' | 'failed' | 'replaced';
  generatedAt?: string;
}

export interface AssembledVideo extends BaseEntity {
  projectId: string;
  clips: VideoClip[];
  audioTrack?: string;
  transitions: Transition[];
  totalDuration: number;
  finalVideoUrl?: string;
  status: 'assembled' | 'processing' | 'completed' | 'failed';
}

export interface Transition {
  type: 'cut' | 'fade' | 'dissolve' | 'wipe';
  duration: number;
  fromScene: number;
  toScene: number;
}

// Feedback types
export interface FeedbackItem extends BaseEntity {
  projectId: string;
  sceneNumber?: number;
  type: FeedbackType;
  content: string;
  position?: Position;
  severity: FeedbackSeverity;
  iteration: number;
  status: FeedbackStatus;
  attachment?: Attachment;
  audio?: AudioAttachment;
}

export type FeedbackType = 'text' | 'voice' | 'file';
export type FeedbackSeverity = 'low' | 'medium' | 'high';
export type FeedbackStatus = 'open' | 'addressed' | 'resolved';

export interface Position {
  x: number;
  y: number;
  anchor?: 'frame' | 'timeline';
}

export interface Attachment {
  filename: string;
  mimetype: string;
  size: number;
  data: string; // Base64 encoded
}

export interface AudioAttachment extends Attachment {
  duration?: number;
  transcription?: string;
}

// Chat types
export interface ChatMessage extends BaseEntity {
  sessionId: string;
  type: MessageType;
  content: string;
  sender: MessageSender;
  attachments?: Attachment[];
}

export type MessageType = 'text' | 'voice' | 'file' | 'system';
export type MessageSender = 'user' | 'agent' | 'system';

export interface ChatSession extends BaseEntity {
  sessionId: string;
  messages: ChatMessage[];
  systemPrompt: string;
  status: 'active' | 'paused' | 'ended';
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T> {
  data: {
    items: T[];
    total: number;
    limit: number;
    offset: number;
  };
}

// WebSocket message types
export interface WebSocketMessage {
  type: WSMessageType;
  payload?: any;
  timestamp: number;
  sessionId?: string;
}

export type WSMessageType = 
  | 'welcome'
  | 'chat'
  | 'ping'
  | 'pong'
  | 'error'
  | 'status_update'
  | 'generation_progress';

// Generation progress types
export interface GenerationProgress {
  operationId: string;
  type: 'vrd' | 'storyboard' | 'image' | 'video';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // seconds
  result?: any;
  error?: string;
}

// Configuration types
export interface KijkoConfig {
  maxIterations: number;
  maxProjectDuration: number; // seconds
  supportedAspectRatios: string[];
  supportedFormats: string[];
  geminiModels: {
    text: string;
    image: string;
    video: string;
  };
}

// Timeline types for advanced view
export interface Timeline {
  projectId: string;
  tracks: TimelineTrack[];
  totalDuration: number;
}

export interface TimelineTrack {
  id: string;
  type: TrackType;
  name: string;
  items: TimelineItem[];
  muted?: boolean;
  visible?: boolean;
}

export type TrackType = 'video' | 'audio' | 'text' | 'graphics';

export interface TimelineItem {
  id: string;
  trackId: string;
  startTime: number; // seconds
  endTime: number; // seconds
  content: string | VideoClip | AudioClip | TextOverlay;
  locked?: boolean;
}

export interface AudioClip {
  id: string;
  url: string;
  duration: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface TextOverlay {
  id: string;
  text: string;
  style: TextStyle;
  position: Position;
  animation?: Animation;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface Animation {
  type: 'fadeIn' | 'fadeOut' | 'slideIn' | 'slideOut' | 'typewriter';
  duration: number;
  delay?: number;
}