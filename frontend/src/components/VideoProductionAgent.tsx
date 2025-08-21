import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Plus,
  Sparkles,
  Grid,
  AlertCircle,
  Wifi,
  WifiOff,
  Key,
  Video,
  Upload,
  Settings as SettingsIcon,
  Image as ImageIcon
} from 'lucide-react';
import { useKijko } from '../context/KijkoContext';
import StoryboardView from './StoryboardView';
import Settings from './Settings';
import ExploreWall from './ExploreWall';
import CloseButton from './CloseButton';

function VideoProductionAgent() {
  const {
    state,
    dispatch,
    sendMessage,
    setApiKey,
    connectWebSocket,
    updateStoryboardFrame,
    regenerateFrameImage,
    generateStoryboard
  } = useKijko();
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [settingsData, setSettingsData] = useState({
    geminiApiKey: '',
    backendUrl: 'https://3001-iaxx0o3ruogtmyukx6kam-6532622b.e2b.dev',
    openaiApiKey: '',
    anthropicApiKey: '',
    elevenLabsApiKey: ''
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages, state.streamingMessage]);

  // API key is optional - backend has its own key configured

  const handleSendMessage = async () => {
    if (inputMessage.trim()) {
      await sendMessage(inputMessage);
      setInputMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // TODO: Implement actual voice recording
  };

  const handleApiKeySubmit = () => {
    if (tempApiKey.trim()) {
      setApiKey(tempApiKey.trim());
      setShowApiKeyInput(false);
      setTempApiKey('');
    }
  };

  const handleSettingsChange = (newSettings: typeof settingsData) => {
    setSettingsData(newSettings);
    // Update the API key in the context if it's provided
    if (newSettings.geminiApiKey && newSettings.geminiApiKey !== state.apiKey) {
      setApiKey(newSettings.geminiApiKey);
    }
  };


  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const getConnectionStatusIcon = () => {
    switch (state.connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'connecting':
        return <Wifi className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'error':
        return <WifiOff className="w-4 h-4 text-red-400" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* API Key Input Modal */}
      {showApiKeyInput && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/20 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <Key className="w-6 h-6 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">Gemini API Key Required</h3>
            </div>
            <p className="text-white/70 text-sm mb-4">
              To use Kijko's AI features, please enter your Google Gemini API key. 
              Get one from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Google AI Studio</a>.
            </p>
            <input
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="Enter your Gemini API key..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 outline-none focus:border-purple-500/50 transition-colors"
              onKeyPress={(e) => e.key === 'Enter' && handleApiKeySubmit()}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowApiKeyInput(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/70"
              >
                Skip for now
              </button>
              <button
                onClick={handleApiKeySubmit}
                disabled={!tempApiKey.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity text-white font-medium"
              >
                Set API Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">Kijko Video Production Agent</h1>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-white/60">AI-Powered Video Creation</p>
                    {getConnectionStatusIcon()}
                    <span className="text-xs text-white/40">
                      {state.connectionStatus === 'connected' ? 'Live API Connected' : 
                       state.connectionStatus === 'connecting' ? 'Connecting...' : 
                       'Offline Mode'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {!state.apiKey && (
                <button
                  onClick={() => setShowApiKeyInput(true)}
                  className="px-3 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors flex items-center gap-2 text-yellow-300"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Set API Key</span>
                </button>
              )}
              
              <button
                onClick={() => connectWebSocket()}
                disabled={state.connectionStatus === 'connecting'}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                {getConnectionStatusIcon()}
              </button>
              
              <button
                onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <SettingsIcon className="w-5 h-5 text-white/70" />
              </button>
              
              <button
                onClick={() => dispatch({ type: 'TOGGLE_EXPLORE_WALL' })}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <Grid className="w-4 h-4 text-white/70" />
                <span className="text-sm text-white/70">Explore</span>
              </button>
              
              <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 transition-opacity flex items-center gap-2">
                <Plus className="w-4 h-4 text-white" />
                <span className="text-sm text-white font-medium">New Project</span>
              </button>
            </div>
          </div>
        </header>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {state.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-3xl ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                <div className="flex items-start gap-3">
                  {message.type === 'agent' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div>
                    <div className={`rounded-2xl px-4 py-3 ${
                      message.type === 'user' 
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30' 
                        : 'bg-white/5 backdrop-blur-lg border border-white/10'
                    }`}>
                      <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                      {message.usage && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <p className="text-xs text-white/40">
                            Tokens: {message.usage.total_tokens} ({message.usage.prompt_tokens} + {message.usage.completion_tokens})
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mt-1 px-1">
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                  {message.type === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">U</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Streaming message display */}
          {state.streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-3xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white animate-pulse" />
                  </div>
                  <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl px-4 py-3">
                    <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                      {state.streamingMessage}
                      <span className="animate-pulse">|</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Generate Storyboard Button */}
          {state.messages.length > 0 && state.storyboardFrames.length === 0 && !state.isProcessing && (
            <div className="flex justify-center mt-4">
              <button
                onClick={async () => {
                  try {
                    // Create test scenes for now - in production this would come from the chat
                    const testScenes = [
                      {
                        id: 1,
                        title: "Opening Scene",
                        description: "A dimly lit room with four cats sitting around a green felt poker table. One cat wears a visor, another has a monocle.",
                        duration: 3,
                        visual_elements: ["cinematic lighting", "poker table", "cats in costumes"]
                      },
                      {
                        id: 2,
                        title: "The Deal",
                        description: "Close-up of cat paws dealing cards. Cards flying through the air in slow motion.",
                        duration: 2,
                        visual_elements: ["close-up", "slow motion", "playing cards"]
                      },
                      {
                        id: 3,
                        title: "The Bluff",
                        description: "One cat pushes all chips forward with a confident expression while others look surprised.",
                        duration: 3,
                        visual_elements: ["dramatic close-up", "poker chips", "cat expressions"]
                      }
                    ];
                    await generateStoryboard(testScenes);
                  } catch (error) {
                    console.error('Error generating storyboard:', error);
                  }
                }}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                Generate Storyboard Images
              </button>
            </div>
          )}

          {/* Storyboard Frames */}
          {state.storyboardFrames.length > 0 && (
            <StoryboardView
              frames={state.storyboardFrames}
              storyboardId={state.currentProject?.storyboard?.id}
              onUpdateFrame={updateStoryboardFrame}
              onRegenerateFrame={regenerateFrameImage}
            />
          )}
          
          {state.isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
                  <p className="text-white/70 text-sm">Kijko is thinking...</p>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-white/10 bg-black/20 backdrop-blur-xl p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3">
              <div className="flex-1 bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl px-4 py-3 focus-within:border-purple-500/50 transition-colors">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe the video you want to create..."
                  className="w-full bg-transparent text-white placeholder-white/40 outline-none resize-none disabled:opacity-50"
                  rows={1}
                  style={{ minHeight: '24px', maxHeight: '120px' }}
                />
              </div>
              
              <button
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={!state.apiKey}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Upload className="w-5 h-5 text-white/70" />
              </button>
              <input id="file-upload" type="file" className="hidden" />
              
              <button
                onClick={toggleRecording}
                disabled={!state.apiKey}
                className={`p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isRecording 
                    ? 'bg-red-500/20 hover:bg-red-500/30' 
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {isRecording ? (
                  <MicOff className="w-5 h-5 text-red-400" />
                ) : (
                  <Mic className="w-5 h-5 text-white/70" />
                )}
              </button>
              
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || state.isProcessing}
                className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 text-blue-300/80">
              <span className="text-sm">
                💡 Powered by Gemini AI.
                {!state.apiKey && (
                  <>
                    <button
                      onClick={() => setShowApiKeyInput(true)}
                      className="underline hover:text-blue-300 ml-1"
                    >
                      Add custom API key
                    </button>
                    {" "}for advanced features.
                  </>
                )}
              </span>
            </div>

            {state.currentProject && (
              <div className="mt-3 flex items-center gap-2 text-white/60">
                <Video className="w-4 h-4" />
                <span className="text-sm">
                  Project: {state.currentProject.name} • Status: {state.currentProject.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {state.showSettings && (
        <Settings 
          currentSettings={settingsData}
          onSettingsChange={handleSettingsChange}
          onClose={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
        />
      )}

      {/* Explore Wall */}
      {state.showExploreWall && (
        <ExploreWall onClose={() => dispatch({ type: 'TOGGLE_EXPLORE_WALL' })} />
      )}

      {/* Close Button */}
      <CloseButton />
    </div>
  );
}

export default VideoProductionAgent;