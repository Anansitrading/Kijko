import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Volume2, FileText, X, Edit2, Check, AlertCircle } from 'lucide-react';

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

interface StickyNoteProps {
  note: StickyNoteData;
  onUpdate: (updates: Partial<StickyNoteData>) => void;
  onDelete: () => void;
}

export default function StickyNote({ note, onUpdate, onDelete }: StickyNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const noteRef = useRef<HTMLDivElement>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-400/50 bg-red-500/10';
      case 'medium': return 'border-yellow-400/50 bg-yellow-500/10';
      case 'low': return 'border-blue-400/50 bg-blue-500/10';
      default: return 'border-white/20 bg-white/5';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'voice': return <Volume2 className="w-3 h-3" />;
      case 'file': return <FileText className="w-3 h-3" />;
      default: return <MessageSquare className="w-3 h-3" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <Check className="w-3 h-3 text-green-400" />;
      case 'addressed': return <AlertCircle className="w-3 h-3 text-yellow-400" />;
      default: return <AlertCircle className="w-3 h-3 text-red-400" />;
    }
  };

  const handleSaveEdit = () => {
    if (content.trim() !== note.content) {
      onUpdate({ content: content.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setContent(note.content);
    setIsEditing(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    
    setIsDragging(true);
    const rect = noteRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      onUpdate({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, onUpdate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={noteRef}
      className={`absolute z-30 min-w-48 max-w-64 glass-effect border-2 rounded-lg shadow-lg cursor-move ${getSeverityColor(note.severity)} ${
        isDragging ? 'opacity-80 scale-105' : ''
      } transition-all`}
      style={{ 
        left: note.x, 
        top: note.y,
        transform: isDragging ? 'rotate(-2deg)' : 'rotate(0deg)'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Note Header */}
      <div className="flex items-center justify-between p-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="text-white/70">
            {getTypeIcon(note.type)}
          </div>
          <span className="text-xs text-white/60">
            {formatTime(note.timestamp)}
          </span>
          {note.sceneNumber && (
            <span className="text-xs text-white/40">
              Scene {note.sceneNumber}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {getStatusIcon(note.status)}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-white/40 hover:text-red-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      {/* Note Content */}
      <div className="p-3">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white placeholder-white/40 outline-none focus:border-purple-400/50 resize-none"
              rows={3}
              placeholder="Enter your feedback..."
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <div className="flex justify-end gap-1">
              <button
                onClick={handleCancelEdit}
                className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded text-white/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-2 py-1 text-xs bg-purple-500 hover:bg-purple-600 rounded text-white transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-white/90 mb-2 leading-relaxed">
              {note.content}
            </p>
            
            {/* Note Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <select
                  value={note.severity}
                  onChange={(e) => onUpdate({ severity: e.target.value as any })}
                  className="text-xs bg-white/10 border border-white/20 rounded px-1 py-0.5 text-white outline-none"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                
                <select
                  value={note.status}
                  onChange={(e) => onUpdate({ status: e.target.value as any })}
                  className="text-xs bg-white/10 border border-white/20 rounded px-1 py-0.5 text-white outline-none"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <option value="open">Open</option>
                  <option value="addressed">Addressed</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-1 text-white/40 hover:text-white/70 transition-colors"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Voice/File specific content */}
      {note.type === 'voice' && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Volume2 className="w-3 h-3" />
            <span>Voice note (Click to play)</span>
          </div>
        </div>
      )}
      
      {note.type === 'file' && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <FileText className="w-3 h-3" />
            <span>Attachment</span>
          </div>
        </div>
      )}
    </div>
  );
}