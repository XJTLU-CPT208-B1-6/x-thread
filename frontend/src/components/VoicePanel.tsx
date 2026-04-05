import React, { useEffect, useRef, useState } from 'react';
import { Mic, Send } from 'lucide-react';
import { socketService } from '../services/socket-service';
import { VoiceService } from '../services/voice-service';
import { useRoomStore } from '../stores/useRoomStore';

type VoicePanelProps = {
  embedded?: boolean;
};

export const VoicePanel = ({ embedded = false }: VoicePanelProps) => {
  const { currentRoom } = useRoomStore();
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState('');
  const voiceServiceRef = useRef<VoiceService | null>(null);

  const containerClassName = embedded
    ? 'shrink-0 border-t border-slate-200 bg-white px-4 py-3'
    : 'fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white p-4 shadow-lg';
  const layoutClassName = embedded
    ? 'flex w-full items-center gap-3'
    : 'mx-auto flex w-full max-w-4xl items-center gap-2';
  const buttonClassName = embedded
    ? `rounded-2xl p-3 transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-500 text-white hover:bg-blue-600'}`
    : `rounded-full p-4 transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-500 text-white hover:bg-blue-600'}`;
  const inputShellClassName = embedded
    ? 'flex min-w-0 flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100'
    : 'flex flex-grow items-center rounded-md border bg-white px-2 focus-within:ring-2 focus-within:ring-blue-500';

  useEffect(() => {
    voiceServiceRef.current = new VoiceService(
      (text) => {
        console.log('Voice recognized:', text);
        if (currentRoom?.id) {
          socketService.sendMessage(currentRoom.id, text);
        }
      },
      (error) => {
        console.error('Voice error:', error);
        setIsRecording(false);
      },
    );
  }, [currentRoom]);

  const handlePttDown = () => {
    if (voiceServiceRef.current?.isSupported()) {
      setIsRecording(true);
      voiceServiceRef.current.startRecording();
    } else {
      alert('Speech recognition is not supported in this browser.');
    }
  };

  const handlePttUp = () => {
    setIsRecording(false);
    voiceServiceRef.current?.stopRecording();
  };

  const handleSendText = () => {
    const message = textInput.trim();
    if (message && currentRoom?.id) {
      socketService.sendMessage(currentRoom.id, message);
      setTextInput('');
    }
  };

  return (
    <div className={containerClassName}>
      <div className={layoutClassName}>
        <button
          type="button"
          onMouseDown={handlePttDown}
          onMouseUp={handlePttUp}
          onTouchStart={handlePttDown}
          onTouchEnd={handlePttUp}
          className={buttonClassName}
        >
          <Mic size={embedded ? 20 : 24} />
        </button>

        <div className={inputShellClassName}>
          <input
            type="text"
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSendText();
              }
            }}
            placeholder={embedded ? '输入消息或按住语音键说话…' : 'Or type here...'}
            className={`w-full bg-transparent text-gray-900 outline-none placeholder-gray-400 ${
              embedded ? 'py-3 text-sm' : 'p-2'
            }`}
          />
          <button
            type="button"
            onClick={handleSendText}
            className={`shrink-0 rounded-full transition ${
              embedded
                ? 'p-2 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
                : 'p-2 text-blue-500 hover:text-blue-700'
            }`}
          >
            <Send size={embedded ? 18 : 20} />
          </button>
        </div>
      </div>

      {isRecording && (
        <p className={`mt-2 text-gray-500 ${embedded ? 'text-xs' : 'text-sm'}`}>
          Listening...
        </p>
      )}
    </div>
  );
};
