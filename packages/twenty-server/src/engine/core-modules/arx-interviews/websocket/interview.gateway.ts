// src/websocket/interview.gateway.ts
import { Injectable } from '@nestjs/common';
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

import { AvatarService } from 'src/engine/core-modules/arx-interviews/services/avatar.service';
import { LlmService } from 'src/engine/core-modules/arx-interviews/services/llm.service';
import { SpeechService } from 'src/engine/core-modules/arx-interviews/services/speech.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class InterviewGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private speechRecognitionSessions: Map<string, any> = new Map();
  private silenceDetectionIntervals: Map<string, NodeJS.Timeout> = new Map();
  // Track if the client is currently speaking
  private clientSpeakingStatus: Map<string, boolean> = new Map();

  constructor(
    private readonly avatarService: AvatarService,
    private readonly speechService: SpeechService,
    private readonly llmService: LlmService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.clientSpeakingStatus.set(client.id, false);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.cleanupClientResources(client.id);
  }

  @SubscribeMessage('get-avatar-token')
  async handleGetAvatarToken(client: Socket) {
    try {
      const token = await this.avatarService.createToken();

      client.emit('avatar-token', token);
    } catch (error) {
      console.error('Error creating avatar token:', error);
      client.emit('error', 'Failed to create avatar token');
    }
  }

  @SubscribeMessage('start-listening')
  async handleStartListening(client: Socket) {
    try {
      // Create a speech recognition session
      const recognitionSession =
        await this.speechService.createSpeechRecognition(
          (transcript: string) => {
            // Send partial transcripts to the client
            client.emit('stt-result', transcript);
          },
          async (finalTranscript: string) => {
            // Process the transcript with LLM to generate a response
            if (finalTranscript.trim()) {
              client.emit('stt-result', finalTranscript);

              // Generate a response using LLM
              const response =
                await this.llmService.generateResponse(finalTranscript);

              // Send the response back to the client for the avatar to speak
              client.emit('recruiter-message', response);
            }
          },
        );

      this.speechRecognitionSessions.set(client.id, recognitionSession);

      // Success notification
      client.emit('listening-started');

      // Setup silence detection interval
      this.setupSilenceDetection(client);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      client.emit('error', 'Failed to start speech recognition');
    }
  }

  private setupSilenceDetection(client: Socket) {
    // Clear any existing interval
    this.clearSilenceDetection(client.id);

    // Set up new interval to check for silence
    const interval = setInterval(() => {
      // If client hasn't sent audio data for a while, emit silence event
      const isSpeaking = this.clientSpeakingStatus.get(client.id);

      if (!isSpeaking) {
        client.emit('candidate-silent');
      }
      // Reset speaking status - will be set to true when audio data comes in
      this.clientSpeakingStatus.set(client.id, false);
    }, 500); // Check every 500ms

    this.silenceDetectionIntervals.set(client.id, interval);
  }

  private clearSilenceDetection(clientId: string) {
    const existingInterval = this.silenceDetectionIntervals.get(clientId);

    if (existingInterval) {
      clearInterval(existingInterval);
      this.silenceDetectionIntervals.delete(clientId);
    }
  }

  @SubscribeMessage('audio-data')
  async handleAudioData(
    client: Socket,
    data: { audioChunk: Buffer; isSilence?: boolean },
  ) {
    try {
      const session = this.speechRecognitionSessions.get(client.id);

      if (!session) return;

      // Mark client as speaking
      const wasSilent = !this.clientSpeakingStatus.get(client.id);

      this.clientSpeakingStatus.set(client.id, true);

      // If client was silent before and now is speaking, emit speaking event
      if (wasSilent) {
        client.emit('candidate-speaking');
      }

      // Use the speech service to process this chunk
      const isSilence =
        data.isSilence ??
        this.speechService?.isSilence?.(data.audioChunk) ??
        false;

      await this.speechService.processAudioChunk(
        session,
        data.audioChunk,
        isSilence,
      );
    } catch (error) {
      console.error('Error processing audio data:', error);
    }
  }

  @SubscribeMessage('stop-listening')
  async handleStopListening(client: Socket) {
    try {
      const session = this.speechRecognitionSessions.get(client.id);

      if (session) {
        await this.speechService.stopSpeechRecognition(session);
        // Confirm to the client that listening has stopped
        client.emit('listening-stopped');
      }

      // Clear silence detection
      this.clearSilenceDetection(client.id);
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
      client.emit('error', 'Failed to stop speech recognition');
    }
  }

  private cleanupClientResources(clientId: string) {
    // Clean up any resources associated with the client
    const session = this.speechRecognitionSessions.get(clientId);

    if (session) {
      this.speechService.stopSpeechRecognition(session);
      this.speechRecognitionSessions.delete(clientId);
    }

    // Clear silence detection
    this.clearSilenceDetection(clientId);

    // Clear speaking status
    this.clientSpeakingStatus.delete(clientId);
  }
}
