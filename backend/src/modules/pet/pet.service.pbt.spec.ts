import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { PetService } from './pet.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { Pet } from '@prisma/client';

// Feature: ai-pet-integration, Property 11: Feed operation increases energy by fixed amount
describe('PetService - Property-Based Tests', () => {
  let service: PetService;
  let prisma: PrismaService;

  const mockPrismaService = {
    pet: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockRoomsService = {
    ensureMembership: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RoomsService,
          useValue: mockRoomsService,
        },
      ],
    }).compile();

    service = module.get<PetService>(PetService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 11: Feed operation increases energy by fixed amount', () => {
    /**
     * **Validates: Requirements 6.3**
     * 
     * For any initial pet energy value E where E ≤ 80, calling the feed operation 
     * SHALL increase energy to E + 20. For E > 80, energy SHALL be capped at 100.
     */
    it('should increase energy by 20, capped at 100, for any initial energy value', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100 }), // Generate random initial energy 0-100
          async (initialEnergy) => {
            // Arrange: Create a mock pet with the generated initial energy
            const mockPet: Pet = {
              id: 'test-pet-id',
              roomId: 'test-room-id',
              petType: 'cat',
              name: 'Test Pet',
              mood: 50,
              energy: initialEnergy,
              level: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // Calculate expected energy: add 20, cap at 100
            const expectedEnergy = Math.min(initialEnergy + 20, 100);
            const expectedEnergyGained = expectedEnergy - initialEnergy;

            const updatedPet: Pet = {
              ...mockPet,
              energy: expectedEnergy,
            };

            // Mock Prisma calls
            mockPrismaService.pet.findUnique.mockResolvedValue(mockPet);
            mockPrismaService.pet.update.mockResolvedValue(updatedPet);

            // Act: Call feedPet
            const result = await service.feedPet('test-room-id');

            // Assert: Verify the energy calculation
            expect(result.pet.energy).toBe(expectedEnergy);
            expect(result.energyGained).toBe(expectedEnergyGained);

            // Verify the update was called with correct energy value
            expect(prisma.pet.update).toHaveBeenCalledWith({
              where: { roomId: 'test-room-id' },
              data: { energy: expectedEnergy },
            });

            // Additional property checks
            if (initialEnergy <= 80) {
              // For E ≤ 80, energy should increase by exactly 20
              expect(result.pet.energy).toBe(initialEnergy + 20);
              expect(result.energyGained).toBe(20);
            } else {
              // For E > 80, energy should be capped at 100
              expect(result.pet.energy).toBe(100);
              expect(result.energyGained).toBe(100 - initialEnergy);
            }

            // Energy should never exceed 100
            expect(result.pet.energy).toBeLessThanOrEqual(100);
            
            // Energy should never decrease
            expect(result.pet.energy).toBeGreaterThanOrEqual(initialEnergy);
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      );
    });
  });

  // Feature: ai-pet-integration, Property 4: Energy threshold triggers Hungry state
  describe('Property 4: Energy threshold triggers Hungry state', () => {
    /**
     * **Validates: Requirements 2.5**
     * 
     * For any pet energy value below 30, the Pet_State_Machine SHALL transition to the Hungry state.
     * 
     * Note: Since PetStateMachine doesn't directly handle energy values, this test validates
     * the business logic in PetService.calculateHungerState that determines when to trigger
     * the Hungry state based on energy levels.
     */
    it('should return true (hungry) for any energy value below 30, false otherwise', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // Generate random energy values 0-100
          (energy) => {
            // Access the private method via type assertion for testing
            const calculateHungerState = (service as any).calculateHungerState.bind(service);
            
            // Act: Call calculateHungerState
            const isHungry = calculateHungerState(energy);
            
            // Assert: Verify the hunger state logic
            if (energy < 30) {
              // Energy below 30 should trigger hungry state
              expect(isHungry).toBe(true);
            } else {
              // Energy >= 30 should not trigger hungry state
              expect(isHungry).toBe(false);
            }
            
            // Additional property checks
            // The threshold is exactly at 30
            if (energy === 29) {
              expect(isHungry).toBe(true);
            }
            if (energy === 30) {
              expect(isHungry).toBe(false);
            }
            
            // Boundary verification
            expect(isHungry).toBe(energy < 30);
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      );
    });
  });
});
