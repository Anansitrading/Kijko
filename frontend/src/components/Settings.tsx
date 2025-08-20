import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Save, Eye, EyeOff, Key, Server, Globe } from 'lucide-react';

interface SettingsData {
  geminiApiKey: string;
  backendUrl: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  elevenLabsApiKey: string;
}

interface SettingsProps {
  onSettingsChange: (settings: SettingsData) => void;
  currentSettings: SettingsData;
}

const Settings: React.FC<SettingsProps> = ({ onSettingsChange, currentSettings }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [settings, setSettings] = useState<SettingsData>(currentSettings);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [saveMessage, setSaveMessage] = useState('');

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('kijko_settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
        onSettingsChange(parsedSettings);
      } catch (error) {
        console.error('Error loading saved settings:', error);
      }
    }
  }, []);

  const handleInputChange = (key: keyof SettingsData, value: string) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('kijko_settings', JSON.stringify(settings));
      onSettingsChange(settings);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('Error saving settings');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const settingsFields = [
    {
      key: 'geminiApiKey' as keyof SettingsData,
      label: 'Google Gemini API Key',
      icon: <Key className="w-4 h-4" />,
      placeholder: 'Enter your Gemini API key for AI features',
      description: 'Required for VRD generation, storyboard creation, and video processing'
    },
    {
      key: 'backendUrl' as keyof SettingsData,
      label: 'Backend URL',
      icon: <Server className="w-4 h-4" />,
      placeholder: 'https://3001-iaxx0o3ruogtmyukx6kam-6532622b.e2b.dev',
      description: 'URL of the Kijko backend service',
      type: 'url'
    },
    {
      key: 'openaiApiKey' as keyof SettingsData,
      label: 'OpenAI API Key (Optional)',
      icon: <Globe className="w-4 h-4" />,
      placeholder: 'Enter OpenAI API key for additional AI features',
      description: 'Optional: For enhanced text generation and analysis'
    },
    {
      key: 'anthropicApiKey' as keyof SettingsData,
      label: 'Anthropic API Key (Optional)',
      icon: <Globe className="w-4 h-4" />,
      placeholder: 'Enter Anthropic Claude API key',
      description: 'Optional: For additional AI text processing capabilities'
    },
    {
      key: 'elevenLabsApiKey' as keyof SettingsData,
      label: 'ElevenLabs API Key (Optional)',
      icon: <Globe className="w-4 h-4" />,
      placeholder: 'Enter ElevenLabs API key for voice synthesis',
      description: 'Optional: For high-quality voice generation and dubbing'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div 
        className="px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 cursor-pointer flex items-center justify-between"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center space-x-3">
          <Key className="w-5 h-5 text-white" />
          <h2 className="text-xl font-semibold text-white">API Settings & Configuration</h2>
        </div>
        <div className="flex items-center space-x-2">
          {saveMessage && (
            <span className="text-sm text-green-100 bg-green-600 px-2 py-1 rounded">
              {saveMessage}
            </span>
          )}
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-white" />
          ) : (
            <ChevronUp className="w-5 h-5 text-white" />
          )}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-6 space-y-6">
          <div className="text-sm text-gray-600 mb-4">
            Configure your API keys and settings. All data is stored locally and never transmitted to external servers.
          </div>

          <div className="grid gap-6">
            {settingsFields.map((field) => (
              <div key={field.key} className="space-y-2">
                <div className="flex items-center space-x-2">
                  {field.icon}
                  <label className="text-sm font-medium text-gray-700">
                    {field.label}
                  </label>
                  {field.key.includes('ApiKey') && (
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(field.key)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords[field.key] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                
                <input
                  type={field.key.includes('ApiKey') && !showPasswords[field.key] ? 'password' : field.type || 'text'}
                  value={settings[field.key]}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                />
                
                <p className="text-xs text-gray-500">{field.description}</p>
              </div>
            ))}
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={saveSettings}
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg"
            >
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </button>
          </div>

          {/* Environment Variables Info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-medium text-gray-800 mb-2">For Backend Configuration</h3>
            <p className="text-xs text-gray-600 mb-2">
              Add these to your backend .env file:
            </p>
            <div className="bg-gray-800 text-green-400 p-3 rounded text-xs font-mono">
              <div>GEMINI_API_KEY={settings.geminiApiKey || 'your_gemini_api_key_here'}</div>
              <div>OPENAI_API_KEY={settings.openaiApiKey || 'your_openai_api_key_here'}</div>
              <div>ANTHROPIC_API_KEY={settings.anthropicApiKey || 'your_anthropic_api_key_here'}</div>
              <div>ELEVENLABS_API_KEY={settings.elevenLabsApiKey || 'your_elevenlabs_api_key_here'}</div>
              <div>PORT=3001</div>
              <div>NODE_ENV=development</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;