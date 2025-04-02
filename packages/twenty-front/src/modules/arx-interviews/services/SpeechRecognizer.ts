export class SpeechRecognizer {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private silenceTimer: number | null = null;
  private silenceThreshold = 3000; // 3 seconds of silence
  private transcript = '';
  private continueListening = true;
  private restartTimer: number | null = null;

  constructor(
    private onSpeechStart: () => void,
    private onSpeechEnd: (transcript: string) => void,
    private onInterimResult: (transcript: string) => void,
  ) {
    this.initRecognition();
  }

  private initRecognition() {
    if (
      !('webkitSpeechRecognition' in window) &&
      !('SpeechRecognition' in window)
    ) {
      console.error('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionAPI();

    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 3;

    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('Speech recognition started');
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isListening = false;

      // If we have a transcript, send it
      if (this.transcript.trim() !== '') {
        console.log('Sending transcript on recognition end:', this.transcript);
        this.onSpeechEnd(this.transcript);
        this.transcript = '';
        this.continueListening = false;
      }
      // If we should continue listening, restart
      else if (this.continueListening) {
        console.log('Restarting speech recognition automatically');
        this.restartRecognition();
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);

      // For no-speech, just restart if we're supposed to continue
      if (event.error === 'no-speech' && this.continueListening) {
        console.log('No speech detected, restarting recognition');
        this.restartRecognition();
      }
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalizedTranscript = '';

      // Clear silence timer since we received speech
      if (this.silenceTimer !== null) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalizedTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Add any finalized parts to our transcript
      if (finalizedTranscript !== '') {
        this.transcript += finalizedTranscript + ' ';
        console.log('Updated transcript:', this.transcript);

        // Start silence timer after getting final results
        this.startSilenceTimer();
      }

      // If we have interim results, trigger the callback
      if (interimTranscript !== '') {
        this.onInterimResult(interimTranscript);
      }

      // Detect start of speech
      if (
        this.transcript === '' &&
        (interimTranscript !== '' || finalizedTranscript !== '')
      ) {
        this.onSpeechStart();
      }
    };
  }

  private restartRecognition() {
    // Use a short delay to prevent rapid restarts
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
    }

    this.restartTimer = window.setTimeout(() => {
      if (this.continueListening && !this.isListening) {
        try {
          this.recognition?.start();
        } catch (e) {
          console.error('Error restarting recognition:', e);
        }
      }
    }, 300);
  }

  private startSilenceTimer() {
    // Start a timer to detect silence after speech
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
    }

    this.silenceTimer = window.setTimeout(() => {
      console.log('Silence detected after speech, stopping recognition');
      // If we have content, consider this the end of speech
      if (this.transcript.trim() !== '') {
        this.stop();
      }
    }, this.silenceThreshold);
  }

  start() {
    if (!this.recognition) {
      console.error('Speech recognition not initialized');
      return;
    }

    this.transcript = '';
    this.continueListening = true;

    try {
      this.recognition.start();
      console.log('Started speech recognition');
    } catch (e) {
      console.error('Error starting speech recognition:', e);
      this.restartRecognition();
    }
  }

  stop() {
    if (!this.recognition) return;

    this.continueListening = false;

    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    try {
      if (this.isListening) {
        this.recognition.stop();
      } else if (this.transcript.trim() !== '') {
        // If already stopped but we have a transcript, send it
        console.log(
          'Recognition already stopped, sending transcript:',
          this.transcript,
        );
        this.onSpeechEnd(this.transcript);
        this.transcript = '';
      }
    } catch (e) {
      console.error('Error stopping recognition:', e);
    }
  }
}
