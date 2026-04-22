import { io, Socket } from 'socket.io-client';
import { getStoredAuthToken } from '../lib/auth';
import { mapApiEdgeToMindMapEdge, mapApiNodeToMindMapNode } from '../lib/mindmap';
import { useRoomStore } from '../stores/useRoomStore';
import { useMindMapStore } from '../stores/useMindMapStore';
import { useChatStore } from '../stores/useChatStore';
import { useUserStore } from '../stores/useUserStore';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';
import { socketBaseUrl } from '../lib/runtime-config';
import type { MindMapApiEdge, MindMapApiNode, WhiteboardSnapshot } from './api-client';
import type { Room, RoomMember } from '../types/room';
import { ChatMessage } from '../types/socket-events';

const SOCKET_NS = '/room';

type RoomDissolvedPayload = {
  roomId: string;
};

type PhaseChangedPayload = {
  phase: Room['phase'];
};

class SocketService {
  private socket: Socket | null = null;

  private normalizeMessage(message: ChatMessage): ChatMessage {
    return {
      ...message,
      msgType:
        message.type === 'SYSTEM'
          ? 'system'
          : message.type === 'VOICE_TRANSCRIPT'
            ? 'ai_notify'
            : 'text',
    };
  }

  connect() {
    if (this.socket) return;
    const token = getStoredAuthToken();
    if (!token) return;

    this.socket = io(`${socketBaseUrl}${SOCKET_NS}`, {
      auth: { token },
      path: '/socket.io',
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('presence-updated', (members: RoomMember[]) => {
      useRoomStore.getState().setMembers(members);
    });

    this.socket.on('new-message', (message: ChatMessage) => {
      useChatStore.getState().addMessage(this.normalizeMessage(message));
    });

    this.socket.on('node-added', (node: MindMapApiNode) => {
      useMindMapStore.getState().addNode(mapApiNodeToMindMapNode(node));
    });

    this.socket.on('node-updated', (node: MindMapApiNode) => {
      useMindMapStore.getState().addNode(mapApiNodeToMindMapNode(node));
    });

    this.socket.on('node-deleted', ({ nodeId }: { nodeId: string }) => {
      useMindMapStore.getState().removeNode(nodeId);
    });

    this.socket.on('edge-added', (edge: MindMapApiEdge) => {
      useMindMapStore.getState().addEdge(mapApiEdgeToMindMapEdge(edge));
    });

    this.socket.on('room-updated', (room: Room) => {
      useRoomStore.getState().setRoom(room);
    });

    this.socket.on('whiteboard-updated', (board: WhiteboardSnapshot) => {
      useWhiteboardStore.getState().setBoard(board);
    });

    this.socket.on('room-dissolved', (payload: RoomDissolvedPayload) => {
      const room = useRoomStore.getState().currentRoom;
      if (room?.id === payload?.roomId) {
        useRoomStore.getState().clearRoom();
      }

      window.dispatchEvent(
        new CustomEvent('x-thread-room-dissolved', {
          detail: payload,
        }),
      );
    });

    this.socket.on('lobby-room-removed', (payload: { roomId: string }) => {
      window.dispatchEvent(
        new CustomEvent('x-thread-lobby-room-removed', { detail: payload }),
      );
    });

    this.socket.on('phase-changed', ({ phase }: PhaseChangedPayload) => {
      const room = useRoomStore.getState().currentRoom;
      if (room) {
        useRoomStore.getState().setRoom({ ...room, phase });
      }
    });
  }

  on(event: string, handler: (...args: any[]) => void) {
    this.socket?.on(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void) {
    this.socket?.off(event, handler);
  }

  getSocketId() {
    return this.socket?.id ?? null;
  }

  joinRoom(roomId: string) {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      // Backend listens: join-room
      this.socket.emit('join-room', { roomId });
    }
  }

  leaveRoom(roomId: string) {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      this.socket.emit('leave-room', { roomId });
    }
  }

  sendMessage(roomId: string, content: string) {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      // Backend listens: send-message
      this.socket.emit('send-message', {
        roomId,
        content,
      });
    }
  }

  submitVoiceTranscript(roomId: string, text: string) {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      // Backend listens: voice-transcript
      this.socket.emit('voice-transcript', {
        roomId,
        text,
      });
    }
  }

  joinVoiceCall(roomId: string) {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      this.socket.emit('voice-call-join', { roomId });
    }
  }

  leaveVoiceCall(roomId: string) {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      this.socket.emit('voice-call-leave', { roomId });
    }
  }

  sendVoiceSignal(
    roomId: string,
    targetSocketId: string,
    signal: Record<string, unknown>,
  ) {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      this.socket.emit('voice-signal', {
        roomId,
        targetSocketId,
        signal,
      });
    }
  }

  setVoiceCallMode(roomId: string, mode: 'OPEN' | 'QUEUE') {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      this.socket.emit('voice-call-mode', {
        roomId,
        mode,
      });
    }
  }

  passVoiceCallTurn(roomId: string) {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      this.socket.emit('voice-call-pass-turn', {
        roomId,
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
