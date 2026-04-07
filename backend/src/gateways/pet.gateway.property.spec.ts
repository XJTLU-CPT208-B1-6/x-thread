import { Test, TestingModule } from '@nestjs/testing';
import { PetGateway } from './pet.gateway';
import { PetService } from '../modules/pet/pet.service';
import { StateChangeDto } from '../modules/pet/dto/pet.dto';
import * as fc from 'fast-check';

// Feature: ai-pet-integration, Property 13: State change events contain required fields
describe('PetGateway - Property-Based Tests', () => {
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

  // Feature: ai-pet-integration, Property 13: State change events contain required fields
  describe('Property 13: State change events contain required fields', () => {
    it('should emit events with all required fields (roomId, mood, energy, timestamp)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random roomId (non-empty string)
          fc.string({ minLength: 1, maxLength: 50 }),
          // Generate random mood (0-100)
          fc.integer({ min: 0, max: 100 }),
          // Generate random energy (0-100)
          fc.integer({ min: 0, max: 100 }),
          // Generate random timestamp (or 0 to test auto-generation)
          fc.oneof(
            fc.constant(0), // Test auto-generation
            fc.integer({ min: 1000000000000, max: 9999999999999 }) // Valid timestamp
          ),
          async (roomId, mood, energy, timestamp) => {
            // Reset mocks for each iteration
            mockServer.emit.mockClear();
            mockServer.to.mockClear();

            const stateChangeData: StateChangeDto = {
              roomId,
              mood,
              energy,
              timestamp,
            };

            await gateway.handleStateChange(stateChangeData, mockClient);

            // Verify that emit was called
            expect(mockServer.emit).toHaveBeenCalledTimes(1);

            // Extract the emitted event data
            const [eventName, eventData] = mockServer.emit.mock.calls[0];

            // Verify event name
            expect(eventName).toBe('pet:state:changed');

            // Verify all required fields are present
            expect(eventData).toHaveProperty('roomId');
            expect(eventData).toHaveProperty('mood');
            expect(eventData).toHaveProperty('energy');
            expect(eventData).toHaveProperty('timestamp');

            // Verify field types
            expect(typeof eventData.roomId).toBe('string');
            expect(typeof eventData.mood).toBe('number');
            expect(typeof eventData.energy).toBe('number');
            expect(typeof eventData.timestamp).toBe('number');

            // Verify field values match input (or are auto-generated for timestamp)
            expect(eventData.roomId).toBe(roomId);
            expect(eventData.mood).toBe(mood);
            expect(eventData.energy).toBe(energy);
            
            // If timestamp was 0, verify it was auto-generated to a valid timestamp
            if (timestamp === 0) {
              expect(eventData.timestamp).toBeGreaterThan(0);
              expect(eventData.timestamp).toBeLessThanOrEqual(Date.now());
            } else {
              expect(eventData.timestamp).toBe(timestamp);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not emit events when required fields are missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random valid data
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1000000000000, max: 9999999999999 }),
          // Generate which field to omit
          fc.constantFrom('roomId', 'mood', 'energy'),
          async (roomId, mood, energy, timestamp, fieldToOmit) => {
            // Reset mocks for each iteration
            mockServer.emit.mockClear();
            mockServer.to.mockClear();
            mockClient.emit.mockClear();

            // Create data with one field missing
            const stateChangeData: any = {
              roomId,
              mood,
              energy,
              timestamp,
            };

            // Remove the specified field
            delete stateChangeData[fieldToOmit];

            await gateway.handleStateChange(stateChangeData, mockClient);

            // Verify that error was emitted to client
            expect(mockClient.emit).toHaveBeenCalledWith('pet:error', {
              message: 'Invalid state change data',
              code: 'INVALID_PAYLOAD',
            });

            // Verify that state change was NOT broadcast
            expect(mockServer.emit).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
