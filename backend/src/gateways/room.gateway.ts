import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from '../modules/chat/chat.service';
import { MessageType } from '@prisma/client';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/room' })
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly chatService: ChatService) {}

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
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

  emitPetUpdated(roomId: string, pet: unknown) {
    this.server.to(`room:${roomId}`).emit('pet-updated', pet);
  }

  emitInputStatus(roomId: string, payload: unknown) {
    this.server.to(`room:${roomId}`).emit('input-status', payload);
  }

  emitWhiteboardUpdated(roomId: string, payload: unknown) {
    this.server.to(`room:${roomId}`).emit('whiteboard-updated', payload);
  }

  emitRoomDissolved(roomId: string, payload: unknown) {
    this.server.to(`room:${roomId}`).emit('room-dissolved', payload);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @MessageBody()
    data: { roomId: string; userId: string; nickname: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`room:${data.roomId}`);
    client
      .to(`room:${data.roomId}`)
      .emit('user-joined', { userId: data.userId, nickname: data.nickname });
    return { event: 'joined', roomId: data.roomId };
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @MessageBody() data: { roomId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`room:${data.roomId}`);
    client.to(`room:${data.roomId}`).emit('user-left', { userId: data.userId });
  }

  @SubscribeMessage('send-message')
  async handleMessage(
    @MessageBody() data: { roomId: string; content: string; userId: string; nickname: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Persist message to database
    const message = await this.chatService.createMessage(
      data.roomId,
      data.userId,
      data.content,
      MessageType.TEXT,
    );

    // Broadcast to all clients in the room (including sender)
    this.emitMessage(data.roomId, message);
  }

  @SubscribeMessage('update-node')
  handleNodeUpdate(@MessageBody() data: { roomId: string; node: unknown }) {
    this.server.to(`room:${data.roomId}`).emit('node-updated', data.node);
  }

  @SubscribeMessage('add-node')
  handleAddNode(@MessageBody() data: { roomId: string; node: unknown }) {
    this.server.to(`room:${data.roomId}`).emit('node-added', data.node);
  }

  @SubscribeMessage('delete-node')
  handleDeleteNode(@MessageBody() data: { roomId: string; nodeId: string }) {
    this.server.to(`room:${data.roomId}`).emit('node-deleted', {
      nodeId: data.nodeId,
    });
  }

  @SubscribeMessage('add-edge')
  handleAddEdge(@MessageBody() data: { roomId: string; edge: unknown }) {
    this.server.to(`room:${data.roomId}`).emit('edge-added', data.edge);
  }

  @SubscribeMessage('phase-change')
  handlePhaseChange(@MessageBody() data: { roomId: string; phase: string }) {
    this.server.to(`room:${data.roomId}`).emit('phase-changed', {
      phase: data.phase,
    });
  }

  @SubscribeMessage('pet-update')
  handlePetUpdate(@MessageBody() data: { roomId: string; pet: unknown }) {
    this.server.to(`room:${data.roomId}`).emit('pet-updated', data.pet);
  }

  @SubscribeMessage('voice-transcript')
  handleVoiceTranscript(
    @MessageBody()
    data: { roomId: string; userId: string; nickname: string; text: string },
  ) {
    this.server.to(`room:${data.roomId}`).emit('voice-transcripted', data);
  }
}
