# AI Interview Module

This module provides an AI-powered interviewing solution integrated with Twenty CRM.

## Setup Instructions

1. **Server Setup**:
   - Make sure the ArxInterviewsModule is imported in the CoreEngineModule
   - Verify that the WebSocket gateway is properly configured

2. **Environment Variables**:
   - Add the following variables to your .env file:
   ```
   REACT_APP_SERVER_URL=http://localhost:3000
   REACT_APP_OPENAI_API_KEY=your_openai_api_key
   ```

3. **Install Dependencies**:
   ```bash
   yarn add @heygen/streaming-avatar socket.io-client
   ```

4. **Fix Connection Issues**:
   - If you encounter "xhr poll error", check that the server is running
   - Ensure the ArxInterviewsModule is properly registered in the server
   - Check that the WebSocket gateway has correct CORS settings 

## Usage

1. Navigate to the interview page
2. Click "Start Interview" to initialize the AI avatar
3. Speak naturally to the avatar - it will process your speech and respond accordingly
4. Toggle "Remove Background" to enable chroma key (green screen) effect
5. Click "End Interview" when done

## Troubleshooting

- **Connection Error**: Verify server is running on the correct port
- **Start Button Disabled**: Check WebSocket connection status
- **Missing Avatar**: Verify Heygen API token configuration
- **Speech Recognition Issues**: Check browser permissions for microphone access

## Features

- AI-driven interview using OpenAI to generate and respond to questions
- Virtual interviewer avatar powered by HeyGen's Streaming Avatar SDK
- Real-time speech recognition for seamless candidate interaction
- Transcription of the entire interview session
- Chroma key functionality to make the avatar's background transparent

## Components

### InterviewApp

The main component that orchestrates the interview experience.

### Services

- **SpeechRecognizer**: Handles speech recognition using the Web Speech API.
- **ChromaKey**: Implements chroma key functionality for the avatar's background.
- **InterviewManager**: Manages the interview flow, questions, and OpenAI integration.

## Customization

You can customize the interview process by modifying:

- `InterviewManager.ts` - Change interview questions or OpenAI prompts
- `InterviewApp.tsx` - Adjust UI layout and styling
- Environment variables - Configure API keys and endpoints

## Dependencies

- HeyGen Streaming Avatar SDK
- OpenAI API
- Web Speech API
- Socket.io for real-time communication 