// src/services/speech.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import OpenAI from 'openai';

// Audio session interface
interface AudioSession {
  id: string;
  active: boolean;
  audioChunks: Buffer[];
  onTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  silenceStartTime?: number;
  lastProcessedIndex: number;
}

@Injectable()
export class SpeechService {
  private openai: OpenAI;
  private readonly SILENCE_THRESHOLD = 2000; // 2 seconds of silence to trigger processing

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async createSpeechRecognition(
    onTranscript: (text: string) => void,
    onFinalTranscript: (text: string) => void,
  ): Promise<AudioSession> {
    // Create a new audio session for this connection
    const session: AudioSession = {
      id: Math.random().toString(36).substring(2, 9),
      active: true,
      audioChunks: [],
      onTranscript,
      onFinalTranscript,
      lastProcessedIndex: 0,
    };

    return session;
  }

  async stopSpeechRecognition(session: AudioSession): Promise<void> {
    if (!session || !session.active) return;

    session.active = false;

    // Process any remaining audio that hasn't been processed
    if (session.audioChunks.length > session.lastProcessedIndex) {
      const pendingAudio = Buffer.concat(
        session.audioChunks.slice(session.lastProcessedIndex),
      );

      try {
        // Only process if there's substantial audio data (>1KB to avoid processing silence)
        if (pendingAudio.length > 1024) {
          const transcript = await this.transcribeAudio(pendingAudio);

          if (transcript && transcript.trim()) {
            session.onFinalTranscript(transcript);
          }
        }
      } catch (error) {
        console.error('Error processing final audio chunk:', error);
      }
    }

    // Clear any resources
    session.audioChunks = [];
  }

  async processAudioChunk(
    session: AudioSession,
    audioChunk: Buffer,
    isSilence: boolean,
  ): Promise<void> {
    if (!session.active) return;

    // Add the audio chunk to the buffer
    session.audioChunks.push(audioChunk);

    // Track silence for auto-processing
    if (isSilence) {
      if (!session.silenceStartTime) {
        session.silenceStartTime = Date.now();
      } else if (
        Date.now() - session.silenceStartTime >
        this.SILENCE_THRESHOLD
      ) {
        // Silence threshold exceeded, process the accumulated audio
        await this.processAccumulatedAudio(session);
        session.silenceStartTime = undefined;
      }
    } else {
      // Reset silence timer when sound is detected
      session.silenceStartTime = undefined;
    }

    // Optionally process audio in chunks to provide partial transcripts
    // This could be implemented with a streaming API if available
  }

  private async processAccumulatedAudio(session: AudioSession): Promise<void> {
    if (session.audioChunks.length <= session.lastProcessedIndex) return;

    // Concatenate all audio chunks since last processing
    const audioToProcess = Buffer.concat(
      session.audioChunks.slice(session.lastProcessedIndex),
    );

    // Update the last processed index
    session.lastProcessedIndex = session.audioChunks.length;

    try {
      // Only process if there's substantial audio data (>1KB to avoid processing silence)
      if (audioToProcess.length > 1024) {
        const transcript = await this.transcribeAudio(audioToProcess);

        if (transcript && transcript.trim()) {
          session.onFinalTranscript(transcript);
        }
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      // Convert buffer to File object for OpenAI API
      const file = await this.bufferToBlob(audioBuffer, 'audio.webm');

      const response = await this.openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: 'en', // Optional: specify language for better accuracy
        response_format: 'text',
      });

      return response.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  // Helper method to convert Buffer to File/Blob for OpenAI API
  async bufferToBlob(buffer: Buffer, filename: string): Promise<File> {
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    return new File([arrayBuffer], filename, { type: 'audio/webm' });
  }

  // Helper method to detect silence in audio buffer
  // This is a simplified implementation; in a real app, you'd use proper audio analysis
  isSilence(audioBuffer: Buffer, threshold = 0.01): boolean {
    // Convert buffer to Int16Array for processing
    const samples = new Int16Array(
      audioBuffer.buffer,
      audioBuffer.byteOffset,
      audioBuffer.byteLength / 2,
    );

    // Calculate RMS of the audio samples
    let sum = 0;

    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }

    const rms = Math.sqrt(sum / samples.length) / 32768.0; // Normalize to 0-1

    return rms < threshold;
  }
}
