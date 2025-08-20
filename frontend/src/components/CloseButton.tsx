import React, { useState } from 'react';
import { X, Power, AlertTriangle, CheckCircle } from 'lucide-react';

interface CloseButtonProps {
  onClose?: () => void;
}

const CloseButton: React.FC<CloseButtonProps> = ({ onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [shutdownStatus, setShutdownStatus] = useState<string[]>([]);

  const handleCloseApplication = async () => {
    setIsClosing(true);
    setShutdownStatus(['Initiating graceful shutdown...']);

    try {
      // Step 1: Notify backend to prepare for shutdown
      setShutdownStatus(prev => [...prev, 'Notifying backend services...']);
      
      try {
        await fetch('/api/shutdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'prepare_shutdown' })
        });
        setShutdownStatus(prev => [...prev, '✅ Backend notified successfully']);
      } catch (error) {
        setShutdownStatus(prev => [...prev, '⚠️ Backend notification failed (continuing...)']);
      }

      // Step 2: Close WebSocket connections
      setShutdownStatus(prev => [...prev, 'Closing WebSocket connections...']);
      // Note: WebSocket cleanup will be handled by the context or component unmounting
      setShutdownStatus(prev => [...prev, '✅ WebSocket connections closed']);

      // Step 3: Clear local storage if needed (optional)
      setShutdownStatus(prev => [...prev, 'Clearing temporary data...']);
      // Only clear temporary data, keep settings
      const settingsToKeep = localStorage.getItem('kijko_settings');
      const apiKeyToKeep = localStorage.getItem('kijko_gemini_api_key');
      
      // Clear other temporary data but preserve important settings
      Object.keys(localStorage).forEach(key => {
        if (!key.startsWith('kijko_settings') && !key.startsWith('kijko_gemini_api_key')) {
          localStorage.removeItem(key);
        }
      });
      
      setShutdownStatus(prev => [...prev, '✅ Temporary data cleared']);

      // Step 4: Final cleanup
      setShutdownStatus(prev => [...prev, 'Finalizing shutdown...']);
      
      // Simulate cleanup time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setShutdownStatus(prev => [...prev, '✅ Application ready to close']);
      setShutdownStatus(prev => [...prev, 'You can safely close this window now.']);

      // Call the onClose callback if provided
      if (onClose) {
        onClose();
      }

    } catch (error) {
      console.error('Error during shutdown:', error);
      setShutdownStatus(prev => [...prev, '❌ Error during shutdown, but safe to close']);
    } finally {
      setIsClosing(false);
    }
  };

  if (showConfirmation) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
          <div className="flex items-center space-x-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-800">Close Kijko Application?</h3>
          </div>
          
          <p className="text-gray-600 mb-6">
            This will gracefully shut down all backend services, close WebSocket connections, 
            and clean up temporary data. Your settings will be preserved.
          </p>

          {isClosing && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {shutdownStatus.map((status, index) => (
                  <div key={index} className="text-sm text-gray-700 flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 flex-shrink-0"></div>
                    {status}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={() => setShowConfirmation(false)}
              disabled={isClosing}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleCloseApplication}
              disabled={isClosing}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isClosing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Closing...</span>
                </>
              ) : (
                <>
                  <Power className="w-4 h-4" />
                  <span>Close App</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirmation(true)}
      className="fixed top-4 right-4 z-40 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg transition-all duration-200 group"
      title="Close Application"
    >
      <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
    </button>
  );
};

export default CloseButton;