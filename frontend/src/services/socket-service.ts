import { io, Socket } from 'socket.io-client';
import { useRoomStore } from '../stores/useRoomStore';
import { useMindMapStore } from '../stores/useMindMapStore';
import { useChatStore } from '../stores/useChatStore';
import { usePetStore } from '../stores/usePetStore';
import { useUserStore } from '../stores/useUserStore';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';

// Backend gateway runs on namespace /room at port 3001
// Vite dev proxy forwards /socket.io → http://localhost:3001
const SOCKET_URL = '/';
const SOCKET_NS = '/room';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (this.socket) return;
    this.socket = io(SOCKET_NS, {
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

    // Backend emits: presence-updated
    this.socket.on('presence-updated', (members: any) => {
      useRoomStore.getState().setMembers(members);
    });

    // Backend emits: new-message
    this.socket.on('new-message', (message: any) => {
      useChatStore.getState().addMessage(message);
    });

    // Backend emits: node-added
    this.socket.on('node-added', (node: any) => {
      useMindMapStore.getState().addNode(node);
    });

    // Backend emits: node-updated
    this.socket.on('node-updated', (node: any) => {
      useMindMapStore.getState().addNode(node);
    });

    // Backend emits: node-deleted
    this.socket.on('node-deleted', ({ nodeId }: { nodeId: string }) => {
      useMindMapStore.getState().removeNode(nodeId);
    });

    // Backend emits: edge-added
    this.socket.on('edge-added', (edge: any) => {
      useMindMapStore.getState().addEdge(edge);
    });

    // Backend emits: pet-updated
    this.socket.on('pet-updated', (pet: any) => {
      usePetStore.getState().setPetData(pet);
    });

    // Backend emits: room-updated
    this.socket.on('room-updated', (room: any) => {
      useRoomStore.getState().setRoom(room);
    });

    this.socket.on('whiteboard-updated', (board: any) => {
      useWhiteboardStore.getState().setBoard(board);
    });

    this.socket.on('room-dissolved', (payload: any) => {
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

    // Global lobby event: a room was dissolved anywhere — remove it from lobby instantly
    this.socket.on('lobby-room-removed', (payload: { roomId: string }) => {
      window.dispatchEvent(
        new CustomEvent('x-thread-lobby-room-removed', { detail: payload }),
      );
    });

    // Backend emits: phase-changed
    this.socket.on('phase-changed', ({ phase }: { phase: string }) => {
      const room = useRoomStore.getState().currentRoom;
      if (room) useRoomStore.getState().setRoom({ ...room, phase } as any);
    });
  }

  joinRoom(roomId: string) {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      // Backend listens: join-room
      this.socket.emit('join-room', { roomId, userId: user.id, nickname: user.name });
    }
  }

  leaveRoom(roomId: string) {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      this.socket.emit('leave-room', { roomId, userId: user.id });
    }
  }

  sendMessage(roomId: string, content: string) {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      // Backend listens: send-message
      this.socket.emit('send-message', {
        roomId,
        content,
        userId: user.id,
        nickname: user.name
      });
    }
  }

  submitVoiceTranscript(roomId: string, text: string) {
    const user = useUserStore.getState().user;
    if (this.socket && user) {
      // Backend listens: voice-transcript
      this.socket.emit('voice-transcript', {
        roomId,
        userId: user.id,
        nickname: user.name,
        text,
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
