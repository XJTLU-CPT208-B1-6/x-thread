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
import { PetService } from '../modules/pet/pet.service';
import { StateChangeDto } from '../modules/pet/dto/pet.dto';

/**
 * PetGateway - WebSocket gateway for real-time pet state synchronization
 * 
 * Requirements:
 * - 2.7: State synchronization via Socket.IO
 * - 8.1: pet:state:change event handling
 * - 8.2: pet:join:room event handling
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/pet' })
export class PetGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly petService: PetService) {}

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Pet client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Pet client disconnected: ${client.id}`);
  }

  /**
   * Handle pet state change event
   * Requirement 8.1: pet:state:change event
   * 
   * Client sends state change → Broadcast to all room members
   */
  @SubscribeMessage('pet:state:change')
  async handleStateChange(
    @MessageBody() data: StateChangeDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      // Validate payload
      if (!data.roomId || data.mood === undefined || data.energy === undefined) {
        client.emit('pet:error', {
          message: 'Invalid state change data',
          code: 'INVALID_PAYLOAD',
        });
        return;
      }

      // Broadcast state change to all clients in the room
      this.broadcastToRoom(data.roomId, 'pet:state:changed', {
        roomId: data.roomId,
        mood: data.mood,
        energy: data.energy,
        timestamp: data.timestamp || Date.now(),
      });
    } catch (error) {
      console.error('Error handling pet state change:', error);
      client.emit('pet:error', {
        message: 'Failed to process state change',
        code: 'STATE_CHANGE_ERROR',
      });
    }
  }

  /**
   * Handle join room event
   * Requirement 8.2: pet:join:room event
   * 
   * Client subscribes to room-specific pet updates
   */
  @SubscribeMessage('pet:join:room')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      if (!data.roomId) {
        client.emit('pet:error', {
          message: 'Room ID is required',
          code: 'MISSING_ROOM_ID',
        });
        return;
      }

      // Join the room-specific channel
      const roomChannel = `pet:room:${data.roomId}`;
      client.join(roomChannel);

      console.log(`Client ${client.id} joined pet room: ${data.roomId}`);

      // Acknowledge successful join
      client.emit('pet:joined', {
        roomId: data.roomId,
        message: 'Successfully joined pet room',
      });
    } catch (error) {
      console.error('Error joining pet room:', error);
      client.emit('pet:error', {
        message: 'Failed to join pet room',
        code: 'JOIN_ROOM_ERROR',
      });
    }
  }

  /**
   * Handle leave room event
   * Client unsubscribes from room-specific pet updates
   */
  @SubscribeMessage('pet:leave:room')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      if (!data.roomId) {
        return;
      }

      const roomChannel = `pet:room:${data.roomId}`;
      client.leave(roomChannel);

      console.log(`Client ${client.id} left pet room: ${data.roomId}`);
    } catch (error) {
      console.error('Error leaving pet room:', error);
    }
  }

  /**
   * Broadcast event to all clients in a specific room
   * Requirement 2.7: Room-scoped broadcasts
   * 
   * @param roomId - The room ID to broadcast to
   * @param event - The event name
   * @param data - The event payload
   */
  private broadcastToRoom(roomId: string, event: string, data: any): void {
    const roomChannel = `pet:room:${roomId}`;
    this.server.to(roomChannel).emit(event, data);
  }

  /**
   * Emit pet data update to room
   * Called by PetService when pet data changes via API
   */
  emitPetDataUpdated(roomId: string, petData: any): void {
    this.broadcastToRoom(roomId, 'pet:data:updated', petData);
  }
}
