# 🎬 Kijko - AI Video Production Platform

**Kijko** is an advanced AI-powered video production platform that leverages Google Gemini APIs to streamline the entire video creation process. From initial concept to final production, Kijko provides an intelligent agent that assists with VRD (Video Requirements Document) generation, storyboard creation, and comprehensive video production workflows.

## ✨ Features

### 🤖 AI-Powered Video Production
- **Gemini 2.0 Flash** integration for intelligent text generation and planning
- **Imagen 3.0** for high-quality storyboard image generation
- **Veo 2.0** for video preview and final clip generation
- **Live API** support for real-time multi-modal interactions

### 📋 Video Requirements Document (VRD) System
- Automated VRD generation from creative briefs
- 5-iteration feedback loop with sticky notes
- Multi-format export (JSON, CSV, EDL)
- Comprehensive project management

### 🎨 Visual Storyboard Creation
- Frame-by-frame storyboard visualization
- AI-generated scene descriptions and visuals
- Interactive editing and refinement tools
- Export capabilities for production teams

### 🔧 Advanced Configuration
- **Persistent Settings**: API keys and configurations saved locally
- **Multi-API Support**: Gemini, OpenAI, Anthropic, ElevenLabs integration
- **Real-time Connection Status**: Live WebSocket connection monitoring
- **Graceful Shutdown**: Elegant application closure with service cleanup

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Git** - [Download here](https://git-scm.com/)
- **Google Gemini API Key** - [Get one here](https://aistudio.google.com/app/apikey)

### 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YourUsername/Kijko.git
   cd Kijko
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   cd ..
   ```

3. **Environment Configuration**
   
   Create a `.env` file in the `backend` directory:
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   Edit the `.env` file with your API keys:
   ```env
   # Required for core functionality
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # Optional API keys for enhanced features
   OPENAI_API_KEY=your_openai_api_key_here
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   
   # Server configuration
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   ```

### 🏃‍♂️ Running the Application

#### Option 1: Development Mode (Recommended for testing)

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   The backend will start on `http://localhost:3001`

2. **Start the frontend (in a new terminal)**
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will start on `http://localhost:5173`

3. **Access the application**
   Open your browser and navigate to `http://localhost:5173`

#### Option 2: Production Mode with PM2

1. **Install PM2 globally**
   ```bash
   npm install -g pm2
   ```

2. **Start all services**
   ```bash
   pm2 start ecosystem.config.js
   ```

3. **Monitor services**
   ```bash
   pm2 status
   pm2 logs
   ```

4. **Stop services**
   ```bash
   pm2 stop all
   pm2 delete all
   ```

## ⚙️ Configuration

### API Key Setup

When you first open Kijko, you'll be prompted to enter your API keys. You can also access the settings panel anytime:

1. **Click the Settings button** in the top-right corner
2. **Enter your API keys** in the collapsible settings panel
3. **Click Save Settings** to persist your configuration

Your settings are automatically saved to localStorage and will persist between sessions.

### Supported APIs

| API | Purpose | Required |
|-----|---------|----------|
| **Google Gemini** | Core AI functionality, VRD generation, storyboard creation | Yes |
| **OpenAI** | Enhanced text generation and analysis | Optional |
| **Anthropic Claude** | Additional AI text processing | Optional |
| **ElevenLabs** | High-quality voice synthesis and dubbing | Optional |

## 🎯 Usage Guide

### 1. Initial Setup
- Launch the application
- Enter your Google Gemini API key when prompted
- Configure additional API keys in settings if desired

### 2. Create a Video Project
- Click "New Project" or start a conversation
- Describe your video concept or upload a creative brief
- The AI will generate a comprehensive VRD

### 3. Storyboard Generation
- Review and refine the generated VRD
- Generate storyboard frames with AI
- Use the feedback system to iterate and improve

### 4. Production Workflow
- Export your VRD in preferred format (JSON, CSV, EDL)
- Use the generated storyboard for video production
- Leverage the planning documents for team collaboration

### 5. Advanced Features
- **Live API Mode**: Real-time multi-modal interactions
- **WebSocket Support**: Live agent communication
- **Feedback Loops**: 5-iteration refinement system
- **Export Options**: Multiple format support

## 🛠️ Development

### Project Structure

```
Kijko/
├── backend/                 # Node.js + Express backend
│   ├── routes/             # API route handlers
│   ├── services/           # Gemini API integrations
│   ├── middleware/         # Express middleware
│   └── server.js           # Main server file
├── frontend/               # React + TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── context/        # React context providers
│   │   └── types/          # TypeScript definitions
│   └── public/             # Static assets
├── shared/                 # Shared utilities and types
└── ecosystem.config.js     # PM2 configuration
```

### Available Scripts

#### Backend
```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run tests
```

#### Frontend
```bash
npm run dev        # Start Vite development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### Building for Production

1. **Build the frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Start production services**
   ```bash
   pm2 start ecosystem.config.js --env production
   ```

## 🔧 Troubleshooting

### Common Issues

1. **API Key Errors**
   - Ensure your Gemini API key is valid
   - Check that the API key has necessary permissions
   - Verify the key is correctly entered in settings

2. **Connection Issues**
   - Check that backend is running on port 3001
   - Verify firewall settings aren't blocking connections
   - Ensure WebSocket connections are allowed

3. **Build Errors**
   - Clear node_modules and reinstall dependencies
   - Check Node.js version compatibility
   - Verify all environment variables are set

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=kijko:*
```

### Port Configuration

Default ports:
- Backend: `3001`
- Frontend: `5173`

To change ports, update:
- Backend: `PORT` in `.env`
- Frontend: `server.port` in `vite.config.ts`

## 📈 Performance Optimization

### Backend Optimization
- Use environment variables for API keys
- Implement caching for frequent API calls
- Use PM2 clustering for high traffic

### Frontend Optimization
- Enable code splitting in Vite
- Optimize images and assets
- Use React.memo for expensive components

## 🔒 Security Considerations

- API keys are stored locally, never transmitted to unauthorized endpoints
- CORS is configured for secure cross-origin requests
- Input validation on all API endpoints
- Secure WebSocket connections with proper authentication

## 🚀 Deployment

### Local Development
Follow the installation and running instructions above.

### Production Deployment

#### Option 1: Traditional Server
1. Deploy backend to a VPS or cloud server
2. Deploy frontend to a static hosting service (Vercel, Netlify)
3. Update CORS settings for production domains

#### Option 2: Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up --build
```

#### Option 3: Cloud Platforms
- **Backend**: Railway, Render, or Heroku
- **Frontend**: Vercel, Netlify, or Cloudflare Pages

## 🤝 Contributing

We welcome contributions to Kijko! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google AI Studio for Gemini API access
- The React and Node.js communities
- Open source contributors

## 📞 Support

For support, questions, or feature requests:
- Open an issue on GitHub
- Check our documentation
- Review the troubleshooting section

---

**Made with ❤️ for the video production community**

🎬 **Happy video creating with Kijko!** 🎬