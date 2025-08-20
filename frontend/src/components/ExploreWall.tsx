import React from 'react';
import { X, Search, Play } from 'lucide-react';

interface ExploreWallProps {
  onClose: () => void;
}

export default function ExploreWall({ onClose }: ExploreWallProps) {
  const mockProjects = [
    {
      id: 1,
      title: 'Product Demo Video',
      description: 'AI-generated promotional video for tech startup',
      thumbnail: '/placeholder-thumbnail.jpg',
      duration: '2:30',
      createdAt: '2 hours ago',
      author: 'Kijko User'
    },
    {
      id: 2,
      title: 'Social Media Campaign',
      description: 'Instagram story series for fashion brand',
      thumbnail: '/placeholder-thumbnail.jpg',
      duration: '0:15',
      createdAt: '5 hours ago',
      author: 'Creative Team'
    },
    {
      id: 3,
      title: 'Explainer Video',
      description: 'Complex concept simplified with AI',
      thumbnail: '/placeholder-thumbnail.jpg',
      duration: '3:45',
      createdAt: '1 day ago',
      author: 'Kijko AI'
    }
  ];

  return (
    <div className="w-96 bg-black/30 backdrop-blur-xl border-l border-white/10 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Explore Wall</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-white/70" />
        </button>
      </div>
      
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search videos..."
            className="input-field pl-10"
          />
        </div>
      </div>
      
      <div className="space-y-4">
        {mockProjects.map((project) => (
          <div 
            key={project.id} 
            className="glass-effect rounded-xl overflow-hidden hover:bg-white/10 transition-colors cursor-pointer group"
          >
            <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center relative">
              <Play className="w-8 h-8 text-white/50 group-hover:text-white/70 transition-colors" />
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                {project.duration}
              </div>
            </div>
            
            <div className="p-4">
              <h3 className="text-white font-medium mb-1 text-sm">{project.title}</h3>
              <p className="text-white/60 text-xs mb-3 line-clamp-2">{project.description}</p>
              
              <div className="flex items-center justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-white/40">{project.createdAt}</span>
                  <span className="text-white/30">by {project.author}</span>
                </div>
                <button className="text-purple-400 hover:text-purple-300 transition-colors">
                  Remix
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {/* Load More */}
        <button className="w-full py-3 button-secondary rounded-lg text-sm">
          Load More Projects
        </button>
      </div>

      {/* Featured Templates */}
      <div className="mt-8 pt-6 border-t border-white/10">
        <h3 className="text-sm font-medium text-white mb-4">Featured Templates</h3>
        
        <div className="space-y-3">
          {['Marketing Video', 'Tutorial Series', 'Product Launch', 'Brand Story'].map((template, index) => (
            <button 
              key={index}
              className="w-full p-3 glass-effect rounded-lg text-left hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/80">{template}</span>
                <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded opacity-60 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}