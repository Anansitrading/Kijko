import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Settings, Image as ImageIcon, Wand2 } from 'lucide-react';

interface EditFrameModalProps {
  isOpen: boolean;
  onClose: () => void;
  frame: {
    scene_id: number;
    scene_title?: string;
    description: string;
    prompt: string;
    image?: string;
    status: string;
  } | null;
  onSave: (frameId: number, updates: FrameUpdateData) => Promise<void>;
}

interface FrameUpdateData {
  description?: string;
  prompt?: string;
  regenerateImage?: boolean;
  imageConfig?: {
    model?: string;
    aspectRatio?: string;
    seed?: number;
    numberOfImages?: number;
    safetyFilterLevel?: string;
    personGeneration?: string;
    addWatermark?: boolean;
    enhancePrompt?: boolean;
    visualStyle?: string;
  };
}

const ASPECT_RATIOS = [
  { value: '1:1', label: 'Square (1:1)' },
  { value: '3:4', label: 'Portrait (3:4)' },
  { value: '4:3', label: 'Landscape (4:3)' },
  { value: '9:16', label: 'Vertical (9:16)' },
  { value: '16:9', label: 'Widescreen (16:9)' }
];

const SAFETY_LEVELS = [
  { value: 'block_most', label: 'Highest Safety' },
  { value: 'block_medium_and_above', label: 'Medium Safety' },
  { value: 'block_some', label: 'Reduced Filtering' },
  { value: 'block_only_high', label: 'Minimal Filtering' }
];

const PERSON_GENERATION = [
  { value: 'dont_allow', label: 'Block People' },
  { value: 'allow_adult', label: 'Adults Only' },
  { value: 'allow_all', label: 'Adults & Children' }
];

const VISUAL_STYLES = [
  'Professional Cinematic',
  'Artistic Illustration',
  'Photorealistic',
  'Animated/Cartoon',
  'Vintage Film',
  'Modern Digital Art',
  'Documentary Style',
  'Fantasy/Sci-Fi',
  'Minimalist',
  'High Contrast'
];

export default function EditFrameModal({ isOpen, onClose, frame, onSave }: EditFrameModalProps) {
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Advanced settings
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [seed, setSeed] = useState<number | ''>('');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [safetyFilterLevel, setSafetyFilterLevel] = useState('block_medium_and_above');
  const [personGeneration, setPersonGeneration] = useState('allow_adult');
  const [addWatermark, setAddWatermark] = useState(true);
  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [visualStyle, setVisualStyle] = useState('Professional Cinematic');

  useEffect(() => {
    if (frame) {
      setDescription(frame.description || '');
      setPrompt(frame.prompt || '');
    }
  }, [frame]);

  const handleSave = async () => {
    if (!frame) return;
    
    setIsSaving(true);
    try {
      const updates: FrameUpdateData = {
        description,
        prompt,
        regenerateImage: true,
        imageConfig: {
          aspectRatio,
          seed: seed === '' ? undefined : Number(seed),
          numberOfImages,
          safetyFilterLevel,
          personGeneration,
          addWatermark,
          enhancePrompt,
          visualStyle
        }
      };
      
      await onSave(frame.scene_id, updates);
      onClose();
    } catch (error) {
      console.error('Error saving frame:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const generateRandomSeed = () => {
    setSeed(Math.floor(Math.random() * 2147483647) + 1);
  };

  if (!isOpen || !frame) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900/95 backdrop-blur-lg border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-purple-400" />
            <h2 className="text-white font-semibold">Edit Frame</h2>
            {frame.scene_title && (
              <span className="text-white/60 text-sm">- {frame.scene_title}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Image */}
          {frame.image && (
            <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg overflow-hidden">
              <img 
                src={`data:image/jpeg;base64,${frame.image}`}
                alt={frame.description}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Scene Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:border-purple-400/50 focus:outline-none resize-none"
              rows={3}
              placeholder="Describe what should happen in this scene..."
            />
          </div>

          {/* Image Prompt */}
          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Image Generation Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:border-purple-400/50 focus:outline-none resize-none"
              rows={3}
              placeholder="Detailed prompt for image generation..."
            />
          </div>

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Advanced Settings
            <span className="text-xs">({showAdvanced ? 'Hide' : 'Show'})</span>
          </button>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-white/5 rounded-lg border border-white/10">
              {/* Visual Style */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Visual Style
                </label>
                <select
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-400/50 focus:outline-none"
                >
                  {VISUAL_STYLES.map(style => (
                    <option key={style} value={style} className="bg-slate-800">
                      {style}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-400/50 focus:outline-none"
                >
                  {ASPECT_RATIOS.map(ratio => (
                    <option key={ratio.value} value={ratio.value} className="bg-slate-800">
                      {ratio.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seed */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Seed (for reproducible results)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value === '' ? '' : Number(e.target.value))}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:border-purple-400/50 focus:outline-none"
                    placeholder="Random (leave empty)"
                    min="1"
                    max="2147483647"
                  />
                  <button
                    onClick={generateRandomSeed}
                    className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded-lg text-purple-300 transition-colors"
                  >
                    <Wand2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-white/50 mt-1">
                  Same seed + same prompt = same image. Requires watermark disabled.
                </p>
              </div>

              {/* Safety & Content Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Safety Filter
                  </label>
                  <select
                    value={safetyFilterLevel}
                    onChange={(e) => setSafetyFilterLevel(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-400/50 focus:outline-none"
                  >
                    {SAFETY_LEVELS.map(level => (
                      <option key={level.value} value={level.value} className="bg-slate-800">
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Person Generation
                  </label>
                  <select
                    value={personGeneration}
                    onChange={(e) => setPersonGeneration(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-400/50 focus:outline-none"
                  >
                    {PERSON_GENERATION.map(option => (
                      <option key={option.value} value={option.value} className="bg-slate-800">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-white/80 text-sm">
                  <input
                    type="checkbox"
                    checked={!addWatermark}
                    onChange={(e) => setAddWatermark(!e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-400/50"
                  />
                  Disable watermark (required for seed functionality)
                </label>

                <label className="flex items-center gap-2 text-white/80 text-sm">
                  <input
                    type="checkbox"
                    checked={enhancePrompt}
                    onChange={(e) => setEnhancePrompt(e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-400/50"
                  />
                  AI prompt enhancement
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white/70 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
            {isSaving ? 'Generating...' : 'Save & Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}
