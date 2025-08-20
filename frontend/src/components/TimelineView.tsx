import React, { useState, useRef } from 'react';
import { Play, Pause, Volume2, MessageSquare, Plus, Edit2 } from 'lucide-react';
import StickyNote from './StickyNote';

interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'graphics';
  items: TimelineItem[];
  height: number;
  visible: boolean;
  muted?: boolean;
}

interface TimelineItem {
  id: string;
  startTime: number;
  endTime: number;
  content: string;
  color?: string;
}

interface StickyNoteData {
  id: string;
  x: number;
  y: number;
  content: string;
  type: 'text' | 'voice' | 'file';
  sceneNumber?: number;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'addressed' | 'resolved';
}

interface TimelineViewProps {
  duration: number;
  tracks: TimelineTrack[];
  stickyNotes: StickyNoteData[];
  onAddStickyNote: (note: Omit<StickyNoteData, 'id'>) => void;
  onUpdateStickyNote: (id: string, updates: Partial<StickyNoteData>) => void;
  onDeleteStickyNote: (id: string) => void;
}

export default function TimelineView({ 
  duration, 
  tracks, 
  stickyNotes,
  onAddStickyNote,
  onUpdateStickyNote,
  onDeleteStickyNote
}: TimelineViewProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showAddNote, setShowAddNote] = useState(false);
  const [notePosition, setNotePosition] = useState({ x: 0, y: 0 });
  const timelineRef = useRef<HTMLDivElement>(null);

  const timelineWidth = duration * 100 * zoom; // 100px per second * zoom

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = (x / timelineWidth) * duration;
    
    setCurrentTime(time);
    
    // Show context menu for adding sticky note
    if (e.button === 2) { // Right click
      e.preventDefault();
      setNotePosition({ x: e.clientX, y: e.clientY });
      setShowAddNote(true);
    }
  };

  const handleAddNote = (type: 'text' | 'voice' | 'file') => {
    const note: Omit<StickyNoteData, 'id'> = {
      x: notePosition.x,
      y: notePosition.y,
      content: type === 'text' ? 'New note' : type === 'voice' ? 'Voice note' : 'File attachment',
      type,
      timestamp: currentTime,
      severity: 'medium',
      status: 'open'
    };
    
    onAddStickyNote(note);
    setShowAddNote(false);
  };

  const playheadPosition = (currentTime / duration) * timelineWidth;

  return (
    <div className="glass-effect rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-semibold flex items-center gap-2">
          Timeline View
        </h3>
        
        <div className="flex items-center gap-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
              className="px-2 py-1 bg-white/10 rounded text-sm text-white/70 hover:text-white"
            >
              -
            </button>
            <span className="text-sm text-white/60 min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button 
              onClick={() => setZoom(Math.min(4, zoom + 0.25))}
              className="px-2 py-1 bg-white/10 rounded text-sm text-white/70 hover:text-white"
            >
              +
            </button>
          </div>
          
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 button-primary rounded-lg"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            
            <span className="text-sm text-white/60 min-w-[4rem]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="border border-white/10 rounded-lg bg-black/20 overflow-hidden">
        {/* Time Ruler */}
        <div className="h-8 bg-white/5 border-b border-white/10 relative overflow-x-auto">
          <div style={{ width: timelineWidth }} className="h-full relative">
            {/* Time markers */}
            {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full border-l border-white/20"
                style={{ left: (i / duration) * timelineWidth }}
              >
                <span className="text-xs text-white/40 ml-1">
                  {formatTime(i)}
                </span>
              </div>
            ))}
            
            {/* Playhead */}
            <div
              className="absolute top-0 w-0.5 h-full bg-purple-500 z-10"
              style={{ left: playheadPosition }}
            >
              <div className="w-3 h-3 bg-purple-500 rounded-full -ml-1.5 -mt-1"></div>
            </div>
          </div>
        </div>

        {/* Timeline Tracks */}
        <div 
          ref={timelineRef}
          className="relative overflow-x-auto max-h-96"
          onClick={handleTimelineClick}
          onContextMenu={handleTimelineClick}
        >
          <div style={{ width: timelineWidth }}>
            {tracks.map((track, trackIndex) => (
              <div
                key={track.id}
                className="flex border-b border-white/5 last:border-b-0"
                style={{ height: track.height || 60 }}
              >
                {/* Track Header */}
                <div className="w-32 flex-shrink-0 p-3 bg-white/5 border-r border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white font-medium">{track.name}</div>
                    <div className="text-xs text-white/50 capitalize">{track.type}</div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {track.type === 'audio' && (
                      <button className={`p-1 rounded ${track.muted ? 'text-red-400' : 'text-white/70'}`}>
                        <Volume2 className="w-3 h-3" />
                      </button>
                    )}
                    <button 
                      className="p-1 text-white/50 hover:text-white/70"
                      onClick={() => {/* TODO: Toggle track visibility */}}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                {/* Track Content */}
                <div className="flex-1 relative p-2" style={{ height: track.height || 60 }}>
                  {track.items.map((item) => (
                    <div
                      key={item.id}
                      className="absolute h-8 bg-gradient-to-r from-purple-500/60 to-pink-500/60 rounded border border-purple-400/30 flex items-center px-2 cursor-pointer hover:brightness-110 transition-all"
                      style={{
                        left: (item.startTime / duration) * timelineWidth,
                        width: ((item.endTime - item.startTime) / duration) * timelineWidth,
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}
                    >
                      <span className="text-xs text-white truncate">
                        {item.content}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* Sticky Notes Overlay */}
          {stickyNotes.map((note) => (
            <StickyNote
              key={note.id}
              note={note}
              onUpdate={(updates) => onUpdateStickyNote(note.id, updates)}
              onDelete={() => onDeleteStickyNote(note.id)}
            />
          ))}
        </div>
      </div>

      {/* Add Note Context Menu */}
      {showAddNote && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowAddNote(false)}
          />
          <div 
            className="fixed z-50 glass-effect rounded-lg p-2 shadow-xl"
            style={{ 
              left: notePosition.x, 
              top: notePosition.y,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="text-xs text-white/60 mb-2 px-2">Add Note</div>
            <div className="space-y-1">
              <button
                onClick={() => handleAddNote('text')}
                className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 rounded flex items-center gap-2"
              >
                <MessageSquare className="w-3 h-3" />
                Text Note
              </button>
              <button
                onClick={() => handleAddNote('voice')}
                className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 rounded flex items-center gap-2"
              >
                <Volume2 className="w-3 h-3" />
                Voice Note
              </button>
              <button
                onClick={() => handleAddNote('file')}
                className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 rounded flex items-center gap-2"
              >
                <Plus className="w-3 h-3" />
                File Attachment
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}