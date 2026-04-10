import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { MessageType } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ChatService } from '../modules/chat/chat.service';
import { RoomsService } from '../modules/rooms/rooms.service';
import { RoomBotService } from './room-bot.service';

type VoiceMode = 'OPEN' | 'QUEUE';

type VoiceParticipant = {
  socketId: string;
  userId: string;
  nickname: string;
};

type VoiceCallState = {
  mode: VoiceMode;
  participants: VoiceParticipant[];
  currentSpeakerSocketId: string | null;
  turnEndsAt: number | null;
  timer: NodeJS.Timeout | null;
};

const VOICE_TURN_MS = 5 * 60 * 1000;

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/room' })
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly voiceCallStates = new Map<string, VoiceCallState>();

  constructor(
    private readonly chatService: ChatService,
    private readonly roomsService: RoomsService,
    private readonly jwtService: JwtService,
    private readonly roomBotService: RoomBotService,
  ) {}

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const user = this.authenticateClient(client);
    if (!user) {
      client.emit('error', { message: 'Authentication required' });
      client.disconnect();
      return;
    }

    client.data.user = user;
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.emitVoiceLeaveOnDisconnect(client);
    console.log(`Client disconnected: ${client.id}`);
  }

  emitRoomUpdated(roomId: string, room: unknown) {
    this.server.to(`room:${roomId}`).emit('room-updated', room);
  }

  emitPresence(roomId: string, members: unknown) {
    this.server.to(`room:${roomId}`).emit('presence-updated', members);
  }

  emitMessage(roomId: string, message: unknown) {
    this.server.to(`room:${roomId}`).emit('new-message', message);
  }

  emitNodeAdded(roomId: string, node: unknown) {
    this.server.to(`room:${roomId}`).emit('node-added', node);
  }

  emitNodeUpdated(roomId: string, node: unknown) {
    this.server.to(`room:${roomId}`).emit('node-updated', node);
  }

  emitNodeDeleted(roomId: string, nodeId: string) {
    this.server.to(`room:${roomId}`).emit('node-deleted', { nodeId });
  }

  emitEdgeAdded(roomId: string, edge: unknown) {
    this.server.to(`room:${roomId}`).emit('edge-added', edge);
  }

  emitInputStatus(roomId: string, payload: unknown) {
    this.server.to(`room:${roomId}`).emit('input-status', payload);
  }

  emitWhiteboardUpdated(roomId: string, payload: unknown) {
    this.server.to(`room:${roomId}`).emit('whiteboard-updated', payload);
  }

  emitRoomDissolved(roomId: string, payload: unknown) {
    this.server.to(`room:${roomId}`).emit('room-dissolved', payload);
    // Broadcast to the global lobby channel so the lobby page updates instantly
    this.server.emit('lobby-room-removed', { roomId });
    this.clearVoiceCallState(roomId);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody()
    data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId);
    if (!user) {
      return;
    }

    client.join(`room:${data.roomId}`);
    client.to(`room:${data.roomId}`).emit('user-joined', {
      userId: user.userId,
      nickname: user.nickname,
      personalityType: user.personalityType ?? null,
    });

    return { event: 'joined', roomId: data.roomId };
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId);
    if (!user) {
      return;
    }

    client.leave(`room:${data.roomId}`);
    client.to(`room:${data.roomId}`).emit('user-left', { userId: user.userId });
  }

  @SubscribeMessage('voice-call-join')
  async handleVoiceCallJoin(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId);
    if (!user) {
      return;
    }

    const voiceRoom = this.getVoiceRoomName(data.roomId);
    client.join(voiceRoom);
    this.addVoiceRoomToClient(client, data.roomId);

    const state = this.ensureVoiceCallState(data.roomId);
    if (!state.participants.some((participant) => participant.socketId === client.id)) {
      state.participants.push({
        socketId: client.id,
        userId: user.userId,
        nickname: user.nickname,
      });
    }
    if (state.mode === 'QUEUE' && !state.currentSpeakerSocketId) {
      this.startNextSpeakerTurn(data.roomId);
    }

    const peers = (await this.server.in(voiceRoom).fetchSockets())
      .filter((socket) => socket.id !== client.id)
      .map((socket) => ({
        socketId: socket.id,
        userId: (socket.data.user as AuthenticatedUser | undefined)?.userId ?? '',
        nickname: (socket.data.user as AuthenticatedUser | undefined)?.nickname ?? 'Guest',
      }));

    client.emit('voice-call-peers', {
      roomId: data.roomId,
      peers,
    });

    client.to(voiceRoom).emit('voice-call-user-joined', {
      roomId: data.roomId,
      socketId: client.id,
      userId: user.userId,
      nickname: user.nickname,
    });
    this.emitVoiceCallState(data.roomId);
  }

  @SubscribeMessage('voice-call-leave')
  async handleVoiceCallLeave(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId);
    if (!user) {
      return;
    }

    this.leaveVoiceRoom(client, data.roomId, user);
  }

  @SubscribeMessage('voice-call-mode')
  async handleVoiceCallMode(
    @MessageBody() data: { roomId: string; mode: VoiceMode },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId, true);
    if (!user) {
      return;
    }

    const state = this.ensureVoiceCallState(data.roomId);
    state.mode = data.mode === 'QUEUE' ? 'QUEUE' : 'OPEN';

    if (state.mode === 'OPEN') {
      this.clearVoiceTurnTimer(state);
      state.currentSpeakerSocketId = null;
      state.turnEndsAt = null;
    } else if (!state.currentSpeakerSocketId) {
      this.startNextSpeakerTurn(data.roomId);
    }

    this.emitVoiceCallState(data.roomId);
  }

  @SubscribeMessage('voice-call-pass-turn')
  async handleVoiceCallPassTurn(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId);
    if (!user) {
      return;
    }

    const state = this.ensureVoiceCallState(data.roomId);
    if (state.mode !== 'QUEUE') {
      return;
    }

    if (state.currentSpeakerSocketId && state.currentSpeakerSocketId !== client.id) {
      return;
    }

    this.startNextSpeakerTurn(data.roomId, client.id);
    this.emitVoiceCallState(data.roomId);
  }

  @SubscribeMessage('voice-signal')
  async handleVoiceSignal(
    @MessageBody()
    data: {
      roomId: string;
      targetSocketId: string;
      signal: Record<string, unknown>;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId);
    if (!user) {
      return;
    }

    this.server.to(data.targetSocketId).emit('voice-signal', {
      roomId: data.roomId,
      fromSocketId: client.id,
      userId: user.userId,
      nickname: user.nickname,
      signal: data.signal,
    });
  }

  @SubscribeMessage('send-message')
  async handleMessage(
    @MessageBody() data: { roomId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId);
    if (!user) {
      return;
    }

    // Persist message to database
    const message = await this.chatService.createMessage(
      data.roomId,
      user.userId,
      data.content,
      MessageType.TEXT,
    );

    // Broadcast to all clients in the room (including sender)
    this.emitMessage(data.roomId, message);

    try {
      const botReply = await this.roomBotService.maybeRespondToMention(
        data.roomId,
        user.userId,
        data.content,
      );
      if (botReply) {
        this.emitMessage(data.roomId, botReply);
      }
    } catch (error) {
      console.error('Failed to generate room bot reply:', error);
    }
  }

  @SubscribeMessage('update-node')
  async handleNodeUpdate(
    @MessageBody() data: { roomId: string; node: unknown },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId);
    if (!user) {
      return;
    }

    this.server.to(`room:${data.roomId}`).emit('node-updated', data.node);
  }

  @SubscribeMessage('add-node')
  async handleAddNode(
    @MessageBody() data: { roomId: string; node: unknown },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId);
    if (!user) {
      return;
    }

    this.server.to(`room:${data.roomId}`).emit('node-added', data.node);
  }

  @SubscribeMessage('delete-node')
  async handleDeleteNode(
    @MessageBody() data: { roomId: string; nodeId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId);
    if (!user) {
      return;
    }

    this.server.to(`room:${data.roomId}`).emit('node-deleted', {
      nodeId: data.nodeId,
    });
  }

  @SubscribeMessage('add-edge')
  async handleAddEdge(
    @MessageBody() data: { roomId: string; edge: unknown },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId);
    if (!user) {
      return;
    }

    this.server.to(`room:${data.roomId}`).emit('edge-added', data.edge);
  }

  @SubscribeMessage('phase-change')
  async handlePhaseChange(
    @MessageBody() data: { roomId: string; phase: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId, true);
    if (!user) {
      return;
    }

    this.server.to(`room:${data.roomId}`).emit('phase-changed', {
      phase: data.phase,
    });
  }

  @SubscribeMessage('voice-transcript')
  async handleVoiceTranscript(
    @MessageBody()
    data: { roomId: string; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.ensureRoomAccess(client, data.roomId);
    if (!user) {
      return;
    }

    this.server.to(`room:${data.roomId}`).emit('voice-transcripted', {
      roomId: data.roomId,
      text: data.text,
      userId: user.userId,
      nickname: user.nickname,
      personalityType: user.personalityType ?? null,
    });
  }

  private authenticateClient(client: Socket): AuthenticatedUser | null {
    const token =
      (typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : null) ??
      this.extractBearerToken(client);

    if (!token) {
      return null;
    }

    try {
      const payload = this.jwtService.verify<{
        sub: string;
        account?: string | null;
        email?: string | null;
        nickname?: string;
        personalityType?: 'I' | 'E' | null;
        isGuest?: boolean;
        isAdmin?: boolean;
      }>(token);

      if (!payload.sub) {
        return null;
      }

      return {
        userId: payload.sub,
        account: payload.account ?? null,
        email: payload.email ?? null,
        nickname: payload.nickname ?? 'Guest',
        personalityType: payload.personalityType ?? null,
        isGuest: payload.isGuest ?? true,
        isAdmin: payload.isAdmin ?? false,
      };
    } catch {
      return null;
    }
  }

  private extractBearerToken(client: Socket) {
    const header = client.handshake.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return null;
    }

    return header.slice('Bearer '.length).trim() || null;
  }

  private requireAuthenticatedUser(client: Socket) {
    const user = client.data.user as AuthenticatedUser | undefined;
    if (!user) {
      client.emit('error', { message: 'Authentication required' });
      client.disconnect();
      throw new Error('Unauthenticated socket client');
    }

    return user;
  }

  private async ensureRoomAccess(
    client: Socket,
    roomId: string,
    ownerOnly = false,
  ) {
    const user = this.requireAuthenticatedUser(client);

    try {
      if (ownerOnly) {
        await this.roomsService.ensureOwner(roomId, user.userId);
      } else {
        await this.roomsService.ensureMembership(roomId, user.userId);
      }
      return user;
    } catch {
      client.emit('error', {
        message: ownerOnly ? 'Forbidden room operation' : 'Forbidden room access',
      });
      return null;
    }
  }

  private getVoiceRoomName(roomId: string) {
    return `voice:${roomId}`;
  }

  private addVoiceRoomToClient(client: Socket, roomId: string) {
    const current = client.data.voiceRooms as Set<string> | undefined;
    if (current) {
      current.add(roomId);
      return;
    }
    client.data.voiceRooms = new Set([roomId]);
  }

  private removeVoiceRoomFromClient(client: Socket, roomId: string) {
    const current = client.data.voiceRooms as Set<string> | undefined;
    current?.delete(roomId);
  }

  private leaveVoiceRoom(client: Socket, roomId: string, user?: AuthenticatedUser) {
    const voiceRoom = this.getVoiceRoomName(roomId);
    const state = this.voiceCallStates.get(roomId);
    if (state) {
      state.participants = state.participants.filter((participant) => participant.socketId !== client.id);
      if (state.currentSpeakerSocketId === client.id) {
        this.startNextSpeakerTurn(roomId, client.id);
      } else if (state.participants.length === 0) {
        this.clearVoiceCallState(roomId);
      }
    }
    client.leave(voiceRoom);
    this.removeVoiceRoomFromClient(client, roomId);
    client.to(voiceRoom).emit('voice-call-user-left', {
      roomId,
      socketId: client.id,
      userId: user?.userId ?? null,
    });
    if (state && state.participants.length > 0) {
      this.emitVoiceCallState(roomId);
    }
  }

  private emitVoiceLeaveOnDisconnect(client: Socket) {
    const user = client.data.user as AuthenticatedUser | undefined;
    const voiceRooms = client.data.voiceRooms as Set<string> | undefined;
    if (!voiceRooms || voiceRooms.size === 0) {
      return;
    }

    for (const roomId of voiceRooms) {
      this.leaveVoiceRoom(client, roomId, user);
    }
  }

  private ensureVoiceCallState(roomId: string) {
    const existing = this.voiceCallStates.get(roomId);
    if (existing) {
      return existing;
    }

    const created: VoiceCallState = {
      mode: 'OPEN',
      participants: [],
      currentSpeakerSocketId: null,
      turnEndsAt: null,
      timer: null,
    };
    this.voiceCallStates.set(roomId, created);
    return created;
  }

  private clearVoiceTurnTimer(state: VoiceCallState) {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }

  private clearVoiceCallState(roomId: string) {
    const state = this.voiceCallStates.get(roomId);
    if (!state) {
      return;
    }
    this.clearVoiceTurnTimer(state);
    this.voiceCallStates.delete(roomId);
  }

  private startNextSpeakerTurn(roomId: string, previousSpeakerSocketId?: string) {
    const state = this.ensureVoiceCallState(roomId);
    this.clearVoiceTurnTimer(state);

    if (state.mode !== 'QUEUE' || state.participants.length === 0) {
      state.currentSpeakerSocketId = null;
      state.turnEndsAt = null;
      return;
    }

    const previousIndex = previousSpeakerSocketId
      ? state.participants.findIndex((participant) => participant.socketId === previousSpeakerSocketId)
      : -1;

    const nextIndex =
      previousIndex >= 0
        ? (previousIndex + 1) % state.participants.length
        : 0;

    const nextSpeaker = state.participants[nextIndex];
    state.currentSpeakerSocketId = nextSpeaker?.socketId ?? null;
    state.turnEndsAt = nextSpeaker ? Date.now() + VOICE_TURN_MS : null;

    if (!nextSpeaker) {
      return;
    }

    state.timer = setTimeout(() => {
      this.startNextSpeakerTurn(roomId, nextSpeaker.socketId);
      this.emitVoiceCallState(roomId);
    }, VOICE_TURN_MS);
  }

  private emitVoiceCallState(roomId: string) {
    const state = this.voiceCallStates.get(roomId);
    if (!state) {
      this.server.to(this.getVoiceRoomName(roomId)).emit('voice-call-state', {
        roomId,
        mode: 'OPEN',
        currentSpeakerSocketId: null,
        turnEndsAt: null,
        participants: [],
      });
      return;
    }

    this.server.to(this.getVoiceRoomName(roomId)).emit('voice-call-state', {
      roomId,
      mode: state.mode,
      currentSpeakerSocketId: state.currentSpeakerSocketId,
      turnEndsAt: state.turnEndsAt,
      participants: state.participants,
    });
  }
}
