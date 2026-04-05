import { useEffect } from 'react';
import { socketService } from '../services/socket-service';

export const useSocket = (roomId?: string) => {
  useEffect(() => {
    socketService.connect();

    if (roomId) {
      socketService.joinRoom(roomId);
    }

    return () => {
      // Keep the shared socket alive across page transitions.
    };
  }, [roomId]);

  return { socketService };
};
