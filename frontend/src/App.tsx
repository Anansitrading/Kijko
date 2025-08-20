import React from 'react';
import { KijkoProvider } from './context/KijkoContext';
import VideoProductionAgent from './components/VideoProductionAgent';

function App() {
  return (
    <KijkoProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
        <VideoProductionAgent />
      </div>
    </KijkoProvider>
  );
}

export default App;