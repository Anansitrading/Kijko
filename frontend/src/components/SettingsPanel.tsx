import React, { useState } from 'react';
import { X, Volume2, VolumeX, Key, Shield, Zap, Database, AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { useKijko } from '../context/KijkoContext';

export default function SettingsPanel() {
  const { state, dispatch, setApiKey, connectWebSocket } = useKijko();
  const [tempApiKey, setTempApiKey] = useState(state.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoQuality, setVideoQuality] = useState('HD');
  const [autoGenerate, setAutoGenerate] = useState(true);

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      setApiKey(tempApiKey.trim());
      // Try to reconnect WebSocket
      connectWebSocket();
    }
  };

  const handleClearApiKey = () => {
    setApiKey('');
    setTempApiKey('');
  };

  const isApiKeyValid = state.apiKey && state.apiKey.length > 0;

  return (
    <div className="w-80 bg-black/30 backdrop-blur-xl border-l border-white/10 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Agent Settings</h2>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-white/70" />
        </button>
      </div>
      
      <div className="space-y-6">
        {/* API Key Configuration */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-5 h-5 text-purple-400" />
            <label className="text-sm font-medium text-white">Gemini API Key</label>
            {isApiKeyValid && <Check className="w-4 h-4 text-green-400" />}
          </div>
          
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="Enter your Gemini API key..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-10 text-white placeholder-white/40 outline-none focus:border-purple-500/50 transition-colors text-sm"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/70"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleSaveApiKey}
                disabled={!tempApiKey.trim()}
                className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity rounded-lg text-white text-sm font-medium"
              >
                Save Key
              </button>
              {isApiKeyValid && (
                <button
                  onClick={handleClearApiKey}
                  className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 transition-colors rounded-lg text-red-300 text-sm"
                >
                  Clear
                </button>
              )}
            </div>
            
            <p className="text-xs text-white/50">
              Get your API key from{' '}
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-purple-400 hover:underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-blue-400" />
            <label className="text-sm font-medium text-white">Connection Status</label>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">API Connection</span>
              <span className={`text-sm px-2 py-1 rounded ${
                isApiKeyValid 
                  ? 'bg-green-500/20 text-green-300' 
                  : 'bg-red-500/20 text-red-300'
              }`}>
                {isApiKeyValid ? 'Ready' : 'Not Configured'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Live API</span>
              <span className={`text-sm px-2 py-1 rounded ${
                state.connectionStatus === 'connected' 
                  ? 'bg-green-500/20 text-green-300' 
                  : state.connectionStatus === 'connecting'
                  ? 'bg-yellow-500/20 text-yellow-300'
                  : 'bg-red-500/20 text-red-300'
              }`}>
                {state.connectionStatus === 'connected' ? 'Connected' :
                 state.connectionStatus === 'connecting' ? 'Connecting' :
                 'Disconnected'}
              </span>
            </div>

            {state.connectionStatus !== 'connected' && isApiKeyValid && (
              <button
                onClick={connectWebSocket}
                className="w-full px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 transition-colors rounded-lg text-blue-300 text-sm"
              >
                Reconnect Live API
              </button>
            )}
          </div>
        </div>

        {/* AI Models Configuration */}
        <div>
          <label className="text-sm text-white/70 mb-2 block">AI Models</label>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Text Generation</label>
              <select 
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                disabled
              >
                <option>Gemini 2.0 Flash</option>
              </select>
            </div>
            
            <div>
              <label className="text-xs text-white/50 mb-1 block">Image Generation</label>
              <select 
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                disabled
              >
                <option>Imagen 3.0</option>
              </select>
            </div>
            
            <div>
              <label className="text-xs text-white/50 mb-1 block">Video Generation</label>
              <select 
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                disabled
              >
                <option>Veo 2.0</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audio Settings */}
        <div>
          <label className="text-sm text-white/70 mb-2 block">Audio Output</label>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setAudioEnabled(true)}
              className={`flex-1 p-2 border rounded-lg flex items-center justify-center gap-2 text-sm transition-colors ${
                audioEnabled 
                  ? 'bg-white/10 border-white/20 text-white' 
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Enabled</span>
            </button>
            <button 
              onClick={() => setAudioEnabled(false)}
              className={`flex-1 p-2 border rounded-lg flex items-center justify-center gap-2 text-sm transition-colors ${
                !audioEnabled 
                  ? 'bg-white/10 border-white/20 text-white' 
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
              }`}
            >
              <VolumeX className="w-4 h-4" />
              <span>Disabled</span>
            </button>
          </div>
        </div>
        
        {/* Video Quality */}
        <div>
          <label className="text-sm text-white/70 mb-2 block">Video Quality</label>
          <div className="flex items-center gap-2">
            {['Draft', 'HD', '4K'].map((quality) => (
              <button
                key={quality}
                onClick={() => setVideoQuality(quality)}
                className={`flex-1 p-2 border rounded-lg text-sm transition-colors ${
                  videoQuality === quality
                    ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30 text-white'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                }`}
              >
                {quality}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-generation Settings */}
        <div>
          <label className="text-sm text-white/70 mb-2 block">Automation</label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoGenerate}
                onChange={(e) => setAutoGenerate(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                autoGenerate 
                  ? 'bg-purple-500 border-purple-500' 
                  : 'border-white/20'
              }`}>
                {autoGenerate && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm text-white/80">Auto-generate storyboards</span>
            </label>
          </div>
        </div>

        {/* Session Info */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-5 h-5 text-gray-400" />
            <label className="text-sm font-medium text-white">Session Info</label>
          </div>
          
          <div className="space-y-2 text-xs text-white/50">
            <div className="flex justify-between">
              <span>Session ID:</span>
              <span className="font-mono">{state.sessionId.substring(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span>Messages:</span>
              <span>{state.messages.length}</span>
            </div>
            {state.currentProject && (
              <div className="flex justify-between">
                <span>Current Project:</span>
                <span>{state.currentProject.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Safety Notice */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Shield className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-300 mb-1">Privacy & Security</h4>
              <p className="text-xs text-yellow-200/80">
                Your API key is stored locally and never sent to our servers. 
                All AI processing happens directly with Google's Gemini API.
              </p>
            </div>
          </div>
        </div>

        {/* Clear Session */}
        <button
          onClick={() => {
            dispatch({ type: 'CLEAR_MESSAGES' });
            dispatch({ type: 'SET_CURRENT_PROJECT', payload: null });
          }}
          className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 transition-colors rounded-lg text-red-300 text-sm"
        >
          Clear Session
        </button>
      </div>
    </div>
  );
}