import { useEffect, useRef, useCallback } from 'react';
import type { PetAnimationState } from '../types/pet';

interface ActivityMonitorOptions {
  roomId?: string;
  onStateChange?: (state: PetAnimationState, duration?: number) => void;
}

const DEBOUNCE_MS = 5000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export function useRoomActivityMonitor({ roomId, onStateChange }: ActivityMonitorOptions = {}) {
  const lastActivityRef = useRef<number>(Date.now());
  const lastTriggeredStateRef = useRef<PetAnimationState | null>(null);
  const lastTriggerTimeRef = useRef<number>(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerState = useCallback(
    (state: PetAnimationState, duration: number = 10000) => {
      const now = Date.now();
      
      if (
        lastTriggeredStateRef.current === state &&
        now - lastTriggerTimeRef.current < DEBOUNCE_MS
      ) {
        return;
      }
      
      lastTriggeredStateRef.current = state;
      lastTriggerTimeRef.current = now;
      lastActivityRef.current = now;
      
      onStateChange?.(state, duration);
      
      resetIdleTimer();
    },
    [onStateChange]
  );

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    
    idleTimerRef.current = setTimeout(() => {
      onStateChange?.('idle');
    }, IDLE_TIMEOUT_MS);
  }, [onStateChange]);

  const handleChatMessage = useCallback(() => {
    triggerState('happy', 10000);
  }, [triggerState]);

  const handleMindMapUpdate = useCallback(() => {
    triggerState('busy', 15000);
  }, [triggerState]);

  const handleVoiceActivity = useCallback(() => {
    triggerState('happy', 10000);
  }, [triggerState]);

  useEffect(() => {
    if (!roomId) return;

    const handleEvent = (event: MessageEvent) => {
      const { type } = event.data || {};
      
      switch (type) {
        case 'chat:message':
          handleChatMessage();
          break;
        case 'mindmap:node:update':
          handleMindMapUpdate();
          break;
        case 'voice:activity':
          handleVoiceActivity();
          break;
      }
    };

    window.addEventListener('socket-message', handleEvent as EventListener);
    
    resetIdleTimer();

    return () => {
      window.removeEventListener('socket-message', handleEvent as EventListener);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [roomId, handleChatMessage, handleMindMapUpdate, handleVoiceActivity, resetIdleTimer]);

  return {
    lastActivity: lastActivityRef.current,
    triggerState,
  };
}
