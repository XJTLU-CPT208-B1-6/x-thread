import { Test, TestingModule } from '@nestjs/testing';
import { PetGateway } from './pet.gateway';
import { PetService } from '../modules/pet/pet.service';
import { StateChangeDto } from '../modules/pet/dto/pet.dto';

describe('PetGateway', () => {
  let gateway: PetGateway;
  let petService: PetService;
  let mockServer: any;
  let mockClient: any;

  beforeEach(async () => {
    // Mock PetService
    const mockPetService = {
      getPetByRoomId: jest.fn(),
      feedPet: jest.fn(),
      updateMood: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetGateway,
        {
          provide: PetService,
          useValue: mockPetService,
        },
      ],
    }).compile();

    gateway = module.get<PetGateway>(PetGateway);
    petService = module.get<PetService>(PetService);

    // Mock Socket.IO server
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    gateway.server = mockServer;

    // Mock Socket.IO client
    mockClient = {
      id: 'test-client-123',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('should log client connection', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      gateway.handleConnection(mockClient);
      expect(consoleSpy).toHaveBeenCalledWith('Pet client connected: test-client-123');
      consoleSpy.mockRestore();
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnection', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      gateway.handleDisconnect(mockClient);
      expect(consoleSpy).toHaveBeenCalledWith('Pet client disconnected: test-client-123');
      consoleSpy.mockRestore();
    });
  });

  describe('handleStateChange', () => {
    it('should broadcast state change to room', async () => {
      const stateChangeData: StateChangeDto = {
        roomId: 'room-123',
        mood: 75,
        energy: 80,
        timestamp: Date.now(),
      };

      await gateway.handleStateChange(stateChangeData, mockClient);

      expect(mockServer.to).toHaveBeenCalledWith('pet:room:room-123');
      expect(mockServer.emit).toHaveBeenCalledWith('pet:state:changed', {
        roomId: 'room-123',
        mood: 75,
        energy: 80,
        timestamp: stateChangeData.timestamp,
      });
    });

    it('should emit error for invalid payload (missing roomId)', async () => {
      const invalidData = {
        mood: 75,
        energy: 80,
        timestamp: Date.now(),
      } as any;

      await gateway.handleStateChange(invalidData, mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith('pet:error', {
        message: 'Invalid state change data',
        code: 'INVALID_PAYLOAD',
      });
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('should emit error for invalid payload (missing mood)', async () => {
      const invalidData = {
        roomId: 'room-123',
        energy: 80,
        timestamp: Date.now(),
      } as any;

      await gateway.handleStateChange(invalidData, mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith('pet:error', {
        message: 'Invalid state change data',
        code: 'INVALID_PAYLOAD',
      });
    });

    it('should emit error for invalid payload (missing energy)', async () => {
      const invalidData = {
        roomId: 'room-123',
        mood: 75,
        timestamp: Date.now(),
      } as any;

      await gateway.handleStateChange(invalidData, mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith('pet:error', {
        message: 'Invalid state change data',
        code: 'INVALID_PAYLOAD',
      });
    });

    it('should use current timestamp if not provided', async () => {
      const stateChangeData: StateChangeDto = {
        roomId: 'room-123',
        mood: 75,
        energy: 80,
        timestamp: 0,
      };

      const beforeTime = Date.now();
      await gateway.handleStateChange(stateChangeData, mockClient);
      const afterTime = Date.now();

      expect(mockServer.emit).toHaveBeenCalled();
      const emittedData = mockServer.emit.mock.calls[0][1];
      expect(emittedData.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(emittedData.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('handleJoinRoom', () => {
    it('should join client to room channel', async () => {
      const joinData = { roomId: 'room-123' };

      await gateway.handleJoinRoom(joinData, mockClient);

      expect(mockClient.join).toHaveBeenCalledWith('pet:room:room-123');
      expect(mockClient.emit).toHaveBeenCalledWith('pet:joined', {
        roomId: 'room-123',
        message: 'Successfully joined pet room',
      });
    });

    it('should emit error for missing roomId', async () => {
      const invalidData = {} as any;

      await gateway.handleJoinRoom(invalidData, mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith('pet:error', {
        message: 'Room ID is required',
        code: 'MISSING_ROOM_ID',
      });
      expect(mockClient.join).not.toHaveBeenCalled();
    });

    it('should log successful room join', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const joinData = { roomId: 'room-123' };

      await gateway.handleJoinRoom(joinData, mockClient);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Client test-client-123 joined pet room: room-123',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('handleLeaveRoom', () => {
    it('should remove client from room channel', async () => {
      const leaveData = { roomId: 'room-123' };

      await gateway.handleLeaveRoom(leaveData, mockClient);

      expect(mockClient.leave).toHaveBeenCalledWith('pet:room:room-123');
    });

    it('should handle missing roomId gracefully', async () => {
      const invalidData = {} as any;

      await gateway.handleLeaveRoom(invalidData, mockClient);

      expect(mockClient.leave).not.toHaveBeenCalled();
    });

    it('should log successful room leave', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const leaveData = { roomId: 'room-123' };

      await gateway.handleLeaveRoom(leaveData, mockClient);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Client test-client-123 left pet room: room-123',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('emitPetDataUpdated', () => {
    it('should broadcast pet data update to room', () => {
      const petData = {
        roomId: 'room-123',
        petType: 'cat',
        mood: 75,
        energy: 80,
      };

      gateway.emitPetDataUpdated('room-123', petData);

      expect(mockServer.to).toHaveBeenCalledWith('pet:room:room-123');
      expect(mockServer.emit).toHaveBeenCalledWith('pet:data:updated', petData);
    });
  });

  describe('broadcastToRoom', () => {
    it('should broadcast custom event to room', () => {
      const roomId = 'room-123';
      const eventName = 'custom:event';
      const eventData = { foo: 'bar' };

      // Access private method via type assertion
      (gateway as any).broadcastToRoom(roomId, eventName, eventData);

      expect(mockServer.to).toHaveBeenCalledWith('pet:room:room-123');
      expect(mockServer.emit).toHaveBeenCalledWith(eventName, eventData);
    });
  });
});
