# PetGateway Implementation

## Overview

The `PetGateway` is a WebSocket gateway that handles real-time pet state synchronization across all clients in a room. It uses Socket.IO with a dedicated `/pet` namespace for pet-related events.

## Requirements Implemented

- **Requirement 2.7**: State synchronization via Socket.IO
- **Requirement 8.1**: `pet:state:change` event handling
- **Requirement 8.2**: `pet:join:room` event handling

## Architecture

### Namespace
- **Namespace**: `/pet`
- **CORS**: Enabled for all origins (configurable)

### Events

#### Client → Server

1. **`pet:state:change`**
   - **Purpose**: Notify server of pet state changes
   - **Payload**: `StateChangeDto`
     ```typescript
     {
       roomId: string;
       mood: number;      // 0-100
       energy: number;    // 0-100
       timestamp: number; // Unix timestamp
     }
     ```
   - **Response**: Broadcasts `pet:state:changed` to all room members

2. **`pet:join:room`**
   - **Purpose**: Subscribe to room-specific pet updates
   - **Payload**: `{ roomId: string }`
   - **Response**: Emits `pet:joined` acknowledgment to client

3. **`pet:leave:room`**
   - **Purpose**: Unsubscribe from room updates
   - **Payload**: `{ roomId: string }`
   - **Response**: Silent (no acknowledgment)

#### Server → Client

1. **`pet:state:changed`**
   - **Purpose**: Broadcast state change to all room members
   - **Payload**: Same as `pet:state:change` input

2. **`pet:data:updated`**
   - **Purpose**: Broadcast pet data updates (from API changes)
   - **Payload**: Full `PetDto` object

3. **`pet:error`**
   - **Purpose**: Send error notifications to client
   - **Payload**: 
     ```typescript
     {
       message: string;
       code: string;
     }
     ```

4. **`pet:joined`**
   - **Purpose**: Acknowledge successful room join
   - **Payload**:
     ```typescript
     {
       roomId: string;
       message: string;
     }
     ```

## Room Channels

The gateway uses room-specific channels for isolation:
- **Format**: `pet:room:{roomId}`
- **Example**: `pet:room:abc123`

This ensures that state changes in one room don't affect other rooms.

## Error Handling

The gateway validates all incoming events and emits errors for:
- Missing required fields (`roomId`, `mood`, `energy`)
- Invalid payload structure
- Internal processing errors

All errors are emitted to the client via the `pet:error` event with a descriptive message and error code.

## Usage Example

### Client-side (TypeScript)

```typescript
import { io } from 'socket.io-client';

// Connect to pet namespace
const socket = io('http://localhost:3001/pet');

// Join a room
socket.emit('pet:join:room', { roomId: 'room-123' });

// Listen for join confirmation
socket.on('pet:joined', (data) => {
  console.log('Joined pet room:', data.roomId);
});

// Listen for state changes
socket.on('pet:state:changed', (data) => {
  console.log('Pet state changed:', data);
  // Update UI with new mood/energy
});

// Emit state change
socket.emit('pet:state:change', {
  roomId: 'room-123',
  mood: 75,
  energy: 80,
  timestamp: Date.now(),
});

// Handle errors
socket.on('pet:error', (error) => {
  console.error('Pet error:', error.message);
});

// Leave room when done
socket.emit('pet:leave:room', { roomId: 'room-123' });
```

## Integration with PetService

The gateway can be injected into other services to emit events when pet data changes via REST API:

```typescript
@Injectable()
export class PetService {
  constructor(
    private prisma: PrismaService,
    private petGateway: PetGateway,
  ) {}

  async feedPet(roomId: string): Promise<Pet> {
    const pet = await this.prisma.pet.update({
      where: { roomId },
      data: { energy: { increment: 20 } },
    });

    // Broadcast update to all room members
    this.petGateway.emitPetDataUpdated(roomId, pet);

    return pet;
  }
}
```

## Testing

### Unit Tests
- Located in: `pet.gateway.spec.ts`
- Coverage: All event handlers, error cases, and broadcast methods
- Run: `npm test pet.gateway.spec.ts`

### Integration Tests
- Located in: `pet.gateway.integration.spec.ts`
- Coverage: Real Socket.IO connections, room isolation, event flow
- Run: `npm test pet.gateway.integration.spec.ts`

## Performance Considerations

1. **Room Isolation**: Uses Socket.IO rooms for efficient broadcasting
2. **Validation**: Early validation prevents unnecessary processing
3. **Error Handling**: Graceful error handling prevents gateway crashes
4. **Logging**: Console logs for debugging (can be replaced with proper logger)

## Future Enhancements

1. **Authentication**: Add JWT validation for WebSocket connections
2. **Rate Limiting**: Prevent spam of state change events
3. **Persistence**: Optionally persist state changes to database
4. **Metrics**: Add monitoring for connection count, event frequency
5. **Compression**: Enable Socket.IO compression for large payloads
