import React from 'react';
import { Check, Edit2, Image as ImageIcon, Play } from 'lucide-react';

interface StoryboardFrame {
  id: number;
  prompt: string;
  status: 'generated' | 'failed' | 'pending';
  imageData?: string;
}

interface StoryboardViewProps {
  frames: StoryboardFrame[];
}

export default function StoryboardView({ frames }: StoryboardViewProps) {
  const handleEditFrame = (frameId: number) => {
    // TODO: Implement frame editing
    console.log('Edit frame:', frameId);
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
        {frames.map((frame) => (
          <div key={frame.id} className="glass-effect rounded-lg p-4 border border-white/10">
            <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg mb-3 flex items-center justify-center">
              {frame.imageData ? (
                <img 
                  src={frame.imageData} 
                  alt={frame.prompt}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-white/30" />
              )}
            </div>
            
            <p className="text-white/70 text-sm mb-2 line-clamp-2">{frame.prompt}</p>
            
            <div className="flex items-center justify-between">
              <span className={`text-xs flex items-center gap-1 ${
                frame.status === 'generated' ? 'text-green-400' :
                frame.status === 'failed' ? 'text-red-400' :
                'text-yellow-400'
              }`}>
                <Check className="w-3 h-3" />
                {frame.status === 'generated' ? 'Generated' :
                 frame.status === 'failed' ? 'Failed' : 'Pending'}
              </span>
              
              <button 
                onClick={() => handleEditFrame(frame.id)}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <button 
        onClick={handleGenerateVideo}
        className="mt-4 w-full py-3 button-primary rounded-lg flex items-center justify-center gap-2"
      >
        <Play className="w-4 h-4" />
        Generate Video Preview
      </button>
    </div>
  );
}