import React, { useState } from 'react';
import { Check, Edit2, Image as ImageIcon, Play, RefreshCw } from 'lucide-react';
import EditFrameModal from './EditFrameModal';

interface StoryboardFrame {
  scene_id: number;
  scene_title?: string;
  prompt: string;
  description: string;
  status: 'generated' | 'error' | 'pending' | 'placeholder';
  image?: string;
  duration?: number;
  updatedAt?: string;
  error_type?: string;
  rai_reason?: string;
}

interface StoryboardViewProps {
  frames: StoryboardFrame[];
  storyboardId?: string;
  onUpdateFrame?: (frameId: number, updates: any) => Promise<void>;
  onRegenerateFrame?: (frameId: number) => void;
}

export default function StoryboardView({
  frames,
  storyboardId,
  onUpdateFrame,
  onRegenerateFrame
}: StoryboardViewProps) {
  const [regeneratingFrames, setRegeneratingFrames] = useState<Set<number>>(new Set());
  const [editingFrame, setEditingFrame] = useState<StoryboardFrame | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEditFrame = (frameId: number) => {
    const frame = frames.find(f => f.scene_id === frameId);
    if (frame) {
      setEditingFrame(frame);
      setIsEditModalOpen(true);
    }
  };

  const handleSaveFrame = async (frameId: number, updates: any) => {
    if (onUpdateFrame) {
      await onUpdateFrame(frameId, updates);
    }
    setIsEditModalOpen(false);
    setEditingFrame(null);
  };

  const handleRegenerateFrame = async (frameId: number) => {
    if (onRegenerateFrame) {
      setRegeneratingFrames(prev => new Set(prev).add(frameId));
      try {
        await onRegenerateFrame(frameId);
      } finally {
        setRegeneratingFrames(prev => {
          const newSet = new Set(prev);
          newSet.delete(frameId);
          return newSet;
        });
      }
    }
  };

  const handleGenerateVideo = () => {
    // TODO: Implement video generation
    console.log('Generate video preview');
  };

  return (
    <div className="glass-effect rounded-2xl p-6 mt-6">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <ImageIcon className="w-5 h-5" />
        Generated Storyboard
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        {frames.map((frame) => {
          const isRegenerating = regeneratingFrames.has(frame.scene_id);

          return (
            <div key={frame.scene_id} className="glass-effect rounded-lg p-4 border border-white/10">
              <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg mb-3 flex items-center justify-center relative">
                {frame.image ? (
                  <img
                    src={`data:image/jpeg;base64,${frame.image}`}
                    alt={frame.description}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center p-4">
                    <ImageIcon className="w-12 h-12 text-white/30" />
                    {frame.status === 'pending' && (
                      <div className="text-xs text-white/50">Generating...</div>
                    )}
                    {frame.status === 'error' && (
                      <div className="text-xs text-red-400">
                        <div className="font-medium mb-1">Generation Failed</div>
                        {frame.error_type === 'billing_required' && (
                          <div className="text-yellow-400">Billing required for Imagen API</div>
                        )}
                        {frame.error_type === 'quota_exceeded' && (
                          <div>Quota exceeded - try again later</div>
                        )}
                        {frame.error_type === 'safety_filter' && (
                          <div>Prompt blocked by safety filters</div>
                        )}
                        {frame.error_type === 'permission_denied' && (
                          <div>Permission denied - check API key</div>
                        )}
                        {!frame.error_type && (
                          <div>Failed to generate image</div>
                        )}
                      </div>
                    )}
                    {frame.status === 'placeholder' && (
                      <div className="text-xs text-yellow-400">
                        <div className="font-medium mb-1">Placeholder Image</div>
                        <div>Image generation not available</div>
                      </div>
                    )}
                  </div>
                )}

                {isRegenerating && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="mb-2">
                {frame.scene_title && (
                  <h4 className="text-white font-medium text-sm mb-1">{frame.scene_title}</h4>
                )}
                <p className="text-white/70 text-xs line-clamp-2">{frame.description}</p>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-xs flex items-center gap-1 ${
                  frame.status === 'generated' ? 'text-green-400' :
                  frame.status === 'error' ? 'text-red-400' :
                  'text-yellow-400'
                }`}>
                  <Check className="w-3 h-3" />
                  {frame.status === 'generated' ? 'Generated' :
                   frame.status === 'error' ? 'Failed' : 'Pending'}
                </span>

                <div className="flex items-center gap-2">
                  {frame.status === 'error' && (
                    <button
                      onClick={() => handleRegenerateFrame(frame.scene_id)}
                      disabled={isRegenerating}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  )}

                  <button
                    onClick={() => handleEditFrame(frame.scene_id)}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <button 
        onClick={handleGenerateVideo}
        className="mt-4 w-full py-3 button-primary rounded-lg flex items-center justify-center gap-2"
      >
        <Play className="w-4 h-4" />
        Generate Video Preview
      </button>

      {/* Edit Frame Modal */}
      <EditFrameModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingFrame(null);
        }}
        frame={editingFrame}
        onSave={handleSaveFrame}
      />
    </div>
  );
}