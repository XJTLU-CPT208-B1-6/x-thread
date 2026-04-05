export class VoiceService {
  private recognition: any;
  private isRecording: boolean = false;
  private onResultCallback: (text: string) => void;
  private onErrorCallback: (error: any) => void;

  constructor(onResult: (text: string) => void, onError: (error: any) => void) {
    this.onResultCallback = onResult;
    this.onErrorCallback = onError;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'zh-CN'; // Default language

      this.recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          this.onResultCallback(text);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        this.onErrorCallback(event.error);
        this.stopRecording();
      };

      this.recognition.onend = () => {
        this.isRecording = false;
      };
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }
  }

  startRecording() {
    if (this.recognition && !this.isRecording) {
      try {
        this.recognition.start();
        this.isRecording = true;
      } catch (error) {
        console.error("Failed to start recording:", error);
      }
    }
  }

  stopRecording() {
    if (this.recognition && this.isRecording) {
      try {
        this.recognition.stop();
        this.isRecording = false;
      } catch (error) {
        console.error("Failed to stop recording:", error);
      }
    }
  }

  isSupported() {
    return !!this.recognition;
  }
}
